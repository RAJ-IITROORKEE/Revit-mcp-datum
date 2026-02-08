import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateFilledRegionTool(server: McpServer) {
  server.tool(
    "create_filled_region",
    "Create filled regions in Revit drafting and detail views for hatching, patterning, and shading areas. Filled regions use fill patterns and are essential for detail drawings, diagrams, and presentation graphics. Supports complex boundary shapes.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where filled region will be created"),
      boundary: z
        .array(
          z.object({
            points: z
              .array(
                z.object({
                  x: z.number().describe("X coordinate in mm"),
                  y: z.number().describe("Y coordinate in mm"),
                }) 
              )
              .describe("Points defining a closed boundary loop. Last point connects to first."),
          })
        )
        .describe("Boundary loops defining the filled region. First loop is outer boundary, additional loops are voids."),
      filledRegionTypeId: z
        .number()
        .optional()
        .describe("ElementId of filled region type (controls fill pattern and line style)"),
      fillPattern: z
        .string()
        .optional()
        .describe("Fill pattern name (e.g., 'Solid fill', 'Diagonal crosshatch', 'Sand', 'Concrete'). Overrides type if specified."),
      backgroundVisible: z
        .boolean()
        .default(true)
        .describe("Show background fill (true) or just boundary lines (false)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_filled_region", params);
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
              text: `Create filled region failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
