import pino from "pino";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function resolvePrettyTransport():
  | {
      target: string;
      options: {
        colorize: boolean;
        singleLine: boolean;
        translateTime: string;
        ignore: string;
      };
    }
  | undefined {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  try {
    require.resolve("pino-pretty");
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: false,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    };
  } catch {
    return undefined;
  }
}

/**
 * Production-grade logger using pino for structured JSON logging.
 * Optimized for managed container deployment with stdout transport.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: resolvePrettyTransport(),
  // Include timestamp in every log
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Log a tool call with timing and result information
 */
export function logToolCall(data: {
  toolName: string;
  userId?: string;
  clientId?: string;
  durationMs: number;
  success: boolean;
  transport?: "direct" | "relay";
  error?: string;
  inputSummary?: string;
}) {
  logger.info(
    {
      event: "tool_call",
      toolName: data.toolName,
      userId: data.userId || "unknown",
      clientId: data.clientId,
      durationMs: data.durationMs,
      success: data.success,
      transport: data.transport || "direct",
      error: data.error,
      inputSummary: data.inputSummary,
    },
    `Tool call: ${data.toolName}`
  );
}

/**
 * Log WebSocket connection events
 */
export function logWebSocketEvent(data: {
  event: "connect" | "disconnect" | "error";
  clientId: string;
  timestamp?: string;
  address?: string;
  reason?: string;
  error?: string;
}) {
  const eventName = data.event === "connect" ? "ws_connect" : `ws_${data.event}`;
  logger.info(
    {
      event: eventName,
      clientId: data.clientId,
      address: data.address,
      reason: data.reason,
      error: data.error,
      timestamp: data.timestamp || new Date().toISOString(),
    },
    `WebSocket ${data.event}: ${data.clientId}`
  );
}

/**
 * Log server startup events
 */
export function logServerStartup(data: {
  port: number;
  host: string;
  environment: string;
  timeout?: number;
  mode?: string;
}) {
  logger.info(
    {
      event: "server_startup",
      port: data.port,
      host: data.host,
      environment: data.environment,
      timeout: data.timeout,
      mode: data.mode,
    },
    `Server started on ${data.host}:${data.port} (${data.environment})`
  );
}

/**
 * Log health check events (at debug level to avoid spam)
 */
export function logHealthCheck(data: {
  ok: boolean;
  connectedClients: number;
  toolCount: number;
  uptime: number;
}) {
  logger.debug(
    {
      event: "health_check",
      ok: data.ok,
      connectedClients: data.connectedClients,
      toolCount: data.toolCount,
      uptime: data.uptime,
    },
    "Health check"
  );
}

/**
 * Log errors with context
 */
export function logError(data: {
  context: string;
  error: Error | string;
  userId?: string;
  clientId?: string;
  details?: Record<string, unknown>;
}) {
  logger.error(
    {
      event: "error",
      context: data.context,
      error: typeof data.error === "string" ? data.error : data.error.message,
      stack: typeof data.error === "string" ? undefined : data.error.stack,
      userId: data.userId,
      clientId: data.clientId,
      ...data.details,
    },
    `Error in ${data.context}`
  );
}

export default logger;
