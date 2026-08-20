import { open, readFile } from "node:fs/promises";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  assertCompleteRegisteredToolNames,
  createLocalToolPolicy,
  policyCatalogHash,
  type LocalToolPolicyManifest,
} from "../policy/local-tool-policy.js";
import {
  parseAndVerifySignedPolicyBundle,
  type ExpectedPolicyBinding,
  type SignedPolicyBundle,
} from "../policy/signed-policy.js";

const LOCAL_TOOL_COUNT = 152;
const PROHIBITED_TOOL = "send_code_to_revit";
const CLOUD_TOOLS = ["query_stored_data", "store_project_data", "store_room_data"] as const;

const policyEntrySchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{1,127}$/),
  mutationClass: z.enum(["read", "mutation", "dangerous"]),
  retryPolicy: z.enum(["read_only", "never"]),
  timeoutMs: z.number().int().min(1_000).max(600_000),
  createdIdsRequired: z.boolean(),
  sessionTagSupported: z.boolean(),
  automaticRollbackAllowed: z.literal(false),
  maxArgsBytes: z.number().int().positive().max(8 * 1024 * 1024),
  maxResultBytes: z.number().int().positive().max(8 * 1024 * 1024),
}).strict();

const manifestSchema = z.object({
  protocolVersion: z.literal(2),
  catalogVersion: z.string().min(1).max(64),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  localToolCount: z.literal(LOCAL_TOOL_COUNT),
  excludedCloudTools: z.array(z.string()).length(CLOUD_TOOLS.length),
  prohibitedLlmTools: z.tuple([z.literal(PROHIBITED_TOOL)]),
  tools: z.array(policyEntrySchema).length(LOCAL_TOOL_COUNT),
}).strict();

export type LocalGatewayStartupErrorCode =
  | "INVALID_MANIFEST"
  | "CATALOG_HASH_MISMATCH"
  | "MODULE_IMPORT_FAILED"
  | "REGISTRATION_DRIFT"
  | "SCHEMA_DRIFT"
  | "POLICY_BINDING_MISMATCH"
  | "POLICY_READ_FAILED"
  | "POLICY_VERIFICATION_FAILED";

export class LocalGatewayStartupError extends Error {
  constructor(public readonly code: LocalGatewayStartupErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LocalGatewayStartupError";
  }
}

export type LocalToolModuleImporter = (name: string) => Promise<unknown>;

export type LoadedLocalTool = {
  name: string;
  description: string;
  inputShape: ZodRawShape;
  inputSchema: z.ZodObject<ZodRawShape>;
  inputJsonSchema: Record<string, unknown>;
};

export type LocalGatewayCatalog = {
  policy: ReturnType<typeof createLocalToolPolicy>;
  registeredTools: ReadonlyMap<string, LoadedLocalTool>;
  llmTools: ReadonlyMap<string, LoadedLocalTool>;
  binding?: ExpectedPolicyBinding;
};

type LoadCatalogOptions = {
  manifest: unknown;
  expectedCatalogHash: string;
  importModule?: LocalToolModuleImporter;
  enabledToolNames?: readonly string[];
  binding?: ExpectedPolicyBinding;
};

type MaterializeVerifiedCanaryOptions = {
  bundle: SignedPolicyBundle;
  expectedBinding: ExpectedPolicyBinding;
  importModule?: LocalToolModuleImporter;
};

function startupError(code: LocalGatewayStartupErrorCode, message: string, cause?: unknown): LocalGatewayStartupError {
  return new LocalGatewayStartupError(code, message, cause === undefined ? undefined : { cause });
}

function isZodType(value: unknown): value is ZodTypeAny {
  return Boolean(value) && typeof value === "object" && typeof (value as ZodTypeAny).safeParse === "function";
}

