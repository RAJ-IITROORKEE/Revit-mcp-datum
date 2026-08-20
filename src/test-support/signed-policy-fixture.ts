import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { policyBundleHash, policyBundleSigningBytes } from "../policy/signed-policy.js";

export async function createSignedPolicyFixture() {
  const manifest = JSON.parse(await readFile(resolve("contracts/desktop-bridge/v2/tool-policy-manifest.json"), "utf8"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const policy = {
    provenance: {
      sourceRepository: "https://github.com/RAJ-IITROORKEE/Revit-mcp-datum.git",
      commit: "a".repeat(40), treeHash: "b".repeat(40),
      generator: "signed-policy-test", generatorVersion: "1",
    },
    catalog: {
      sourceToolCount: 155, localToolCount: 152,
      excludedCloudTools: ["query_stored_data", "store_project_data", "store_room_data"],
      manifest,
    },
    profiles: [{
      id: "local-revit-readonly-v3",
      enabledTools: ["get_levels_list"], llmVisibleTools: ["get_levels_list"],
      deniedTools: ["send_code_to_revit"], maxResultBytes: 65_536,
      tools: { get_levels_list: {
        mutationClass: "read", retryPolicy: "never", timeoutMs: 30_000,
        input: { includeNonStructural: true, sortByElevation: true }, maxLevels: 256, resultUnit: "mm",
      } },
    }],
  };
  const unsigned = {
    schema: "datumm.revit.policy-bundle/v1", protocolVersion: 2,
    issuer: "https://www.datumm.ai", algorithm: "Ed25519", kid: "ephemeral-test-key",
    policyReleaseId: "readonly-canary-test-001", issuedAt: "2026-08-09T00:00:00.000Z",
    notBefore: "2026-08-09T00:00:00.000Z", expiresAt: "2026-08-10T00:00:00.000Z",
    policyHash: policyBundleHash(policy), policy,
  };
  const bundle = { ...unsigned, signature: sign(null, policyBundleSigningBytes(unsigned), privateKey).toString("base64url") };
  const trustRoot = {
    $schema: "https://contracts.datumm.com/desktop-bridge/v2/trust-root.json",
    schema: "datumm.revit.trust-root/v1", issuer: "https://www.datumm.ai", algorithm: "Ed25519",
    keys: [{ kid: unsigned.kid, publicKeySpkiBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64"), notBefore: unsigned.notBefore }],
  };
  return { bundle, trustRoot };
}
