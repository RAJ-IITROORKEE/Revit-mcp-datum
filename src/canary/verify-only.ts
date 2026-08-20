import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { getLevelsListContract } from "./get-levels-list-contract.js";
import {
  parseAndVerifySignedPolicyBundle,
  type ExpectedPolicyBinding,
} from "../policy/signed-policy.js";

const MAX_POLICY_BUNDLE_BYTES = 8 * 1024 * 1024;

export type VerifyOnlyErrorCode =
  | "POLICY_READ_FAILED"
  | "POLICY_BUNDLE_BYTES_MISMATCH"
  | "POLICY_VERIFICATION_FAILED"
  | "POLICY_BINDING_MISMATCH"
  | "TOOL_CONTRACT_MISMATCH";

export class VerifyOnlyError extends Error {
  constructor(public readonly code: VerifyOnlyErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "VerifyOnlyError";
  }
}

type VerifyOnlyPolicyFileOptions = {
  policyBundlePath: string;
  expectedPolicyBundleSha256: string;
  expectedPolicyHash: string;
  expectedPolicyReleaseId: string;
  expectedPolicyProfileId: ExpectedPolicyBinding["profileId"];
  expectedCatalogHash: string;
  trustRootJson: string;
  now?: Date;
};

function fail(code: VerifyOnlyErrorCode, message: string, cause?: unknown): never {
  throw new VerifyOnlyError(code, message, cause === undefined ? undefined : { cause });
}

async function boundedRead(path: string): Promise<Buffer> {
  let handle;
  try {
    handle = await open(path, "r");
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_POLICY_BUNDLE_BYTES) throw new Error("Policy bundle exceeds its byte limit");
    const bytes = Buffer.allocUnsafe(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) throw new Error("Policy bundle changed or ended during read");
      offset += bytesRead;
    }
    return bytes;
  } catch (error) {
    return fail("POLICY_READ_FAILED", "Unable to bounded-read the signed policy bundle", error);
  } finally {
    await handle?.close();
  }
}

export async function verifyOnlyPolicyFile(options: VerifyOnlyPolicyFileOptions) {
  const bytes = await boundedRead(options.policyBundlePath);
  const byteHash = createHash("sha256").update(bytes).digest("hex");
  if (byteHash !== options.expectedPolicyBundleSha256) {
    fail("POLICY_BUNDLE_BYTES_MISMATCH", "Signed policy bundle bytes do not match the broker-pinned SHA-256");
  }

  let bundle;
  try {
    bundle = parseAndVerifySignedPolicyBundle(bytes.toString("utf8"), options.trustRootJson, options.now);
  } catch (error) {
    fail("POLICY_VERIFICATION_FAILED", "Signed policy bundle verification failed", error);
  }
  const profile = bundle.policy.profiles[0];
  if (bundle.policyHash !== options.expectedPolicyHash ||
      bundle.policyReleaseId !== options.expectedPolicyReleaseId ||
      profile.id !== options.expectedPolicyProfileId ||
      bundle.policy.catalog.manifest.catalogHash !== options.expectedCatalogHash) {
    fail("POLICY_BINDING_MISMATCH", "Signed policy does not match the exact broker binding");
  }
  if (getLevelsListContract.name !== "get_levels_list" ||
      getLevelsListContract.input.safeParse({ includeNonStructural: true, sortByElevation: true }).success !== true ||
      JSON.stringify(profile.enabledTools) !== JSON.stringify([getLevelsListContract.name]) ||
      JSON.stringify(profile.llmVisibleTools) !== JSON.stringify([getLevelsListContract.name])) {
    fail("TOOL_CONTRACT_MISMATCH", "Signed canary profile differs from the embedded get_levels_list contract");
  }
  return {
    mode: "VERIFY_ONLY" as const,
    profileId: profile.id,
    policyReleaseId: bundle.policyReleaseId,
    policyHash: bundle.policyHash,
    catalogHash: bundle.policy.catalog.manifest.catalogHash,
    verifiedTools: [getLevelsListContract.name],
    dispatchAvailable: false as const,
    readEnabled: false as const,
    sessions: 0 as const,
  };
}
