import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createLocalGateway } from "./gateway.js";

type LocalGateway = ReturnType<typeof createLocalGateway>;
type GatewayResponse = Awaited<ReturnType<LocalGateway["handle"]>>;

function gatewayErrorResult(response: GatewayResponse): CallToolResult {
  const error = response.error ?? {
    code: -32603,
    message: "Local gateway request rejected",
    data: { code: "INTERNAL_ERROR", retryable: false as const },
  };
  return {
    isError: true,
    content: [{
      type: "text",
      text: JSON.stringify({
        success: false,
        error: error.message,
        code: error.data.code,
        retryable: false,
      }),
    }],
  };
}

export function createLocalMcpServer(gateway: LocalGateway): Server {
  const server = new Server(
    { name: "datumm-revit-local-gateway", version: "0.1.0" },
    {
      capabilities: { tools: { listChanged: false } },
      instructions: "Fail-closed local Revit policy gateway. Mutation execution is disabled.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async (request): Promise<ListToolsResult> => {
    const response = await gateway.handle({
      jsonrpc: "2.0",
      id: 0,
      method: "tools/list",
      params: request.params ?? {},
    });
    if (response.error || !response.result) {
      return { tools: [] };
    }
    return response.result as ListToolsResult;
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const response = await gateway.handle({
      jsonrpc: "2.0",
      id: 0,
      method: "tools/call",
      params: request.params,
    });
    if (response.error) return gatewayErrorResult(response);
    return {
      isError: false,
      content: [{ type: "text", text: JSON.stringify(response.result ?? null) }],
    };
  });

  return server;
}
