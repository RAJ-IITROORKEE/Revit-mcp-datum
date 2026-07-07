import { createHmac, timingSafeEqual } from "node:crypto";

export const RELAY_SESSION_PREFIX = "dtm_rly_";

export interface RelaySessionPayload {
  connectionId: string;
  clerkUserId?: string;
  deviceId?: string;
  scopes?: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface VerifiedRelaySession {
  payload: RelaySessionPayload;
  routeKey: string;
}

export type RelaySessionVerification =
  | { valid: true; session: VerifiedRelaySession }
  | { valid: false; error: string };

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function normalizeSecret(secret: string | undefined): string {
  return typeof secret === "string" ? secret.trim() : "";
}

export function getRelaySessionSecret(env = process.env): string {
  return normalizeSecret(env.RELAY_SESSION_SECRET || env.MCP_RELAY_SESSION_SECRET);
}

export function getRelayRouteKey(connectionId: string): string {
  return `connection:${connectionId}`;
}

function isValidConnectionId(connectionId: unknown): connectionId is string {
  return typeof connectionId === "string" && connectionId.trim().length > 0 && connectionId.trim().length <= 128;
}

function normalizePayload(payload: RelaySessionPayload): RelaySessionPayload {
  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes.filter((scope) => typeof scope === "string" && scope.trim()).map((scope) => scope.trim())
    : [];

  return {
    connectionId: payload.connectionId.trim(),
    clerkUserId: payload.clerkUserId?.trim() || undefined,
    deviceId: payload.deviceId?.trim() || undefined,
    scopes,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export function createRelaySession(payload: RelaySessionPayload, secret = getRelaySessionSecret()): string {
  const signingSecret = normalizeSecret(secret);
  if (!signingSecret) {
    throw new Error("RELAY_SESSION_SECRET or MCP_RELAY_SESSION_SECRET is not configured");
  }

  if (!isValidConnectionId(payload.connectionId)) {
    throw new Error("connectionId is required for relay session");
  }

  const normalized = normalizePayload(payload);
  const expiresAtMs = Date.parse(normalized.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    throw new Error("expiresAt must be a valid ISO timestamp");
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(normalized));
  const signature = signPayload(encodedPayload, signingSecret);
  return `${RELAY_SESSION_PREFIX}${encodedPayload}.${signature}`;
}

export function verifyRelaySession(
  token: string | undefined,
  secret = getRelaySessionSecret(),
  now = new Date()
): RelaySessionVerification {
  const signingSecret = normalizeSecret(secret);
  const trimmed = typeof token === "string" ? token.trim() : "";

  if (!trimmed) return { valid: false, error: "Missing relay session" };
  if (!trimmed.startsWith(RELAY_SESSION_PREFIX)) return { valid: false, error: "Invalid relay session prefix" };
  if (!signingSecret) return { valid: false, error: "Relay session secret is not configured" };

  const tokenBody = trimmed.slice(RELAY_SESSION_PREFIX.length);
  const separatorIndex = tokenBody.lastIndexOf(".");
  if (separatorIndex <= 0) return { valid: false, error: "Malformed relay session" };

  const encodedPayload = tokenBody.slice(0, separatorIndex);
  const signature = tokenBody.slice(separatorIndex + 1);
  const expectedSignature = signPayload(encodedPayload, signingSecret);
  const actual = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { valid: false, error: "Invalid relay session signature" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return { valid: false, error: "Invalid relay session payload" };
  }

  const payload = parsed as Partial<RelaySessionPayload>;
  if (!isValidConnectionId(payload.connectionId)) {
    return { valid: false, error: "Relay session missing connectionId" };
  }

  const expiresAtMs = Date.parse(String(payload.expiresAt || ""));
  if (!Number.isFinite(expiresAtMs)) return { valid: false, error: "Relay session missing expiresAt" };
  if (expiresAtMs <= now.getTime()) return { valid: false, error: "Relay session expired" };

  const normalized = normalizePayload({
    connectionId: payload.connectionId,
    clerkUserId: payload.clerkUserId,
    deviceId: payload.deviceId,
    scopes: payload.scopes,
    issuedAt: String(payload.issuedAt || ""),
    expiresAt: String(payload.expiresAt),
  });

  return {
    valid: true,
    session: {
      payload: normalized,
      routeKey: getRelayRouteKey(normalized.connectionId),
    },
  };
}
