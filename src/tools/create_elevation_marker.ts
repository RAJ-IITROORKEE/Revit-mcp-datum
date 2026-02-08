import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateElevationMarkerTool(server: McpServer) {
  server.tool(
    "create_elevation_marker",
    "Create elevation markers in Revit floor plans that automatically generate interior and exterior elevation views. Markers show multiple elevation arrows pointing in different directions with automatic view references.",
    {
      planViewId: z
        .number()
        .describe("ElementId of the floor plan view where marker will be placed"),
      location: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
        })
        .describe("Placement point for the elevation marker center"),
      elevationDirections: z
        .array(
          z.object({
            direction: z.enum(["North", "South", "East", "West", "Custom"]).describe("Cardinal direction or custom"),
            angle: z.number().optional().describe("Custom angle in degrees (0-360). Required if direction is Custom. 0=East, 90=North, 180=West, 270=South"),
            createView: z.boolean().default(true).describe("Generate elevation view for this direction"),
            viewName: z.string().optional().describe("Name for the generated elevation view"),
          })
        )
        .describe("Elevation directions to create. Typically 4 directions for building elevations or 4 interior elevations for rooms."),
      elevationTypeId: z
        .number()
        .optional()
        .describe("ElementId of elevation type (controls marker appearance)"),
      scale: z
        .number()
        .optional()
        .describe("Scale for generated elevation views (e.g., 100 for 1:100)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_elevation_marker", params);
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
              text: `Create elevation marker failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
