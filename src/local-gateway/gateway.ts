import {
  LocalToolPolicyError,
  authorizeLocalToolCall,
  normalizeLocalToolResult,
} from "../policy/local-tool-policy.js";
import type { LocalGatewayCatalog } from "./manifest-loader.js";

const ERROR_MESSAGE = "Local gateway request rejected";
const CONTEXT_FIELDS = [
  "runtimeId",
  "desktopDeviceId",
  "jobId",
  "connectionId",
  "revitInstanceId",
  "documentFingerprint",
  "catalogHash",
  "policyHash",
  "policyReleaseId",
  "policyProfileId",
  "routeGeneration",
  "leaseEpoch",
] as const;

export type TrustedRuntimeContext = {
  runtimeId: string;
  desktopDeviceId: string;
  jobId: string;
  connectionId: string;
  revitInstanceId: string;
  documentFingerprint: string;
  catalogHash: string;
  policyHash: string;
  policyReleaseId: string;
  policyProfileId: string;
  routeGeneration: number;
  leaseEpoch: number;
};

export type LocalGatewayDispatcher = (
  tool: string,
  args: Record<string, unknown>,
  context: TrustedRuntimeContext,
) => Promise<unknown>;

type GatewayOptions = {
  catalog: LocalGatewayCatalog;
  resolveTrustedSession: (connectionId: string) => TrustedRuntimeContext | undefined;
  readEnabled?: boolean;
  dispatcher?: LocalGatewayDispatcher;
  maxQueueDepth?: number;
};

type JsonRpcId = string | number | null;
type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data: { code: string; retryable: false } };
};

class GatewayRejection extends Error {
  constructor(public readonly code: string, public readonly rpcCode = -32000) {
    super(ERROR_MESSAGE);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function reject(code: string, rpcCode = -32000): never {
  throw new GatewayRejection(code, rpcCode);
}

function errorResponse(id: JsonRpcId, error: unknown): JsonRpcResponse {
  const rejection = error instanceof GatewayRejection
    ? error
    : error instanceof LocalToolPolicyError
      ? new GatewayRejection(error.code)
      : new GatewayRejection("INTERNAL_ERROR");
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: rejection.rpcCode,
      message: ERROR_MESSAGE,
      data: { code: rejection.code, retryable: false },
    },
  };
}

function parseRequest(value: unknown): { id: JsonRpcId; method: "tools/list" | "tools/call"; params: Record<string, unknown> } {
  if (!isRecord(value)) reject("INVALID_REQUEST", -32600);
  const id = value.id;
  if (!(id === null || typeof id === "string" || (typeof id === "number" && Number.isFinite(id)))) {
    reject("INVALID_REQUEST", -32600);
  }
  if (value.jsonrpc !== "2.0" || (value.method !== "tools/list" && value.method !== "tools/call")) {
    reject(value.jsonrpc === "2.0" ? "METHOD_NOT_FOUND" : "INVALID_REQUEST", value.jsonrpc === "2.0" ? -32601 : -32600);
  }
  if (value.params !== undefined && !isRecord(value.params)) reject("INVALID_REQUEST", -32600);
  return { id, method: value.method, params: (value.params ?? {}) as Record<string, unknown> };
}

function claimedContext(meta: unknown): TrustedRuntimeContext {
  if (!isRecord(meta)) reject("MISSING_CONTEXT");
  const context = {} as TrustedRuntimeContext;
  for (const field of CONTEXT_FIELDS) {
    const value = meta[field];
    if (field === "routeGeneration" || field === "leaseEpoch") {
      if (!Number.isInteger(value) || (value as number) < 1) reject("MISSING_CONTEXT");
    } else if (typeof value !== "string" || value.length === 0) {
      reject("MISSING_CONTEXT");
    }
    Object.assign(context, { [field]: value });
  }
  return context;
}

function contextsMatch(claimed: TrustedRuntimeContext, trusted: TrustedRuntimeContext | undefined): trusted is TrustedRuntimeContext {
  if (!trusted) return false;
  return CONTEXT_FIELDS.every((field) => claimed[field] === trusted[field]);
}

function hasSemanticPluginError(value: unknown, depth = 0): boolean {
  if (depth > 5 || value == null) return false;
  if (Array.isArray(value)) return value.some((item) => hasSemanticPluginError(item, depth + 1));
  if (!isRecord(value)) return false;
  if (value.success === false || value.Success === false || value.isError === true || value.IsError === true) return true;
  if ((typeof value.error === "string" && value.error.trim()) || (typeof value.Error === "string" && value.Error.trim())) return true;
  return ["result", "Result", "content", "Content", "response", "Response"]
    .some((key) => key in value && hasSemanticPluginError(value[key], depth + 1));
}

class PerInstanceQueue {
  private readonly states = new Map<string, { tail: Promise<void>; depth: number }>();

  constructor(private readonly maxDepth: number) {}

