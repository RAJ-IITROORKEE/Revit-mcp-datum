import { createHash, createPublicKey, sign, verify } from "node:crypto";
import canonicalize from "canonicalize";

function canonicalBytes(value) {
  const canonical = canonicalize(value);
  if (typeof canonical !== "string") throw new Error("Policy bundle cannot be canonicalized");
  return Buffer.from(canonical, "utf8");
}

function signingProjection(bundle) {
  const { signature: _signature, ...unsigned } = bundle;
  return unsigned;
}

const CLOUD_TOOLS = ["query_stored_data", "store_project_data", "store_room_data"];

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  const keys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index]);
}

function validString(value, min = 1, max = 256) {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function validHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validIdentifier(value, min = 8, max = 128) {
  return typeof value === "string" && value.length >= min && value.length <= max && /^[A-Za-z0-9._-]+$/.test(value);
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : undefined;
}

function strictTrustRoot(value) {
  if (!record(value) || !exactKeys(value, ["$schema", "schema", "issuer", "algorithm", "keys"]) || value.$schema !== "https://contracts.datumm.com/desktop-bridge/v2/trust-root.json" || value.schema !== "datumm.revit.trust-root/v1" || value.issuer !== "https://www.datumm.ai" || value.algorithm !== "Ed25519" || !Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 8) return false;
  const kids = new Set();
  return value.keys.every((key) => {
    if (!record(key) || (!exactKeys(key, ["kid", "publicKeySpkiBase64", "notBefore"]) && !exactKeys(key, ["kid", "publicKeySpkiBase64", "notBefore", "expiresAt"])) || !validIdentifier(key.kid) || kids.has(key.kid) || typeof key.publicKeySpkiBase64 !== "string" || !/^[A-Za-z0-9+/]{40,256}={0,2}$/.test(key.publicKeySpkiBase64) || canonicalTimestamp(key.notBefore) === undefined || (key.expiresAt !== undefined && canonicalTimestamp(key.expiresAt) === undefined)) return false;
    const notBefore = canonicalTimestamp(key.notBefore);
    const expiresAt = key.expiresAt === undefined ? undefined : canonicalTimestamp(key.expiresAt);
    if (notBefore === undefined || (expiresAt !== undefined && notBefore >= expiresAt)) return false;
    try {
      createPublicKey({ key: Buffer.from(key.publicKeySpkiBase64, "base64"), format: "der", type: "spki" });
    } catch {
      return false;
    }
    kids.add(key.kid);
    return true;
  });
}

function strictUnsignedBundle(value) {
  if (!record(value) || !exactKeys(value, ["schema", "protocolVersion", "issuer", "algorithm", "kid", "policyReleaseId", "issuedAt", "notBefore", "expiresAt", "policyHash", "policy"])) return false;
  const issuedAt = canonicalTimestamp(value.issuedAt);
  const notBefore = canonicalTimestamp(value.notBefore);
  const expiresAt = canonicalTimestamp(value.expiresAt);
  return value.schema === "datumm.revit.policy-bundle/v1" && value.protocolVersion === 2 && value.issuer === "https://www.datumm.ai" && value.algorithm === "Ed25519" && validIdentifier(value.kid) && validIdentifier(value.policyReleaseId, 16) && issuedAt !== undefined && notBefore !== undefined && expiresAt !== undefined && issuedAt <= notBefore && notBefore < expiresAt && validHash(value.policyHash) && closedReadonlyCanaryPolicy(value.policy);
}

function strictSignedBundle(value) {
  return record(value) && exactKeys(value, ["schema", "protocolVersion", "issuer", "algorithm", "kid", "policyReleaseId", "issuedAt", "notBefore", "expiresAt", "policyHash", "policy", "signature"]) && strictUnsignedBundle(signingProjection(value)) && typeof value.signature === "string" && /^[A-Za-z0-9_-]{86}$/.test(value.signature);
}

function strictProvenanceAttestation(value) {
  if (!record(value) || !exactKeys(value, ["schema", "sourceRepository", "commit", "treeHash", "catalogHash", "sourceToolCount", "localToolCount", "excludedCloudTools", "generator", "generatorVersion", "validatedAt", "clean"])) return false;
  return value.schema === "datumm.revit.policy-provenance-attestation/v1" && validString(value.sourceRepository) && typeof value.commit === "string" && /^[a-f0-9]{40}$/.test(value.commit) && typeof value.treeHash === "string" && /^[a-f0-9]{40,64}$/.test(value.treeHash) && validHash(value.catalogHash) && value.sourceToolCount === 155 && value.localToolCount === 152 && JSON.stringify(value.excludedCloudTools) === JSON.stringify(CLOUD_TOOLS) && validString(value.generator) && validString(value.generatorVersion, 1, 64) && canonicalTimestamp(value.validatedAt) !== undefined && value.clean === true;
}

function matchingProvenanceAttestation(policy, attestation) {
  if (!strictProvenanceAttestation(attestation) || !record(policy.provenance) || !record(policy.catalog) || !record(policy.catalog.manifest)) return false;
  const { provenance } = policy;
  const { manifest } = policy.catalog;
  return attestation.sourceRepository === provenance.sourceRepository && attestation.commit === provenance.commit && attestation.treeHash === provenance.treeHash && attestation.catalogHash === manifest.catalogHash && attestation.generator === provenance.generator && attestation.generatorVersion === provenance.generatorVersion;
}

export function parseSignedPolicyBundleJson(input) {
  assertNoDuplicateJsonKeys(input);
  const value = JSON.parse(input);
  if (!strictSignedBundle(value)) throw new Error("Policy bundle is not a strict signed policy bundle");
  return value;
}

function assertNoDuplicateJsonKeys(input) {
  let index = 0;
  const whitespace = () => { while (/\s/.test(input[index] ?? "")) index += 1; };
  const stringValue = () => {
    const start = index;
    if (input[index] !== '"') throw new Error("Invalid JSON string");
    index += 1;
    while (index < input.length) {
      if (input[index] === "\\") { index += 2; continue; }
      if (input[index] === '"') { index += 1; return JSON.parse(input.slice(start, index)); }
      if ((input.charCodeAt(index) ?? 0) < 0x20) throw new Error("Invalid JSON control character");
      index += 1;
    }
    throw new Error("Unterminated JSON string");
  };
  const value = () => {
    whitespace();
    if (input[index] === "{") { object(); return; }
    if (input[index] === "[") { array(); return; }
    if (input[index] === '"') { stringValue(); return; }
    const literal = /(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
    literal.lastIndex = index;
    const match = literal.exec(input);
    if (!match) throw new Error("Invalid JSON value");
    index += match[0].length;
  };
  const object = () => {
    index += 1; whitespace();
    const keys = new Set();
    if (input[index] === "}") { index += 1; return; }
    while (true) {
      whitespace(); const key = stringValue();
      if (keys.has(key)) throw new Error(`Policy bundle JSON contains duplicate key: ${key}`);
      keys.add(key); whitespace();
      if (input[index] !== ":") throw new Error("Invalid JSON object");
      index += 1; value(); whitespace();
      if (input[index] === "}") { index += 1; return; }
      if (input[index] !== ",") throw new Error("Invalid JSON object");
      index += 1;
    }
  };
  const array = () => {
    index += 1; whitespace();
    if (input[index] === "]") { index += 1; return; }
    while (true) {
      value(); whitespace();
      if (input[index] === "]") { index += 1; return; }
      if (input[index] !== ",") throw new Error("Invalid JSON array");
      index += 1;
    }
  };
  value(); whitespace();
  if (index !== input.length) throw new Error("Invalid trailing JSON content");
}

function closedReadonlyCanaryPolicy(policy) {
  if (!record(policy) || !exactKeys(policy, ["provenance", "catalog", "profiles"])) return false;
  const { provenance, catalog, profiles } = policy;
  if (!record(provenance) || !exactKeys(provenance, ["sourceRepository", "commit", "treeHash", "generator", "generatorVersion"])) return false;
  if (!validString(provenance.sourceRepository) || !/^[a-f0-9]{40}$/.test(String(provenance.commit)) || !/^[a-f0-9]{40,64}$/.test(String(provenance.treeHash)) || !validString(provenance.generator) || !validString(provenance.generatorVersion, 1, 64)) return false;
  if (!record(catalog) || !exactKeys(catalog, ["sourceToolCount", "localToolCount", "excludedCloudTools", "manifest"])) return false;
  if (catalog.sourceToolCount !== 155 || catalog.localToolCount !== 152 || JSON.stringify(catalog.excludedCloudTools) !== JSON.stringify(CLOUD_TOOLS)) return false;
  if (!record(catalog.manifest) || !exactKeys(catalog.manifest, ["protocolVersion", "catalogVersion", "catalogHash", "localToolCount", "excludedCloudTools", "tools"])) return false;
  const manifest = catalog.manifest;
  if (manifest.protocolVersion !== 2 || manifest.localToolCount !== 152 || !validString(manifest.catalogVersion, 1, 64) || !validHash(manifest.catalogHash) || JSON.stringify(manifest.excludedCloudTools) !== JSON.stringify(CLOUD_TOOLS) || !Array.isArray(manifest.tools) || manifest.tools.length !== 152) return false;
  const names = new Set();
  for (const tool of manifest.tools) {
    if (!record(tool) || !exactKeys(tool, ["name", "mutationClass", "retryPolicy", "timeoutMs", "createdIdsRequired", "sessionTagSupported", "automaticRollbackAllowed", "maxArgsBytes", "maxResultBytes"])) return false;
    if (!validString(tool.name, 2, 128) || !/^[a-z][a-z0-9_]{1,127}$/.test(tool.name) || names.has(tool.name)) return false;
    names.add(tool.name);
    if (!(["read", "mutation", "dangerous"].includes(tool.mutationClass)) || !(["read_only", "never"].includes(tool.retryPolicy)) || !Number.isInteger(tool.timeoutMs) || tool.timeoutMs < 1000 || tool.timeoutMs > 600000 || !Number.isInteger(tool.maxArgsBytes) || tool.maxArgsBytes < 1 || tool.maxArgsBytes > 8388608 || !Number.isInteger(tool.maxResultBytes) || tool.maxResultBytes < 1 || tool.maxResultBytes > 8388608 || (tool.mutationClass !== "read" && tool.retryPolicy !== "never") || typeof tool.createdIdsRequired !== "boolean" || typeof tool.sessionTagSupported !== "boolean" || typeof tool.automaticRollbackAllowed !== "boolean") return false;
  }
  if (!names.has("get_levels_list") || !names.has("send_code_to_revit")) return false;
  if (!Array.isArray(profiles) || profiles.length !== 1 || !record(profiles[0])) return false;
  const profile = profiles[0];
  if (!exactKeys(profile, ["id", "enabledTools", "llmVisibleTools", "deniedTools", "maxResultBytes", "tools"]) || profile.id !== "local-revit-readonly-canary-v1" || JSON.stringify(profile.enabledTools) !== JSON.stringify(["get_levels_list"]) || JSON.stringify(profile.llmVisibleTools) !== JSON.stringify(["get_levels_list"]) || JSON.stringify(profile.deniedTools) !== JSON.stringify(["send_code_to_revit"]) || profile.maxResultBytes !== 65536 || !record(profile.tools) || !exactKeys(profile.tools, ["get_levels_list"])) return false;
  const levels = profile.tools.get_levels_list;
  return record(levels) && exactKeys(levels, ["mutationClass", "retryPolicy", "timeoutMs", "input", "maxLevels", "resultUnit"]) && levels.mutationClass === "read" && levels.retryPolicy === "never" && levels.timeoutMs === 30000 && levels.maxLevels === 256 && levels.resultUnit === "mm" && record(levels.input) && exactKeys(levels.input, ["includeNonStructural", "sortByElevation"]) && levels.input.includeNonStructural === true && levels.input.sortByElevation === true;
}

export function policyBundleHash(policy) {
  return createHash("sha256").update(canonicalBytes(policy)).digest("hex");
}

export function policyBundleSigningBytes(bundle) {
  return canonicalBytes(signingProjection(bundle));
}

export function signPolicyBundle(bundle, privateKey, attestation) {
  if (!strictUnsignedBundle(bundle)) throw new Error("Policy bundle policy is not a closed read-only canary");
  if (!matchingProvenanceAttestation(bundle.policy, attestation)) throw new Error("Policy bundle provenance attestation is missing or does not match a frozen read-only policy");
  const policyHash = policyBundleHash(bundle.policy);
  if (bundle.policyHash !== policyHash) throw new Error("Policy bundle policyHash does not match RFC 8785 policy bytes");
  return {
    ...signingProjection(bundle),
    signature: sign(null, policyBundleSigningBytes(bundle), privateKey).toString("base64url"),
  };
}

export function verifyPolicyBundle(bundle, trustRoot, now = new Date()) {
  if (!strictSignedBundle(bundle) || !strictTrustRoot(trustRoot) || trustRoot.issuer !== bundle.issuer || trustRoot.algorithm !== bundle.algorithm || bundle.algorithm !== "Ed25519") return false;
  const current = now.getTime();
  const issuedAt = canonicalTimestamp(bundle.issuedAt);
  const notBefore = canonicalTimestamp(bundle.notBefore);
  const expiresAt = canonicalTimestamp(bundle.expiresAt);
  if (issuedAt === undefined || notBefore === undefined || expiresAt === undefined || issuedAt > notBefore || notBefore > expiresAt || current < notBefore || current >= expiresAt || issuedAt > current) return false;
  const key = trustRoot.keys?.find((candidate) => candidate?.kid === bundle.kid);
  if (!key) return false;
  const keyNotBefore = canonicalTimestamp(key.notBefore);
  const keyExpiresAt = key.expiresAt === undefined ? undefined : canonicalTimestamp(key.expiresAt);
  if (keyNotBefore === undefined || (key.expiresAt !== undefined && keyExpiresAt === undefined) || current < keyNotBefore || issuedAt < keyNotBefore || notBefore < keyNotBefore || (keyExpiresAt !== undefined && (current >= keyExpiresAt || expiresAt > keyExpiresAt))) return false;
  if (!closedReadonlyCanaryPolicy(bundle.policy) || bundle.policyHash !== policyBundleHash(bundle.policy)) return false;
  try {
    const publicKey = createPublicKey({ key: Buffer.from(key.publicKeySpkiBase64, "base64"), format: "der", type: "spki" });
    return verify(null, policyBundleSigningBytes(bundle), publicKey, Buffer.from(bundle.signature, "base64url"));
  } catch {
    return false;
  }
}
