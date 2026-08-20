import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSignedPolicyFixture } from "../test-support/signed-policy-fixture.js";
import { VerifyOnlyError, verifyOnlyPolicyFile } from "./verify-only.js";

test("VERIFY_ONLY checks exact signed bundle bytes before parsing and imports one read contract", async () => {
  const directory = await mkdtemp(join(tmpdir(), "datumm-canary-"));
  try {
    const { bundle, trustRoot } = await createSignedPolicyFixture();
    const bytes = Buffer.from(JSON.stringify(bundle), "utf8");
    const path = join(directory, "ephemeral-policy.json");
    await writeFile(path, bytes);
    const result = await verifyOnlyPolicyFile({
      policyBundlePath: path,
      expectedPolicyBundleSha256: createHash("sha256").update(bytes).digest("hex"),
      expectedPolicyHash: bundle.policyHash,
      expectedPolicyReleaseId: bundle.policyReleaseId,
      expectedPolicyProfileId: "local-revit-readonly-v3",
      expectedCatalogHash: bundle.policy.catalog.manifest.catalogHash,
      trustRootJson: JSON.stringify(trustRoot),
      now: new Date("2026-08-09T12:00:00.000Z"),
    });
    assert.deepEqual(result, {
      mode: "VERIFY_ONLY",
      profileId: "local-revit-readonly-v3",
      policyReleaseId: bundle.policyReleaseId,
      policyHash: bundle.policyHash,
      catalogHash: bundle.policy.catalog.manifest.catalogHash,
      verifiedTools: ["get_levels_list"],
      dispatchAvailable: false,
      readEnabled: false,
      sessions: 0,
    });

    await writeFile(path, "{not-json", "utf8");
    await assert.rejects(
      verifyOnlyPolicyFile({
        policyBundlePath: path,
        expectedPolicyBundleSha256: "0".repeat(64),
        expectedPolicyHash: bundle.policyHash,
        expectedPolicyReleaseId: bundle.policyReleaseId,
        expectedPolicyProfileId: "local-revit-readonly-v3",
        expectedCatalogHash: bundle.policy.catalog.manifest.catalogHash,
        trustRootJson: JSON.stringify(trustRoot),
      }),
      (error: unknown) => error instanceof VerifyOnlyError && error.code === "POLICY_BUNDLE_BYTES_MISMATCH",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("VERIFY_ONLY blocks when the production bundle is absent", async () => {
  await assert.rejects(
    verifyOnlyPolicyFile({
      policyBundlePath: join(tmpdir(), `absent-policy-${process.pid}.json`),
      expectedPolicyBundleSha256: "0".repeat(64),
      expectedPolicyHash: "1".repeat(64),
      expectedPolicyReleaseId: "readonly-canary-release-001",
      expectedPolicyProfileId: "local-revit-readonly-v3",
      expectedCatalogHash: "2".repeat(64),
      trustRootJson: "{}",
    }),
    (error: unknown) => error instanceof VerifyOnlyError && error.code === "POLICY_READ_FAILED",
  );
});
