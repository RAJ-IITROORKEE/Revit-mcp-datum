import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedToolCatch, normalizedToolResult } from "./_result.js";

export function registerGetLevelsListTool(server: McpServer) {
  server.tool(
    "get_levels_list",
    "Get a list of all levels in the Revit project. Returns level names, IDs, elevations, and structural/non-structural status. Critical for multi-story building coordination and creating level-based views.",
    {
      includeNonStructural: z
        .boolean()
        .default(true)
        .describe("Include non-structural levels (reference levels) in results"),
      sortByElevation: z
        .boolean()
        .default(true)
        .describe("Sort results by elevation (lowest to highest)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_levels_list", params);
        });

        return normalizedToolResult("get_levels_list", response);
      } catch (error) {
        return normalizedToolCatch("get_levels_list", error);
      }
    }
  );
}
