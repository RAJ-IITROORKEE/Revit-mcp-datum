import { PINNED_TRUST_ROOT_JSON } from "./pinned-trust-root.js";
import { parseVerifyOnlyConfig } from "./verify-only-config.js";
import { verifyOnlyPolicyFile } from "./verify-only.js";

async function main(): Promise<void> {
  const config = parseVerifyOnlyConfig(process.env.DATUMM_LOCAL_GATEWAY_CONFIG_JSON);
  const result = await verifyOnlyPolicyFile({
    policyBundlePath: config.policyBundlePath,
    expectedPolicyBundleSha256: config.expectedPolicyBundleSha256,
    expectedPolicyHash: config.expectedPolicyHash,
    expectedPolicyReleaseId: config.expectedPolicyReleaseId,
    expectedPolicyProfileId: config.expectedPolicyProfileId,
    expectedCatalogHash: config.expectedCatalogHash,
    trustRootJson: PINNED_TRUST_ROOT_JSON,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[2] === "--print-embedded-trust-root") {
  process.stdout.write(`${PINNED_TRUST_ROOT_JSON}\n`);
} else {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "VERIFY_ONLY canary failed";
    process.stderr.write(`[verify-only-canary] ${message.slice(0, 500)}\n`);
    process.exitCode = 1;
  });
}
