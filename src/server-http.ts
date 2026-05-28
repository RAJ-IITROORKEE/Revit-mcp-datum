/**
 * Revit MCP HTTP Server for Railway / Cloud Deployment
 * 
 * Uses StreamableHTTPServerTransport for proper MCP-over-HTTP protocol.
 * Railway provides HTTPS termination, so this runs plain HTTP internally.
 * 
 * Each client session gets its own McpServer instance with all tools registered.
 * 
 * Endpoints:
 *   POST /mcp   - MCP client-to-server requests (JSON-RPC)
 *   GET  /mcp   - SSE stream for server-to-client notifications
 *   DELETE /mcp - Session termination
 *   GET /health  - Health check (no auth)
 *   GET /status  - Server status (requires auth)
 */

import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerTools } from "./tools/register.js";

// ─── Configuration ───────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.MCP_HOST || "0.0.0.0";
const API_KEY = (process.env.MCP_API_KEY || "").trim();
const SERVER_TIMEOUT_MS = 300000;
const SERVER_KEEPALIVE_TIMEOUT_MS = 305000;
const SERVER_HEADERS_TIMEOUT_MS = 310000;

// ─── Session Store ───────────────────────────────────────────────────────────
interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: Date;
}

const sessions: Map<string, Session> = new Map();

function getSessionId(req: Request): string | undefined {
  const value = req.headers["mcp-session-id"];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string" && first.trim()) {
      return first.trim();
    }
  }
  return undefined;
}

// ─── MCP Server Factory ─────────────────────────────────────────────────────
/**
 * Create a new McpServer instance with all tools registered.
 * Each session gets its own server for proper isolation.
 */
async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "revit-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        logging: {},
        tools: { listChanged: false },
      },
    }
  );
  await registerTools(server);
  return server;
}

let cachedToolCount: number | null = null;

async function getToolCount(): Promise<number> {
  if (cachedToolCount !== null) return cachedToolCount;
  try {
    const server = await createMcpServer();
    const toolRegistry = (server as any)._registeredTools || {};
    cachedToolCount = Object.keys(toolRegistry).length;
  } catch {
    cachedToolCount = 0;
  }
  return cachedToolCount;
}

async function handleStatelessRequest(req: Request, res: Response): Promise<void> {
  const body = req.body as { id?: string | number | null; method?: string } | undefined;

  // Direct fallback for tool catalog: return list without requiring prior session init.
  // This prevents intermittent tools/list 400 errors behind non-sticky load balancers.
  if (body?.method === "tools/list") {
    const server = await createMcpServer();
    const toolRegistry = (server as any)._registeredTools || {};
    const tools = Object.keys(toolRegistry).map((name) => ({
      name,
      description: toolRegistry[name]?.description || "",
      inputSchema: toolRegistry[name]?.inputSchema || { type: "object", properties: {} },
    }));

    res.status(200).json({
      jsonrpc: "2.0",
      id: body?.id ?? null,
      result: {
        tools,
      },
    });
    return;
  }

  const server = await createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await transport.close().catch(() => {
      // ignore transport close errors on stateless fallback
    });
  }
}

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "5mb" }));

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key, Mcp-Session-Id"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  next();
});

app.options("/{*path}", (_req: Request, res: Response) => {
  res.sendStatus(204);
});

// ─── Auth Middleware ─────────────────────────────────────────────────────────
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth if no API key configured (dev mode)
  if (!API_KEY) {
    next();
    return;
  }

  // Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === API_KEY) {
      next();
      return;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader === API_KEY) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized - Invalid API key" });
}

// ─── Health Check (no auth) ──────────────────────────────────────────────────
app.get("/health", async (_req: Request, res: Response) => {
  const toolCount = await getToolCount();
  res.json({
    ok: true,
    uptime: process.uptime(),
    toolCount,
    version: process.env.npm_package_version || "1.0.0",
    service: "revit-mcp",
    sessions: sessions.size,
  });
});

