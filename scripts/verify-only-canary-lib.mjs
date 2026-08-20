import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify, isDeepStrictEqual } from "node:util";
import { build } from "esbuild";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();
const PINNED_TRUST_ROOT_PATH = join(PROJECT_ROOT, "contracts", "desktop-bridge", "v2", "trust-root.v1.json");
export const ARTIFACT_ENTRYPOINT = "datumm-revit-canary-verify-only.mjs";
export const ARTIFACT_MANIFEST = "artifact-manifest.json";
export const ARTIFACT_PACKAGE = "package.json";
export const ARTIFACT_PAYLOAD_FILES = [ARTIFACT_ENTRYPOINT, ARTIFACT_MANIFEST, ARTIFACT_PACKAGE];

const MANIFEST_DESCRIPTOR_FILES = [ARTIFACT_ENTRYPOINT, ARTIFACT_PACKAGE];
const PACKAGE_PAYLOAD_FILES = [ARTIFACT_ENTRYPOINT, ARTIFACT_MANIFEST];
const ALLOWED_SOURCE_INPUTS = [
  "src/canary/get-levels-list-contract.ts",
  "src/canary/pinned-trust-root.ts",
  "src/canary/verify-only-config.ts",
  "src/canary/verify-only-entrypoint.ts",
  "src/canary/verify-only.ts",
  "src/policy/signed-policy.ts",
].sort();
const PACKAGE_METADATA = {
  name: "@datumm/revit-verify-only-canary",
  version: "3.0.0",
  private: true,
  type: "module",
  files: PACKAGE_PAYLOAD_FILES,
};

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, expected) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

async function descriptor(outputDirectory, path) {
  const bytes = await readFile(path);
  return {
    path: relative(outputDirectory, path).replaceAll("\\", "/"),
    size: bytes.length,
    sha256: hash(bytes),
  };
}

async function loadPinnedTrustRoot() {
  return JSON.parse(await readFile(PINNED_TRUST_ROOT_PATH, "utf8"));
}

