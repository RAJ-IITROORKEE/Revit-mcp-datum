import { z } from "zod";
import { MAX_FRAME_BYTES } from "./framed-stdio.js";
export { parseVerifyOnlyConfig, type VerifyOnlyConfig } from "../canary/verify-only-config.js";

const contextSchema = z.object({
  runtimeId: z.string().min(1).max(128),
  desktopDeviceId: z.string().min(1).max(128),
  jobId: z.string().min(1).max(128),
  connectionId: z.string().min(1).max(128),
  revitInstanceId: z.string().min(1).max(128),
  documentFingerprint: z.string().min(1).max(256),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  policyHash: z.string().regex(/^[a-f0-9]{64}$/),
  policyReleaseId: z.string().min(16).max(128).regex(/^[A-Za-z0-9._-]+$/),
  policyProfileId: z.literal("local-revit-readonly-v3"),
  routeGeneration: z.number().int().positive(),
  leaseEpoch: z.number().int().positive(),
}).strict();

const brokerConfigSchema = z.object({
  policyBundlePath: z.string().min(1),
  expectedPolicyHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedPolicyReleaseId: z.string().min(16).max(128).regex(/^[A-Za-z0-9._-]+$/),
  expectedPolicyProfileId: z.literal("local-revit-readonly-v3"),
  expectedCatalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  maxFrameBytes: z.number().int().positive().max(MAX_FRAME_BYTES).default(MAX_FRAME_BYTES),
  readEnabled: z.literal(false),
  sessions: z.array(contextSchema).min(1),
}).strict();

export type LocalGatewayConfig = z.infer<typeof brokerConfigSchema>;

function parseConfigJson(raw: string | undefined): unknown {
  if (!raw) throw new Error("DATUMM_LOCAL_GATEWAY_CONFIG_JSON is required");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("DATUMM_LOCAL_GATEWAY_CONFIG_JSON must be valid JSON");
  }
}

export function parseLocalGatewayConfig(raw: string | undefined): LocalGatewayConfig {
  const value = parseConfigJson(raw);
  const parsed = brokerConfigSchema.safeParse(value);
  if (!parsed.success) throw new Error("DATUMM_LOCAL_GATEWAY_CONFIG_JSON is invalid");
  const config = parsed.data;
  if (config.sessions.some((session) =>
    session.catalogHash !== config.expectedCatalogHash ||
    session.policyHash !== config.expectedPolicyHash ||
    session.policyReleaseId !== config.expectedPolicyReleaseId ||
    session.policyProfileId !== config.expectedPolicyProfileId)) {
    throw new Error("Every broker session must bind the expected policy and catalog values");
  }
  if (new Set(config.sessions.map((session) => session.connectionId)).size !== config.sessions.length) {
    throw new Error("Broker session connection IDs must be unique");
  }
  return config;
}
