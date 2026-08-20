/**
 * Relay Module - Cloud-to-Local Revit Communication
 *
 * Exports:
 * - RelayServer: WebSocket hub for routing commands
 * - sendCommandViaToken: Direct in-memory command routing (no self-connecting WS client)
 * - relay-context: AsyncLocalStorage for threading relay token through MCP tool chain
 * - Types: Message types and utilities
 */

// Server (for standalone deployment)
export {
  startRelayServer,
  stopRelayServer,
  attachRelayToServer,
  getConnectedClients,
  getPairingTokens,
  createPairingToken,
  getTokenInfo,
  ensureTokenRegistered,
  sendCommandViaToken,
} from "./relay-server.js";

export {
  RELAY_SESSION_PREFIX,
  createRelaySession,
  getRelayRouteKey,
  isMcpRelayEndpointRole,
  verifyRelaySession,
  type RelaySessionPayload,
  type RelaySessionVerification,
  type VerifiedRelaySession,
} from "./relay-session.js";

// Async context for per-request relay token threading
export { relayTokenStorage, getRelayToken } from "./relay-context.js";

// Types
export {
  type ClientType,
  type ClientInfo,
  type RelayMessage,
  type RelayMessageType,
  type RegisterPayload,
  type RegisterAckPayload,
  type CommandPayload,
  type ResponsePayload,
  type StatusPayload,
  type ErrorPayload,
  type PairingToken,
  RelayErrorCodes,
  createMessage,
  generateMessageId,
  generatePairingToken,
  isValidPairingToken,
} from "./types.js";
