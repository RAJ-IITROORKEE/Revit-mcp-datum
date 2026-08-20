import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createLocalGateway, type TrustedRuntimeContext } from "./gateway.js";
import { loadLocalGatewayCatalog } from "./manifest-loader.js";
import { createLocalMcpServer } from "./mcp-server.js";
import type { LocalToolPolicyManifest } from "../policy/local-tool-policy.js";

async function setup(readEnabled: boolean) {
  const manifestPath = resolve("contracts/desktop-bridge/v2/tool-policy-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as LocalToolPolicyManifest;
  const binding = {
    policyHash: "b".repeat(64),
    policyReleaseId: "readonly-canary-release-001",
    profileId: "local-revit-readonly-v3" as const,
    catalogHash: manifest.catalogHash,
  };
  const catalog = await loadLocalGatewayCatalog({
    manifest,
    expectedCatalogHash: manifest.catalogHash,
    enabledToolNames: ["get_levels_list"],
    binding,
  });
  const context: TrustedRuntimeContext = {
    runtimeId: "runtime-0000000000000001",
    desktopDeviceId: "device-0000000000000001",
    jobId: "job-1",
    connectionId: "connection-1",
    revitInstanceId: "revit-instance-000000001",
    documentFingerprint: "document-fingerprint-000000001",
    catalogHash: manifest.catalogHash,
    policyHash: binding.policyHash,
    policyReleaseId: binding.policyReleaseId,
    policyProfileId: binding.profileId,
    routeGeneration: 1,
    leaseEpoch: 1,
  };
  const gateway = createLocalGateway({
    catalog,
    readEnabled,
    dispatcher: readEnabled ? async () => ({ levels: [] }) : undefined,
    resolveTrustedSession: (connectionId) => connectionId === context.connectionId ? context : undefined,
  });
  const server = createLocalMcpServer(gateway);
  const client = new Client({ name: "local-gateway-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, context, server };
}

function textContent(result: unknown): string {
  const content = (result as { content?: unknown } | undefined)?.content;
  if (!Array.isArray(content)) return "";
  const first = content[0] as { type?: unknown; text?: unknown } | undefined;
  return first?.type === "text" && typeof first.text === "string" ? first.text : "";
}

test("official MCP initialization exposes the exact local profile", async () => {
  const { client, server } = await setup(false);
  try {
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 1);
    assert.equal(listed.tools.some((tool) => tool.name === "send_code_to_revit"), false);
    assert.equal(listed.tools.some((tool) => tool.name === "query_stored_data"), false);
    const levels = listed.tools.find((tool) => tool.name === "get_levels_list");
    assert.deepEqual(
      (levels?.inputSchema.properties as Record<string, { type?: string }> | undefined)?.sortByElevation?.type,
      "boolean",
    );
  } finally {
    await client.close();
    await server.close();
  }
});

test("official MCP calls preserve fail-closed errors and bounded read results", async () => {
  const disabled = await setup(false);
  try {
    const result = await disabled.client.callTool({
      name: "get_levels_list",
      arguments: {},
      _meta: disabled.context,
    });
    assert.equal(result.isError, true);
    assert.match(textContent(result), /LOCAL_READ_DISABLED/);
  } finally {
    await disabled.client.close();
    await disabled.server.close();
  }

  const enabled = await setup(true);
  try {
    const result = await enabled.client.callTool({
      name: "get_levels_list",
      arguments: {},
      _meta: enabled.context,
    });
    assert.equal(result.isError, false);
    assert.deepEqual(JSON.parse(textContent(result)), { levels: [] });
  } finally {
    await enabled.client.close();
    await enabled.server.close();
  }
});
