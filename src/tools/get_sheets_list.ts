import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetSheetsListTool(server: McpServer) {
  server.tool(
    "get_sheets_list",
    "Get a list of all sheets in the Revit project. Returns sheet numbers, names, IDs, and viewport information. Useful for sheet management and automation workflows.",
    {
      searchNumber: z
        .string()
        .optional()
        .describe("Filter sheets by number containing this text (case-insensitive)"),
      searchName: z
        .string()
        .optional()
        .describe("Filter sheets by name containing this text (case-insensitive)"),
      includePlaceholders: z
        .boolean()
        .default(false)
        .describe("Include placeholder sheets in the results"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_sheets_list", params);
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
              text: `Get sheets list failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
