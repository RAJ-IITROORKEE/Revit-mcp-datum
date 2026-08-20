import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = join(SCRIPT_DIRECTORY, "..");
const CLOUD_ONLY_TOOLS = new Set([
  "query_stored_data",
  "store_project_data",
  "store_room_data",
]);
const PROHIBITED_LOCAL_LLM_TOOLS = new Set(["send_code_to_revit"]);
const EXPECTED_SESSION_TAG_TOOLS = new Set([
  "create_ceiling",
  "create_floor",
  "create_room",
  "create_wall",
  "delete_elements",
  "place_component",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function catalogHash(tools) {
  return createHash("sha256").update(stableStringify(tools), "utf8").digest("hex");
}

function toolFiles(entries) {
  return entries
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !["index.ts", "register.ts"].includes(file))
    .filter((file) => !file.endsWith(".test.ts"))
    .filter((file) => !file.startsWith("_"))
    .sort();
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadCatalogInputs(repositoryRoot = REPOSITORY_ROOT) {
  const toolsRoot = join(repositoryRoot, "src", "tools");
  const entries = await readdir(toolsRoot);
  const files = toolFiles(entries);
  const sources = await Promise.all(files.map(async (file) => [
    file,
    await readFile(join(toolsRoot, file), "utf8"),
  ]));

  return {
    sourceTools: files.map((file) => file.slice(0, -3)),
    sourceContents: new Map(sources),
    manifest: await loadJson(join(repositoryRoot, "contracts", "desktop-bridge", "v2", "tool-policy-manifest.json")),
    signedManifest: await loadJson(join(repositoryRoot, "contracts", "desktop-bridge", "v2", "fixtures", "signed-tool-policy-manifest.json")),
  };
}

export function validateCatalog({ sourceTools, sourceContents, manifest, signedManifest }) {
  const sourceNames = [...sourceTools].sort();
  assert(sourceNames.length === 155, `Expected 155 source tools, received ${sourceNames.length}`);
  assert(new Set(sourceNames).size === sourceNames.length, "Source catalog contains duplicate names");

  const missingExports = sourceNames.filter((name) => {
    const source = sourceContents.get(`${name}.ts`);
    return !/export\s+(?:async\s+)?function\s+register\w*\s*\(|export\s+const\s+register\w*\s*=/.test(source);
  });
  assert(missingExports.length === 0, `Source tools missing registration exports: ${missingExports.join(", ")}`);

  assert(manifest.protocolVersion === 2, "Manifest protocol version must be 2");
  assert(manifest.localToolCount === 152, "Manifest localToolCount must be 152");
  assert(JSON.stringify([...manifest.excludedCloudTools].sort()) === JSON.stringify([...CLOUD_ONLY_TOOLS].sort()), "Manifest cloud exclusions differ from the authoritative set");
  assert(Array.isArray(manifest.prohibitedLlmTools), "Manifest must have prohibitedLlmTools array");
  assert(JSON.stringify([...manifest.prohibitedLlmTools].sort()) === JSON.stringify([...PROHIBITED_LOCAL_LLM_TOOLS].sort()), "Manifest prohibitedLlmTools differs from the authoritative set");

  const cloudNames = sourceNames.filter((name) => CLOUD_ONLY_TOOLS.has(name));
  assert(cloudNames.length === 3, `Expected 3 cloud-only source tools, received ${cloudNames.length}`);
  const localNames = sourceNames.filter((name) => !CLOUD_ONLY_TOOLS.has(name));
  assert(localNames.length === 152, `Expected 152 local source tools, received ${localNames.length}`);

  const policies = manifest.tools;
  assert(policies.length === 152, `Expected 152 policy entries, received ${policies.length}`);
  const policyNames = policies.map((tool) => tool.name);
  assert(new Set(policyNames).size === policyNames.length, "Policy catalog contains duplicate names");
  assert(JSON.stringify([...policyNames].sort()) === JSON.stringify(localNames), "Policy membership differs from source local tools");
  assert(!policyNames.includes("query_stored_data") && !policyNames.includes("store_project_data") && !policyNames.includes("store_room_data"), "Cloud-only tool entered local policy");

  const counts = {
    registered: sourceNames.length,
    local: localNames.length,
    cloud: cloudNames.length,
    reads: policies.filter((tool) => tool.mutationClass === "read").length,
    mutations: policies.filter((tool) => tool.mutationClass === "mutation").length,
    dangerous: policies.filter((tool) => tool.mutationClass === "dangerous").length,
  };
  assert(counts.reads === 28 && counts.mutations === 102 && counts.dangerous === 22, `Unexpected policy classes: ${JSON.stringify(counts)}`);

  const policyByName = new Map(policies.map((tool) => [tool.name, tool]));
  for (const tool of policies) {
    assert(tool.retryPolicy === (tool.mutationClass === "read" ? "read_only" : "never"), `${tool.name}: retry policy does not match mutation class`);
    assert(tool.automaticRollbackAllowed === false, `${tool.name}: automatic rollback must remain disabled`);
  }

  const sessionTagTools = sourceNames.filter((name) => /\bsessionTag\s*:/.test(sourceContents.get(`${name}.ts`))).sort();
  assert(JSON.stringify(sessionTagTools) === JSON.stringify([...EXPECTED_SESSION_TAG_TOOLS].sort()), `Session-tag schema drift: ${sessionTagTools.join(", ")}`);
  for (const name of localNames) {
    assert(policyByName.get(name).sessionTagSupported === EXPECTED_SESSION_TAG_TOOLS.has(name), `${name}: sessionTag policy mismatch`);
  }

  const prohibitedTool = [...PROHIBITED_LOCAL_LLM_TOOLS][0];
  assert(policyByName.get(prohibitedTool)?.mutationClass === "dangerous", `${prohibitedTool}: must remain dangerous and excluded from local LLM use`);
  assert(manifest.prohibitedLlmTools.includes(prohibitedTool), `${prohibitedTool}: must be listed in manifest prohibitedLlmTools`);

  assert(manifest.catalogHash === catalogHash(policies), "Manifest catalog hash does not match deterministic policy content");
  assert(JSON.stringify(signedManifest.manifest) === JSON.stringify(manifest), "Signed policy fixture content differs from manifest");

  return { counts, sessionTagTools, prohibitedTool };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = validateCatalog(await loadCatalogInputs());
  console.log(`Validated ${result.counts.registered} source tools: ${result.counts.local} local, ${result.counts.cloud} cloud-only; ${result.sessionTagTools.length} sessionTag schemas.`);
}
