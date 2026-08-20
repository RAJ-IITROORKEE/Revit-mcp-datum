import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { policyCatalogHash, type LocalToolPolicy, type LocalToolPolicyManifest } from "../policy/local-tool-policy.js";
import { parseAndVerifySignedPolicyBundle } from "../policy/signed-policy.js";
import { createSignedPolicyFixture } from "../test-support/signed-policy-fixture.js";
import {
  LocalGatewayStartupError,
  loadLocalGatewayCatalog,
  loadLocalGatewayCatalogFile,
  materializeVerifiedCanaryCatalog,
  type LocalToolModuleImporter,
} from "./manifest-loader.js";

const CLOUD_TOOLS = ["query_stored_data", "store_project_data", "store_room_data"];

function policy(name: string, mutationClass: LocalToolPolicy["mutationClass"]): LocalToolPolicy {
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

export function testManifest(): LocalToolPolicyManifest {
  const tools = [
    policy("get_levels_list", "read"),
    policy("get_rooms_list", "read"),
    policy("send_code_to_revit", "dangerous"),
    ...Array.from({ length: 149 }, (_, index) => policy(`tool_${String(index).padStart(3, "0")}`, "mutation")),
  ].sort((left, right) => left.name.localeCompare(right.name));
  return {
    protocolVersion: 2,
    catalogVersion: "test-local-v2",
    catalogHash: policyCatalogHash(tools),
    localToolCount: 152,
    excludedCloudTools: CLOUD_TOOLS,
    prohibitedLlmTools: ["send_code_to_revit"],
    tools,
  };
}

export function testImporter(overrides: Record<string, unknown> = {}): LocalToolModuleImporter {
  return async (name) => overrides[name] ?? {
    [`register_${name}`]: (server: { tool: (...args: unknown[]) => void }) => {
      server.tool(name, `${name} description`, { enabled: z.boolean().optional() }, () => undefined);
    },
  };
}

test("strict startup imports and exposes exactly 151 LLM-safe local modules", async () => {
  const manifest = testManifest();
  const imported: string[] = [];
  const importer = testImporter();
  const catalog = await loadLocalGatewayCatalog({
    manifest,
    expectedCatalogHash: manifest.catalogHash,
    importModule: async (name) => {
      imported.push(name);
      return importer(name);
    },
  });

  assert.equal(catalog.policy.manifest.tools.length, 152);
  assert.equal(catalog.registeredTools.size, 151);
  assert.equal(catalog.llmTools.size, 151);
  assert.equal(catalog.llmTools.has("send_code_to_revit"), false);
  assert.equal(imported.length, 151);
  assert.equal(imported.includes("send_code_to_revit"), false);
  assert.equal(imported.some((name) => CLOUD_TOOLS.includes(name)), false);
});

test("strict startup rejects broker hash, count, duplicate, registration, name, and schema drift", async (t) => {
  const valid = testManifest();
  const cases: Array<[string, LocalToolPolicyManifest, LocalToolModuleImporter, string]> = [
    ["broker hash", valid, testImporter(), "CATALOG_HASH_MISMATCH"],
    ["count", { ...valid, localToolCount: 151 }, testImporter(), "INVALID_MANIFEST"],
    ["prohibited tools", { ...valid, prohibitedLlmTools: [] }, testImporter(), "INVALID_MANIFEST"],
    ["duplicate", { ...valid, tools: [...valid.tools.slice(0, -1), valid.tools[0]] }, testImporter(), "INVALID_MANIFEST"],
    ["missing registration", valid, testImporter({ get_levels_list: {} }), "REGISTRATION_DRIFT"],
    ["wrong name", valid, testImporter({
      get_levels_list: { registerWrong: (server: { tool: (...args: unknown[]) => void }) => server.tool("wrong_name", "", {}, () => undefined) },
    }), "REGISTRATION_DRIFT"],
    ["schema", valid, testImporter({
      get_levels_list: { registerBad: (server: { tool: (...args: unknown[]) => void }) => server.tool("get_levels_list", "", { bad: true }, () => undefined) },
    }), "SCHEMA_DRIFT"],
  ];

  for (const [name, manifest, importer, code] of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        loadLocalGatewayCatalog({
          manifest,
          expectedCatalogHash: name === "broker hash" ? "0".repeat(64) : valid.catalogHash,
          importModule: importer,
        }),
        (error: unknown) => error instanceof LocalGatewayStartupError && error.code === code,
      );
    });
  }
});

test("strict startup does not suppress module import failures", async () => {
  const manifest = testManifest();
  await assert.rejects(
    loadLocalGatewayCatalog({
      manifest,
      expectedCatalogHash: manifest.catalogHash,
      importModule: async (name) => {
        if (name === "get_levels_list") throw new Error("missing module");
        return testImporter()(name);
      },
    }),
    (error: unknown) => error instanceof LocalGatewayStartupError && error.code === "MODULE_IMPORT_FAILED",
  );
});

test("repository manifest and compiled tool modules produce the exact local profile", async () => {
  const manifestPath = resolve("contracts/desktop-bridge/v2/tool-policy-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as LocalToolPolicyManifest;
  const catalog = await loadLocalGatewayCatalogFile(manifestPath, manifest.catalogHash);

  assert.equal(catalog.registeredTools.size, 151);
  assert.equal(catalog.llmTools.size, 151);
  assert.equal(catalog.llmTools.has("send_code_to_revit"), false);
});

test("verified canary imports and exposes only get_levels_list", async () => {
  const { bundle, trustRoot } = await createSignedPolicyFixture();
  const verified = parseAndVerifySignedPolicyBundle(JSON.stringify(bundle), JSON.stringify(trustRoot), new Date("2026-08-09T12:00:00.000Z"));
  const imported: string[] = [];
  const expectedBinding = {
    policyHash: bundle.policyHash,
    policyReleaseId: bundle.policyReleaseId,
    profileId: "local-revit-readonly-v3" as const,
    catalogHash: bundle.policy.catalog.manifest.catalogHash,
  };
  const catalog = await materializeVerifiedCanaryCatalog({
    bundle: verified,
    expectedBinding,
    importModule: async (name) => { imported.push(name); return testImporter()(name); },
  });
  assert.deepEqual(imported, ["get_levels_list"]);
  assert.deepEqual([...catalog.llmTools.keys()], ["get_levels_list"]);
  assert.equal(catalog.policy.manifest.tools.length, 152);
  assert.deepEqual(catalog.binding, expectedBinding);
});

test("verified canary rejects every expected policy binding mismatch", async () => {
  const { bundle, trustRoot } = await createSignedPolicyFixture();
  const verified = parseAndVerifySignedPolicyBundle(JSON.stringify(bundle), JSON.stringify(trustRoot), new Date("2026-08-09T12:00:00.000Z"));
  const binding = {
    policyHash: bundle.policyHash,
    policyReleaseId: bundle.policyReleaseId,
    profileId: "local-revit-readonly-v3" as const,
    catalogHash: bundle.policy.catalog.manifest.catalogHash,
  };
  for (const field of Object.keys(binding) as Array<keyof typeof binding>) {
    await assert.rejects(
      materializeVerifiedCanaryCatalog({
        bundle: verified,
        expectedBinding: { ...binding, [field]: field.toLowerCase().includes("hash") ? "0".repeat(64) : "mismatched-binding" },
        importModule: testImporter(),
      }),
      (error: unknown) => error instanceof LocalGatewayStartupError && error.code === "POLICY_BINDING_MISMATCH",
    );
  }
});
