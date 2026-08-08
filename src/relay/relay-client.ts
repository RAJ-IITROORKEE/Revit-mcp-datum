/**
 * Relay Client - Connects MCP Server to Relay Server
 * 
 * This module allows the cloud MCP server to send commands to
 * Revit through the relay server instead of direct localhost connection.
 * 
 * Usage:
 *   const client = new RelayClient("wss://relay.example.com", "PAIRING_TOKEN");
 *   await client.connect();
 *   const result = await client.sendCommand("create_wall", { ... });
 */

import WebSocket from "ws";
import {
  RelayMessage,
  CommandPayload,
  ResponsePayload,
  RegisterPayload,
  RegisterAckPayload,
  StatusPayload,
  createMessage,
  generateMessageId,
} from "./types.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL = 25000; // 25 seconds (less than server's 30s)

// ─── Events ──────────────────────────────────────────────────────────────────

export type RelayClientEvent = 
  | "connected"
  | "disconnected"
  | "paired"
  | "unpaired"
  | "error";

export type RelayClientEventHandler = (data?: unknown) => void;

// ─── RelayClient Class ───────────────────────────────────────────────────────

export class RelayClient {
  private ws: WebSocket | null = null;
  private relayUrl: string;
  private pairingToken: string;
  private clientId: string | null = null;
  private pairedClientId: string | null = null;
  private isConnected = false;
  private isPaired = false;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private pingInterval: NodeJS.Timeout | null = null;

  private pendingCommands = new Map<string, {
    resolve: (response: ResponsePayload) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  private eventHandlers = new Map<RelayClientEvent, Set<RelayClientEventHandler>>();

  constructor(relayUrl: string, pairingToken: string) {
    this.relayUrl = relayUrl;
    this.pairingToken = pairingToken;
  }

  // ─── Connection Management ─────────────────────────────────────────────────

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.relayUrl);

