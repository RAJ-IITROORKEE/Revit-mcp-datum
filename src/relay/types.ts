/**
 * Relay Server Types
 * 
 * Defines the message protocol between:
 * - Cloud MCP Server (sends commands)
 * - Relay Server (routes messages)
 * - Revit Plugin (executes commands)
 */

// ─── Connection Types ────────────────────────────────────────────────────────

export type ClientType = "mcp-server" | "revit-plugin";

export interface ClientInfo {
  id: string;
  type: ClientType;
  /** Route key used by the relay. Legacy tokens use the token value; signed sessions use connection:<id>. */
  pairingToken: string;
  connectedAt: Date;
  lastPing: Date;
  metadata?: {
    revitVersion?: string;
    projectName?: string;
    userName?: string;
    machineName?: string;
  };
}

// ─── Message Types ───────────────────────────────────────────────────────────

export type RelayMessageType =
  | "register"           // Client registration with pairing token
  | "register_ack"       // Registration acknowledgment
  | "command"            // MCP -> Revit: Execute a command
  | "response"           // Revit -> MCP: Command result
  | "ping"               // Keepalive ping
  | "pong"               // Keepalive pong
  | "status"             // Status update (connection state, etc.)
  | "error";             // Error message

export interface RelayMessage {
  type: RelayMessageType;
  id: string;            // Message ID for request/response correlation
  timestamp: number;
  payload: unknown;
}

// ─── Registration ────────────────────────────────────────────────────────────

export interface RegisterPayload {
  clientType: ClientType;
  /** Legacy 8-character pairing token. Kept temporarily for current plugin compatibility. */
  pairingToken?: string;
  /** Signed connection-scoped relay session for the production plugin path. */
  relaySession?: string;
  connectionId?: string;
  metadata?: ClientInfo["metadata"];
}

export interface RegisterAckPayload {
  success: boolean;
  clientId: string;
  message?: string;
  pairedWith?: string;   // ID of paired client (if already connected)
}

// ─── Commands ────────────────────────────────────────────────────────────────

export interface CommandPayload {
  command: string;       // Command name (e.g., "create_wall")
  params: unknown;       // Command parameters
  timeout?: number;      // Optional timeout in ms
}

export interface ResponsePayload {
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  executionTime?: number;
}

// ─── Status ──────────────────────────────────────────────────────────────────

export interface StatusPayload {
  status: "connected" | "disconnected" | "paired" | "unpaired" | "busy" | "ready";
  clientId?: string;
  pairedClientId?: string;
  message?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

// ─── Error Codes ─────────────────────────────────────────────────────────────

export const RelayErrorCodes = {
  INVALID_TOKEN: "INVALID_TOKEN",
  NO_PAIRED_CLIENT: "NO_PAIRED_CLIENT",
  CLIENT_DISCONNECTED: "CLIENT_DISCONNECTED",
  COMMAND_TIMEOUT: "COMMAND_TIMEOUT",
  INVALID_MESSAGE: "INVALID_MESSAGE",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

// ─── Pairing Token Structure ─────────────────────────────────────────────────

/**
 * Pairing tokens are short-lived codes that link an MCP server session
 * to a specific Revit plugin instance.
 * 
 * Format: 8-character alphanumeric code (e.g., "A1B2C3D4")
 * Valid for: 24 hours after creation
 * 
 * Token lifecycle:
 * 1. User generates token in Revit plugin UI
 * 2. User enters token in web chat interface
 * 3. MCP server connects to relay with token
 * 4. Relay pairs both clients
 * 5. Commands flow: MCP -> Relay -> Revit
 */
export interface PairingToken {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  revitClientId?: string;
  mcpClientId?: string;
  used: boolean;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

export function createMessage<T>(type: RelayMessageType, payload: T, id?: string): RelayMessage {
  return {
    type,
    id: id || generateMessageId(),
    timestamp: Date.now(),
    payload,
  };
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generatePairingToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing characters (0/O, 1/I/L)
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export function isValidPairingToken(token: string): boolean {
  return /^[A-Z2-9]{8}$/.test(token);
}
