import { sign } from "node:crypto";
import {
  assertUnsignedPolicyBundle,
  parseAndVerifySignedPolicyBundle,
  parseSignedPolicyBundleJson as parseProductionSignedPolicyBundleJson,
  policyBundleHash,
  policyBundleSigningBytes,
} from "../build/policy/signed-policy.js";

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

function canonicalTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : undefined;
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
  return parseProductionSignedPolicyBundleJson(input);
}

export { policyBundleHash, policyBundleSigningBytes };

export function signPolicyBundle(bundle, privateKey, attestation) {
  try {
    assertUnsignedPolicyBundle(bundle);
  } catch {
    throw new Error("Policy bundle policy is not a closed read-only canary");
  }
  if (!matchingProvenanceAttestation(bundle.policy, attestation)) throw new Error("Policy bundle provenance attestation is missing or does not match a frozen read-only policy");
  const policyHash = policyBundleHash(bundle.policy);
  if (bundle.policyHash !== policyHash) throw new Error("Policy bundle policyHash does not match RFC 8785 policy bytes");
  return {
    ...signingProjection(bundle),
    signature: sign(null, policyBundleSigningBytes(bundle), privateKey).toString("base64url"),
  };
}

export function verifyPolicyBundle(bundle, trustRoot, now = new Date()) {
  try {
    parseAndVerifySignedPolicyBundle(JSON.stringify(bundle), JSON.stringify(trustRoot), now);
    return true;
  } catch {
    return false;
  }
}
