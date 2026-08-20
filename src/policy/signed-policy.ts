import { createHash, createPublicKey, verify } from "node:crypto";
import canonicalizePackage from "canonicalize";
import type { LocalToolPolicyManifest } from "./local-tool-policy.js";

export const CANARY_PROFILE_ID = "local-revit-readonly-v3";
const CLOUD_TOOLS = ["query_stored_data", "store_project_data", "store_room_data"] as const;
const PROHIBITED_LLM_TOOLS = ["send_code_to_revit"] as const;
const canonicalize = canonicalizePackage as unknown as (value: unknown) => string | undefined;

export type ExpectedPolicyBinding = {
  policyHash: string;
  policyReleaseId: string;
  profileId: typeof CANARY_PROFILE_ID;
  catalogHash: string;
};

export type SignedPolicyBundle = {
  schema: "datumm.revit.policy-bundle/v1";
  protocolVersion: 2;
  issuer: "https://www.datumm.ai";
  algorithm: "Ed25519";
  kid: string;
  policyReleaseId: string;
  issuedAt: string;
  notBefore: string;
  expiresAt: string;
  policyHash: string;
  policy: {
    provenance: Record<string, unknown>;
    catalog: {
      sourceToolCount: 155;
      localToolCount: 152;
      excludedCloudTools: string[];
      manifest: LocalToolPolicyManifest;
    };
    profiles: [{
      id: typeof CANARY_PROFILE_ID;
      enabledTools: ["get_levels_list"];
      llmVisibleTools: ["get_levels_list"];
      deniedTools: ["send_code_to_revit"];
      maxResultBytes: 65_536;
      tools: Record<string, unknown>;
    }];
  };
  signature: string;
};

export type SignedPolicyErrorCode =
  | "INVALID_JSON"
  | "DUPLICATE_JSON_KEY"
  | "INVALID_BUNDLE"
  | "INVALID_TRUST_ROOT"
  | "POLICY_NOT_YET_VALID"
  | "POLICY_EXPIRED"
  | "UNKNOWN_KEY"
  | "KEY_NOT_VALID"
  | "POLICY_HASH_MISMATCH"
  | "INVALID_SIGNATURE";

export class SignedPolicyError extends Error {
  constructor(public readonly code: SignedPolicyErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SignedPolicyError";
  }
}

type TrustKey = { kid: string; publicKeySpkiBase64: string; notBefore: string; expiresAt?: string };
type TrustRoot = {
  $schema: string;
  schema: string;
  issuer: string;
  algorithm: string;
  keys: TrustKey[];
};

function fail(code: SignedPolicyErrorCode, message: string, cause?: unknown): never {
  throw new SignedPolicyError(code, message, cause === undefined ? undefined : { cause });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}

