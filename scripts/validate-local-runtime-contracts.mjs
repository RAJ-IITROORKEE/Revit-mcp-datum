import { readFile } from "node:fs/promises";
import { verify } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { registerTools } from "../build/tools/register.js";
import {
  authenticatedFrameMac,
  authorizationSigningBytes,
  canonicalSha256,
  catalogHash,
  commandPayloadHash,
  executionSnapshotHash,
  executionStepPayloadHash,
  pipeAcceptedMac,
  pipeHandshakeTranscriptHash,
  pipeProof,
  pipeSessionKey,
  planFingerprint,
  planContentHash,
} from "./local-runtime-canonical.mjs";
import { FIXTURE_ISSUER, FIXTURE_KID, FIXTURE_PUBLIC_KEY } from "./fixture-signing-key.mjs";
import { FIXTURE_PIPE_SECRET } from "./fixture-pipe-secret.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts", "desktop-bridge", "v2");
const schemaFiles = [
  "runtime-session.schema.json",
  "step-authorization.schema.json",
  "permission-grant.schema.json",
  "bridge-command.schema.json",
  "bridge-response.schema.json",
  "job-event.schema.json",
  "interaction-request.schema.json",
  "interaction-response.schema.json",
  "todo-update.schema.json",
  "tool-policy-manifest.schema.json",
  "signed-tool-policy-manifest.schema.json",
  "policy-bundle.schema.json",
  "policy-provenance-attestation.schema.json",
  "trust-root.schema.json",
  "plan-artifact.schema.json",
  "execution-snapshot.schema.json",
  "pipe-handshake.schema.json",
  "authenticated-frame.schema.json",
];
const fixtureSchema = new Map([
  ["runtime-session.json", "runtime-session.schema.json"],
  ["read-command.json", "bridge-command.schema.json"],
  ["mutation-command.json", "bridge-command.schema.json"],
  ["completed-response.json", "bridge-response.schema.json"],
  ["unknown-response.json", "bridge-response.schema.json"],
  ["job-event.json", "job-event.schema.json"],
  ["interaction-request.json", "interaction-request.schema.json"],
  ["interaction-response.json", "interaction-response.schema.json"],
  ["todo-update.json", "todo-update.schema.json"],
  ["plan-artifact.json", "plan-artifact.schema.json"],
  ["execution-snapshot.json", "execution-snapshot.schema.json"],
  ["pipe-hello.json", "pipe-handshake.schema.json"],
  ["pipe-challenge.json", "pipe-handshake.schema.json"],
  ["pipe-proof.json", "pipe-handshake.schema.json"],
  ["pipe-accepted.json", "pipe-handshake.schema.json"],
  ["authenticated-frame.json", "authenticated-frame.schema.json"],
  ["tool-policy-manifest.json", "tool-policy-manifest.schema.json"],
  ["signed-tool-policy-manifest.json", "signed-tool-policy-manifest.schema.json"],
  ["trust-root.v1.json", "trust-root.schema.json"],
]);

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasForbiddenPublicField(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenPublicField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    ["thought", "reasoning", "analysis", "rawResponse", "systemPrompt", "prompt", "rawToolResult", "toolResult"].includes(key)
      || hasForbiddenPublicField(child));
}

