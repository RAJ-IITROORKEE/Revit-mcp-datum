import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ARTIFACT_ENTRYPOINT,
  compareCanaryBuildDirectories,
  verifyCanaryArtifactDirectory,
} from "./verify-only-canary-lib.mjs";

const committedDirectory = join("artifacts", "verify-only-canary");
const pinnedTrustRoot = JSON.parse(await readFile("contracts/desktop-bridge/v2/trust-root.v1.json", "utf8"));

async function copiedArtifact() {
  const root = await mkdtemp(join(tmpdir(), "datumm-canary-tamper-"));
  const directory = join(root, "artifact");
  await cp(committedDirectory, directory, { recursive: true });
  return { root, directory };
}

async function editJson(path, edit) {
  const value = JSON.parse(await readFile(path, "utf8"));
  edit(value);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("dedicated canary artifact has the exact entrypoint, payload set, metadata, and pinned trust root", async () => {
  const result = await verifyCanaryArtifactDirectory(committedDirectory, pinnedTrustRoot);
  assert.equal(result.entrypoint, ARTIFACT_ENTRYPOINT);
  assert.deepEqual(result.payloadFiles, [ARTIFACT_ENTRYPOINT, "artifact-manifest.json", "package.json"]);
});

test("artifact verification rejects entrypoint and payload-set substitution", async (t) => {
  await t.test("entrypoint", async () => {
    const { root, directory } = await copiedArtifact();
    try {
      await editJson(join(directory, "artifact-manifest.json"), (manifest) => { manifest.entrypoint = "substituted.mjs"; });
      await assert.rejects(verifyCanaryArtifactDirectory(directory, pinnedTrustRoot), /exact entrypoint/i);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  await t.test("manifest payload descriptor", async () => {
    const { root, directory } = await copiedArtifact();
    try {
      await editJson(join(directory, "artifact-manifest.json"), (manifest) => {
        manifest.files.push({ path: "extra.js", size: 0, sha256: "0".repeat(64) });
      });
      await assert.rejects(verifyCanaryArtifactDirectory(directory, pinnedTrustRoot), /exact payload file set/i);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  await t.test("package payload", async () => {
    const { root, directory } = await copiedArtifact();
    try {
      await editJson(join(directory, "package.json"), (packageJson) => { packageJson.files.push("extra.js"); });
      await assert.rejects(verifyCanaryArtifactDirectory(directory, pinnedTrustRoot), /exact package payload/i);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

test("artifact verification rejects semantic pinned-trust-root substitution", async () => {
  const { root, directory } = await copiedArtifact();
  try {
    const artifactPath = join(directory, ARTIFACT_ENTRYPOINT);
    const originalKid = pinnedTrustRoot.keys[0].kid;
    const substitutedKid = `${originalKid.slice(0, -1)}c`;
    const artifact = await readFile(artifactPath, "utf8");
    assert.match(artifact, new RegExp(originalKid));
    const substitutedBytes = Buffer.from(artifact.replaceAll(originalKid, substitutedKid), "utf8");
    await writeFile(artifactPath, substitutedBytes);
    await editJson(join(directory, "artifact-manifest.json"), (manifest) => {
      const descriptor = manifest.files.find((file) => file.path === ARTIFACT_ENTRYPOINT);
      descriptor.size = substitutedBytes.length;
      descriptor.sha256 = createHash("sha256").update(substitutedBytes).digest("hex");
    });
    await assert.rejects(verifyCanaryArtifactDirectory(directory, pinnedTrustRoot), /embedded trust root/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("reproducibility verification rejects byte-level build drift", async () => {
  const first = await copiedArtifact();
  const second = await copiedArtifact();
  try {
    await compareCanaryBuildDirectories(first.directory, second.directory);
    await writeFile(join(second.directory, "package.json"), "{}\n", "utf8");
    await assert.rejects(compareCanaryBuildDirectories(first.directory, second.directory), /not byte-identical/i);
  } finally {
    await rm(first.root, { recursive: true, force: true });
    await rm(second.root, { recursive: true, force: true });
  }
});