function validString(value: unknown, min = 1, max = 256): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function validIdentifier(value: unknown, min = 8): value is string {
  return validString(value, min, 128) && /^[A-Za-z0-9._-]+$/.test(value);
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function timestamp(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : undefined;
}

function canonicalBytes(value: unknown): Buffer {
  const encoded = canonicalize(value);
  if (typeof encoded !== "string") fail("INVALID_BUNDLE", "Policy data cannot be RFC8785 canonicalized");
  return Buffer.from(encoded, "utf8");
}

export function policyBundleHash(policy: unknown): string {
  return createHash("sha256").update(canonicalBytes(policy)).digest("hex");
}

function signingProjection(bundle: Record<string, unknown>): Record<string, unknown> {
  const { signature: _signature, ...unsigned } = bundle;
  return unsigned;
}

export function policyBundleSigningBytes(bundle: Record<string, unknown>): Buffer {
  return canonicalBytes(signingProjection(bundle));
}

function assertNoDuplicateJsonKeys(input: string): void {
  let index = 0;
  const whitespace = () => { while (/\s/.test(input[index] ?? "")) index += 1; };
  const stringValue = (): string => {
    const start = index;
    if (input[index] !== '"') fail("INVALID_JSON", "Invalid JSON string");
    index += 1;
    while (index < input.length) {
      if (input[index] === "\\") { index += 2; continue; }
      if (input[index] === '"') {
        index += 1;
        try { return JSON.parse(input.slice(start, index)) as string; } catch (error) { fail("INVALID_JSON", "Invalid JSON string", error); }
      }
      if (input.charCodeAt(index) < 0x20) fail("INVALID_JSON", "Invalid JSON control character");
      index += 1;
    }
    fail("INVALID_JSON", "Unterminated JSON string");
  };
  const value = (): void => {
    whitespace();
    if (input[index] === "{") return object();
    if (input[index] === "[") return array();
    if (input[index] === '"') { stringValue(); return; }
    const literal = /(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
    literal.lastIndex = index;
    const match = literal.exec(input);
    if (!match) fail("INVALID_JSON", "Invalid JSON value");
    index += match[0].length;
  };
  const object = (): void => {
    index += 1; whitespace();
    const keys = new Set<string>();
    if (input[index] === "}") { index += 1; return; }
    while (true) {
      whitespace();
      const key = stringValue();
      if (keys.has(key)) fail("DUPLICATE_JSON_KEY", "JSON contains duplicate key");
      keys.add(key); whitespace();
      if (input[index] !== ":") fail("INVALID_JSON", "Invalid JSON object");
      index += 1; value(); whitespace();
      if (input[index] === "}") { index += 1; return; }
      if (input[index] !== ",") fail("INVALID_JSON", "Invalid JSON object");
      index += 1;
    }
  };
  const array = (): void => {
    index += 1; whitespace();
    if (input[index] === "]") { index += 1; return; }
    while (true) {
      value(); whitespace();
      if (input[index] === "]") { index += 1; return; }
      if (input[index] !== ",") fail("INVALID_JSON", "Invalid JSON array");
      index += 1;
    }
  };
  value(); whitespace();
  if (index !== input.length) fail("INVALID_JSON", "Invalid trailing JSON content");
}

function parseJson(input: string): unknown {
  assertNoDuplicateJsonKeys(input);
  try { return JSON.parse(input) as unknown; } catch (error) { fail("INVALID_JSON", "Invalid JSON", error); }
}

function strictTrustRoot(value: unknown): value is TrustRoot {
  if (!isRecord(value) || !exactKeys(value, ["$schema", "schema", "issuer", "algorithm", "keys"]) ||
      value.$schema !== "https://contracts.datumm.com/desktop-bridge/v2/trust-root.json" ||
      value.schema !== "datumm.revit.trust-root/v1" || value.issuer !== "https://www.datumm.ai" ||
      value.algorithm !== "Ed25519" || !Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 8) return false;
  const kids = new Set<string>();
  return value.keys.every((candidate) => {
    if (!isRecord(candidate) || (!exactKeys(candidate, ["kid", "publicKeySpkiBase64", "notBefore"]) &&
        !exactKeys(candidate, ["kid", "publicKeySpkiBase64", "notBefore", "expiresAt"])) ||
        !validIdentifier(candidate.kid) || kids.has(candidate.kid) ||
        typeof candidate.publicKeySpkiBase64 !== "string" || !/^[A-Za-z0-9+/]{40,256}={0,2}$/.test(candidate.publicKeySpkiBase64)) return false;
    const starts = timestamp(candidate.notBefore);
    const expires = candidate.expiresAt === undefined ? undefined : timestamp(candidate.expiresAt);
    if (starts === undefined || (candidate.expiresAt !== undefined && expires === undefined)) return false;
    try {
      const key = createPublicKey({ key: Buffer.from(candidate.publicKeySpkiBase64, "base64"), format: "der", type: "spki" });
      if (key.asymmetricKeyType !== "ed25519") return false;
    } catch { return false; }
    kids.add(candidate.kid);
    return true;
  });
}

function strictManifest(value: unknown): value is LocalToolPolicyManifest {
  if (!isRecord(value) || !exactKeys(value, ["protocolVersion", "catalogVersion", "catalogHash", "localToolCount", "excludedCloudTools", "prohibitedLlmTools", "tools"]) ||
      value.protocolVersion !== 2 || !validString(value.catalogVersion, 1, 64) || !validHash(value.catalogHash) ||
      value.localToolCount !== 152 || JSON.stringify(value.excludedCloudTools) !== JSON.stringify(CLOUD_TOOLS) ||
      JSON.stringify(value.prohibitedLlmTools) !== JSON.stringify(PROHIBITED_LLM_TOOLS) ||
      !Array.isArray(value.tools) || value.tools.length !== 152) return false;
  const names = new Set<string>();
  for (const tool of value.tools) {
    if (!isRecord(tool) || !exactKeys(tool, ["name", "mutationClass", "retryPolicy", "timeoutMs", "createdIdsRequired", "sessionTagSupported", "automaticRollbackAllowed", "maxArgsBytes", "maxResultBytes"]) ||
        typeof tool.name !== "string" || !/^[a-z][a-z0-9_]{1,127}$/.test(tool.name) || names.has(tool.name) ||
        !["read", "mutation", "dangerous"].includes(String(tool.mutationClass)) || !["read_only", "never"].includes(String(tool.retryPolicy)) ||
        tool.retryPolicy !== (tool.mutationClass === "read" ? "read_only" : "never") ||
        !Number.isInteger(tool.timeoutMs) || (tool.timeoutMs as number) < 1_000 || (tool.timeoutMs as number) > 600_000 ||
        typeof tool.createdIdsRequired !== "boolean" || typeof tool.sessionTagSupported !== "boolean" || tool.automaticRollbackAllowed !== false ||
        !Number.isInteger(tool.maxArgsBytes) || (tool.maxArgsBytes as number) < 1 || (tool.maxArgsBytes as number) > 8_388_608 ||
        !Number.isInteger(tool.maxResultBytes) || (tool.maxResultBytes as number) < 1 || (tool.maxResultBytes as number) > 8_388_608) return false;
    names.add(tool.name);
  }
  return names.has("get_levels_list") && names.has("send_code_to_revit") && !CLOUD_TOOLS.some((name) => names.has(name));
}

function strictPolicy(value: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, ["provenance", "catalog", "profiles"])) return false;
  const { provenance, catalog, profiles } = value;
  if (!isRecord(provenance) || !exactKeys(provenance, ["sourceRepository", "commit", "treeHash", "generator", "generatorVersion"]) ||
      !validString(provenance.sourceRepository) || typeof provenance.commit !== "string" || !/^[a-f0-9]{40}$/.test(provenance.commit) ||
      typeof provenance.treeHash !== "string" || !/^[a-f0-9]{40,64}$/.test(provenance.treeHash) ||
      !validString(provenance.generator, 1, 128) || !validString(provenance.generatorVersion, 1, 64)) return false;
  if (!isRecord(catalog) || !exactKeys(catalog, ["sourceToolCount", "localToolCount", "excludedCloudTools", "manifest"]) ||
      catalog.sourceToolCount !== 155 || catalog.localToolCount !== 152 ||
      JSON.stringify(catalog.excludedCloudTools) !== JSON.stringify(CLOUD_TOOLS) || !strictManifest(catalog.manifest)) return false;
  if (!Array.isArray(profiles) || profiles.length !== 1 || !isRecord(profiles[0])) return false;
  const profile = profiles[0];
  if (!exactKeys(profile, ["id", "enabledTools", "llmVisibleTools", "deniedTools", "maxResultBytes", "tools"]) ||
      profile.id !== CANARY_PROFILE_ID || JSON.stringify(profile.enabledTools) !== JSON.stringify(["get_levels_list"]) ||
      JSON.stringify(profile.llmVisibleTools) !== JSON.stringify(["get_levels_list"]) ||
      JSON.stringify(profile.deniedTools) !== JSON.stringify(["send_code_to_revit"]) || profile.maxResultBytes !== 65_536 ||
      !isRecord(profile.tools) || !exactKeys(profile.tools, ["get_levels_list"]) || !isRecord(profile.tools.get_levels_list)) return false;
  const levels = profile.tools.get_levels_list;
  return exactKeys(levels, ["mutationClass", "retryPolicy", "timeoutMs", "input", "maxLevels", "resultUnit"]) &&
    levels.mutationClass === "read" && levels.retryPolicy === "never" && levels.timeoutMs === 30_000 &&
    levels.maxLevels === 256 && levels.resultUnit === "mm" && isRecord(levels.input) &&
    exactKeys(levels.input, ["includeNonStructural", "sortByElevation"]) &&
    levels.input.includeNonStructural === true && levels.input.sortByElevation === true;
}

