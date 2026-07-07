import { RevitClientConnection } from "./SocketClient.js";
import { sendCommandViaToken } from "../relay/relay-server.js";
import { getRelayToken } from "../relay/relay-context.js";

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
    host: process.env.REVIT_HOST || "127.0.0.1",
    port: parseInt(process.env.REVIT_PORT || "8080", 10),
  };
}

// ─── Unified Interface ───────────────────────────────────────────────────────

/**
 * Interface that both direct and relay clients implement
 */
export interface IRevitClient {
  sendCommand(command: string, params: unknown, timeoutMs?: number): Promise<unknown>;
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

  async sendCommand(command: string, params: unknown, timeoutMs?: number): Promise<unknown> {
    return this.connection.sendCommand(command, params);
  }

  disconnect(): void {
    this.connection.disconnect();
  }
}

/**
 * Relay client that routes commands directly through the in-memory relay hub.
 * Uses the relay token from AsyncLocalStorage (set by the /mcp HTTP handler).
 * No self-connecting WebSocket — zero extra network hops.
 */
class InProcessRelayRevitClient implements IRevitClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async sendCommand(command: string, params: unknown, timeoutMs?: number): Promise<unknown> {
    return sendCommandViaToken(this.token, command, params, timeoutMs);
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
 * - **Relay mode**: Routes commands via the in-memory relay hub using the
 *   per-request relay token from AsyncLocalStorage.
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
 * In-process relay connection.
 * Reads the relay token from AsyncLocalStorage (set by the /mcp HTTP handler).
 * Calls sendCommandViaToken() which routes directly to the Revit plugin WS
 * already stored in the relay server's tokenToClients Map — no extra WS hop.
 */
async function withRelayConnection<T>(
  operation: (client: IRevitClient) => Promise<T>
): Promise<T> {
  const token = getRelayToken();

  if (!token) {
    throw new Error(
      "No relay credential in async context. " +
      "Ensure X-Relay-Session or X-Relay-Token header is set and the /mcp handler wraps requests in relayTokenStorage.run()."
    );
  }

  const client = new InProcessRelayRevitClient(token);
  return operation(client);
}

// ─── Legacy Export for Compatibility ─────────────────────────────────────────

/**
 * @deprecated Use withRevitConnection instead
 */
export { withRevitConnection as default };
