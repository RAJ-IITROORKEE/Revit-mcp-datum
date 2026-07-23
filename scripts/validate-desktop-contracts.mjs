import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts", "desktop-bridge", "v1");

const schemaFiles = [
  "bridge-command.schema.json",
  "bridge-response.schema.json",
  "relay-session-claims.schema.json",
  "job-event.schema.json",
];

const fixtureFiles = [
  "read-command.json",
  "mutation-command.json",
  "completed-response.json",
  "unknown-response.json",
  "terminal-warning-event.json",
  "terminal-failure-event.json",
];

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of schemaFiles) {
  const schema = await loadJson(join(root, file));
  assert(schema.$schema, `${file}: missing $schema`);
  assert(schema.$id, `${file}: missing $id`);
  assert(schema.type === "object", `${file}: root must be an object schema`);
}

const readCommand = await loadJson(join(root, "fixtures", "read-command.json"));
const mutationCommand = await loadJson(join(root, "fixtures", "mutation-command.json"));
const completedResponse = await loadJson(join(root, "fixtures", "completed-response.json"));
const unknownResponse = await loadJson(join(root, "fixtures", "unknown-response.json"));
const warningEvent = await loadJson(join(root, "fixtures", "terminal-warning-event.json"));
const failureEvent = await loadJson(join(root, "fixtures", "terminal-failure-event.json"));

assert(readCommand.protocolVersion === 1, "read fixture: protocol version");
assert(readCommand.type === "command", "read fixture: command type");
assert(readCommand.mutationClass === "read", "read fixture: mutation class");
assert(!("idempotencyKey" in readCommand), "read fixture: must not require an idempotency key");

assert(mutationCommand.mutationClass === "mutation", "mutation fixture: mutation class");
assert(typeof mutationCommand.idempotencyKey === "string", "mutation fixture: missing idempotency key");

for (const response of [completedResponse, unknownResponse]) {
  assert(response.type === "response", "response fixture: response type");
  assert(typeof response.commandId === "string", "response fixture: command ID");
  assert(typeof response.outcome === "string", "response fixture: outcome");
  assert(response.revitInstanceId && response.routeGeneration >= 1, "response fixture: route identity");
}
assert(completedResponse.outcome === "COMPLETED", "completed fixture: wrong outcome");
assert(completedResponse.createdElementIds.length === 1, "completed fixture: created ID preservation");
assert(unknownResponse.outcome === "OUTCOME_UNKNOWN", "unknown fixture: wrong outcome");
assert(unknownResponse.error.retryable === false, "unknown fixture: must not be retryable");

assert(warningEvent.terminal === false && warningEvent.severity === "warning", "warning event lifecycle");
assert(failureEvent.terminal === true && failureEvent.status === "RECOVERY_REQUIRED", "failure event recovery state");

for (const file of fixtureFiles) {
  await loadJson(join(root, "fixtures", file));
}

console.log(`Validated ${schemaFiles.length} schemas and ${fixtureFiles.length} fixtures.`);
