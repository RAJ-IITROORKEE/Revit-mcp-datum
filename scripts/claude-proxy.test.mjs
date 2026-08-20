import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const proxyPath = fileURLToPath(new URL("../claude-proxy.js", import.meta.url));
const railwayProxyPath = fileURLToPath(new URL("../railway-proxy.cjs", import.meta.url));
const connectionTestPath = fileURLToPath(new URL("../test-mcp-connection.js", import.meta.url));
const localLauncherPath = fileURLToPath(new URL("../start-local.bat", import.meta.url));
const protectedServerEntrypoints = [
  fileURLToPath(new URL("../server-secure.cjs", import.meta.url)),
  fileURLToPath(new URL("../build/server-combined.js", import.meta.url)),
  fileURLToPath(new URL("../build/server-http.js", import.meta.url)),
];

function environmentWithoutCredential() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key.toUpperCase() !== "MCP_API_KEY" && key.toUpperCase() !== "NODE_OPTIONS",
    ),
  );
}

test("proxy fails closed before processing stdin when MCP_API_KEY is absent", () => {
  const env = environmentWithoutCredential();

  const result = spawnSync(process.execPath, [proxyPath], {
    env,
    input: "not-json\n",
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /MCP_API_KEY.*required/i);
  assert.doesNotMatch(result.stderr, /parse error|ready/i);
});

test("legacy Railway proxy fails closed before processing stdin when MCP_API_KEY is absent", () => {
  const env = environmentWithoutCredential();

  const result = spawnSync(process.execPath, [railwayProxyPath], {
    env,
    input: "not-json\n",
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /MCP_API_KEY.*required/i);
  assert.doesNotMatch(result.stderr, /parse error|ready/i);
});

test("connection test fails closed before network startup without a usable MCP_API_KEY", () => {
  for (const credential of [undefined, "   "]) {
    const env = environmentWithoutCredential();
    if (credential !== undefined) env.MCP_API_KEY = credential;

    const result = spawnSync(process.execPath, [connectionTestPath], {
      env,
      encoding: "utf8",
      timeout: 5_000,
    });

    assert.equal(result.status, 1);
    assert.equal(result.signal, null);
    assert.match(result.stderr, /MCP_API_KEY.*required/i);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Testing MCP connection|Status:/i);
  }
});

test("proxy source derives mcpCredential only from the environment and contains no credential-shaped literal", async () => {
  const source = await readFile(proxyPath, "utf8");
  const initializations = source.match(/\b(?:const|let|var)\s+mcpCredential\s*=\s*[^;]+;/g) ?? [];
  const expectedInitialization = "const mcpCredential = (process.env.MCP_API_KEY ?? '').trim();";

  if (initializations.length !== 1 || initializations[0] !== expectedInitialization) {
    throw new Error("mcpCredential must have exactly one environment-only initialization");
  }
  if (/(['"`])[a-f\d]{32,}\1/i.test(source)) {
    throw new Error("Proxy source contains a credential-shaped literal");
  }
});

test("legacy Railway proxy derives its credential only from the environment", async () => {
  const source = await readFile(railwayProxyPath, "utf8");
  const initializations = source.match(/\b(?:const|let|var)\s+mcpCredential\s*=\s*[^;]+;/g) ?? [];

  assert.deepEqual(initializations, ["const mcpCredential = (process.env.MCP_API_KEY || '').trim();"]);
  assert.doesNotMatch(source, /(['"`])[a-f\d]{32,}\1/i);
});

test("protected server entrypoints exit before binding when MCP_API_KEY is absent", () => {
  const env = environmentWithoutCredential();

  for (const path of protectedServerEntrypoints) {
    const result = spawnSync(process.execPath, [path], {
      env,
      encoding: "utf8",
      timeout: 5_000,
    });

    assert.equal(result.status, 1, `${path} must exit with status 1`);
    assert.equal(result.signal, null, `${path} must exit before the timeout`);
    assert.match(result.stderr, /MCP_API_KEY.*required/i);
  }
});

test("local launcher fails before npm startup when MCP_API_KEY is absent", () => {
  const env = environmentWithoutCredential();

  const result = spawnSync("cmd.exe", ["/d", "/c", "call", localLauncherPath], {
    env,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /MCP_API_KEY.*required/i);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /> revit-mcp@|npm error/i);
});
