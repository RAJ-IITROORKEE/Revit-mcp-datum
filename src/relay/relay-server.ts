/**
 * Relay Server - WebSocket Hub for Cloud-to-Local Revit Communication
 * 
 * This server acts as a bridge between:
 * - Cloud MCP Server (receives LLM commands)
 * - Local Revit Plugin (executes commands in Revit)
 * 
 * Architecture:
 * ┌─────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌──────────────┐
 * │  LLM Chat   │ ──────────────────▶│ Relay Server │◀────────────────── │ Revit Plugin │
 * │  (Cloud)    │                    │   (Cloud)    │                    │   (Local)    │
 * └─────────────┘                    └──────────────┘                    └──────────────┘
 * 
 * The Revit plugin connects OUTBOUND to the relay (solving NAT/firewall issues).
 * Messages are routed based on pairing tokens.
 */

import { WebSocketServer, WebSocket } from "ws";
import { createServer, Server as HttpServer, IncomingMessage } from "http";
import {
  ClientInfo,
  RelayMessage,
  RegisterPayload,
  RegisterAckPayload,
  CommandPayload,
  ResponsePayload,
  StatusPayload,
  ErrorPayload,
  PairingToken,
  RelayErrorCodes,
  createMessage,
  generateMessageId,
  generatePairingToken,
  isValidPairingToken,
} from "./types.js";
import { logWebSocketEvent, logError } from "../utils/Logger.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const RELAY_PORT = parseInt(process.env.RELAY_PORT || "8081", 10);
const RELAY_HOST = process.env.RELAY_HOST || "0.0.0.0";
const PING_INTERVAL = 30000; // 30 seconds
const CLIENT_TIMEOUT = 90000; // 90 seconds without pong = disconnect
const TOKEN_EXPIRY_HOURS = 24;
const MAX_PENDING_COMMANDS = 100;

// ─── State ───────────────────────────────────────────────────────────────────

interface ConnectedClient extends ClientInfo {
  ws: WebSocket;
  pendingCommands: Map<string, {
    resolve: (response: ResponsePayload) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
}

const clients = new Map<string, ConnectedClient>();
const pairingTokens = new Map<string, PairingToken>();
const tokenToClients = new Map<string, { revit?: string; mcp?: string }>();

// Pending promises for sendCommandViaToken() — keyed by messageId
const directPending = new Map<string, {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

// ─── Server Setup ────────────────────────────────────────────────────────────

let httpServer: HttpServer;
let wss: WebSocketServer;
let pingInterval: NodeJS.Timeout;

export function startRelayServer(port = RELAY_PORT, host = RELAY_HOST): Promise<void> {
  return new Promise((resolve) => {
    httpServer = createServer((req, res) => {
      // Health check endpoint
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          status: "healthy",
          service: "revit-relay",
          clients: clients.size,
          pairingTokens: pairingTokens.size,
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      // Generate pairing token endpoint
      if (req.url === "/token" && req.method === "POST") {
        const token = createPairingToken();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          token: token.token,
          expiresAt: token.expiresAt.toISOString(),
        }));
        return;
      }

      // Token info endpoint
      if (req.url?.startsWith("/token/") && req.method === "GET") {
        const token = req.url.split("/")[2];
        const info = getTokenInfo(token);
        if (info) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(info));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Token not found or expired" }));
        }
        return;
      }

      // 404 for other routes
      res.writeHead(404);
      res.end("Not found");
    });

    wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (ws, req) => {
      handleConnection(ws, req);
    });

    // Start ping interval
    pingInterval = setInterval(pingAllClients, PING_INTERVAL);

    httpServer.listen(port, host, () => {
      console.log("═══════════════════════════════════════════════════════════");
      console.log("  Revit Relay Server (WebSocket Hub)");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`  WebSocket: ws://${host}:${port}`);
      console.log(`  Health:    http://${host}:${port}/health`);
      console.log(`  Token:     POST http://${host}:${port}/token`);
      console.log("═══════════════════════════════════════════════════════════");
      resolve();
    });
  });
}

