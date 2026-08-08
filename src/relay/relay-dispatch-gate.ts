/**
 * Relay transport is not an execution authority. Keep every command path
 * unavailable until the canonical local executor owns signed authorization.
 */
export function relayCommandDispatchEnabled(): false {
  return false;
}

export function requireRelayCommandDispatchEnabled(): never {
  throw new Error("Relay command dispatch is disabled pending local executor authority");
}

export function relaySessionAuthorizationEnabled(): false {
  return false;
}

export function requireRelaySessionAuthorizationEnabled(): never {
  throw new Error("Relay session authorization is disabled pending local executor authority");
}
