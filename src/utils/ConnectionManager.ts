import { RevitClientConnection } from "./SocketClient.js";
import { getRelayClient, RelayClient } from "../relay/index.js";

/**
 * Connection mode for Revit communication
 * - "direct": Connect directly to localhost:8080 (local development / Claude Desktop)
 * - "relay": Connect through cloud relay server (production / web deployment)
 */
export type ConnectionMode = "direct" | "relay";

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Get the current connection mode from environment
 * Set REVIT_CONNECTION_MODE=relay to use relay, defaults to direct
 */
function getConnectionMode(): ConnectionMode {
  const mode = process.env.REVIT_CONNECTION_MODE?.toLowerCase();
  if (mode === "relay") return "relay";
  return "direct";
}

/**
 * Get direct connection settings from environment
 */
function getDirectConnectionSettings(): { host: string; port: number } {
  return {
    host: process.env.REVIT_HOST || "localhost",
    port: parseInt(process.env.REVIT_PORT || "8080", 10),
  };
}

// ─── Unified Interface ───────────────────────────────────────────────────────

/**
 * Interface that both direct and relay clients implement
 */
export interface IRevitClient {
  sendCommand(command: string, params: unknown): Promise<unknown>;
}

/**
 * Wrapper around direct socket connection to match IRevitClient interface
 */
class DirectRevitClient implements IRevitClient {
  private connection: RevitClientConnection;
  private host: string;
  private port: number;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
    this.connection = new RevitClientConnection(host, port);
  }

  async connect(): Promise<void> {
    if (this.connection.isConnected) return;

    return new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        this.connection.socket.removeListener("connect", onConnect);
        this.connection.socket.removeListener("error", onError);
        resolve();
      };

      const onError = (error: unknown) => {
        this.connection.socket.removeListener("connect", onConnect);
        this.connection.socket.removeListener("error", onError);
        reject(new Error("Failed to connect to Revit client"));
      };

      this.connection.socket.on("connect", onConnect);
      this.connection.socket.on("error", onError);

      this.connection.connect();

      setTimeout(() => {
        this.connection.socket.removeListener("connect", onConnect);
        this.connection.socket.removeListener("error", onError);
        reject(new Error("Failed to connect to Revit client after 10 seconds"));
      }, 10000);
    });
  }

  async sendCommand(command: string, params: unknown): Promise<unknown> {
    return this.connection.sendCommand(command, params);
  }

  disconnect(): void {
    this.connection.disconnect();
  }
}

/**
 * Wrapper around relay client to match IRevitClient interface
 */
class RelayRevitClient implements IRevitClient {
  private relayClient: RelayClient;

  constructor(relayClient: RelayClient) {
    this.relayClient = relayClient;
  }

  async sendCommand(command: string, params: unknown): Promise<unknown> {
    const response = await this.relayClient.sendCommand(command, params);
    if (response.success) {
      return response.result;
    } else {
      throw new Error(response.error?.message || "Command failed");
    }
  }
}

// ─── Main Connection Function ────────────────────────────────────────────────

/**
 * Connect to Revit client and execute operation
 * 
 * Supports two modes:
 * - **Direct mode** (default): Connects to localhost:8080 via TCP socket.
 *   Used for local development with Claude Desktop.
 * 
 * - **Relay mode**: Connects through cloud WebSocket relay.
 *   Used for production deployment where users connect via web.
 *   Set REVIT_CONNECTION_MODE=relay to enable.
 * 
 * @param operation Operation function to execute after successful connection
 * @returns Result of the operation
 */
export async function withRevitConnection<T>(
  operation: (client: IRevitClient) => Promise<T>
): Promise<T> {
  const mode = getConnectionMode();

  if (mode === "relay") {
    return withRelayConnection(operation);
  } else {
    return withDirectConnection(operation);
  }
}

/**
 * Direct connection to Revit via localhost TCP socket
 */
async function withDirectConnection<T>(
  operation: (client: IRevitClient) => Promise<T>
): Promise<T> {
  const settings = getDirectConnectionSettings();
  const client = new DirectRevitClient(settings.host, settings.port);

  try {
    await client.connect();
    return await operation(client);
  } finally {
    client.disconnect();
  }
}

/**
 * Connection to Revit via cloud relay server
 */
async function withRelayConnection<T>(
  operation: (client: IRevitClient) => Promise<T>
): Promise<T> {
  const relayClient = getRelayClient();
  
  if (!relayClient) {
    throw new Error(
      "Relay client not initialized. Call initRelayClient() first with relay URL and pairing token."
    );
  }

  if (!relayClient.connected) {
    throw new Error("Relay client not connected to relay server");
  }

  if (!relayClient.paired) {
    throw new Error("Relay client not paired with Revit plugin. Waiting for Revit to connect with pairing token.");
  }

  const client = new RelayRevitClient(relayClient);
  return await operation(client);
}

// ─── Legacy Export for Compatibility ─────────────────────────────────────────

/**
 * @deprecated Use withRevitConnection instead
 */
export { withRevitConnection as default };
