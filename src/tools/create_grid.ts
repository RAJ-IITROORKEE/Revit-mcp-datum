import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateGridTool(server: McpServer) {
  server.tool(
    "create_grid",
    "Create grid lines in Revit for spatial organization and element placement reference. Supports both linear and arc grids with automatic numbering or custom naming. Grids are visible in all plan and section views and are fundamental for building layout.",
    {
      gridType: z
        .enum(["Linear", "Arc"])
        .describe("Type of grid. Linear: straight grid line. Arc: curved grid line."),
      name: z
        .string()
        .optional()
        .describe("Custom grid name/number (e.g., 'A', 'B', '1', '2'). If not provided, auto-generates sequential name."),
      curve: z
        .object({
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
          centerPoint: z
            .object({
              x: z.number().describe("X coordinate of arc center in mm"),
              y: z.number().describe("Y coordinate of arc center in mm"),
              z: z.number().describe("Z coordinate of arc center in mm"),
            })
            .optional()
            .describe("Center point for arc grids. Required when gridType is Arc."),
        })
        .describe("Grid line geometry definition"),
      gridTypeId: z
        .number()
        .optional()
        .describe("ElementId of grid type (controls line style and appearance)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_grid", params);
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
              text: `Create grid failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