function validatePlanGraph(plan) {
  const stepIds = new Set(plan.steps.map((step) => step.id));
  assert(stepIds.size === plan.steps.length, "plan: duplicate step IDs");
  const orderedSteps = plan.steps.slice().sort((a, b) => a.order - b.order);
  assert(new Set(orderedSteps.map((step) => step.order)).size === orderedSteps.length, "plan: duplicate step order");
  assert(orderedSteps.every((step, index) => step.order === index + 1), "plan: execution order must be contiguous from 1");
  assert(orderedSteps[0]?.toolName === "get_levels_list", "plan: minimum-order tool must be get_levels_list");

  const phaseIds = new Set(plan.phases.map((phase) => phase.id));
  assert(phaseIds.size === plan.phases.length, "plan: duplicate phase IDs");
  const orderedPhases = plan.phases.slice().sort((a, b) => a.order - b.order);
  assert(new Set(orderedPhases.map((phase) => phase.order)).size === orderedPhases.length, "plan: duplicate phase order");
  assert(orderedPhases.every((phase, index) => phase.order === index + 1), "plan: phase order must be contiguous from 1");
  const membership = new Map();
  for (const phase of plan.phases) {
    for (const stepId of phase.stepIds) membership.set(stepId, (membership.get(stepId) ?? 0) + 1);
  }
  for (const step of plan.steps) {
    assert(phaseIds.has(step.phaseId), `plan: unknown phase for ${step.id}`);
    assert(membership.get(step.id) === 1, `plan: ${step.id} must belong to exactly one phase`);
    assert(plan.phases.find((phase) => phase.id === step.phaseId).stepIds.includes(step.id), `plan: ${step.id} is not in its declared phase`);
    assert(step.dependsOn.every((dependency) => stepIds.has(dependency) && dependency !== step.id), `plan: invalid dependency for ${step.id}`);
    assert(step.dependsOn.every((dependency) => plan.steps.find((candidate) => candidate.id === dependency).order < step.order), `plan: dependency must precede ${step.id}`);
  }
  for (const phase of orderedPhases) {
    const phaseSteps = orderedSteps.filter((step) => step.phaseId === phase.id);
    assert(JSON.stringify(phase.stepIds) === JSON.stringify(phaseSteps.map((step) => step.id)), `plan: ${phase.id} step order differs from execution order`);
    const laterSteps = orderedSteps.filter((step) => orderedPhases.find((candidate) => candidate.id === step.phaseId).order > phase.order);
    if (phaseSteps.length && laterSteps.length) assert(Math.max(...phaseSteps.map((step) => step.order)) < Math.min(...laterSteps.map((step) => step.order)), `plan: ${phase.id} overlaps a later phase`);
  }
  assert([...membership.keys()].every((id) => stepIds.has(id)), "plan: phase references unknown step");

  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(plan.steps.map((step) => [step.id, step]));
  function visit(id) {
    if (visiting.has(id)) throw new Error(`plan: dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of stepIds) visit(id);
}

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const schemas = new Map();
for (const file of schemaFiles) {
  const schema = await loadJson(join(root, file));
  assert(schema.$id?.includes("/desktop-bridge/v2/"), `${file}: wrong contract ID`);
  assert(schema.type === "object" && schema.additionalProperties === false, `${file}: closed object schema required`);
  schemas.set(file, schema);
  ajv.addSchema(schema);
}

const fixtures = new Map();
for (const [file, schemaFile] of fixtureSchema) {
  const fixturePath = file === "tool-policy-manifest.json" || file === "trust-root.v1.json" ? join(root, file) : join(root, "fixtures", file);
  const fixture = await loadJson(fixturePath);
  const validate = ajv.getSchema(schemas.get(schemaFile).$id);
  assert(validate(fixture), `${file}: schema validation failed: ${ajv.errorsText(validate.errors)}`);
  fixtures.set(file, fixture);
}

const manifest = fixtures.get("tool-policy-manifest.json");
const policyByName = new Map(manifest.tools.map((tool) => [tool.name, tool]));
function commandMatchesPolicy(command) {
  return policyByName.get(command.tool)?.mutationClass === command.mutationClass;
}

const unsafeResponse = await loadJson(join(root, "fixtures", "invalid-unsafe-response.json"));
const validateResponse = ajv.getSchema(schemas.get("bridge-response.schema.json").$id);
assert(!validateResponse(unsafeResponse), "negative response fixture: retryable unknown outcome must fail schema");
const validateCommand = ajv.getSchema(schemas.get("bridge-command.schema.json").$id);
const unboundMutation = { ...fixtures.get("mutation-command.json") };
delete unboundMutation.planFingerprint;
assert(!validateCommand(unboundMutation), "negative command: unbound mutation must fail schema");
const validateInteraction = ajv.getSchema(schemas.get("interaction-request.schema.json").$id);
const misclassifiedPermission = { ...fixtures.get("interaction-request.json"), kind: "question" };
assert(!validateInteraction(misclassifiedPermission), "negative interaction: dangerous action cannot be a question");
const cyclicPlan = await loadJson(join(root, "fixtures", "invalid-cyclic-plan.json"));
const validatePlan = ajv.getSchema(schemas.get("plan-artifact.schema.json").$id);
assert(validatePlan(cyclicPlan), "negative cyclic plan must be structurally valid before semantic rejection");
let cycleRejected = false;
try { validatePlanGraph(cyclicPlan); } catch { cycleRejected = true; }
assert(cycleRejected, "negative cyclic plan must fail semantic validation");

const runtime = fixtures.get("runtime-session.json");
assert(runtime.executionHost === "DESKTOP" && runtime.capabilities.includes("revit-mcp-152"), "runtime: local host capability");
assert(runtime.catalogVersion === manifest.catalogVersion && runtime.catalogHash === manifest.catalogHash, "runtime: signed catalog identity mismatch");
const readCommand = fixtures.get("read-command.json");
const mutationCommand = fixtures.get("mutation-command.json");
assert(readCommand.tool === "get_levels_list" && readCommand.mutationClass === "read", "read command: mandatory setup example");
assert(commandMatchesPolicy(readCommand), "read command: manifest classification mismatch");
for (const field of ["planId", "planRevision", "planFingerprint", "stepId", "executionSnapshotId", "executionSnapshotHash", "stepAuthorization", "idempotencyKey", "sessionTag", "payloadHash"]) {
  assert(mutationCommand[field], `mutation command: missing ${field}`);
}
assert(commandMatchesPolicy(mutationCommand), "mutation command: manifest classification mismatch");
assert(mutationCommand.payloadHash === commandPayloadHash(mutationCommand), "mutation command: canonical payload hash mismatch");
assert(mutationCommand.stepAuthorization.payloadHash === mutationCommand.payloadHash, "mutation command: signed step payload mismatch");
assert(mutationCommand.stepAuthorization.executionSnapshotHash === mutationCommand.executionSnapshotHash, "mutation command: signed snapshot mismatch");
assert(mutationCommand.stepAuthorization.issuer === FIXTURE_ISSUER && mutationCommand.stepAuthorization.kid === FIXTURE_KID, "mutation command: signing identity");
assert(verify(null, authorizationSigningBytes(mutationCommand.stepAuthorization), FIXTURE_PUBLIC_KEY, Buffer.from(mutationCommand.stepAuthorization.signature, "base64url")), "mutation command: fixture signature verification");
const tamperedAuthorization = { ...mutationCommand.stepAuthorization, tool: "delete_elements" };
assert(!verify(null, authorizationSigningBytes(tamperedAuthorization), FIXTURE_PUBLIC_KEY, Buffer.from(tamperedAuthorization.signature, "base64url")), "mutation command: tampered authorization must fail signature");
const tamperedMutation = structuredClone(mutationCommand);
tamperedMutation.args.walls[0].endPoint.x += 1;
assert(tamperedMutation.payloadHash !== commandPayloadHash(tamperedMutation), "mutation command: tampered arguments must invalidate hash");
const mislabeledDangerousCommand = { ...readCommand, tool: "delete_elements", mutationClass: "read" };
assert(validateCommand(mislabeledDangerousCommand), "negative command: mislabeled dangerous command is structurally valid");
assert(!commandMatchesPolicy(mislabeledDangerousCommand), "negative command: manifest must reject dangerous tool labeled read");
const completed = fixtures.get("completed-response.json");
const unknown = fixtures.get("unknown-response.json");
assert(completed.journalState === "TERMINAL" && completed.outcome === "COMPLETED" && completed.createdElementIds.length === 1, "completed response: evidence");
assert(unknown.journalState === "DISPATCHED" && unknown.outcome === "OUTCOME_UNKNOWN" && unknown.error.retryable === false, "unknown response: no retry");

const event = fixtures.get("job-event.json");
assert(event.sequence >= 1 && event.stateVersion >= 1 && event.kind === "tool.completed", "event: durable ordering");
const interaction = fixtures.get("interaction-request.json");
assert(interaction.kind === "permission" && interaction.runtimeId && interaction.planFingerprint, "interaction: dangerous permission identity");
const interactionResponse = fixtures.get("interaction-response.json");
assert(interactionResponse.requestId === interaction.requestId && interactionResponse.planFingerprint === interaction.planFingerprint, "interaction response: request/revision binding");
assert(interactionResponse.kind === "permission" && interactionResponse.decision === "approve" && interactionResponse.permissionGrant, "interaction response: server-issued permission grant");
assert(interactionResponse.permissionGrant.permissionRequestId === interaction.requestId, "interaction response: grant request binding");
for (const field of ["tool", "payloadHash", "revitInstanceId", "documentFingerprint", "runtimeId", "jobId", "leaseEpoch"]) {
  assert(interactionResponse.permissionGrant[field] === interaction[field], `interaction response: grant ${field} mismatch`);
}
assert(interactionResponse.permissionGrant.issuer === FIXTURE_ISSUER && interactionResponse.permissionGrant.kid === FIXTURE_KID, "interaction response: grant signing identity");
assert(verify(null, authorizationSigningBytes(interactionResponse.permissionGrant), FIXTURE_PUBLIC_KEY, Buffer.from(interactionResponse.permissionGrant.signature, "base64url")), "interaction response: grant signature verification");
const substitutedGrant = { ...interactionResponse.permissionGrant, payloadHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
assert(!verify(null, authorizationSigningBytes(substitutedGrant), FIXTURE_PUBLIC_KEY, Buffer.from(substitutedGrant.signature, "base64url")), "interaction response: substituted grant payload must fail signature");

const todos = fixtures.get("todo-update.json").todos;
assert(todos.filter((todo) => todo.status === "in_progress").length === 1, "todos: exactly one active item");
const todoIds = new Set(todos.map((todo) => todo.id));
assert(todoIds.size === todos.length && todos.every((todo) => todo.dependsOn.every((id) => todoIds.has(id))), "todos: unique IDs and valid dependencies");

const plan = fixtures.get("plan-artifact.json");
validatePlanGraph(plan);
assert(plan.fingerprint === planFingerprint(plan), "plan: canonical fingerprint mismatch");
assert(plan.contentHash === planContentHash(plan), "plan: canonical content hash mismatch");
const replacedSnapshotPlan = { ...plan, executionSnapshotHash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" };
assert(replacedSnapshotPlan.fingerprint !== planFingerprint(replacedSnapshotPlan), "plan: replacing executable snapshot must invalidate approval fingerprint");
assert(plan.units === "mm" && plan.dimensions.footprint.widthMm === 12192 && plan.dimensions.footprint.heightMm === 15240, "plan: 40x50 ft millimeter conversion");
const wallIds = new Set(plan.diagram.walls.map((wall) => wall.id));
assert(plan.diagram.openings.every((opening) => wallIds.has(opening.wallId)), "plan: opening wall reference");
const unsafePlan = structuredClone(plan);
unsafePlan.steps[0].sanitizedArgs = { reasoning: "hidden" };
assert(!validatePlan(unsafePlan), "negative plan: forbidden sanitized argument key must fail schema");

const snapshot = fixtures.get("execution-snapshot.json");
assert(snapshot.snapshotHash === executionSnapshotHash(snapshot), "execution snapshot: canonical hash mismatch");
assert(snapshot.snapshotId === plan.executionSnapshotId && snapshot.snapshotHash === plan.executionSnapshotHash, "execution snapshot: public plan reference mismatch");
assert(snapshot.planId === plan.id && snapshot.planRevision === plan.revision && snapshot.planContentHash === plan.contentHash, "execution snapshot: plan content identity mismatch");
assert(snapshot.policyCatalogVersion === manifest.catalogVersion && snapshot.policyCatalogHash === manifest.catalogHash, "execution snapshot: signed policy identity mismatch");
const orderedSnapshotSteps = snapshot.steps.slice().sort((a, b) => a.order - b.order);
assert(orderedSnapshotSteps.every((step, index) => step.order === index + 1), "execution snapshot: step order must be contiguous from 1");
assert(orderedSnapshotSteps[0]?.tool === "get_levels_list", "execution snapshot: first tool must be get_levels_list");
const snapshotStepIds = new Set(snapshot.steps.map((step) => step.stepId));
assert(snapshotStepIds.size === snapshot.steps.length, "execution snapshot: duplicate step IDs");
for (const step of snapshot.steps) {
  assert(step.payloadHash === executionStepPayloadHash(step), `execution snapshot: ${step.stepId} payload hash mismatch`);
  assert(step.dependsOn.every((dependency) => snapshotStepIds.has(dependency) && snapshot.steps.find((candidate) => candidate.stepId === dependency).order < step.order), `execution snapshot: invalid dependency for ${step.stepId}`);
  const policy = policyByName.get(step.tool);
  assert(policy && policy.mutationClass === step.mutationClass && policy.timeoutMs === step.timeoutMs, `execution snapshot: ${step.stepId} policy mismatch`);
}
const authorizedStep = snapshot.steps.find((step) => step.stepId === mutationCommand.stepId);
assert(authorizedStep && authorizedStep.tool === mutationCommand.tool, "mutation command: snapshot tool mismatch");
assert(JSON.stringify(authorizedStep.args) === JSON.stringify(mutationCommand.args), "mutation command: snapshot arguments mismatch");
const tamperedSnapshot = structuredClone(snapshot);
tamperedSnapshot.steps[1].args.walls[0].endPoint.x += 1;
assert(tamperedSnapshot.snapshotHash !== executionSnapshotHash(tamperedSnapshot), "execution snapshot: tampered arguments must invalidate hash");

const challenge = fixtures.get("pipe-challenge.json");
const proof = fixtures.get("pipe-proof.json");
const accepted = fixtures.get("pipe-accepted.json");
assert(challenge.transcriptHash === pipeHandshakeTranscriptHash(challenge), "pipe handshake: transcript hash mismatch");
assert(challenge.serverProof === pipeProof(FIXTURE_PIPE_SECRET, "server-proof", challenge.transcriptHash), "pipe handshake: server proof mismatch");
assert(proof.transcriptHash === challenge.transcriptHash && proof.clientProof === pipeProof(FIXTURE_PIPE_SECRET, "client-proof", challenge.transcriptHash), "pipe handshake: client proof mismatch");
const serverKey = pipeSessionKey(FIXTURE_PIPE_SECRET, challenge.transcriptHash, "plugin-to-client");
assert(accepted.sessionId === challenge.sessionId && accepted.transcriptHash === challenge.transcriptHash && accepted.clientToPluginInitialSequence === 1 && accepted.pluginToClientInitialSequence === 1, "pipe handshake: accepted identity mismatch");
assert(accepted.serverFinishedMac === pipeAcceptedMac(accepted, serverKey), "pipe handshake: server finished MAC mismatch");
const substitutedSession = { ...accepted, sessionId: "pipe-session-substituted-000000001" };
assert(accepted.serverFinishedMac !== pipeAcceptedMac(substitutedSession, serverKey), "pipe handshake: session substitution must fail finished MAC");
const downgradedFrameLimit = { ...accepted, maxFrameBytes: accepted.maxFrameBytes / 2 };
assert(accepted.serverFinishedMac !== pipeAcceptedMac(downgradedFrameLimit, serverKey), "pipe handshake: frame-limit downgrade must fail finished MAC");
const tamperedChallenge = { ...challenge, pluginPid: challenge.pluginPid + 1 };
assert(tamperedChallenge.transcriptHash !== pipeHandshakeTranscriptHash(tamperedChallenge), "pipe handshake: transcript tampering must fail");
const frame = fixtures.get("authenticated-frame.json");
const clientKey = pipeSessionKey(FIXTURE_PIPE_SECRET, challenge.transcriptHash, "client-to-plugin");
const pluginKey = serverKey;
assert(frame.payloadHash === canonicalSha256(frame.payload), "authenticated frame: payload hash mismatch");
assert(frame.mac === authenticatedFrameMac(frame, clientKey), "authenticated frame: MAC mismatch");
assert(frame.mac !== authenticatedFrameMac(frame, pluginKey), "authenticated frame: directional keys must differ");
const replayedFrame = { ...frame, sequence: 2 };
assert(frame.mac !== authenticatedFrameMac(replayedFrame, clientKey), "authenticated frame: sequence tampering must fail MAC");

const journaledAuthorization = mutationCommand.stepAuthorization;
const identicalRetransmission = structuredClone(mutationCommand);
assert(identicalRetransmission.commandId === mutationCommand.commandId && identicalRetransmission.payloadHash === mutationCommand.payloadHash && identicalRetransmission.stepAuthorization.jti === journaledAuthorization.jti, "journal replay: identical command retains authorization identity");
const crossCommandReplay = structuredClone(mutationCommand);
crossCommandReplay.commandId = "cmd-mutation-replayed-000000001";
crossCommandReplay.payloadHash = commandPayloadHash(crossCommandReplay);
assert(crossCommandReplay.payloadHash !== journaledAuthorization.payloadHash, "journal replay: cross-command JTI reuse must fail signed payload binding");

for (const [file, fixture] of fixtures) assert(!hasForbiddenPublicField(fixture), `${file}: forbidden hidden-reasoning field`);

assert(manifest.localToolCount === 152 && manifest.tools.length === 152, "tool policy: exact local count");
assert(new Set(manifest.tools.map((tool) => tool.name)).size === 152, "tool policy: duplicate names");
assert(manifest.excludedCloudTools.slice().sort().join(",") === "query_stored_data,store_project_data,store_room_data", "tool policy: cloud-only exclusions");
assert(manifest.tools.every((tool) => tool.mutationClass === "read" || tool.retryPolicy === "never"), "tool policy: mutation retry prohibition");
for (const dangerousName of ["apply_view_template", "create_assembly", "create_design_option", "group_elements", "manage_phases", "manage_revisions", "manage_view_templates", "operate_element", "optimize_model", "send_code_to_revit"]) {
  assert(policyByName.get(dangerousName)?.mutationClass === "dangerous", `tool policy: ${dangerousName} must require permission`);
}
for (const creatorName of ["array_elements", "auto_furnish_room", "batch_dimension_elements", "batch_tag_elements", "copy_elements", "duplicate_view", "mirror_copy_layout", "mirror_elements", "route_conduit", "route_mep_path", "split_element", "tag_all_walls"]) {
  assert(policyByName.get(creatorName)?.createdIdsRequired === true, `tool policy: ${creatorName} must return created IDs when successful`);
}
const expectedHash = catalogHash(manifest.tools);
assert(manifest.catalogHash === expectedHash, "tool policy: catalog hash mismatch");
const signedManifest = fixtures.get("signed-tool-policy-manifest.json");
assert(signedManifest.issuer === FIXTURE_ISSUER && signedManifest.kid === FIXTURE_KID, "tool policy: signing identity");
assert(JSON.stringify(signedManifest.manifest) === JSON.stringify(manifest), "tool policy: signed fixture content mismatch");
assert(verify(null, authorizationSigningBytes(signedManifest), FIXTURE_PUBLIC_KEY, Buffer.from(signedManifest.signature, "base64url")), "tool policy: signature verification");
const tamperedManifest = structuredClone(signedManifest);
tamperedManifest.manifest.tools[0].mutationClass = "dangerous";
assert(!verify(null, authorizationSigningBytes(tamperedManifest), FIXTURE_PUBLIC_KEY, Buffer.from(tamperedManifest.signature, "base64url")), "tool policy: tampered manifest must fail signature");
const localToolNames = new Set(manifest.tools.map((tool) => tool.name));
assert(plan.steps.every((step) => !step.toolName || localToolNames.has(step.toolName)), "plan: tool missing from local catalog");

const registeredNames = [];
const diagnostics = [];
const server = { tool: (...args) => { registeredNames.push(String(args[0])); return {}; } };
const originalConsoleError = console.error;
console.error = (...args) => diagnostics.push(args.map(String).join(" "));
try { await registerTools(server); } finally { console.error = originalConsoleError; }
assert(!diagnostics.some((message) => /warning|error registering/i.test(message)), "tool policy: registration errors");
const actualLocalNames = registeredNames.filter((name) => !manifest.excludedCloudTools.includes(name)).sort();
assert(JSON.stringify(actualLocalNames) === JSON.stringify(manifest.tools.map((tool) => tool.name)), "tool policy: manifest membership differs from authoritative catalog");

console.log(`Validated v2 local runtime contracts: ${schemaFiles.length} schemas, ${fixtureSchema.size} valid fixtures, 2 negative fixtures, 152 tool policies.`);
