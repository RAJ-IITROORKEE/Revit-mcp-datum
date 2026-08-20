import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalogInputs, validateCatalog } from "./validate-local-tool-catalog.mjs";

test("source catalog and policy manifest are reconciled", async () => {
  const inputs = await loadCatalogInputs();
  const result = validateCatalog(inputs);

  assert.deepEqual(result.counts, {
    registered: 155,
    local: 152,
    cloud: 3,
    reads: 28,
    mutations: 102,
    dangerous: 22,
  });
  assert.deepEqual(result.sessionTagTools, [
    "create_ceiling",
    "create_floor",
    "create_room",
    "create_wall",
    "delete_elements",
    "place_component",
  ]);
  assert.equal(result.prohibitedTool, "send_code_to_revit");
});
