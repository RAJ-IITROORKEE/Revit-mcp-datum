import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parseSignedPolicyBundleJson, policyBundleHash, policyBundleSigningBytes, signPolicyBundle, verifyPolicyBundle } from "./policy-bundle-canonical.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts", "desktop-bridge", "v2");

async function readJson(file) {
  return JSON.parse(await readFile(join(root, file), "utf8"));
}

test("uses RFC 8785 bytes for a schema-valid, signed read-only policy bundle", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const manifest = await readJson("tool-policy-manifest.json");
  const policy = {
    provenance: {
      sourceRepository: "https://github.com/RAJ-IITROORKEE/Revit-mcp-datum.git",
      commit: "a".repeat(40),
      treeHash: "b".repeat(40),
      generator: "generate-local-tool-policy",
      generatorVersion: "contract-test",
    },
    catalog: {
      sourceToolCount: 155,
      localToolCount: 152,
      excludedCloudTools: ["query_stored_data", "store_project_data", "store_room_data"],
      manifest,
    },
    profiles: [{
      id: "local-revit-readonly-canary-v1",
      enabledTools: ["get_levels_list"],
      llmVisibleTools: ["get_levels_list"],
      deniedTools: ["send_code_to_revit"],
      maxResultBytes: 65536,
      tools: {
        get_levels_list: {
          mutationClass: "read",
          retryPolicy: "never",
          timeoutMs: 30000,
          input: { includeNonStructural: true, sortByElevation: true },
          maxLevels: 256,
          resultUnit: "mm",
        },
      },
    }],
  };
  const bundle = {
    schema: "datumm.revit.policy-bundle/v1",
    protocolVersion: 2,
    issuer: "https://www.datumm.ai",
    algorithm: "Ed25519",
    kid: "test-policy-kid",
    policyReleaseId: "test-readonly-canary-001",
    issuedAt: "2026-08-08T00:00:00.000Z",
    notBefore: "2026-08-08T00:00:00.000Z",
    expiresAt: "2026-08-08T01:00:00.000Z",
    policyHash: policyBundleHash(policy),
    policy,
  };

  const attestation = {
    schema: "datumm.revit.policy-provenance-attestation/v1",
    sourceRepository: policy.provenance.sourceRepository,
    commit: policy.provenance.commit,
    treeHash: policy.provenance.treeHash,
    catalogHash: policy.catalog.manifest.catalogHash,
    sourceToolCount: 155,
    localToolCount: 152,
    excludedCloudTools: ["query_stored_data", "store_project_data", "store_room_data"],
    generator: policy.provenance.generator,
    generatorVersion: policy.provenance.generatorVersion,
    validatedAt: "2026-08-08T00:00:00.000Z",
    clean: true,
  };

  assert.throws(() => signPolicyBundle(bundle, privateKey, { ...attestation, treeHash: "c".repeat(40) }), /provenance attestation/);
  const signed = signPolicyBundle(bundle, privateKey, attestation);
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  const manifestSchema = await readJson("tool-policy-manifest.schema.json");
  const bundleSchema = await readJson("policy-bundle.schema.json");
  ajv.addSchema(manifestSchema);
  const validate = ajv.compile(bundleSchema);
  assert.equal(validate(signed), true, ajv.errorsText(validate.errors));
  assert.equal(validate({ ...signed, policy: { ...signed.policy, profiles: [{ ...signed.policy.profiles[0], enabledTools: ["delete_elements"] }] } }), false);
  const trustRoot = {
    $schema: "https://contracts.datumm.com/desktop-bridge/v2/trust-root.json",
    schema: "datumm.revit.trust-root/v1",
    issuer: "https://www.datumm.ai",
    algorithm: "Ed25519",
    keys: [{
      kid: "test-policy-kid",
      publicKeySpkiBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
      notBefore: "2026-08-08T00:00:00.000Z",
    }],
  };
  assert.equal(policyBundleSigningBytes(signed).equals(policyBundleSigningBytes({ ...signed, signature: "ignored" })), true);
  assert.equal(verifyPolicyBundle(signed, trustRoot, new Date("2026-08-08T00:30:00.000Z")), true);
  assert.equal(verifyPolicyBundle({ ...signed, policyReleaseId: "tampered" }, trustRoot, new Date("2026-08-08T00:30:00.000Z")), false);
  assert.equal(verifyPolicyBundle(signed, trustRoot, new Date("2026-08-08T01:00:00.000Z")), false);
  assert.equal(verifyPolicyBundle({ ...signed, unexpected: true }, trustRoot, new Date("2026-08-08T00:30:00.000Z")), false);
  assert.equal(verifyPolicyBundle(signed, { ...trustRoot, keys: [trustRoot.keys[0], trustRoot.keys[0]] }, new Date("2026-08-08T00:30:00.000Z")), false);
  assert.throws(() => parseSignedPolicyBundleJson('{"schema":"datumm.revit.policy-bundle/v1","schema":"duplicate"}'), /duplicate key/);
});
