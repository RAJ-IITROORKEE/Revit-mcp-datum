/**
 * Relay Module - Cloud-to-Local Revit Communication
 * 
 * Exports:
 * - RelayServer: WebSocket hub for routing commands
 * - RelayClient: Client for MCP server to send commands via relay
 * - Types: Message types and utilities
 */

// Server (for standalone deployment)
export {
  startRelayServer,
  stopRelayServer,
  getConnectedClients,
  getPairingTokens,
  createPairingToken,
} from "./relay-server.js";

// Client (for MCP server integration)
export {
  RelayClient,
  getRelayClient,
  initRelayClient,
  closeRelayClient,
  type RelayClientEvent,
  type RelayClientEventHandler,
} from "./relay-client.js";

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
