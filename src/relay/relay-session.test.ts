import assert from "node:assert/strict";
import {
  createRelaySession,
  getRelayRouteKey,
  RELAY_SESSION_PREFIX,
  verifyRelaySession,
} from "./relay-session.js";

const secret = "test-relay-secret";
const now = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date(now.getTime() + 60_000).toISOString();

const token = createRelaySession(
  {
    connectionId: "conn_123",
    endpointRole: "revit-plugin",
    clerkUserId: "user_123",
    deviceId: "device_123",
    scopes: ["revit:relay"],
    issuedAt: now.toISOString(),
    expiresAt,
  },
  secret
);

assert.ok(token.startsWith(RELAY_SESSION_PREFIX));

const verified = verifyRelaySession(token, secret, now);
assert.equal(verified.valid, true);
if (verified.valid) {
  assert.equal(verified.session.payload.connectionId, "conn_123");
  assert.equal(verified.session.payload.clerkUserId, "user_123");
  assert.equal(verified.session.routeKey, getRelayRouteKey("conn_123"));
}

const wrongSecret = verifyRelaySession(token, "wrong-secret", now);
assert.equal(wrongSecret.valid, false);

const expired = verifyRelaySession(token, secret, new Date(Date.parse(expiresAt) + 1));
assert.equal(expired.valid, false);

const notYetActive = createRelaySession({
  connectionId: "conn_123",
  endpointRole: "desktop-bridge",
  scopes: ["revit:relay"],
  issuedAt: now.toISOString(),
  notBefore: new Date(now.getTime() + 60_000).toISOString(),
  expiresAt,
}, secret);
assert.equal(verifyRelaySession(notYetActive, secret, now).valid, false);

assert.throws(() => createRelaySession({
  connectionId: "conn_123",
  endpointRole: "revit-plugin",
  scopes: [],
  issuedAt: now.toISOString(),
  expiresAt,
}, secret));

const tampered = `${token.slice(0, -1)}x`;
assert.equal(verifyRelaySession(tampered, secret, now).valid, false);

assert.throws(() => createRelaySession({ connectionId: "", endpointRole: "revit-plugin", issuedAt: now.toISOString(), expiresAt }, secret));
