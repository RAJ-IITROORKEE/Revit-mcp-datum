/**
 * Relay Context - AsyncLocalStorage for per-request relay token threading
 *
 * Threads the X-Relay-Token from the /mcp HTTP handler down through the
 * entire MCP tool execution chain without modifying tool signatures.
 *
 * Usage:
 *   // In HTTP handler:
 *   relayTokenStorage.run(token, async () => { ... process MCP request ... });
 *
 *   // In tool / ConnectionManager:
 *   const token = getRelayToken(); // returns token set by handler above
 */

import { AsyncLocalStorage } from "async_hooks";

export const relayTokenStorage = new AsyncLocalStorage<string>();

/**
 * Returns the relay token for the current async execution context.
 * Returns undefined if called outside of a relayTokenStorage.run() scope.
 */
export function getRelayToken(): string | undefined {
  return relayTokenStorage.getStore();
}
