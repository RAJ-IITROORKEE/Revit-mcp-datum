import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateDetailLinesTool(server: McpServer) {
  server.tool(
    "create_detail_lines",
    "Create detail lines in Revit views for 2D drafting, annotations, and detailing. Detail lines are view-specific and don't represent model geometry. Supports multiple line styles including solid, dashed, and dotted patterns.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where detail lines will be placed"),
      lines: z
        .array(
          z.object({
            startPoint: z.object({
              x: z.number().describe("X coordinate of start point in mm"),
              y: z.number().describe("Y coordinate of start point in mm"),
              z: z.number().describe("Z coordinate of start point in mm"),
            }),
            endPoint: z.object({
              x: z.number().describe("X coordinate of end point in mm"),
              y: z.number().describe("Y coordinate of end point in mm"),
              z: z.number().describe("Z coordinate of end point in mm"),
            }),
            lineStyleName: z
              .string()
              .optional()
              .describe("Name of line style (e.g., 'Thin Lines', 'Medium Lines', 'Wide Lines', 'Hidden [1/16\"]', 'Centerline'). Uses default if not specified."),
          })
        )
        .describe("Array of lines to create"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_detail_lines", params);
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
              text: `Create detail lines failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
