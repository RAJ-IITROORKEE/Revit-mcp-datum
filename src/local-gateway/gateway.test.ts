import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { policyCatalogHash, type LocalToolPolicy, type LocalToolPolicyManifest } from "../policy/local-tool-policy.js";
import { createLocalGateway, type TrustedRuntimeContext } from "./gateway.js";
import { loadLocalGatewayCatalog, type LocalToolModuleImporter } from "./manifest-loader.js";

function testPolicy(name: string, mutationClass: LocalToolPolicy["mutationClass"]): LocalToolPolicy {
  return {
    name,
    mutationClass,
    retryPolicy: mutationClass === "read" ? "read_only" : "never",
    timeoutMs: 1_000,
    createdIdsRequired: false,
    sessionTagSupported: false,
    automaticRollbackAllowed: false,
    maxArgsBytes: 1024,
    maxResultBytes: 2048,
  };
}

function testManifest(): LocalToolPolicyManifest {
  const tools = [
    testPolicy("get_levels_list", "read"),
    testPolicy("get_rooms_list", "read"),
    testPolicy("send_code_to_revit", "dangerous"),
    ...Array.from({ length: 149 }, (_, index) => testPolicy(`tool_${String(index).padStart(3, "0")}`, "mutation")),
  ].sort((left, right) => left.name.localeCompare(right.name));
  return {
    protocolVersion: 2,
    catalogVersion: "test-local-v2",
    catalogHash: policyCatalogHash(tools),
    localToolCount: 152,
    excludedCloudTools: ["query_stored_data", "store_project_data", "store_room_data"],
    prohibitedLlmTools: ["send_code_to_revit"],
    tools,
  };
}

function testImporter(): LocalToolModuleImporter {
  return async (name) => ({
    [`register_${name}`]: (server: { tool: (...args: unknown[]) => void }) => {
      server.tool(name, `${name} description`, { enabled: z.boolean().optional() }, () => undefined);
    },
  });
}

const sessionA: TrustedRuntimeContext = {
  runtimeId: "runtime-0000000000000001",
  desktopDeviceId: "device-0000000000000001",
  jobId: "job-1",
  connectionId: "connection-1",
  revitInstanceId: "revit-instance-000000001",
  documentFingerprint: "document-fingerprint-000000001",
  catalogHash: testManifest().catalogHash,
  policyHash: "b".repeat(64),
  policyReleaseId: "readonly-canary-release-001",
  policyProfileId: "local-revit-readonly-v3",
  routeGeneration: 1,
  leaseEpoch: 1,
};

const sessionB: TrustedRuntimeContext = {
  ...sessionA,
  connectionId: "connection-2",
  revitInstanceId: "revit-instance-000000002",
  documentFingerprint: "document-fingerprint-000000002",
};

function call(id: number, name = "get_levels_list", context: TrustedRuntimeContext = sessionA, args: unknown = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args, _meta: { ...context } },
  };
}

async function setup(options: Parameters<typeof createLocalGateway>[0] extends infer _T ? {
  readEnabled?: boolean;
  dispatcher?: Parameters<typeof createLocalGateway>[0]["dispatcher"];
  sessions?: Map<string, TrustedRuntimeContext>;
  maxQueueDepth?: number;
} : never = {}) {
  const manifest = testManifest();
  const catalog = await loadLocalGatewayCatalog({
    manifest,
    expectedCatalogHash: manifest.catalogHash,
    importModule: testImporter(),
    enabledToolNames: ["get_levels_list"],
    binding: {
      policyHash: sessionA.policyHash,
      policyReleaseId: sessionA.policyReleaseId,
      profileId: "local-revit-readonly-v3",
      catalogHash: manifest.catalogHash,
    },
  });
  const sessions = options.sessions ?? new Map([[sessionA.connectionId, sessionA]]);
  return createLocalGateway({
    catalog,
    readEnabled: options.readEnabled,
    dispatcher: options.dispatcher,
    maxQueueDepth: options.maxQueueDepth,
    resolveTrustedSession: (connectionId) => sessions.get(connectionId),
  });
}

function errorCode(response: unknown): string | undefined {
  return (response as { error?: { data?: { code?: string } } }).error?.data?.code;
}