function strictUnsignedBundle(value: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, ["schema", "protocolVersion", "issuer", "algorithm", "kid", "policyReleaseId", "issuedAt", "notBefore", "expiresAt", "policyHash", "policy"])) return false;
  const issued = timestamp(value.issuedAt);
  const starts = timestamp(value.notBefore);
  const expires = timestamp(value.expiresAt);
  return value.schema === "datumm.revit.policy-bundle/v1" && value.protocolVersion === 2 &&
    value.issuer === "https://www.datumm.ai" && value.algorithm === "Ed25519" && validIdentifier(value.kid) &&
    validIdentifier(value.policyReleaseId, 16) && issued !== undefined && starts !== undefined && expires !== undefined &&
    validHash(value.policyHash) && strictPolicy(value.policy);
}

function strictBundle(value: unknown): value is SignedPolicyBundle {
  return isRecord(value) &&
    exactKeys(value, ["schema", "protocolVersion", "issuer", "algorithm", "kid", "policyReleaseId", "issuedAt", "notBefore", "expiresAt", "policyHash", "policy", "signature"]) &&
    typeof value.signature === "string" && /^[A-Za-z0-9_-]{86}$/.test(value.signature) &&
    strictUnsignedBundle(signingProjection(value));
}

export function assertUnsignedPolicyBundle(value: unknown): void {
  if (!strictUnsignedBundle(value)) fail("INVALID_BUNDLE", "Policy bundle policy is not a strict closed read-only canary");
}

