/**
 * Combined Server - MCP HTTP + Relay WebSocket (Single Port for Railway)
 * 
 * This server runs both on the SAME port:
 * - MCP HTTP endpoints (for LLM clients) 
 * - Relay WebSocket (for Revit plugins) at /relay path
 * 
 * This is required for Railway which only exposes a single port.
 */

import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerTools } from "./tools/register.js";
import { 
  attachRelayToServer, 
  createPairingToken, 
  getTokenInfo,
  getConnectedClients, 
  getPairingTokens,
  relayTokenStorage,
} from "./relay/index.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const API_KEY = (process.env.MCP_API_KEY || "").trim();

// ─── MCP Session Store ───────────────────────────────────────────────────────

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: Date;
}

const sessions: Map<string, Session> = new Map();

function getRelayWebSocketUrl(req: Request): string {
  const host = req.headers.host || `localhost:${PORT}`;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = typeof forwardedProto === "string" ? forwardedProto : req.secure ? "https" : "http";
  const wsProto = proto === "https" ? "wss" : "ws";
  return `${wsProto}://${host}/relay`;
}

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

async function handleStatelessRequest(req: Request, res: Response): Promise<void> {
  const body = req.body as { id?: string | number | null; method?: string } | undefined;

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
      result: { tools },
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
    await transport.close().catch(() => {});
  }
}

// ─── Express App ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "5mb" }));

// CORS
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

// Auth Middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!API_KEY) {
    next();
    return;
  }

  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === API_KEY) {
      next();
      return;
    }
  }

  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader === API_KEY) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized - Invalid API key" });
}

// ─── Health & Status Endpoints ───────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "revit-mcp-combined",
    mcpSessions: sessions.size,
    relayClients: getConnectedClients().length,
    pairingTokens: getPairingTokens().length,
  });
});

app.get("/status", authMiddleware, (_req: Request, res: Response) => {
  res.json({
    status: "running",
    service: "revit-mcp-combined",
    version: "1.0.0",
    mcpSessions: sessions.size,
    relayClients: getConnectedClients(),
    pairingTokens: getPairingTokens().map(t => ({
      token: t.token,
      expiresAt: t.expiresAt,
      hasRevit: !!t.revitClientId,
      hasMcp: !!t.mcpClientId,
    })),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Relay Token Endpoints ───────────────────────────────────────────────────

// Generate new pairing token
app.post("/api/relay/token", authMiddleware, async (req: Request, res: Response) => {
  const token = createPairingToken();
  const websocketUrl = getRelayWebSocketUrl(req);

  res.json({
    token: token.token,
    expiresAt: token.expiresAt.toISOString(),
    websocketUrl,
  });
});

// Get token info
app.get("/api/relay/token/:token", authMiddleware, async (req: Request, res: Response) => {
  const tokenParam = req.params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const info = getTokenInfo(token);
  
  if (!info) {
    res.status(404).json({ error: "Token not found or expired" });
    return;
  }

  res.json({
    token: info.token,
    createdAt: info.createdAt,
    expiresAt: info.expiresAt,
    used: info.used,
    revitClientId: info.revitClientId || null,
    mcpClientId: info.mcpClientId || null,
  });
});

// ─── MCP Endpoints ───────────────────────────────────────────────────────────

app.post("/mcp", authMiddleware, async (req: Request, res: Response) => {
  try {
    // Extract relay token from header — Datum sends this to identify the user's Revit session.
    const relayTokenHeader = req.headers["x-relay-token"];
    const relayToken = typeof relayTokenHeader === "string"
      ? relayTokenHeader.trim()
      : Array.isArray(relayTokenHeader)
        ? String(relayTokenHeader[0] || "").trim()
        : "";

    if (relayToken) {
      const tokenInfo = getTokenInfo(relayToken);
      if (!tokenInfo) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Invalid or expired relay token" },
          id: req.body?.id ?? null,
        });
        return;
      }
    }

    // Thread the relay token through the MCP tool execution chain via AsyncLocalStorage.
    // ConnectionManager.withRevitConnection() reads it from getRelayToken() — no global state.
    await relayTokenStorage.run(relayToken, async () => {
      const sessionId = getSessionId(req);

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        console.log("[MCP] New session initialization request");
        const server = await createMcpServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (sid: string) => {
            console.log(`[MCP] Session initialized: ${sid}`);
            if (!sessions.has(sid)) {
              sessions.set(sid, { transport, server, createdAt: new Date() });
            }
          },
        });

        await server.connect(transport);

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && sessions.has(sid)) {
            sessions.delete(sid);
            console.log(`[MCP] Session closed: ${sid}`);
          }
        };

        await transport.handleRequest(req, res, req.body);

        const initializedSessionId = transport.sessionId;
        if (initializedSessionId && !sessions.has(initializedSessionId)) {
          sessions.set(initializedSessionId, { transport, server, createdAt: new Date() });
        }
        return;
      }

      // No matching session — Railway may have restarted. Return a clean JSON-RPC error
      // so the client can detect and re-initialize the session (new initialize call).
      const method = typeof req.body?.method === "string" ? req.body.method : "unknown";
      const reqId = req.body?.id ?? null;
      console.warn(`[MCP] No session found for sessionId — returning session-expired error. method=${method}`);
      res.status(400).json({
        jsonrpc: "2.0",
        id: reqId,
        error: {
          code: -32000,
          message: "Server not initialized: session expired or server restarted. Please reinitialize.",
        },
      });
    });
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

app.delete("/mcp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
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

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Start Server ────────────────────────────────────────────────────────────

async function start() {
  // Create HTTP server from Express app
  const httpServer = createServer(app);

  // Attach WebSocket relay to the same server at /relay path
  attachRelayToServer(httpServer);

  // Start listening
  httpServer.listen(PORT, HOST, () => {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  Revit MCP Combined Server (Single Port)");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  HTTP:        http://${HOST}:${PORT}`);
    console.log(`  MCP:         http://${HOST}:${PORT}/mcp`);
    console.log(`  Relay WS:    ws://${HOST}:${PORT}/relay`);
    console.log(`  Health:      http://${HOST}:${PORT}/health`);
    console.log(`  New Token:   POST http://${HOST}:${PORT}/api/relay/token`);
    console.log(`  Auth:        ${API_KEY ? "ENABLED" : "DISABLED"}`);
    console.log("═══════════════════════════════════════════════════════════");
  });

  httpServer.on("error", (err: Error) => {
    console.error("[Server] Listen error:", err);
  });

  // Graceful Shutdown
  async function shutdown(signal: string) {
    console.log(`[Server] ${signal} received - shutting down...`);

    // Close MCP sessions
    for (const [sid, session] of sessions) {
      try {
        await session.transport.close();
        console.log(`[MCP] Closed session: ${sid}`);
      } catch (err) {
        console.error(`[MCP] Error closing session ${sid}:`, err);
      }
    }
    sessions.clear();

    // Close HTTP server (this also closes WebSocket connections)
    httpServer.close(() => {
      console.log("[Server] Server stopped");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("[Server] Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error("[Server] Uncaught exception:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Server] Unhandled rejection:", reason);
  });
}

start().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