        const connectionTimeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
          this.ws?.close();
        }, 10000);

        this.ws.on("open", () => {
          clearTimeout(connectionTimeout);
          console.log("[RelayClient] Connected to relay server");
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.register()
            .then(() => resolve())
            .catch(reject);
        });

        this.ws.on("message", (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on("close", (code, reason) => {
          console.log(`[RelayClient] Disconnected: code=${code}, reason=${reason}`);
          this.handleDisconnect();
        });

        this.ws.on("error", (error) => {
          console.error("[RelayClient] WebSocket error:", error);
          this.emit("error", error);
          if (!this.isConnected) {
            clearTimeout(connectionTimeout);
            reject(error);
          }
        });

        this.ws.on("pong", () => {
          // Keepalive acknowledged
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.stopPingInterval();
    
    // Reject all pending commands
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Client disconnecting"));
    }
    this.pendingCommands.clear();

    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isPaired = false;
  }

  private async register(): Promise<void> {
    return new Promise((resolve, reject) => {
      const payload: RegisterPayload = {
        clientType: "mcp-server",
        endpointRole: "mcp-server",
        pairingToken: this.pairingToken,
      };

      const messageId = generateMessageId();
      const message = createMessage("register", payload, messageId);

      const timeout = setTimeout(() => {
        reject(new Error("Registration timeout"));
      }, 10000);

      // Store resolver for register_ack
      const handler = (data: RelayMessage) => {
        if (data.id === messageId && data.type === "register_ack") {
          clearTimeout(timeout);
          const ack = data.payload as RegisterAckPayload;
          if (ack.success) {
            this.clientId = ack.clientId;
            this.pairedClientId = ack.pairedWith || null;
            this.isPaired = !!ack.pairedWith;
            console.log(`[RelayClient] Registered as ${this.clientId}, paired=${this.isPaired}`);
            this.emit("connected", { clientId: this.clientId });
            if (this.isPaired) {
              this.emit("paired", { pairedWith: this.pairedClientId });
            }
            resolve();
          } else {
            reject(new Error(ack.message || "Registration failed"));
          }
        }
      };

      // Temporarily add handler for registration response
      this._registerAckHandler = handler;
      
      this.send(message);
    });
  }

  private _registerAckHandler: ((data: RelayMessage) => void) | null = null;

  // ─── Message Handling ──────────────────────────────────────────────────────

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data) as RelayMessage;

      switch (message.type) {
        case "register_ack":
          if (this._registerAckHandler) {
            this._registerAckHandler(message);
            this._registerAckHandler = null;
          }
          break;

        case "response":
          this.handleResponse(message);
          break;

        case "status":
          this.handleStatus(message);
          break;

        case "error":
          this.handleError(message);
          break;

        case "ping":
          this.send(createMessage("pong", {}, message.id));
          break;

        default:
          console.warn(`[RelayClient] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("[RelayClient] Failed to parse message:", error);
    }
  }

  private handleResponse(message: RelayMessage) {
    const pending = this.pendingCommands.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(message.id);
      pending.resolve(message.payload as ResponsePayload);
    } else {
      console.warn(`[RelayClient] Received response for unknown command: ${message.id}`);
    }
  }

  private handleStatus(message: RelayMessage) {
    const status = message.payload as StatusPayload;
    console.log(`[RelayClient] Status update: ${status.status}`);

    if (status.status === "paired") {
      this.isPaired = true;
      this.pairedClientId = status.pairedClientId || null;
      this.emit("paired", { pairedWith: this.pairedClientId });
    } else if (status.status === "unpaired") {
      this.isPaired = false;
      this.pairedClientId = null;
      this.emit("unpaired", {});
    }
  }

  private handleError(message: RelayMessage) {
    const pending = this.pendingCommands.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(message.id);
      const error = message.payload as { code: string; message: string };
      pending.reject(new Error(`${error.code}: ${error.message}`));
    }
    this.emit("error", message.payload);
  }

  private handleDisconnect() {
    this.stopPingInterval();
    this.isConnected = false;
    this.isPaired = false;
    this.emit("disconnected", {});

    // Reject all pending commands
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection lost"));
    }
    this.pendingCommands.clear();

    // Attempt reconnection
    if (this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      console.log(`[RelayClient] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(() => this.connect().catch(() => {}), RECONNECT_DELAY);
    }
  }

  // ─── Command Sending ───────────────────────────────────────────────────────

  async sendCommand(command: string, params: unknown, timeout = DEFAULT_TIMEOUT): Promise<ResponsePayload> {
    if (!this.isConnected) {
      throw new Error("Not connected to relay server");
    }

    if (!this.isPaired) {
      throw new Error("No Revit plugin connected");
    }

    return new Promise((resolve, reject) => {
      const messageId = generateMessageId();
      const payload: CommandPayload = {
        command,
        params,
        timeout,
      };

      const timeoutHandle = setTimeout(() => {
        this.pendingCommands.delete(messageId);
        reject(new Error(`Command ${command} timed out after ${timeout}ms`));
      }, timeout);

      this.pendingCommands.set(messageId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      const message = createMessage("command", payload, messageId);
      this.send(message);
    });
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  private send(message: RelayMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error("WebSocket not connected");
    }
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, PING_INTERVAL);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ─── Event Handling ────────────────────────────────────────────────────────

  on(event: RelayClientEvent, handler: RelayClientEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: RelayClientEvent, handler: RelayClientEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: RelayClientEvent, data?: unknown) {
    this.eventHandlers.get(event)?.forEach(handler => handler(data));
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  get connected(): boolean {
    return this.isConnected;
  }

  get paired(): boolean {
    return this.isPaired;
  }

  get id(): string | null {
    return this.clientId;
  }

  get pairedWith(): string | null {
    return this.pairedClientId;
  }
}

// ─── Factory Function ────────────────────────────────────────────────────────

let globalRelayClient: RelayClient | null = null;

export function getRelayClient(): RelayClient | null {
  return globalRelayClient;
}

export async function initRelayClient(relayUrl: string, pairingToken: string): Promise<RelayClient> {
  if (globalRelayClient) {
    await globalRelayClient.disconnect();
  }
  globalRelayClient = new RelayClient(relayUrl, pairingToken);
  await globalRelayClient.connect();
  return globalRelayClient;
}

export async function closeRelayClient(): Promise<void> {
  if (globalRelayClient) {
    await globalRelayClient.disconnect();
    globalRelayClient = null;
  }
}