export function parseSignedPolicyBundleJson(bundleJson: string): SignedPolicyBundle {
  const value = parseJson(bundleJson);
  if (!strictBundle(value)) fail("INVALID_BUNDLE", "Policy bundle failed strict closed-canary validation");
  return value;
}

export function parseAndVerifySignedPolicyBundle(bundleJson: string, trustRootJson: string, now = new Date()): SignedPolicyBundle {
  const bundleValue = parseSignedPolicyBundleJson(bundleJson);
  const trustValue = parseJson(trustRootJson);
  if (!strictTrustRoot(trustValue)) fail("INVALID_TRUST_ROOT", "Pinned trust root failed strict validation");
  if (trustValue.issuer !== bundleValue.issuer || trustValue.algorithm !== bundleValue.algorithm) fail("INVALID_TRUST_ROOT", "Trust root issuer or algorithm mismatch");

  const trustKey = trustValue.keys.find((candidate) => candidate.kid === bundleValue.kid);
  if (!trustKey) fail("UNKNOWN_KEY", "Policy signing key is not pinned");
  try {
    const publicKey = createPublicKey({ key: Buffer.from(trustKey.publicKeySpkiBase64, "base64"), format: "der", type: "spki" });
    if (!verify(null, policyBundleSigningBytes(bundleValue), publicKey, Buffer.from(bundleValue.signature, "base64url"))) {
      fail("INVALID_SIGNATURE", "Policy signature verification failed");
    }
  } catch (error) {
    if (error instanceof SignedPolicyError) throw error;
    fail("INVALID_SIGNATURE", "Policy signature verification failed", error);
  }

  const current = now.getTime();
  if (!Number.isFinite(current)) fail("INVALID_BUNDLE", "Verification time is invalid");
  const issued = timestamp(bundleValue.issuedAt)!;
  const starts = timestamp(bundleValue.notBefore)!;
  const expires = timestamp(bundleValue.expiresAt)!;
  if (issued > starts || starts >= expires) fail("INVALID_BUNDLE", "Policy validity interval is invalid");
  if (current < starts || issued > current) fail("POLICY_NOT_YET_VALID", "Policy bundle is not yet valid");
  if (current >= expires) fail("POLICY_EXPIRED", "Policy bundle has expired");

  const keyStarts = timestamp(trustKey.notBefore)!;
  const keyExpires = trustKey.expiresAt === undefined ? undefined : timestamp(trustKey.expiresAt)!;
  if ((keyExpires !== undefined && keyStarts >= keyExpires) || current < keyStarts || issued < keyStarts || starts < keyStarts ||
      (keyExpires !== undefined && (current >= keyExpires || expires > keyExpires))) fail("KEY_NOT_VALID", "Policy signing key is outside its validity window");
  if (bundleValue.policyHash !== policyBundleHash(bundleValue.policy)) fail("POLICY_HASH_MISMATCH", "Policy hash does not match RFC8785 policy bytes");
  return bundleValue;
}
