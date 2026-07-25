import { createHash, createHmac, hkdfSync } from "node:crypto";
import canonicalize from "canonicalize";

function sha256(value) {
  const canonical = canonicalize(value);
  if (typeof canonical !== "string") throw new Error("Value cannot be canonicalized");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function commandPayloadProjection(command) {
  const { payloadHash: _payloadHash, stepAuthorization: _stepAuthorization, permissionGrant: _permissionGrant, ...projection } = command;
  return projection;
}

export function commandPayloadHash(command) {
  return sha256(commandPayloadProjection(command));
}

export function planContentProjection(plan) {
  const {
    contentHash: _contentHash,
    fingerprint: _fingerprint,
    status: _status,
    capabilities: _capabilities,
    executionSnapshotId: _executionSnapshotId,
    executionSnapshotHash: _executionSnapshotHash,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    jobId: _jobId,
    ...immutable
  } = plan;
  return {
    ...immutable,
    phases: immutable.phases.map(({ status: _phaseStatus, ...phase }) => phase),
    steps: immutable.steps.map(({ status: _stepStatus, reason: _reason, ...step }) => step),
  };
}

export function planFingerprint(plan) {
  return sha256({
    schemaVersion: plan.schemaVersion,
    planId: plan.id,
    revision: plan.revision,
    contentHash: plan.contentHash,
    executionSnapshotId: plan.executionSnapshotId,
    executionSnapshotHash: plan.executionSnapshotHash,
  });
}

export function planContentHash(plan) {
  return sha256(planContentProjection(plan));
}

export function catalogHash(tools) {
  return sha256(tools);
}

export function executionStepPayloadProjection(step) {
  const { payloadHash: _payloadHash, ...projection } = step;
  return projection;
}

export function executionStepPayloadHash(step) {
  return sha256(executionStepPayloadProjection(step));
}

export function executionSnapshotProjection(snapshot) {
  const { snapshotHash: _snapshotHash, ...projection } = snapshot;
  return projection;
}

export function executionSnapshotHash(snapshot) {
  return sha256(executionSnapshotProjection(snapshot));
}

export function authorizationSigningProjection(value) {
  const { signature: _signature, ...projection } = value;
  return projection;
}

export function authorizationSigningBytes(value) {
  const canonical = canonicalize(authorizationSigningProjection(value));
  if (typeof canonical !== "string") throw new Error("Authorization cannot be canonicalized");
  return Buffer.from(canonical, "utf8");
}

export function pipeHandshakeTranscriptProjection(value) {
  return {
    protocolVersion: value.protocolVersion,
    desktopDeviceId: value.desktopDeviceId,
    runtimeId: value.runtimeId,
    revitInstanceId: value.revitInstanceId,
    sessionId: value.sessionId,
    pluginPid: value.pluginPid,
    pluginVersion: value.pluginVersion,
    catalogHash: value.catalogHash,
    maxFrameBytes: value.maxFrameBytes,
    clientNonce: value.clientNonce,
    serverNonce: value.serverNonce,
    clientTimestampUnixMs: value.clientTimestampUnixMs,
    serverTimestampUnixMs: value.serverTimestampUnixMs,
  };
}

export function pipeHandshakeTranscriptHash(value) {
  return sha256(pipeHandshakeTranscriptProjection(value));
}

export function pipeProof(secret, label, transcriptHash) {
  return createHmac("sha256", secret)
    .update(`datumm-pipe-v2:${label}:`, "utf8")
    .update(Buffer.from(transcriptHash, "hex"))
    .digest("base64url");
}

export function pipeSessionKey(secret, transcriptHash, direction) {
  const info = Buffer.from(`datumm-pipe-v2:${direction}`, "utf8");
  return Buffer.from(hkdfSync("sha256", secret, Buffer.from(transcriptHash, "hex"), info, 32));
}

export function authenticatedFrameProjection(frame) {
  const { mac: _mac, ...projection } = frame;
  return projection;
}

export function authenticatedFrameMac(frame, key) {
  const canonical = canonicalize(authenticatedFrameProjection(frame));
  if (typeof canonical !== "string") throw new Error("Authenticated frame cannot be canonicalized");
  return createHmac("sha256", key).update(canonical, "utf8").digest("base64url");
}

export function pipeAcceptedProjection(value) {
  const { serverFinishedMac: _serverFinishedMac, ...projection } = value;
  return projection;
}

export function pipeAcceptedMac(value, key) {
  const canonical = canonicalize(pipeAcceptedProjection(value));
  if (typeof canonical !== "string") throw new Error("Pipe acceptance cannot be canonicalized");
  return createHmac("sha256", key).update(canonical, "utf8").digest("base64url");
}

export function canonicalSha256(value) {
  return sha256(value);
}
