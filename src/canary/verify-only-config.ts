import { z } from "zod";

const verifyOnlyConfigSchema = z.object({
  mode: z.literal("VERIFY_ONLY"),
  policyBundlePath: z.string().min(1),
  expectedPolicyBundleSha256: z.string().regex(/^[a-f0-9]{64}$/),
  expectedPolicyHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedPolicyReleaseId: z.string().min(16).max(128).regex(/^[A-Za-z0-9._-]+$/),
  expectedPolicyProfileId: z.literal("local-revit-readonly-v3"),
  expectedCatalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  readEnabled: z.literal(false),
  sessions: z.tuple([]),
}).strict();

export type VerifyOnlyConfig = z.infer<typeof verifyOnlyConfigSchema>;

export function parseVerifyOnlyConfig(raw: string | undefined): VerifyOnlyConfig {
  if (!raw) throw new Error("DATUMM_LOCAL_GATEWAY_CONFIG_JSON is required");
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("DATUMM_LOCAL_GATEWAY_CONFIG_JSON must be valid JSON");
  }
  const parsed = verifyOnlyConfigSchema.safeParse(value);
  if (!parsed.success) throw new Error("DATUMM_LOCAL_GATEWAY_CONFIG_JSON is invalid for VERIFY_ONLY");
  return parsed.data;
}