// ─── Status (requires auth) ─────────────────────────────────────────────────
app.get("/status", authMiddleware, (_req: Request, res: Response) => {
  res.json({
    status: "running",
    service: "revit-mcp",
    version: "1.0.0",
    sessions: sessions.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── MCP Endpoints (require auth) ───────────────────────────────────────────

// POST /mcp - Handle client-to-server MCP requests
app.post("/mcp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);

    // Case 1: Existing session - forward request to existing transport
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // Case 2: New session - must be an initialize request
    if (!sessionId && isInitializeRequest(req.body)) {
      console.log("[MCP] New session initialization request");

      // Create a dedicated MCP server for this session
      const server = await createMcpServer();

      // Create transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid: string) => {
          console.log(`[MCP] Session initialized: ${sid}`);
        },
      });

      // Connect server to transport
      await server.connect(transport);

      // Clean up on transport close
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          sessions.delete(sid);
          console.log(`[MCP] Session closed and cleaned up: ${sid}`);
        }
      };

      // Handle the initialization request
      await transport.handleRequest(req, res, req.body);

      // Ensure initialized session is stored for subsequent requests
      const initializedSessionId = transport.sessionId;
      if (initializedSessionId && !sessions.has(initializedSessionId)) {
        sessions.set(initializedSessionId, {
          transport,
          server,
          createdAt: new Date(),
        });
      }
      return;
    }

    // Case 3: Missing or unknown session - fallback to stateless request handling.
    // This protects against non-sticky load balancers where initialize and follow-up
    // requests may land on different instances.
    console.warn(
      `[MCP] Stateless fallback for method=${typeof req.body?.method === "string" ? req.body.method : "unknown"}`
    );
    await handleStatelessRequest(req, res);
  } catch (error) {
    console.error("[MCP] Error handling POST /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// GET /mcp - SSE stream for server-to-client notifications
app.get("/mcp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
    } else {
      res.status(400).json({ error: "Invalid or missing session ID" });
    }
  } catch (error) {
    console.error("[MCP] Error handling GET /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// DELETE /mcp - Session termination
app.delete("/mcp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      // Transport's onclose handler will clean up the session
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  } catch (error) {
    console.error("[MCP] Error handling DELETE /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Start Server ────────────────────────────────────────────────────────────
console.log(`[BOOT] PORT=${PORT} (env PORT=${process.env.PORT}, MCP_PORT=${process.env.MCP_PORT})`);

const httpServer = app.listen(PORT, HOST, () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Revit MCP HTTP Server (Railway/Cloud Deployment)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  URL:    http://${HOST}:${PORT}`);
  console.log(`  MCP:    http://${HOST}:${PORT}/mcp`);
  console.log(`  Health: http://${HOST}:${PORT}/health`);
  console.log(`  Auth:   ${API_KEY ? "ENABLED (API key required)" : "DISABLED (no API key set)"}`);
  console.log("═══════════════════════════════════════════════════════════");
});

httpServer.timeout = SERVER_TIMEOUT_MS;
httpServer.keepAliveTimeout = SERVER_KEEPALIVE_TIMEOUT_MS;
httpServer.headersTimeout = SERVER_HEADERS_TIMEOUT_MS;

httpServer.on("error", (err: Error) => {
  console.error(`[BOOT] Server listen error:`, err);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`[MCP] ${signal} received - shutting down gracefully...`);

  // Close all active sessions
  const sessionIds = Array.from(sessions.keys());
  for (const sid of sessionIds) {
    try {
      const session = sessions.get(sid);
      if (session) {
        await session.transport.close();
        console.log(`[MCP] Closed session: ${sid}`);
      }
    } catch (err) {
      console.error(`[MCP] Error closing session ${sid}:`, err);
    }
  }
  sessions.clear();

  // Close HTTP server
  httpServer.close(() => {
    console.log("[MCP] HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("[MCP] Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("[MCP] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[MCP] Unhandled rejection:", reason);
});
