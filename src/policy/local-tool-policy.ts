import { createHash } from "node:crypto";

export type MutationClass = "read" | "mutation" | "dangerous";
export type RetryPolicy = "read_only" | "never";

export type LocalToolPolicy = {
  name: string;
  mutationClass: MutationClass;
  retryPolicy: RetryPolicy;
  timeoutMs: number;
  createdIdsRequired: boolean;
  sessionTagSupported: boolean;
  automaticRollbackAllowed: false;
  maxArgsBytes: number;
  maxResultBytes: number;
};

export type LocalToolPolicyManifest = {
  protocolVersion: number;
  catalogVersion: string;
  catalogHash: string;
  localToolCount: number;
  excludedCloudTools: string[];
  prohibitedLlmTools: string[];
  tools: LocalToolPolicy[];
};

export type LocalToolContext = {
  runtimeId: string;
  revitInstanceId: string;
  documentFingerprint: string;
};

export type LocalToolCall = {
  tool: string;
  args: unknown;
  context?: Partial<LocalToolContext>;
  localReadOnlyEnabled?: boolean;
  retryRequested?: boolean;
};

export type AuthorizedLocalToolCall = {
  tool: string;
  args: unknown;
  context: LocalToolContext;
  mutationClass: "read";
  timeoutMs: number;
  maxResultBytes: number;
};

export type LocalToolPolicyErrorCode =
  | "INVALID_MANIFEST"
  | "CATALOG_DRIFT"
  | "UNKNOWN_TOOL"
  | "EXCLUDED_TOOL"
  | "PROHIBITED_TOOL"
  | "LOCAL_READ_DISABLED"
  | "LOCAL_MUTATION_DISABLED"
  | "MISSING_CONTEXT"
  | "ARGS_TOO_LARGE"
  | "RETRY_NOT_ALLOWED"
  | "RESULT_TOO_LARGE";

export class LocalToolPolicyError extends Error {
  constructor(public readonly code: LocalToolPolicyErrorCode, message: string) {
    super(message);
    this.name = "LocalToolPolicyError";
  }
}

type NormalizedLocalToolResult =
  | { ok: true; tool: string; value: unknown }
  | { ok: false; tool: string; code: "RESULT_TOO_LARGE"; message: string };

const PROHIBITED_LOCAL_TOOL = "send_code_to_revit";
const SENSITIVE_KEY = /token|secret|password|credential|authorization|cookie|privatekey|apikey|databaseurl|workers?ecret/i;
const PRIVATE_KEY = /^(thought|reasoning|analysis|systemprompt|prompt|rawresponse|rawtoolresult|private)$/i;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function policyCatalogHash(tools: LocalToolPolicy[]): string {
  return createHash("sha256").update(stableStringify(tools), "utf8").digest("hex");
}

function invalidManifest(message: string): never {
  throw new LocalToolPolicyError("INVALID_MANIFEST", message);
}

export function createLocalToolPolicy(manifest: LocalToolPolicyManifest) {
  if (manifest.protocolVersion !== 2) invalidManifest("Local tool policy protocol must be version 2");
  if (manifest.localToolCount !== manifest.tools.length) invalidManifest("Local tool count does not match policy entries");
  if (manifest.catalogHash !== policyCatalogHash(manifest.tools)) invalidManifest("Local tool policy catalog hash does not match policy content");
  if (manifest.prohibitedLlmTools.length !== 1 || manifest.prohibitedLlmTools[0] !== PROHIBITED_LOCAL_TOOL) {
    invalidManifest("Local tool policy prohibited LLM tools differ from the authoritative set");
  }

  const names = new Set<string>();
  for (const tool of manifest.tools) {
    if (names.has(tool.name)) invalidManifest(`Duplicate local tool policy: ${tool.name}`);
    names.add(tool.name);
    if (manifest.excludedCloudTools.includes(tool.name)) invalidManifest(`${tool.name}: cloud-only tool entered local policy`);
    if (tool.name === PROHIBITED_LOCAL_TOOL && tool.mutationClass !== "dangerous") {
      invalidManifest(`${tool.name}: prohibited tool must remain dangerous`);
    }
    if (tool.retryPolicy !== (tool.mutationClass === "read" ? "read_only" : "never")) {
      invalidManifest(`${tool.name}: retry policy does not match mutation class`);
    }
    if (tool.automaticRollbackAllowed !== false || tool.maxArgsBytes <= 0 || tool.maxResultBytes <= 0) {
      invalidManifest(`${tool.name}: unsafe or invalid bounds`);
    }
  }

  return {
    manifest,
    byName: new Map(manifest.tools.map((tool) => [tool.name, tool])),
  };
}

type LocalToolPolicyIndex = ReturnType<typeof createLocalToolPolicy>;

