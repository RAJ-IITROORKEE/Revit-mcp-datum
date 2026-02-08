import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerPlaceViewportTool(server: McpServer) {
  server.tool(
    "place_viewport",
    "Place views onto sheets as viewports. Viewports are the representation of views on drawing sheets. Supports positioning, scale override, and multiple viewports per sheet. Essential for creating complete drawing sets.",
    {
      sheetId: z
        .number()
        .describe("ElementId of the sheet where the viewport will be placed"),
      viewId: z
        .number()
        .describe("ElementId of the view to place on the sheet"),
      location: z
        .object({
          x: z.number().describe("X coordinate of viewport center in mm (sheet coordinates)"),
          y: z.number().describe("Y coordinate of viewport center in mm (sheet coordinates)"),
        })
        .describe("Position of the viewport center on the sheet"),
      viewportTypeId: z
        .number()
        .optional()
        .describe("ElementId of the viewport type to use (controls viewport line styles)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("place_viewport", params);
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
              text: `Place viewport failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