function validateManifest(value: unknown, expectedCatalogHash: string): LocalToolPolicyManifest {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) throw startupError("INVALID_MANIFEST", "Local tool policy manifest failed strict validation");
  const manifest = parsed.data as LocalToolPolicyManifest;
  const excluded = [...manifest.excludedCloudTools].sort();
  if (JSON.stringify(excluded) !== JSON.stringify([...CLOUD_TOOLS].sort())) {
    throw startupError("INVALID_MANIFEST", "Local tool policy cloud exclusions differ from the authoritative set");
  }
  if (!/^[a-f0-9]{64}$/.test(expectedCatalogHash) || manifest.catalogHash !== expectedCatalogHash) {
    throw startupError("CATALOG_HASH_MISMATCH", "Manifest hash does not match trusted broker configuration");
  }
  if (manifest.catalogHash !== policyCatalogHash(manifest.tools)) {
    throw startupError("INVALID_MANIFEST", "Manifest hash does not match policy content");
  }
  const names = manifest.tools.map((tool) => tool.name);
  if (new Set(names).size !== LOCAL_TOOL_COUNT) throw startupError("INVALID_MANIFEST", "Local policy contains duplicate tools");
  if (CLOUD_TOOLS.some((name) => names.includes(name))) throw startupError("INVALID_MANIFEST", "Cloud tool entered local policy");
  if (names.filter((name) => name === PROHIBITED_TOOL).length !== 1) {
    throw startupError("INVALID_MANIFEST", `${PROHIBITED_TOOL} must occur exactly once in the policy catalog`);
  }
  try {
    createLocalToolPolicy(manifest);
  } catch (error) {
    throw startupError("INVALID_MANIFEST", "Local policy invariants failed", error);
  }
  return manifest;
}

function defaultModuleImporter(name: string): Promise<unknown> {
  return import(new URL(`../tools/${name}.js`, import.meta.url).href) as Promise<unknown>;
}

export async function loadLocalGatewayCatalog(options: LoadCatalogOptions): Promise<LocalGatewayCatalog> {
  const manifest = validateManifest(options.manifest, options.expectedCatalogHash);
  const policy = createLocalToolPolicy(manifest);
  const importModule = options.importModule ?? defaultModuleImporter;
  const registeredTools = new Map<string, LoadedLocalTool>();

  const llmPolicies = options.enabledToolNames === undefined
    ? manifest.tools.filter((tool) => tool.name !== PROHIBITED_TOOL)
    : options.enabledToolNames.map((name) => {
      const definition = policy.byName.get(name);
      if (!definition || name === PROHIBITED_TOOL) throw startupError("REGISTRATION_DRIFT", `Profile enabled an unavailable tool: ${name}`);
      return definition;
    });
  for (const expected of llmPolicies) {
    let moduleValue: unknown;
    try {
      moduleValue = await importModule(expected.name);
    } catch (error) {
      throw startupError("MODULE_IMPORT_FAILED", `Failed to import expected local tool module: ${expected.name}`, error);
    }
    if (!moduleValue || typeof moduleValue !== "object") {
      throw startupError("REGISTRATION_DRIFT", `${expected.name}: module has no registration export`);
    }
    const registrations = Object.entries(moduleValue)
      .filter(([name, value]) => name.startsWith("register") && typeof value === "function");
    if (registrations.length !== 1) {
      throw startupError("REGISTRATION_DRIFT", `${expected.name}: expected exactly one registration export`);
    }

    const captured: unknown[][] = [];
    const captureServer = { tool: (...args: unknown[]) => { captured.push(args); return {}; } };
    try {
      await (registrations[0][1] as (server: unknown) => unknown)(captureServer);
    } catch (error) {
      throw startupError("REGISTRATION_DRIFT", `${expected.name}: registration threw`, error);
    }
    if (captured.length !== 1 || captured[0][0] !== expected.name || registeredTools.has(expected.name)) {
      throw startupError("REGISTRATION_DRIFT", `${expected.name}: registered name/count differs from manifest`);
    }
    const [, description, shape] = captured[0];
    if (typeof description !== "string" || !shape || typeof shape !== "object" || Array.isArray(shape)) {
      throw startupError("SCHEMA_DRIFT", `${expected.name}: registration metadata or schema is malformed`);
    }
    const inputShape = shape as Record<string, unknown>;
    if (!Object.values(inputShape).every(isZodType)) {
      throw startupError("SCHEMA_DRIFT", `${expected.name}: every input field must be a Zod schema`);
    }
    const inputSchema = z.object(inputShape as ZodRawShape).strict();
    registeredTools.set(expected.name, {
      name: expected.name,
      description,
      inputShape: inputShape as ZodRawShape,
      inputSchema,
      inputJsonSchema: zodToJsonSchema(inputSchema, { strictUnions: true }) as Record<string, unknown>,
    });
  }

  if (options.enabledToolNames === undefined) {
    if (registeredTools.size !== LOCAL_TOOL_COUNT - 1) {
      throw startupError("REGISTRATION_DRIFT", "Local LLM profile must contain exactly 151 tools");
    }
    try {
      assertCompleteRegisteredToolNames(policy, [...registeredTools.keys()]);
    } catch (error) {
      throw startupError("REGISTRATION_DRIFT", "Registered tools do not exactly match the verified local LLM profile", error);
    }
  } else if (registeredTools.size !== options.enabledToolNames.length) {
    throw startupError("REGISTRATION_DRIFT", "Registered tools do not exactly match the verified signed profile");
  }
  const llmTools = new Map(registeredTools);
  return { policy, registeredTools, llmTools, binding: options.binding };
}

