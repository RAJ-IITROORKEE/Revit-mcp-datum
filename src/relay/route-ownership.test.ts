import assert from "node:assert/strict";
import {
  claimRouteOwner,
  createRouteBinding,
  isCurrentRouteOwner,
  releaseRouteOwner,
} from "./route-ownership.js";

const binding = createRouteBinding();
const first = claimRouteOwner(binding, "revit-plugin", "old-client").owner;
const second = claimRouteOwner(binding, "revit-plugin", "new-client").owner;

assert.equal(first.generation < second.generation, true);
assert.equal(isCurrentRouteOwner(binding, "revit-plugin", "old-client", first.generation), false);
assert.equal(isCurrentRouteOwner(binding, "revit-plugin", "new-client", second.generation), true);
assert.equal(releaseRouteOwner(binding, "revit-plugin", "old-client", first.generation), false);
assert.equal(isCurrentRouteOwner(binding, "revit-plugin", "new-client", second.generation), true);
assert.equal(releaseRouteOwner(binding, "revit-plugin", "new-client", second.generation), true);