export function validateRegisteredToolNames(policy: LocalToolPolicyIndex, registeredNames: string[]) {
  const seen = new Set<string>();
  for (const name of registeredNames) {
    if (seen.has(name)) throw new LocalToolPolicyError("CATALOG_DRIFT", `Duplicate registered local tool: ${name}`);
    seen.add(name);
    if (policy.manifest.excludedCloudTools.includes(name)) {
      throw new LocalToolPolicyError("EXCLUDED_TOOL", `Cloud-only tool cannot enter the local profile: ${name}`);
    }
    if (!policy.byName.has(name)) {
      throw new LocalToolPolicyError("CATALOG_DRIFT", `Registered tool is absent from the local policy: ${name}`);
    }
    if (name === PROHIBITED_LOCAL_TOOL) {
      throw new LocalToolPolicyError("PROHIBITED_TOOL", `${name} is prohibited from the local LLM profile`);
    }
  }
  return { accepted: [...seen].sort() };
}

export function assertCompleteRegisteredToolNames(policy: LocalToolPolicyIndex, registeredNames: string[]) {
  const { accepted } = validateRegisteredToolNames(policy, registeredNames);
  const expected = policy.manifest.tools
    .map((tool) => tool.name)
    .filter((name) => name !== PROHIBITED_LOCAL_TOOL)
    .sort();
  if (JSON.stringify(accepted) !== JSON.stringify(expected)) {
    throw new LocalToolPolicyError("CATALOG_DRIFT", "Registered local tools do not exactly match the verified policy profile");
  }
  return { accepted };
}

function requireContext(context: Partial<LocalToolContext> | undefined): LocalToolContext {
  if (!context?.runtimeId || !context.revitInstanceId || !context.documentFingerprint) {
    throw new LocalToolPolicyError("MISSING_CONTEXT", "Runtime, Revit instance, and document fingerprint are required");
  }
  return {
    runtimeId: context.runtimeId,
    revitInstanceId: context.revitInstanceId,
    documentFingerprint: context.documentFingerprint,
  };
}

export function authorizeLocalToolCall(policy: LocalToolPolicyIndex, call: LocalToolCall): AuthorizedLocalToolCall {
  const definition = policy.byName.get(call.tool);
  if (!definition) {
    if (policy.manifest.excludedCloudTools.includes(call.tool)) {
      throw new LocalToolPolicyError("EXCLUDED_TOOL", `Cloud-only tool is unavailable locally: ${call.tool}`);
    }
    throw new LocalToolPolicyError("UNKNOWN_TOOL", `Unknown local tool: ${call.tool}`);
  }
  if (call.tool === PROHIBITED_LOCAL_TOOL) {
    throw new LocalToolPolicyError("PROHIBITED_TOOL", `${call.tool} is prohibited from local LLM use`);
  }

  const context = requireContext(call.context);
  const argsBytes = Buffer.byteLength(stableStringify(call.args), "utf8");
  if (argsBytes > definition.maxArgsBytes) {
    throw new LocalToolPolicyError("ARGS_TOO_LARGE", `${call.tool} arguments exceed ${definition.maxArgsBytes} bytes`);
  }
  if (call.retryRequested) {
    throw new LocalToolPolicyError("RETRY_NOT_ALLOWED", "Automatic local tool retries are disabled in Phase 3");
  }
  if (definition.mutationClass !== "read") {
    throw new LocalToolPolicyError("LOCAL_MUTATION_DISABLED", "Local mutation execution remains disabled until later phase gates pass");
  }
  if (!call.localReadOnlyEnabled) {
    throw new LocalToolPolicyError("LOCAL_READ_DISABLED", "Local read-only execution is disabled");
  }

  return {
    tool: call.tool,
    args: call.args,
    context,
    mutationClass: "read",
    timeoutMs: definition.timeoutMs,
    maxResultBytes: definition.maxResultBytes,
  };
}

function redactResult(value: unknown, seen: WeakSet<object>, depth = 0): unknown {
  if (depth > 8) return "[REDACTED_DEPTH]";
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[REDACTED_CYCLE]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactResult(item, seen, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) || PRIVATE_KEY.test(key) ? "[REDACTED]" : redactResult(child, seen, depth + 1);
  }
  return output;
}

export function normalizeLocalToolResult(tool: string, value: unknown, maxResultBytes: number): NormalizedLocalToolResult {
  const redacted = redactResult(value, new WeakSet<object>());
  const bytes = Buffer.byteLength(stableStringify(redacted), "utf8");
  if (bytes > maxResultBytes) {
    return { ok: false, tool, code: "RESULT_TOO_LARGE", message: `${tool} result exceeds ${maxResultBytes} bytes` };
  }
  return { ok: true, tool, value: redacted };
}