  run<T>(instanceId: string, task: () => { response: Promise<T>; settled: Promise<void> }): Promise<T> {
    let state = this.states.get(instanceId);
    if (!state) {
      state = { tail: Promise.resolve(), depth: 0 };
      this.states.set(instanceId, state);
    }
    if (state.depth >= this.maxDepth) reject("QUEUE_FULL");
    state.depth += 1;
    const previous = state.tail;
    let resolveResult!: (value: T | PromiseLike<T>) => void;
    let rejectResult!: (reason?: unknown) => void;
    const result = new Promise<T>((resolve, rejectPromise) => {
      resolveResult = resolve;
      rejectResult = rejectPromise;
    });
    const run = async () => {
      try {
        const operation = task();
        operation.response.then(resolveResult, rejectResult);
        await operation.settled;
      } catch (error) {
        rejectResult(error);
      } finally {
        state!.depth -= 1;
        if (state!.depth === 0) this.states.delete(instanceId);
      }
    };
    state.tail = previous.then(run, run);
    return result;
  }
}

function timeoutResponse<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, rejectPromise) => {
    const timeout = setTimeout(() => rejectPromise(new GatewayRejection("DISPATCH_TIMEOUT")), timeoutMs);
    operation.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      () => { clearTimeout(timeout); rejectPromise(new GatewayRejection("DISPATCH_FAILED")); },
    );
  });
}

export function createLocalGateway(options: GatewayOptions) {
  const readEnabled = options.readEnabled === true;
  let resolveTrustedSession = options.resolveTrustedSession;
  const queue = new PerInstanceQueue(options.maxQueueDepth ?? 32);

  async function handle(requestValue: unknown): Promise<JsonRpcResponse> {
    let id: JsonRpcId = null;
    try {
      const request = parseRequest(requestValue);
      id = request.id;
      if (request.method === "tools/list") {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: [...options.catalog.llmTools.values()]
              .sort((left, right) => left.name.localeCompare(right.name))
              .map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputJsonSchema,
              })),
          },
        };
      }

      const { name, arguments: rawArgs, _meta: meta } = request.params;
      if (typeof name !== "string") reject("INVALID_REQUEST", -32602);
      if (!isRecord(rawArgs)) reject("INVALID_ARGUMENTS", -32602);

      const claimed = claimedContext(meta);
      const trusted = resolveTrustedSession(claimed.connectionId);
      if (!contextsMatch(claimed, trusted)) reject("CONTEXT_MISMATCH");
      if (trusted.catalogHash !== options.catalog.policy.manifest.catalogHash) reject("CATALOG_DRIFT");
      if (options.catalog.binding && (
        trusted.policyHash !== options.catalog.binding.policyHash ||
        trusted.policyReleaseId !== options.catalog.binding.policyReleaseId ||
        trusted.policyProfileId !== options.catalog.binding.profileId ||
        trusted.catalogHash !== options.catalog.binding.catalogHash
      )) reject("POLICY_BINDING_MISMATCH");
      if (!options.catalog.llmTools.has(name)) reject("TOOL_NOT_PROFILED");
      const authorized = authorizeLocalToolCall(options.catalog.policy, {
        tool: name,
        args: rawArgs,
        context: trusted,
        localReadOnlyEnabled: readEnabled,
        retryRequested: isRecord(meta) && meta.retryRequested === true,
      });
      const registered = options.catalog.llmTools.get(authorized.tool);
      if (!registered) reject("CATALOG_DRIFT");
      const parsedArgs = registered.inputSchema.safeParse(authorized.args);
      if (!parsedArgs.success) reject("INVALID_ARGUMENTS", -32602);
      if (!options.dispatcher) reject("DISPATCH_DISABLED");

      const value = await queue.run(trusted.revitInstanceId, () => {
        const current = resolveTrustedSession(claimed.connectionId);
        if (!contextsMatch(claimed, current)) {
          const rejected = Promise.reject<unknown>(new GatewayRejection("CONTEXT_MISMATCH"));
          rejected.catch(() => undefined);
          return { response: rejected, settled: Promise.resolve() };
        }
        const dispatched = options.dispatcher!(authorized.tool, parsedArgs.data, current);
        return {
          response: timeoutResponse(dispatched, authorized.timeoutMs),
          settled: dispatched.then(() => undefined, () => undefined),
        };
      });
      if (hasSemanticPluginError(value)) reject("PLUGIN_ERROR");
      const normalized = normalizeLocalToolResult(name, value, authorized.maxResultBytes);
      if (!normalized.ok) reject(normalized.code);
      return { jsonrpc: "2.0", id, result: normalized.value };
    } catch (error) {
      return errorResponse(id, error);
    }
  }

  return {
    handle,
    setTrustedSessionResolver(resolver: (connectionId: string) => TrustedRuntimeContext | undefined) {
      resolveTrustedSession = resolver;
    },
  };
}
