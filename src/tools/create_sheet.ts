import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateSheetTool(server: McpServer) {
  server.tool(
    "create_sheet",
    "Create new sheets in Revit for organizing and presenting views. Sheets are the drawing pages where views are placed for printing or export. Supports setting sheet number, name, and titleblock.",
    {
      sheetNumber: z
        .string()
        .describe("Unique sheet number (e.g., 'A-101', 'S-201', 'M-301'). Must be unique in the project."),
      sheetName: z
        .string()
        .describe("Descriptive name for the sheet (e.g., 'Ground Floor Plan', 'Building Sections')"),
      titleBlockTypeId: z
        .number()
        .optional()
        .describe("ElementId of the titleblock family type to use. If not specified, uses the default titleblock."),
      placeholderSheet: z
        .boolean()
        .optional()
        .default(false)
        .describe("Create as placeholder sheet (without titleblock). Useful for organizational purposes."),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_sheet", params);
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
              text: `Create sheet failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
