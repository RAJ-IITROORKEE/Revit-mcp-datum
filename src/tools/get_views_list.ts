import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetViewsListTool(server: McpServer) {
  server.tool(
    "get_views_list",
    "Get a list of all views in the Revit project with filtering options. Returns view names, IDs, types, and associated levels. Essential for identifying views before operations like duplication or property modification.",
    {
      viewType: z
        .enum([
          "All",
          "FloorPlan",
          "CeilingPlan",
          "Section",
          "Elevation",
          "ThreeD",
          "DraftingView",
          "AreaPlan",
          "EngineeringPlan",
          "Schedule"
        ])
        .optional()
        .describe("Filter by view type. Use 'All' or omit to get all view types."),
      includeTemplates: z
        .boolean()
        .default(false)
        .describe("Include view templates in the results"),
      searchName: z
        .string()
        .optional()
        .describe("Filter views by name containing this text (case-insensitive)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_views_list", params);
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
              text: `Get views list failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