test("tools/list exposes exactly the signed canary tool", async () => {
  const gateway = await setup();
  const response = await gateway.handle({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  const tools = (response as { result: { tools: Array<{ name: string }> } }).result.tools;
  const names = tools.map((tool) => tool.name);
  assert.equal(names.length, 1);
  assert.equal(names.includes("get_levels_list"), true);
  assert.equal(names.includes("get_rooms_list"), false);
  assert.equal(names.includes("send_code_to_revit"), false);
  assert.equal(names.includes("query_stored_data"), false);
  assert.deepEqual(names, [...names].sort());
  assert.equal(
    ((tools[0] as { inputSchema?: { properties?: Record<string, unknown> } }).inputSchema?.properties?.enabled as { type?: string })?.type,
    "boolean",
  );
});

test("read and mutation flags are server-owned and disabled by default", async () => {
  const gateway = await setup();
  const attemptedOverride = call(1) as ReturnType<typeof call> & { params: { _meta: Record<string, unknown> } };
  attemptedOverride.params._meta.localReadEnabled = true;
  assert.equal(errorCode(await gateway.handle(attemptedOverride)), "LOCAL_READ_DISABLED");
  assert.equal(errorCode(await gateway.handle(call(2, "tool_000"))), "TOOL_NOT_PROFILED");
});

test("Phase 3 has no production dispatcher but its injected boundary can dispatch policy-approved reads", async () => {
  const noDispatcher = await setup({ readEnabled: true });
  assert.equal(errorCode(await noDispatcher.handle(call(1))), "DISPATCH_DISABLED");

  const dispatched: string[] = [];
  const withFake = await setup({
    readEnabled: true,
    dispatcher: async (tool) => { dispatched.push(tool); return { items: [] }; },
  });
  assert.equal(errorCode(await withFake.handle(call(2, "get_levels_list"))), undefined);
  assert.deepEqual(dispatched, ["get_levels_list"]);
});

test("calls validate Zod arguments and exact trusted context before dispatch", async () => {
  let dispatches = 0;
  const gateway = await setup({
    readEnabled: true,
    dispatcher: async () => { dispatches += 1; return { levels: [] }; },
  });
  assert.equal(errorCode(await gateway.handle(call(1, "get_levels_list", sessionA, { enabled: "yes" }))), "INVALID_ARGUMENTS");
  assert.equal(errorCode(await gateway.handle(call(2, "get_levels_list", { ...sessionA, leaseEpoch: 2 }))), "CONTEXT_MISMATCH");
  assert.equal(errorCode(await gateway.handle(call(3, "get_levels_list", { ...sessionA, policyHash: "c".repeat(64) }))), "CONTEXT_MISMATCH");
  assert.equal(dispatches, 0);
});

test("trusted sessions must retain the verified policy binding", async () => {
  const stale = { ...sessionA, policyReleaseId: "readonly-canary-release-002" };
  const gateway = await setup({ sessions: new Map([[stale.connectionId, stale]]) });
  assert.equal(errorCode(await gateway.handle(call(1, "get_levels_list", stale))), "POLICY_BINDING_MISMATCH");
});

test("automatic retry requests are rejected and dispatch occurs once on timeout", async () => {
  let dispatches = 0;
  const gateway = await setup({
    readEnabled: true,
    dispatcher: async () => { dispatches += 1; return new Promise(() => undefined); },
  });
  const retried = call(1) as ReturnType<typeof call> & { params: { _meta: Record<string, unknown> } };
  retried.params._meta.retryRequested = true;
  assert.equal(errorCode(await gateway.handle(retried)), "RETRY_NOT_ALLOWED");
  assert.equal(errorCode(await gateway.handle(call(2))), "DISPATCH_TIMEOUT");
  assert.equal(dispatches, 1);
});

test("same-instance calls serialize while different instances run concurrently", async () => {
  let active = 0;
  let maximum = 0;
  const releases: Array<() => void> = [];
  const sessions = new Map([[sessionA.connectionId, sessionA], [sessionB.connectionId, sessionB]]);
  const gateway = await setup({
    readEnabled: true,
    sessions,
    dispatcher: async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return { levels: [] };
    },
  });

  const sameOne = gateway.handle(call(1, "get_levels_list", sessionA));
  const sameTwo = gateway.handle(call(2, "get_levels_list", sessionA));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(active, 1);
  releases.shift()?.();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(active, 1);
  releases.shift()?.();
  await Promise.all([sameOne, sameTwo]);
  assert.equal(maximum, 1);

  maximum = 0;
  const differentOne = gateway.handle(call(3, "get_levels_list", sessionA));
  const differentTwo = gateway.handle(call(4, "get_levels_list", sessionB));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(active, 2);
  assert.equal(maximum, 2);
  releases.splice(0).forEach((release) => release());
  await Promise.all([differentOne, differentTwo]);
});

test("trusted context is revalidated after queue wait", async () => {
  let current = sessionA;
  let dispatches = 0;
  let release!: () => void;
  const firstWait = new Promise<void>((resolve) => { release = resolve; });
  const gateway = await setup({
    readEnabled: true,
    sessions: new Map(),
    dispatcher: async () => {
      dispatches += 1;
      if (dispatches === 1) await firstWait;
      return { levels: [] };
    },
  });
  gateway.setTrustedSessionResolver((connectionId) => connectionId === current.connectionId ? current : undefined);
  const first = gateway.handle(call(1));
  const second = gateway.handle(call(2));
  await new Promise((resolve) => setTimeout(resolve, 5));
  current = { ...sessionA, leaseEpoch: 2 };
  release();
  await first;
  assert.equal(errorCode(await second), "CONTEXT_MISMATCH");
  assert.equal(dispatches, 1);
});

test("semantic plugin failures, secrets, and oversized results use bounded stable envelopes", async () => {
  const failed = await setup({ readEnabled: true, dispatcher: async () => ({ success: false, error: "Revit failed" }) });
  const failureResponse = await failed.handle(call(1));
  assert.equal(errorCode(failureResponse), "PLUGIN_ERROR");
  assert.equal(JSON.stringify(failureResponse).includes("retryable\":true"), false);

  const redacted = await setup({ readEnabled: true, dispatcher: async () => ({ levels: [], accessToken: "secret-value" }) });
  const redactedResponse = await redacted.handle(call(2));
  assert.equal(JSON.stringify(redactedResponse).includes("secret-value"), false);

  const oversized = await setup({ readEnabled: true, dispatcher: async () => ({ value: "x".repeat(4096) }) });
  assert.equal(errorCode(await oversized.handle(call(3))), "RESULT_TOO_LARGE");
});