/**
 * Attach WebSocket relay to an existing HTTP server (for Railway single-port deployment)
 */
export function attachRelayToServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/relay" });

  wss.on("connection", (ws, req) => {
    handleConnection(ws, req);
  });

  // Start ping interval if not already running
  if (!pingInterval) {
    pingInterval = setInterval(pingAllClients, PING_INTERVAL);
  }

  console.log("[Relay] WebSocket attached to existing server at /relay");
  return wss;
}

export function stopRelayServer(): Promise<void> {
  return new Promise((resolve) => {
    clearInterval(pingInterval);
    
    // Close all client connections
    for (const client of clients.values()) {
      client.ws.close(1000, "Server shutting down");
    }
    clients.clear();
    
    wss.close(() => {
      httpServer.close(() => {
        console.log("[Relay] Server stopped");
        resolve();
      });
    });
  });
}

// ─── Pairing Token Management ────────────────────────────────────────────────

function createPairingToken(): PairingToken {
  const token: PairingToken = {
    token: generatePairingToken(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    used: false,
  };
  
  pairingTokens.set(token.token, token);
  tokenToClients.set(token.token, {});
  
  console.log(`[Relay] Created pairing token: ${token.token}`);
  return token;
}

function getTokenInfo(token: string): PairingToken | null {
  const info = pairingTokens.get(token);
  if (!info) return null;
  if (info.expiresAt < new Date()) {
    // Expired - clean up
    pairingTokens.delete(token);
    tokenToClients.delete(token);
    return null;
  }
  return info;
}

/**
 * Ensure a token is registered in memory, re-creating it if the server restarted.
 *
 * When Railway restarts, all in-memory pairingTokens are wiped. The Revit plugin
 * still holds the old token and can call this endpoint to re-register it so that
 * both sides can resume using the same token without the user having to re-enter it.
 *
 * @param token  Existing 8-character pairing token from the plugin
 * @returns      The PairingToken entry (existing or freshly re-created)
 */
export function ensureTokenRegistered(token: string): PairingToken {
  if (!isValidPairingToken(token)) {
    throw new Error(`Invalid token format: "${token}". Must be 8 uppercase alphanumeric characters.`);
  }

  const existing = getTokenInfo(token);
  if (existing) {
    console.log(`[Relay] ensureTokenRegistered: token already live: ${token}`);
    return existing;
  }

  // Token unknown (server restarted) — re-register under the same token string
  const entry: PairingToken = {
    token,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    used: false,
  };
  pairingTokens.set(token, entry);
  tokenToClients.set(token, {});
  console.log(`[Relay] ensureTokenRegistered: re-registered token after restart: ${token}`);
  return entry;
}

function validateToken(token: string): boolean {
  if (!isValidPairingToken(token)) return false;
  const info = getTokenInfo(token);
  return info !== null;
}

// ─── Connection Handling ─────────────────────────────────────────────────────

function handleConnection(ws: WebSocket, req: IncomingMessage) {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const remoteAddress = req.socket.remoteAddress || "unknown";
  console.log(`[Relay] New connection: ${clientId} from ${remoteAddress}`);
  
  // Log WebSocket connection
  logWebSocketEvent({
    event: "connect",
    clientId,
    address: remoteAddress,
    timestamp: new Date().toISOString(),
  });

  // Temporary client info until registration
  let registeredClient: ConnectedClient | null = null;

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString()) as RelayMessage;
      handleMessage(ws, clientId, message, registeredClient, (client) => {
        registeredClient = client;
      });
    } catch (error) {
      console.error(`[Relay] Invalid message from ${clientId}:`, error);
      logError({
        context: "Relay WebSocket message parsing",
        error: error instanceof Error ? error : new Error(String(error)),
        clientId,
      });
      sendError(ws, "unknown", RelayErrorCodes.INVALID_MESSAGE, "Invalid JSON message");
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[Relay] Connection closed: ${clientId} (code=${code}, reason=${reason})`);
    logWebSocketEvent({
      event: "disconnect",
      clientId,
      reason: String(reason || `code ${code}`),
      timestamp: new Date().toISOString(),
    });
    if (registeredClient) {
      handleDisconnect(registeredClient);
    }
  });

  ws.on("error", (error) => {
    console.error(`[Relay] WebSocket error for ${clientId}:`, error);
    logWebSocketEvent({
      event: "error",
      clientId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  });

  ws.on("pong", () => {
    if (registeredClient) {
      registeredClient.lastPing = new Date();
    }
  });
}

function handleMessage(
  ws: WebSocket,
  clientId: string,
  message: RelayMessage,
  currentClient: ConnectedClient | null,
  setClient: (client: ConnectedClient) => void
) {
  switch (message.type) {
    case "register":
      handleRegister(ws, clientId, message, setClient);
      break;

    case "command":
      if (!currentClient) {
        sendError(ws, message.id, RelayErrorCodes.UNAUTHORIZED, "Not registered");
        return;
      }
      handleCommand(currentClient, message);
      break;

    case "response":
      if (!currentClient) {
        sendError(ws, message.id, RelayErrorCodes.UNAUTHORIZED, "Not registered");
        return;
      }
      handleResponse(currentClient, message);
      break;

    case "pong":
      // Handled by ws.on("pong")
      break;

    case "ping":
      // Application-level keepalive from clients (e.g., Revit plugin)
      if (currentClient) {
        currentClient.lastPing = new Date();
      }
      send(
        ws,
        createMessage(
          "pong",
          {
            status: "ready",
            clientId,
            message: "pong",
          } as StatusPayload,
          message.id
        )
      );
      break;

    default:
      sendError(ws, message.id, RelayErrorCodes.INVALID_MESSAGE, `Unknown message type: ${message.type}`);
  }
}

function handleRegister(
  ws: WebSocket,
  clientId: string,
  message: RelayMessage,
  setClient: (client: ConnectedClient) => void
) {
  const payload = message.payload as RegisterPayload;
  
  // Validate pairing token
  if (!validateToken(payload.pairingToken)) {
    const ackPayload: RegisterAckPayload = {
      success: false,
      clientId: "",
      message: "Invalid or expired pairing token",
    };
    send(ws, createMessage("register_ack", ackPayload, message.id));
    ws.close(4001, "Invalid pairing token");
    return;
  }

  // Create client info
  const client: ConnectedClient = {
    id: clientId,
    type: payload.clientType,
    pairingToken: payload.pairingToken,
    connectedAt: new Date(),
    lastPing: new Date(),
    metadata: payload.metadata,
    ws,
    pendingCommands: new Map(),
  };

  // Register client
  clients.set(clientId, client);
  setClient(client);

  // Update token associations
  const tokenClients = tokenToClients.get(payload.pairingToken) || {};
  if (payload.clientType === "revit-plugin") {
    tokenClients.revit = clientId;
    const tokenInfo = pairingTokens.get(payload.pairingToken);
    if (tokenInfo) tokenInfo.revitClientId = clientId;
  } else {
    tokenClients.mcp = clientId;
    const tokenInfo = pairingTokens.get(payload.pairingToken);
    if (tokenInfo) tokenInfo.mcpClientId = clientId;
  }
  tokenToClients.set(payload.pairingToken, tokenClients);

  console.log(`[Relay] Registered ${payload.clientType}: ${clientId} with token ${payload.pairingToken}`);

  // Check if paired
  const pairedClientId = payload.clientType === "revit-plugin" ? tokenClients.mcp : tokenClients.revit;
  const pairedClient = pairedClientId ? clients.get(pairedClientId) : undefined;

  // Send registration acknowledgment
  const ackPayload: RegisterAckPayload = {
    success: true,
    clientId,
    pairedWith: pairedClientId,
    message: pairedClientId ? "Paired with existing client" : "Waiting for pair",
  };
  send(ws, createMessage("register_ack", ackPayload, message.id));

  // Notify paired client
  if (pairedClient) {
    const statusPayload: StatusPayload = {
      status: "paired",
      clientId: pairedClient.id,
      pairedClientId: clientId,
      message: `Paired with ${payload.clientType}`,
    };
    send(pairedClient.ws, createMessage("status", statusPayload));
    console.log(`[Relay] Paired: ${clientId} <-> ${pairedClientId}`);
  }
}

function handleCommand(client: ConnectedClient, message: RelayMessage) {
  const payload = message.payload as CommandPayload;
  
  // Find paired Revit plugin
  const tokenClients = tokenToClients.get(client.pairingToken);
  if (!tokenClients?.revit) {
    sendError(client.ws, message.id, RelayErrorCodes.NO_PAIRED_CLIENT, "No Revit plugin connected");
    return;
  }

  const revitClient = clients.get(tokenClients.revit);
  if (!revitClient) {
    sendError(client.ws, message.id, RelayErrorCodes.CLIENT_DISCONNECTED, "Revit plugin disconnected");
    return;
  }

  console.log(`[Relay] Routing command: ${payload.command} from ${client.id} to ${revitClient.id}`);

  // Forward command to Revit plugin
  const commandMessage = createMessage("command", payload, message.id);
  send(revitClient.ws, commandMessage);

  // Track pending command for response routing
  const timeout = setTimeout(() => {
    const pending = client.pendingCommands.get(message.id);
    if (pending) {
      client.pendingCommands.delete(message.id);
      sendError(client.ws, message.id, RelayErrorCodes.COMMAND_TIMEOUT, 
        `Command ${payload.command} timed out after ${payload.timeout || 300000}ms`);
    }
  }, payload.timeout || 300000);

  // Store in MCP client's pending commands for response routing
  client.pendingCommands.set(message.id, {
    resolve: () => {}, // Not used for relay, just for cleanup
    reject: () => {},
    timeout,
  });
}

function handleResponse(client: ConnectedClient, message: RelayMessage) {
  const payload = message.payload as ResponsePayload;

  // Primary path: resolve a Promise from sendCommandViaToken() (no WS self-connection needed)
  const directHandler = directPending.get(message.id);
  if (directHandler) {
    clearTimeout(directHandler.timeout);
    directPending.delete(message.id);
    if (payload.success) {
      directHandler.resolve(payload.result);
    } else {
      directHandler.reject(new Error(payload.error?.message || "Revit command failed"));
    }
    console.log(`[Relay] Resolved direct pending for ${message.id} from ${client.id}`);
    return;
  }

  // Legacy path: forward to an mcp-server WS client (backwards compat)
  const tokenClients = tokenToClients.get(client.pairingToken);
  if (!tokenClients?.mcp) {
    console.warn(`[Relay] No handler for response ${message.id} — no direct pending and no MCP WS client`);
    return;
  }

  const mcpClient = clients.get(tokenClients.mcp);
  if (!mcpClient) {
    console.warn(`[Relay] MCP server disconnected, dropping response for message ${message.id}`);
    return;
  }

  // Clear timeout on MCP WS client
  const pending = mcpClient.pendingCommands.get(message.id);
  if (pending) {
    clearTimeout(pending.timeout);
    mcpClient.pendingCommands.delete(message.id);
  }

  console.log(`[Relay] Routing response for ${message.id} from ${client.id} to ${mcpClient.id}`);

  // Forward response to MCP WS client
  const responseMessage = createMessage("response", payload, message.id);
  send(mcpClient.ws, responseMessage);
}

function handleDisconnect(client: ConnectedClient) {
  // Clean up pending commands
  for (const [, pending] of client.pendingCommands) {
    clearTimeout(pending.timeout);
  }
  client.pendingCommands.clear();

  // Remove from clients
  clients.delete(client.id);

  // Update token associations
  const tokenClients = tokenToClients.get(client.pairingToken);
  if (tokenClients) {
    if (client.type === "revit-plugin") {
      delete tokenClients.revit;
    } else {
      delete tokenClients.mcp;
    }
  }

  // Notify paired client
  const pairedClientId = client.type === "revit-plugin" ? tokenClients?.mcp : tokenClients?.revit;
  if (pairedClientId) {
    const pairedClient = clients.get(pairedClientId);
    if (pairedClient) {
      const statusPayload: StatusPayload = {
        status: "unpaired",
        clientId: pairedClient.id,
        message: `${client.type} disconnected`,
      };
      send(pairedClient.ws, createMessage("status", statusPayload));
    }
  }

  console.log(`[Relay] Client disconnected: ${client.id} (${client.type})`);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function send(ws: WebSocket, message: RelayMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, messageId: string, code: string, message: string) {
  const errorPayload: ErrorPayload = { code, message };
  send(ws, createMessage("error", errorPayload, messageId));
}

function pingAllClients() {
  const now = Date.now();
  for (const [id, client] of clients) {
    // Check for timeout
    if (now - client.lastPing.getTime() > CLIENT_TIMEOUT) {
      console.log(`[Relay] Client timeout: ${id}`);
      client.ws.close(4002, "Ping timeout");
      continue;
    }

    // Send ping
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.ping();
    }
  }

  // Clean up expired tokens
  for (const [token, info] of pairingTokens) {
    if (info.expiresAt < new Date()) {
      pairingTokens.delete(token);
      tokenToClients.delete(token);
      console.log(`[Relay] Expired token cleaned up: ${token}`);
    }
  }
}

// ─── Exports for Integration ─────────────────────────────────────────────────

export function getConnectedClients(): ClientInfo[] {
  return Array.from(clients.values()).map(({ ws, pendingCommands, ...info }) => info);
}

export function getPairingTokens(): PairingToken[] {
  return Array.from(pairingTokens.values());
}

export { createPairingToken, getTokenInfo };

// ─── Direct Command Routing ───────────────────────────────────────────────────

/**
 * Send a command directly to the Revit plugin for a given pairing token.
 *
 * Bypasses the self-connecting WS relay client (globalRelayClient).
 * Uses the in-memory tokenToClients Map to find the Revit plugin WS directly.
 *
 * @param token    Pairing token (X-Relay-Token from HTTP header)
 * @param command  Command name (e.g. "create_wall")
 * @param params   Command parameters
 * @param timeoutMs  Timeout in ms (default 5 minutes to match socket client)
 */
export async function sendCommandViaToken(
  token: string,
  command: string,
  params: unknown,
  timeoutMs = 300000
): Promise<unknown> {
  const tokenClients = tokenToClients.get(token);
  if (!tokenClients?.revit) {
    throw new Error(
      "No Revit plugin connected for this token. " +
      "Open Revit, go to Settings → Cloud Relay and click Connect."
    );
  }

  const revitClient = clients.get(tokenClients.revit);
  if (!revitClient || revitClient.ws.readyState !== WebSocket.OPEN) {
    throw new Error("Revit plugin WebSocket is not open. Waiting for reconnection.");
  }

  const messageId = generateMessageId();

  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      directPending.delete(messageId);
      reject(new Error(`Revit command '${command}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    directPending.set(messageId, { resolve, reject, timeout });

    const payload: CommandPayload = { command, params, timeout: timeoutMs };
    send(revitClient.ws, createMessage("command", payload, messageId));

    console.log(`[Relay] sendCommandViaToken: ${command} → revit client ${revitClient.id} (msgId=${messageId})`);
  });
}

// ─── Standalone Entry Point ──────────────────────────────────────────────────

// Check if this module is being run directly
const isMainModule = process.argv[1]?.endsWith("relay-server.js") || 
                     process.argv[1]?.endsWith("relay-server.ts");

if (isMainModule) {
  startRelayServer().catch((err) => {
    console.error("[Relay] Failed to start:", err);
    process.exit(1);
  });

  process.on("SIGTERM", () => {
    console.log("[Relay] SIGTERM received");
    stopRelayServer().then(() => process.exit(0));
  });

  process.on("SIGINT", () => {
    console.log("[Relay] SIGINT received");
    stopRelayServer().then(() => process.exit(0));
  });
}
