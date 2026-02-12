import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreatePropertyLineTool(server: McpServer) {
  server.tool(
    "create_property_line",
    "Create property lines and boundary definitions in Revit site plans. Property lines define legal lot boundaries, setbacks, easements, and rights-of-way. Essential for zoning compliance, site layout, and building placement validation. Can automatically calculate buildable area, check setback violations, and validate building footprint against zoning codes. Supports creating from surveyor coordinates or sketch input.",
    {
      points: z
        .array(
          z.object({
            x: z.number().describe("X coordinate in mm (or specify coordinateSystem)"),
            y: z.number().describe("Y coordinate in mm"),
            z: z.number().optional().describe("Z elevation in mm (optional, defaults to site base elevation)"),
          })
        )
        .min(3)
        .describe("Property boundary points forming a closed polygon. Points should be in order (clockwise or counterclockwise)."),
      coordinateSystem: z
        .enum(["Project", "Shared", "Survey", "LatLong"])
        .optional()
        .default("Project")
        .describe(
          "'Project' uses project coordinates, 'Shared' uses shared coordinates, 'Survey' uses survey point coordinates, 'LatLong' uses latitude/longitude (converted to project)."
        ),
      propertyType: z
        .enum(["ParcelBoundary", "BuildingSetback", "Easement", "RightOfWay", "ZoningLine", "Custom"])
        .optional()
        .default("ParcelBoundary")
        .describe("Type of property line for annotation and reporting"),
      setbacks: z
        .object({
          front: z.number().optional().describe("Front setback distance in mm"),
          rear: z.number().optional().describe("Rear setback distance in mm"),
          left: z.number().optional().describe("Left side setback in mm"),
          right: z.number().optional().describe("Right side setback in mm"),
        })
        .optional()
        .describe("Setback distances from property lines. Creates inner buildable boundary lines."),
      validateBuildings: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to check if existing buildings violate property lines or setbacks. Returns violations if any."),
      importFromCAD: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to import property line geometry from a linked CAD file"),
      cadLayerName: z
        .string()
        .optional()
        .describe("CAD layer name containing property lines (for importFromCAD)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_property_line", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create property line failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