export async function materializeVerifiedCanaryCatalog(options: MaterializeVerifiedCanaryOptions): Promise<LocalGatewayCatalog> {
  const profile = options.bundle.policy.profiles[0];
  const actual: ExpectedPolicyBinding = {
    policyHash: options.bundle.policyHash,
    policyReleaseId: options.bundle.policyReleaseId,
    profileId: profile.id,
    catalogHash: options.bundle.policy.catalog.manifest.catalogHash,
  };
  if (Object.keys(actual).some((field) => actual[field as keyof ExpectedPolicyBinding] !== options.expectedBinding[field as keyof ExpectedPolicyBinding])) {
    throw startupError("POLICY_BINDING_MISMATCH", "Signed policy does not match the broker expected binding");
  }
  return loadLocalGatewayCatalog({
    manifest: options.bundle.policy.catalog.manifest,
    expectedCatalogHash: options.expectedBinding.catalogHash,
    importModule: options.importModule,
    enabledToolNames: profile.enabledTools,
    binding: actual,
  });
}

async function boundedReadUtf8(path: string | URL, maximumBytes: number): Promise<string> {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximumBytes) throw new Error("Policy file exceeds its byte limit");
    const chunks: Buffer[] = [];
    let total = 0;
    while (total <= maximumBytes) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maximumBytes + 1 - total));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (bytesRead === 0) return Buffer.concat(chunks, total).toString("utf8");
      chunks.push(chunk.subarray(0, bytesRead));
      total += bytesRead;
    }
    throw new Error("Policy file exceeds its byte limit");
  } finally {
    await handle.close();
  }
}

export async function loadSignedLocalGatewayCatalogFile(
  policyBundlePath: string,
  expectedBinding: ExpectedPolicyBinding,
  now = new Date(),
): Promise<LocalGatewayCatalog> {
  let bundleJson: string;
  let trustRootJson: string;
  try {
    [bundleJson, trustRootJson] = await Promise.all([
      boundedReadUtf8(policyBundlePath, 8 * 1024 * 1024),
      boundedReadUtf8(new URL("../../contracts/desktop-bridge/v2/trust-root.v1.json", import.meta.url), 64 * 1024),
    ]);
  } catch (error) {
    throw startupError("POLICY_READ_FAILED", "Unable to bounded-read signed policy or pinned trust root", error);
  }
  let bundle: SignedPolicyBundle;
  try {
    bundle = parseAndVerifySignedPolicyBundle(bundleJson, trustRootJson, now);
  } catch (error) {
    throw startupError("POLICY_VERIFICATION_FAILED", "Signed policy verification failed", error);
  }
  return materializeVerifiedCanaryCatalog({ bundle, expectedBinding });
}

export async function loadLocalGatewayCatalogFile(
  manifestPath: string,
  expectedCatalogHash: string,
): Promise<LocalGatewayCatalog> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  } catch (error) {
    throw startupError("INVALID_MANIFEST", "Unable to read local tool policy manifest", error);
  }
  return loadLocalGatewayCatalog({ manifest, expectedCatalogHash });
}
