import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetGridsListTool(server: McpServer) {
  server.tool(
    "get_grids_list",
    "Get a list of all grids in the Revit project. Returns grid names, IDs, and geometry information. Useful for creating elements aligned with grids or generating grid-based documentation.",
    {
      searchName: z
        .string()
        .optional()
        .describe("Filter grids by name containing this text (case-insensitive)"),
      includeGeometry: z
        .boolean()
        .default(false)
        .describe("Include detailed geometry information (start/end points) for each grid"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_grids_list", params);
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Get grids list failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
