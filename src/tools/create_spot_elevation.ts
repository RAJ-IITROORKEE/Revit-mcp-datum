import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateSpotElevationTool(server: McpServer) {
  server.tool(
    "create_spot_elevation",
    "Create spot elevation and spot coordinate annotations in Revit views. Spot elevations display the Z-elevation of a point (top of floor, bottom of beam, top of wall). Spot coordinates display XYZ coordinates (survey/shared coordinates). Essential for construction documentation, foundation plans, site grading, and coordination drawings. Supports bulk creation for automated annotation of key points.",
    {
      annotationType: z
        .enum(["SpotElevation", "SpotCoordinate", "SpotSlope"])
        .describe(
          "'SpotElevation' shows Z elevation only, 'SpotCoordinate' shows X,Y,Z coordinates, 'SpotSlope' shows slope percentage/angle."
        ),
      viewId: z
        .number()
        .describe("ElementId of view to place annotations in (must be plan, section, or elevation view)"),
      points: z
        .array(
          z.object({
            x: z.number().describe("X coordinate in mm"),
            y: z.number().describe("Y coordinate in mm"),
            z: z.number().describe("Z elevation in mm"),
            label: z.string().optional().describe("Optional custom label (e.g., 'T.O. FLOOR', 'F.F.E.')"),
          })
        )
        .min(1)
        .describe("Points to annotate. For bulk annotation, provide multiple points."),
      elementId: z
        .number()
        .optional()
        .describe("ElementId of element to annotate (e.g., floor, wall, beam). If specified, annotation snaps to element face."),
      coordinateSystem: z
        .enum(["Project", "Shared", "Survey"])
        .optional()
        .default("Project")
        .describe("Coordinate system for SpotCoordinate annotation"),
      referenceLevel: z
        .number()
        .optional()
        .describe("ElementId of level to use as elevation reference (e.g., show relative to Level 1). Uses absolute if omitted."),
      leaderType: z
        .enum(["None", "Straight", "Arc", "Spline"])
        .optional()
        .default("Straight")
        .describe("Leader line style"),
      textFormat: z
        .object({
          prefix: z.string().optional().describe("Text prefix (e.g., 'EL.' for elevation)"),
          suffix: z.string().optional().describe("Text suffix (e.g., ' MSL' for mean sea level)"),
          precision: z.number().optional().default(2).describe("Decimal places (0-4)"),
        })
        .optional()
        .describe("Text formatting options"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_spot_elevation", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create spot elevation failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
