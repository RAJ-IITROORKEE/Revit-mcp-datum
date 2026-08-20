import assert from "node:assert/strict";
import test from "node:test";
import { parseLocalGatewayConfig, parseVerifyOnlyConfig } from "./config.js";

const context = {
  runtimeId: "runtime-0000000000000001",
  desktopDeviceId: "device-0000000000000001",
  jobId: "job-1",
  connectionId: "connection-1",
  revitInstanceId: "revit-instance-000000001",
  documentFingerprint: "document-fingerprint-000000001",
  catalogHash: "a".repeat(64),
  policyHash: "b".repeat(64),
  policyReleaseId: "readonly-canary-release-001",
  policyProfileId: "local-revit-readonly-v3",
  routeGeneration: 1,
  leaseEpoch: 1,
};

function config(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    policyBundlePath: "C:/broker/policy-bundle.json",
    expectedPolicyHash: "b".repeat(64),
    expectedPolicyReleaseId: "readonly-canary-release-001",
    expectedPolicyProfileId: "local-revit-readonly-v3",
    expectedCatalogHash: "a".repeat(64),
    readEnabled: false,
    sessions: [context],
    ...overrides,
  });
}

test("local gateway startup configuration is hard-disabled for runtime dispatch", () => {
  assert.equal(parseLocalGatewayConfig(config()).readEnabled, false);
  assert.throws(() => parseLocalGatewayConfig(config({ readEnabled: true })), /invalid/i);
  assert.throws(() => parseLocalGatewayConfig(config({ mutationEnabled: false })), /invalid/i);
});

function verifyOnlyConfig(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    mode: "VERIFY_ONLY",
    policyBundlePath: "C:/broker/policy-bundle.json",
    expectedPolicyBundleSha256: "d".repeat(64),
    expectedPolicyHash: "b".repeat(64),
    expectedPolicyReleaseId: "readonly-canary-release-001",
    expectedPolicyProfileId: "local-revit-readonly-v3",
    expectedCatalogHash: "a".repeat(64),
    readEnabled: false,
    sessions: [],
    ...overrides,
  });
}

test("VERIFY_ONLY requires an exact bundle hash and permits zero sessions only", () => {
  const parsed = parseVerifyOnlyConfig(verifyOnlyConfig());
  assert.equal(parsed.mode, "VERIFY_ONLY");
  assert.equal(parsed.sessions.length, 0);
  assert.equal(parsed.readEnabled, false);
  assert.throws(() => parseVerifyOnlyConfig(verifyOnlyConfig({ readEnabled: true })), /invalid/i);
  assert.throws(() => parseVerifyOnlyConfig(verifyOnlyConfig({ sessions: [context] })), /invalid/i);
  assert.throws(() => parseVerifyOnlyConfig(verifyOnlyConfig({ expectedPolicyBundleSha256: undefined })), /invalid/i);
  assert.throws(() => parseVerifyOnlyConfig(verifyOnlyConfig({ mode: "RUN" })), /invalid/i);
  assert.throws(() => parseLocalGatewayConfig(config({ sessions: [] })), /invalid/i);
});

test("local gateway startup rejects missing, duplicate, and catalog-mismatched broker context", () => {
  assert.throws(() => parseLocalGatewayConfig(undefined), /required/i);
  assert.throws(() => parseLocalGatewayConfig("not-json"), /valid JSON/i);
  assert.throws(() => parseLocalGatewayConfig(config({
    sessions: [context, { ...context }],
  })), /unique/i);
  assert.throws(() => parseLocalGatewayConfig(config({
    sessions: [{ ...context, catalogHash: "b".repeat(64) }],
  })), /bind/i);
  for (const field of ["policyHash", "policyReleaseId", "policyProfileId", "catalogHash"] as const) {
    assert.throws(() => parseLocalGatewayConfig(config({
      sessions: [{ ...context, [field]: field.toLowerCase().includes("hash") ? "c".repeat(64) : `${context[field]}-mismatch` }],
    })));
  }
  assert.throws(() => parseLocalGatewayConfig(config({ trustRootPath: "C:/broker/root.json" })), /invalid/i);
});
