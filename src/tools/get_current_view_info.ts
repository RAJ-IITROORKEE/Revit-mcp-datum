import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedToolCatch, normalizedToolResult } from "./_result.js";

export function registerGetCurrentViewInfoTool(server: McpServer) {
  server.tool(
    "get_current_view_info",
    "获取 Revit 当前活动视图的详细信息，包括视图类型、名称、比例等属性。",
    {},
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_current_view_info", {});
        });

        return normalizedToolResult("get_current_view_info", response);
      } catch (error) {
        return normalizedToolCatch("get_current_view_info", error);
      }
    }
  );
}
