import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import canonicalize from "canonicalize";

import { catalogHash } from "./local-runtime-canonical.mjs";

const CLOUD_TOOLS = ["query_stored_data", "store_project_data", "store_room_data"];
const SOURCE_REPOSITORY = "https://github.com/RAJ-IITROORKEE/Revit-mcp-datum.git";

function canonicalJson(value) {
  const output = canonicalize(value);
  if (typeof output !== "string") throw new Error("Policy release candidate cannot be canonicalized");
  return output;
}

function sha256(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function exactArray(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" ||
    !/^[a-f0-9]{40}$/.test(metadata.commit) ||
    !/^[a-f0-9]{40,64}$/.test(metadata.treeHash) ||
    !canonicalTimestamp(metadata.validatedAt) ||
    !/^[a-f0-9]{64}$/.test(metadata.generatorVersion)) {
    throw new Error("Policy release metadata is invalid");
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
    manifest.protocolVersion !== 2 || manifest.localToolCount !== 152 ||
    !exactArray(manifest.excludedCloudTools, CLOUD_TOOLS) ||
    !Array.isArray(manifest.tools) || manifest.tools.length !== 152 ||
    !/^[a-f0-9]{64}$/.test(manifest.catalogHash) ||
    catalogHash(manifest.tools) !== manifest.catalogHash) {
    throw new Error("Policy manifest catalog hash or shape is invalid");
  }
  const names = new Set(manifest.tools.map((tool) => tool?.name));
  if (names.size !== 152 || !names.has("get_levels_list") || !names.has("send_code_to_revit")) {
    throw new Error("Policy manifest does not contain the required canonical tool set");
  }
}

export function buildPolicyReleaseCandidate(manifest, metadata) {
  validateManifest(manifest);
  validateMetadata(metadata);

  const provenance = {
    sourceRepository: SOURCE_REPOSITORY,
    commit: metadata.commit,
    treeHash: metadata.treeHash,
    generator: "generate-policy-release-candidate",
    generatorVersion: metadata.generatorVersion,
  };
  const policy = {
    provenance,
    catalog: {
      sourceToolCount: 155,
      localToolCount: 152,
      excludedCloudTools: CLOUD_TOOLS,
      manifest,
    },
    profiles: [{
      id: "local-revit-readonly-canary-v1",
      enabledTools: ["get_levels_list"],
      llmVisibleTools: ["get_levels_list"],
      deniedTools: ["send_code_to_revit"],
      maxResultBytes: 65536,
      tools: {
        get_levels_list: {
          mutationClass: "read",
          retryPolicy: "never",
          timeoutMs: 30000,
          input: { includeNonStructural: true, sortByElevation: true },
          maxLevels: 256,
          resultUnit: "mm",
        },
      },
    }],
  };
  const candidate = {
    schema: "datumm.revit.policy-candidate/v1",
    protocolVersion: 2,
    policyReleaseId: `revit-local-v2-canary-${metadata.commit.slice(0, 12)}`,
    policy,
  };
  const attestation = {
    schema: "datumm.revit.policy-provenance-attestation/v1",
    sourceRepository: SOURCE_REPOSITORY,
    commit: metadata.commit,
    treeHash: metadata.treeHash,
    catalogHash: manifest.catalogHash,
    sourceToolCount: 155,
    localToolCount: 152,
    excludedCloudTools: CLOUD_TOOLS,
    generator: provenance.generator,
    generatorVersion: provenance.generatorVersion,
    validatedAt: metadata.validatedAt,
    clean: true,
  };
  return { candidate, attestation };
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) values.set(argv[index], argv[index + 1]);
  const commit = values.get("--commit");
  const outDir = values.get("--out-dir");
  if (!/^[a-f0-9]{40}$/.test(commit ?? "") || typeof outDir !== "string" || values.size !== 2) {
    throw new Error("Usage: generate-policy-release-candidate --commit <40-hex> --out-dir <directory>");
  }
  return { commit, outDir };
}

async function main() {
  const { commit, outDir } = parseArgs(process.argv.slice(2));
  if (git("rev-parse", "HEAD") !== commit || git("status", "--porcelain").length > 0) {
    throw new Error("Policy release candidate requires an exact clean checked-out commit");
  }
  const manifestPath = new URL("../contracts/desktop-bridge/v2/tool-policy-manifest.json", import.meta.url);
  const scriptPath = fileURLToPath(import.meta.url);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const commitTimestamp = new Date(git("show", "-s", "--format=%cI", commit)).toISOString();
  const metadata = {
    commit,
    treeHash: git("rev-parse", `${commit}^{tree}`),
    validatedAt: commitTimestamp,
    generatorVersion: createHash("sha256").update(await readFile(scriptPath)).digest("hex"),
  };
  const { candidate, attestation } = buildPolicyReleaseCandidate(manifest, metadata);
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/policy-candidate.json`, `${canonicalJson(candidate)}\n`, "utf8");
  await writeFile(`${outDir}/policy-provenance-attestation.json`, `${canonicalJson(attestation)}\n`, "utf8");
  await writeFile(
    `${outDir}/SHA256SUMS`,
    `${sha256(candidate)}  policy-candidate.json\n${sha256(attestation)}  policy-provenance-attestation.json\n`,
    "utf8",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Policy candidate generation failed"}\n`);
    process.exitCode = 1;
  });
}
