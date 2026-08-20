import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  SignedPolicyError,
  parseAndVerifySignedPolicyBundle,
  policyBundleHash,
  policyBundleSigningBytes,
} from "./signed-policy.js";

async function fixture() {
  const manifest = JSON.parse(await readFile(resolve("contracts/desktop-bridge/v2/tool-policy-manifest.json"), "utf8"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const policy = {
    provenance: {
      sourceRepository: "https://github.com/RAJ-IITROORKEE/Revit-mcp-datum.git",
      commit: "a".repeat(40),
      treeHash: "b".repeat(40),
      generator: "signed-policy-test",
      generatorVersion: "1",
    },
    catalog: {
      sourceToolCount: 155,
      localToolCount: 152,
      excludedCloudTools: ["query_stored_data", "store_project_data", "store_room_data"],
      manifest,
    },
    profiles: [{
      id: "local-revit-readonly-v3",
      enabledTools: ["get_levels_list"],
      llmVisibleTools: ["get_levels_list"],
      deniedTools: ["send_code_to_revit"],
      maxResultBytes: 65_536,
      tools: {
        get_levels_list: {
          mutationClass: "read",
          retryPolicy: "never",
          timeoutMs: 30_000,
          input: { includeNonStructural: true, sortByElevation: true },
          maxLevels: 256,
          resultUnit: "mm",
        },
      },
    }],
  };
  const unsigned = {
    schema: "datumm.revit.policy-bundle/v1",
    protocolVersion: 2,
    issuer: "https://www.datumm.ai",
    algorithm: "Ed25519",
    kid: "ephemeral-test-key",
    policyReleaseId: "readonly-canary-test-001",
    issuedAt: "2026-08-09T00:00:00.000Z",
    notBefore: "2026-08-09T00:00:00.000Z",
    expiresAt: "2026-08-10T00:00:00.000Z",
    policyHash: policyBundleHash(policy),
    policy,
  };
  const bundle = {
    ...unsigned,
    signature: sign(null, policyBundleSigningBytes(unsigned), privateKey).toString("base64url"),
  };
  const trustRoot = {
    $schema: "https://contracts.datumm.com/desktop-bridge/v2/trust-root.json",
    schema: "datumm.revit.trust-root/v1",
    issuer: "https://www.datumm.ai",
    algorithm: "Ed25519",
    keys: [{
      kid: unsigned.kid,
      publicKeySpkiBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
      notBefore: unsigned.notBefore,
    }],
  };
  return { bundle, trustRoot };
}

function hasCode(code: string) {
  return (error: unknown) => error instanceof SignedPolicyError && error.code === code;
}

test("production verifier accepts a valid ephemeral Ed25519 canary and rejects tampering", async () => {
  const { bundle, trustRoot } = await fixture();
  const verified = parseAndVerifySignedPolicyBundle(
    JSON.stringify(bundle),
    JSON.stringify(trustRoot),
    new Date("2026-08-09T12:00:00.000Z"),
  );
  assert.equal(verified.policyHash, bundle.policyHash);
  assert.equal(verified.policy.profiles[0].enabledTools[0], "get_levels_list");

  assert.throws(
    () => parseAndVerifySignedPolicyBundle(
      JSON.stringify({ ...bundle, policyReleaseId: "tampered-release-id" }),
      JSON.stringify(trustRoot),
      new Date("2026-08-09T12:00:00.000Z"),
    ),
    hasCode("INVALID_SIGNATURE"),
  );
});

test("production verifier fails closed for expiry and unknown key IDs", async () => {
  const { bundle, trustRoot } = await fixture();
  assert.throws(
    () => parseAndVerifySignedPolicyBundle(JSON.stringify(bundle), JSON.stringify(trustRoot), new Date(bundle.expiresAt)),
    hasCode("POLICY_EXPIRED"),
  );
  assert.throws(
    () => parseAndVerifySignedPolicyBundle(
      JSON.stringify({ ...bundle, kid: "unknown-test-key" }),
      JSON.stringify(trustRoot),
      new Date("2026-08-09T12:00:00.000Z"),
    ),
    hasCode("UNKNOWN_KEY"),
  );
});

test("tampered signed semantics fail signature verification before time and hash classification", async () => {
  const { bundle, trustRoot } = await fixture();
  const cases = [
    { ...bundle, expiresAt: "2026-08-09T01:00:00.000Z" },
    { ...bundle, notBefore: "2026-08-09T13:00:00.000Z" },
    { ...bundle, policyHash: "0".repeat(64) },
    {
      ...bundle,
      policy: {
        ...bundle.policy,
        provenance: { ...bundle.policy.provenance, generator: "tampered-generator" },
      },
    },
  ];
  for (const tampered of cases) {
    assert.throws(
      () => parseAndVerifySignedPolicyBundle(
        JSON.stringify(tampered),
        JSON.stringify(trustRoot),
        new Date("2026-08-09T12:00:00.000Z"),
      ),
      hasCode("INVALID_SIGNATURE"),
    );
  }
});

test("production parser rejects duplicate keys in bundles and trust roots", async () => {
  const { bundle, trustRoot } = await fixture();
  const duplicateBundle = JSON.stringify(bundle).replace('{"schema":', '{"schema":"duplicate","schema":');
  const duplicateRoot = JSON.stringify(trustRoot).replace('"issuer":', '"issuer":"duplicate","issuer":');
  assert.throws(
    () => parseAndVerifySignedPolicyBundle(duplicateBundle, JSON.stringify(trustRoot), new Date("2026-08-09T12:00:00.000Z")),
    hasCode("DUPLICATE_JSON_KEY"),
  );
  assert.throws(
    () => parseAndVerifySignedPolicyBundle(JSON.stringify(bundle), duplicateRoot, new Date("2026-08-09T12:00:00.000Z")),
    hasCode("DUPLICATE_JSON_KEY"),
  );
});

test("production parser rejects nested and escaped duplicate keys", async () => {
  const { bundle, trustRoot } = await fixture();
  const nestedBundle = JSON.stringify(bundle).replace(
    '"input":{"includeNonStructural":true,"sortByElevation":true}',
    '"input":{"sort\\u0042yElevation":false,"includeNonStructural":true,"sortByElevation":true}',
  );
  const escapedTrustRoot = JSON.stringify(trustRoot).replace(
    '"kid":"ephemeral-test-key"',
    '"k\\u0069d":"duplicate","kid":"ephemeral-test-key"',
  );
  assert.throws(
    () => parseAndVerifySignedPolicyBundle(nestedBundle, JSON.stringify(trustRoot), new Date("2026-08-09T12:00:00.000Z")),
    hasCode("DUPLICATE_JSON_KEY"),
  );
  assert.throws(
    () => parseAndVerifySignedPolicyBundle(JSON.stringify(bundle), escapedTrustRoot, new Date("2026-08-09T12:00:00.000Z")),
    hasCode("DUPLICATE_JSON_KEY"),
  );
});
