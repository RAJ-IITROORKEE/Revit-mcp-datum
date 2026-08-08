import assert from "node:assert/strict";
import test from "node:test";

import { relayCommandDispatchEnabled, requireRelayCommandDispatchEnabled } from "./relay-dispatch-gate.js";

test("relay command dispatch remains source-disabled pending local executor authority", () => {
  assert.equal(relayCommandDispatchEnabled(), false);
  assert.throws(() => requireRelayCommandDispatchEnabled(), /disabled/i);
});
