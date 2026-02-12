import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateTopographyTool(server: McpServer) {
  server.tool(
    "create_topography",
    "Create topography (terrain) surfaces in Revit from point data or boundary with elevation. Topography represents the existing or proposed ground surface for site design. Points define the 3D terrain mesh. Supports flat sites, sloped sites, and complex terrain with multiple elevation zones. Essential for site plans, grading, and building pad placement. All units are in millimeters (mm).",
    {
      action: z
        .enum(["create", "modify", "addPoints", "removePoints"])
        .describe(
          "Action: 'create' new surface, 'modify' existing surface, 'addPoints' to existing, 'removePoints' from existing"
        ),
      topographyId: z
        .number()
        .optional()
        .describe("ElementId of existing topography surface (for modify/addPoints/removePoints actions)"),
      points: z
        .array(
          z.object({
            x: z.number().describe("X coordinate in mm"),
            y: z.number().describe("Y coordinate in mm"),
            z: z.number().describe("Z coordinate (elevation) in mm"),
          })
        )
        .optional()
        .describe(
          "Array of 3D points defining the terrain. Minimum 3 points. More points = more detailed terrain. Use consistent grid spacing for uniform surfaces."
        ),
      boundary: z
        .array(
          z.object({
            x: z.number().describe("X coordinate in mm"),
            y: z.number().describe("Y coordinate in mm"),
          })
        )
        .optional()
        .describe("Optional site boundary (closed polygon). Points outside this boundary are excluded."),
      flatSite: z
        .object({
          corners: z
            .array(
              z.object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
              })
            )
            .min(3)
            .describe("Corner points of the flat site boundary"),
          elevation: z.number().describe("Uniform elevation in mm for the flat site"),
          gridSpacing: z
            .number()
            .optional()
            .default(5000)
            .describe("Grid point spacing in mm for the interior mesh"),
        })
        .optional()
        .describe("Shortcut for creating a flat site — specify corners and elevation instead of individual points"),
      name: z
        .string()
        .optional()
        .describe("Name for the topography surface (e.g., 'Existing Grade', 'Proposed Grade')"),
      phaseCreated: z
        .string()
        .optional()
        .describe("Phase when this surface was created (e.g., 'Existing', 'New Construction')"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_topography", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create topography failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
