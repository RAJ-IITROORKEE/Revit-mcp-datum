import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateDetailComponentTool(server: McpServer) {
  server.tool(
    "create_detail_component",
    "Place detail component families in Revit views for standard detail elements like bolts, welds, break lines, section indicators, and custom detail symbols. Detail components are 2D annotation families that don't represent actual model geometry.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where detail component will be placed"),
      familyName: z
        .string()
        .describe("Name of the detail component family (e.g., 'M_Bolt-Hex Head', 'Break Line', 'Weld Symbol')"),
      typeName: z
        .string()
        .optional()
        .describe("Type name within the family. Uses default type if not specified."),
      location: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .describe("Placement point for the detail component"),
      rotation: z
        .number()
        .optional()
        .describe("Rotation angle in degrees (0-360)"),
      flipHorizontal: z
        .boolean()
        .default(false)
        .describe("Mirror the component horizontally"),
      flipVertical: z
        .boolean()
        .default(false)
        .describe("Mirror the component vertically"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_detail_component", params);
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
              text: `Create detail component failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
