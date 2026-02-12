import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerPlaceSiteComponentTool(server: McpServer) {
  server.tool(
    "place_site_component",
    "Place site components in Revit: trees, plants, site furniture (benches, bollards, signs), lighting, retaining walls, fences, and hardscape elements. Site components are specialized families that host to topography surfaces. Supports bulk placement with distribution patterns (grid, scattered, along path) for landscaping and site design. Essential for site planning, landscape architecture, and exterior visualization.",
    {
      componentType: z
        .enum([
          "Tree",
          "Plant",
          "SiteFurniture",
          "Lighting",
          "RetainingWall",
          "Fence",
          "Gate",
          "Bollard",
          "Sign",
          "Hardscape",
          "Custom",
        ])
        .describe("Type of site component to place"),
      familyTypeId: z
        .number()
        .optional()
        .describe(
          "ElementId of specific family type to place. Use get_loaded_families to find site component families. If omitted, uses default for componentType."
        ),
      placementPattern: z
        .enum(["Single", "Array", "AlongPath", "ScatteredInArea", "Grid"])
        .describe(
          "'Single' = one instance, 'Array' = linear/polar array, 'AlongPath' = distributed along curve, 'ScatteredInArea' = random distribution, 'Grid' = regular grid."
        ),
      locations: z
        .array(
          z.object({
            x: z.number().describe("X coordinate in mm"),
            y: z.number().describe("Y coordinate in mm"),
            z: z.number().optional().describe("Z elevation in mm (optional, auto-hosts to topography if omitted)"),
            rotation: z.number().optional().describe("Rotation angle in degrees"),
          })
        )
        .optional()
        .describe("Specific placement locations (for Single placement). Required for 'Single' pattern."),
      pathPoints: z
        .array(
          z.object({
            x: z.number().describe("X in mm"),
            y: z.number().describe("Y in mm"),
          })
        )
        .optional()
        .describe("Path points for 'AlongPath' placement"),
      areaPolygon: z
        .array(
          z.object({
            x: z.number().describe("X in mm"),
            y: z.number().describe("Y in mm"),
          })
        )
        .optional()
        .describe("Area boundary for 'ScatteredInArea' or 'Grid' placement"),
      distributionOptions: z
        .object({
          count: z.number().optional().describe("Number of components to place (for AlongPath, ScatteredInArea)"),
          spacing: z.number().optional().describe("Spacing between components in mm (for AlongPath, Grid, Array)"),
          gridRows: z.number().optional().describe("Number of rows (for Grid pattern)"),
          gridColumns: z.number().optional().describe("Number of columns (for Grid pattern)"),
          randomRotation: z.boolean().optional().describe("Whether to randomize rotation (for ScatteredInArea)"),
          minSpacing: z.number().optional().describe("Minimum spacing between components in mm (for ScatteredInArea)"),
        })
        .optional()
        .describe("Distribution parameters for pattern-based placement"),
      hostToTopography: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to automatically host components to topography surface at each location"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("place_site_component", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Place site component failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
