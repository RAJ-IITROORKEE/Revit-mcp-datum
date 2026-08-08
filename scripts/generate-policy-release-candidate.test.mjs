import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPolicyReleaseCandidate } from "./generate-policy-release-candidate.mjs";

const manifest = JSON.parse(
  await readFile(new URL("../contracts/desktop-bridge/v2/tool-policy-manifest.json", import.meta.url), "utf8"),
);

const metadata = {
  commit: "a".repeat(40),
  treeHash: "b".repeat(40),
  validatedAt: "2026-08-08T12:00:00.000Z",
  generatorVersion: "c".repeat(64),
};

test("builds a deterministic unsigned read-only policy candidate and matching provenance attestation", () => {
  const { candidate, attestation } = buildPolicyReleaseCandidate(manifest, metadata);

  assert.equal(candidate.schema, "datumm.revit.policy-candidate/v1");
  assert.equal(candidate.protocolVersion, 2);
  assert.equal(candidate.policy.provenance.commit, metadata.commit);
  assert.equal(candidate.policy.catalog.manifest.catalogHash, manifest.catalogHash);
  assert.deepEqual(candidate.policy.profiles[0].enabledTools, ["get_levels_list"]);
  assert.equal(candidate.policy.profiles[0].tools.get_levels_list.resultUnit, "mm");
  assert.deepEqual(attestation, {
    schema: "datumm.revit.policy-provenance-attestation/v1",
    sourceRepository: "https://github.com/RAJ-IITROORKEE/Revit-mcp-datum.git",
    commit: metadata.commit,
    treeHash: metadata.treeHash,
    catalogHash: manifest.catalogHash,
    sourceToolCount: 155,
    localToolCount: 152,
    excludedCloudTools: ["query_stored_data", "store_project_data", "store_room_data"],
    generator: "generate-policy-release-candidate",
    generatorVersion: metadata.generatorVersion,
    validatedAt: metadata.validatedAt,
    clean: true,
  });
});

test("rejects a manifest whose catalog hash does not match its policy entries", () => {
  const invalid = { ...manifest, catalogHash: "0".repeat(64) };
  assert.throws(() => buildPolicyReleaseCandidate(invalid, metadata), /catalog hash/i);
});
