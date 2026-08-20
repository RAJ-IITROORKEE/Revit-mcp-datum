import assert from "node:assert/strict";
import test from "node:test";
import {
  LocalToolPolicyError,
  assertCompleteRegisteredToolNames,
  authorizeLocalToolCall,
  createLocalToolPolicy,
  normalizeLocalToolResult,
  policyCatalogHash,
  validateRegisteredToolNames,
  type LocalToolPolicy,
  type LocalToolPolicyManifest,
} from "./local-tool-policy.js";

function manifest(): LocalToolPolicyManifest {
  const tools: LocalToolPolicy[] = [
    {
      name: "get_levels_list",
      mutationClass: "read" as const,
      retryPolicy: "read_only" as const,
      timeoutMs: 30_000,
      createdIdsRequired: false,
      sessionTagSupported: false,
      automaticRollbackAllowed: false,
      maxArgsBytes: 64,
      maxResultBytes: 128,
    },
    {
      name: "create_wall",
      mutationClass: "mutation" as const,
      retryPolicy: "never" as const,
      timeoutMs: 180_000,
      createdIdsRequired: true,
      sessionTagSupported: true,
      automaticRollbackAllowed: false,
      maxArgsBytes: 64,
      maxResultBytes: 128,
    },
    {
      name: "send_code_to_revit",
      mutationClass: "dangerous" as const,
      retryPolicy: "never" as const,
      timeoutMs: 300_000,
      createdIdsRequired: false,
      sessionTagSupported: false,
      automaticRollbackAllowed: false,
      maxArgsBytes: 64,
      maxResultBytes: 128,
    },
  ];

  return {
    protocolVersion: 2,
    catalogVersion: "test-v2",
    catalogHash: policyCatalogHash(tools),
    localToolCount: tools.length,
    excludedCloudTools: ["query_stored_data"],
    prohibitedLlmTools: ["send_code_to_revit"],
    tools,
  };
}

const context = {
  runtimeId: "runtime-test",
  revitInstanceId: "revit-test",
  documentFingerprint: "document-test",
};

test("manifest verification and registration membership fail closed", () => {
  const policy = createLocalToolPolicy(manifest());
  assert.deepEqual(validateRegisteredToolNames(policy, ["create_wall", "get_levels_list"]), {
    accepted: ["create_wall", "get_levels_list"],
  });
  assert.deepEqual(assertCompleteRegisteredToolNames(policy, ["create_wall", "get_levels_list"]), {
    accepted: ["create_wall", "get_levels_list"],
  });
  assert.throws(
    () => validateRegisteredToolNames(policy, ["get_levels_list", "unknown_tool"]),
    (error: unknown) => error instanceof LocalToolPolicyError && error.code === "CATALOG_DRIFT",
  );

  const invalid = manifest();
  invalid.catalogHash = "0".repeat(64);
  assert.throws(() => createLocalToolPolicy(invalid), /catalog hash/i);

  const missingProhibition = manifest();
  missingProhibition.prohibitedLlmTools = [];
  assert.throws(() => createLocalToolPolicy(missingProhibition), /prohibited LLM tools/i);
});

test("authorization permits only bounded read calls when local read-only is enabled", () => {
  const policy = createLocalToolPolicy(manifest());
  const authorized = authorizeLocalToolCall(policy, {
    tool: "get_levels_list",
    args: { limit: 10 },
    context,
    localReadOnlyEnabled: true,
  });
  assert.equal(authorized.mutationClass, "read");
  assert.equal(authorized.timeoutMs, 30_000);

  assert.throws(
    () => authorizeLocalToolCall(policy, { tool: "get_levels_list", args: {}, context }),
    (error: unknown) => error instanceof LocalToolPolicyError && error.code === "LOCAL_READ_DISABLED",
  );
  assert.throws(
    () => authorizeLocalToolCall(policy, { tool: "unknown_tool", args: {}, context, localReadOnlyEnabled: true }),
    (error: unknown) => error instanceof LocalToolPolicyError && error.code === "UNKNOWN_TOOL",
  );
  assert.throws(
    () => authorizeLocalToolCall(policy, { tool: "send_code_to_revit", args: {}, context, localReadOnlyEnabled: true }),
    (error: unknown) => error instanceof LocalToolPolicyError && error.code === "PROHIBITED_TOOL",
  );
});

test("authorization checks document context, argument bounds, and retry policy", () => {
  const policy = createLocalToolPolicy(manifest());
  assert.throws(
    () => authorizeLocalToolCall(policy, {
      tool: "get_levels_list",
      args: {},
      context: { ...context, documentFingerprint: "" },
      localReadOnlyEnabled: true,
    }),
    (error: unknown) => error instanceof LocalToolPolicyError && error.code === "MISSING_CONTEXT",
  );
  assert.throws(
    () => authorizeLocalToolCall(policy, {
      tool: "get_levels_list",
      args: { value: "x".repeat(100) },
      context,
      localReadOnlyEnabled: true,
    }),
    (error: unknown) => error instanceof LocalToolPolicyError && error.code === "ARGS_TOO_LARGE",
  );
  assert.throws(
    () => authorizeLocalToolCall(policy, {
      tool: "get_levels_list",
      args: {},
      context,
      localReadOnlyEnabled: true,
      retryRequested: true,
    }),
    (error: unknown) => error instanceof LocalToolPolicyError && error.code === "RETRY_NOT_ALLOWED",
  );
});

test("result normalization redacts secrets and rejects oversized output", () => {
  const normalized = normalizeLocalToolResult("get_levels_list", {
    levels: [{ id: 1 }],
    accessToken: "secret",
    nested: { reasoning: "private" },
  }, 256);
  assert.equal(normalized.ok, true);
  assert.equal(JSON.stringify(normalized.value).includes("secret"), false);
  assert.equal(JSON.stringify(normalized.value).includes("private"), false);

  const oversized = normalizeLocalToolResult("get_levels_list", { value: "x".repeat(100) }, 32);
  assert.equal(oversized.ok, false);
  assert.equal(oversized.code, "RESULT_TOO_LARGE");
});
