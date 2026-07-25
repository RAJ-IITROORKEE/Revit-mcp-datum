import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sign } from "node:crypto";
import {
  authenticatedFrameMac,
  authorizationSigningBytes,
  canonicalSha256,
  commandPayloadHash,
  executionSnapshotHash,
  executionStepPayloadHash,
  pipeHandshakeTranscriptHash,
  pipeAcceptedMac,
  pipeProof,
  pipeSessionKey,
  planContentHash,
  planFingerprint,
} from "./local-runtime-canonical.mjs";
import { FIXTURE_ISSUER, FIXTURE_KID, FIXTURE_PRIVATE_KEY } from "./fixture-signing-key.mjs";
import { FIXTURE_PIPE_SECRET } from "./fixture-pipe-secret.mjs";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts", "desktop-bridge", "v2", "fixtures");
async function load(name) {
  return JSON.parse(await readFile(join(fixtures, name), "utf8"));
}
async function save(name, value) {
  await writeFile(join(fixtures, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const manifest = JSON.parse(await readFile(join(fixtures, "..", "tool-policy-manifest.json"), "utf8"));
const signedManifest = {
  algorithm: "Ed25519",
  issuer: FIXTURE_ISSUER,
  kid: FIXTURE_KID,
  manifest,
  signature: "pending",
};
signedManifest.signature = sign(null, authorizationSigningBytes(signedManifest), FIXTURE_PRIVATE_KEY).toString("base64url");
await save("signed-tool-policy-manifest.json", signedManifest);
const runtime = await load("runtime-session.json");
runtime.catalogVersion = manifest.catalogVersion;
runtime.catalogHash = manifest.catalogHash;
await save("runtime-session.json", runtime);
const plan = await load("plan-artifact.json");
plan.contentHash = planContentHash(plan);

const snapshot = await load("execution-snapshot.json");
snapshot.planId = plan.id;
snapshot.planRevision = plan.revision;
snapshot.planContentHash = plan.contentHash;
snapshot.policyCatalogVersion = manifest.catalogVersion;
snapshot.policyCatalogHash = manifest.catalogHash;
for (const step of snapshot.steps) step.payloadHash = executionStepPayloadHash(step);
snapshot.snapshotHash = executionSnapshotHash(snapshot);
await save("execution-snapshot.json", snapshot);

plan.executionSnapshotId = snapshot.snapshotId;
plan.executionSnapshotHash = snapshot.snapshotHash;
plan.fingerprint = planFingerprint(plan);
await save("plan-artifact.json", plan);

const readCommand = await load("read-command.json");
readCommand.payloadHash = commandPayloadHash(readCommand);
await save("read-command.json", readCommand);

const mutationCommand = await load("mutation-command.json");
mutationCommand.planId = plan.id;
mutationCommand.planRevision = plan.revision;
mutationCommand.planFingerprint = plan.fingerprint;
mutationCommand.executionSnapshotId = plan.executionSnapshotId;
mutationCommand.executionSnapshotHash = plan.executionSnapshotHash;
mutationCommand.payloadHash = commandPayloadHash(mutationCommand);
mutationCommand.stepAuthorization = {
  algorithm: "Ed25519",
  issuer: FIXTURE_ISSUER,
  kid: FIXTURE_KID,
  jti: "step-auth-01J000000000000000000",
  userSubject: "user_fixture_001",
  desktopDeviceId: "desktop-device-001",
  runtimeId: mutationCommand.runtimeId,
  jobId: mutationCommand.jobId,
  revitInstanceId: mutationCommand.revitInstanceId,
  documentFingerprint: mutationCommand.documentFingerprint,
  leaseEpoch: mutationCommand.leaseEpoch,
  executionSnapshotId: mutationCommand.executionSnapshotId,
  executionSnapshotHash: mutationCommand.executionSnapshotHash,
  planId: mutationCommand.planId,
  planRevision: mutationCommand.planRevision,
  planFingerprint: mutationCommand.planFingerprint,
  stepId: mutationCommand.stepId,
  tool: mutationCommand.tool,
  payloadHash: mutationCommand.payloadHash,
  issuedAt: "2026-07-26T12:00:00.000Z",
  expiresAt: "2026-07-26T12:10:00.000Z",
  signature: "pending"
};
mutationCommand.stepAuthorization.signature = sign(null, authorizationSigningBytes(mutationCommand.stepAuthorization), FIXTURE_PRIVATE_KEY).toString("base64url");
await save("mutation-command.json", mutationCommand);

for (const name of ["completed-response.json", "unknown-response.json", "invalid-unsafe-response.json"]) {
  const response = await load(name);
  response.payloadHash = mutationCommand.payloadHash;
  await save(name, response);
}

const interaction = await load("interaction-request.json");
interaction.planFingerprint = plan.fingerprint;
await save("interaction-request.json", interaction);
const interactionResponse = await load("interaction-response.json");
delete interactionResponse.permissionGrantId;
interactionResponse.planFingerprint = plan.fingerprint;
interactionResponse.decision = "approve";
interactionResponse.permissionGrant = {
  algorithm: "Ed25519",
  issuer: FIXTURE_ISSUER,
  kid: FIXTURE_KID,
  jti: "permission-grant-01J0000000000000",
  permissionRequestId: interaction.requestId,
  permissionResponseId: interactionResponse.responseId,
  decision: "approve",
  userSubject: "user_fixture_001",
  desktopDeviceId: "desktop-device-001",
  runtimeId: interactionResponse.runtimeId,
  jobId: interactionResponse.jobId,
  revitInstanceId: interaction.revitInstanceId,
  documentFingerprint: interaction.documentFingerprint,
  leaseEpoch: interactionResponse.leaseEpoch,
  tool: interaction.tool,
  payloadHash: interaction.payloadHash,
  issuedAt: "2026-07-26T12:03:00.000Z",
  expiresAt: "2026-07-26T12:08:00.000Z",
  signature: "pending"
};
interactionResponse.permissionGrant.signature = sign(null, authorizationSigningBytes(interactionResponse.permissionGrant), FIXTURE_PRIVATE_KEY).toString("base64url");
await save("interaction-response.json", interactionResponse);

const challenge = await load("pipe-challenge.json");
challenge.catalogHash = manifest.catalogHash;
challenge.transcriptHash = pipeHandshakeTranscriptHash(challenge);
challenge.serverProof = pipeProof(FIXTURE_PIPE_SECRET, "server-proof", challenge.transcriptHash);
await save("pipe-challenge.json", challenge);

const proof = await load("pipe-proof.json");
proof.transcriptHash = challenge.transcriptHash;
proof.clientProof = pipeProof(FIXTURE_PIPE_SECRET, "client-proof", challenge.transcriptHash);
await save("pipe-proof.json", proof);

const accepted = await load("pipe-accepted.json");
accepted.transcriptHash = challenge.transcriptHash;
accepted.sessionId = challenge.sessionId;
accepted.serverFinishedMac = pipeAcceptedMac(accepted, pipeSessionKey(FIXTURE_PIPE_SECRET, challenge.transcriptHash, "plugin-to-client"));
await save("pipe-accepted.json", accepted);

const frame = await load("authenticated-frame.json");
frame.payloadHash = canonicalSha256(frame.payload);
frame.mac = authenticatedFrameMac(frame, pipeSessionKey(FIXTURE_PIPE_SECRET, challenge.transcriptHash, "client-to-plugin"));
await save("authenticated-frame.json", frame);

console.log(`Updated canonical fixtures for plan ${plan.fingerprint} and snapshot ${snapshot.snapshotHash}.`);