export async function buildCanaryArtifact(outputDirectory) {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const artifactPath = join(outputDirectory, ARTIFACT_ENTRYPOINT);
  const result = await build({
    absWorkingDir: PROJECT_ROOT,
    entryPoints: ["src/canary/verify-only-entrypoint.ts"],
    outfile: artifactPath,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    minify: true,
    legalComments: "none",
    sourcemap: false,
    metafile: true,
    charset: "ascii",
    logLevel: "silent",
  });
  const sourceInputs = Object.keys(result.metafile.inputs)
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => path.startsWith("src/"))
    .sort();
  if (!isDeepStrictEqual(sourceInputs, ALLOWED_SOURCE_INPUTS)) {
    throw new Error(`Canary source imports differ from the exact allowlist: ${sourceInputs.join(", ")}`);
  }

  await writeFile(join(outputDirectory, ARTIFACT_PACKAGE), `${JSON.stringify(PACKAGE_METADATA, null, 2)}\n`, "utf8");
  const trustRootBytes = Buffer.from(JSON.stringify(await loadPinnedTrustRoot()), "utf8");
  const manifest = {
    schema: "datumm.revit.verify-only-canary-artifact/v1",
    mode: "VERIFY_ONLY",
    profileId: "local-revit-readonly-v3",
    entrypoint: ARTIFACT_ENTRYPOINT,
    dispatchAvailable: false,
    readEnabled: false,
    files: [
      await descriptor(outputDirectory, artifactPath),
      await descriptor(outputDirectory, join(outputDirectory, ARTIFACT_PACKAGE)),
    ],
    pinnedTrustRoot: { size: trustRootBytes.length, sha256: hash(trustRootBytes) },
  };
  await writeFile(join(outputDirectory, ARTIFACT_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function verifyCanaryArtifactDirectory(directory, pinnedTrustRoot) {
  pinnedTrustRoot ??= await loadPinnedTrustRoot();
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort();
  if (entries.some((entry) => !entry.isFile()) || !isDeepStrictEqual(names, [...ARTIFACT_PAYLOAD_FILES].sort())) {
    throw new Error("Artifact directory does not contain the exact payload file set");
  }

  const manifest = JSON.parse(await readFile(join(directory, ARTIFACT_MANIFEST), "utf8"));
  if (!exactKeys(manifest, ["schema", "mode", "profileId", "entrypoint", "dispatchAvailable", "readEnabled", "files", "pinnedTrustRoot"]) ||
      manifest.schema !== "datumm.revit.verify-only-canary-artifact/v1" || manifest.mode !== "VERIFY_ONLY" ||
      manifest.profileId !== "local-revit-readonly-v3" || manifest.dispatchAvailable !== false || manifest.readEnabled !== false) {
    throw new Error("Artifact manifest safety identity is invalid");
  }
  if (manifest.entrypoint !== ARTIFACT_ENTRYPOINT) throw new Error("Artifact manifest does not name the exact entrypoint");
  if (!Array.isArray(manifest.files) ||
      !isDeepStrictEqual(manifest.files.map((file) => file?.path), MANIFEST_DESCRIPTOR_FILES) ||
      manifest.files.some((file) => !exactKeys(file, ["path", "size", "sha256"]))) {
    throw new Error("Artifact manifest does not contain the exact payload file set");
  }

  const packageMetadata = JSON.parse(await readFile(join(directory, ARTIFACT_PACKAGE), "utf8"));
  if (!isDeepStrictEqual(packageMetadata, PACKAGE_METADATA)) throw new Error("Artifact package does not contain the exact package payload metadata");
  for (const expected of manifest.files) {
    const bytes = await readFile(join(directory, expected.path));
    if (bytes.length !== expected.size || hash(bytes) !== expected.sha256) {
      throw new Error(`${expected.path}: artifact hash or size mismatch`);
    }
  }

  const compactTrustRoot = Buffer.from(JSON.stringify(pinnedTrustRoot), "utf8");
  if (!exactKeys(manifest.pinnedTrustRoot, ["size", "sha256"]) || manifest.pinnedTrustRoot.size !== compactTrustRoot.length ||
      manifest.pinnedTrustRoot.sha256 !== hash(compactTrustRoot)) {
    throw new Error("Artifact manifest pinned trust root differs from pinned source");
  }
  const { stdout, stderr } = await execFileAsync(process.execPath, [join(directory, ARTIFACT_ENTRYPOINT), "--print-embedded-trust-root"], {
    windowsHide: true,
    maxBuffer: 64 * 1024,
  });
  if (stderr !== "") throw new Error("Artifact trust-root introspection emitted diagnostics");
  let embeddedTrustRoot;
  try { embeddedTrustRoot = JSON.parse(stdout); } catch { throw new Error("Artifact embedded trust root is not valid JSON"); }
  if (!isDeepStrictEqual(embeddedTrustRoot, pinnedTrustRoot)) throw new Error("Artifact embedded trust root differs semantically from pinned source");

  const artifact = await readFile(join(directory, ARTIFACT_ENTRYPOINT), "utf8");
  for (const forbidden of ["ConnectionManager", "createLocalGateway", "createLocalMcpServer", "sendCommand(", "server-combined", "query_stored_data.ts", "send_code_to_revit.ts"]) {
    if (artifact.includes(forbidden)) throw new Error(`Artifact contains forbidden runtime code: ${forbidden}`);
  }
  return { entrypoint: ARTIFACT_ENTRYPOINT, payloadFiles: ARTIFACT_PAYLOAD_FILES };
}

export async function compareCanaryBuildDirectories(firstDirectory, secondDirectory) {
  for (const name of ARTIFACT_PAYLOAD_FILES) {
    const [first, second] = await Promise.all([
      readFile(join(firstDirectory, name)),
      readFile(join(secondDirectory, name)),
    ]);
    if (!first.equals(second)) throw new Error(`${name}: canary builds are not byte-identical`);
  }
}

export async function verifyCommittedCanaryArtifact(committedDirectory) {
  const root = await mkdtemp(join(tmpdir(), "datumm-canary-rebuild-"));
  const first = join(root, "first");
  const second = join(root, "second");
  try {
    const pinnedTrustRoot = await loadPinnedTrustRoot();
    await buildCanaryArtifact(first);
    await buildCanaryArtifact(second);
    await verifyCanaryArtifactDirectory(first, pinnedTrustRoot);
    await verifyCanaryArtifactDirectory(second, pinnedTrustRoot);
    await compareCanaryBuildDirectories(first, second);
    await verifyCanaryArtifactDirectory(committedDirectory, pinnedTrustRoot);
    await compareCanaryBuildDirectories(first, committedDirectory);
    return JSON.parse(await readFile(join(committedDirectory, ARTIFACT_MANIFEST), "utf8"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
