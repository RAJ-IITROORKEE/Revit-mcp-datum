import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerMeasureDistanceTool(server: McpServer) {
  server.tool(
    "measure_distance",
    "Measure distances in Revit between points, between elements, from element to point, or between element faces/surfaces. Returns distance in millimeters with 3D coordinates. Essential for LLM to verify clearances, check spacing compliance, validate furniture placement distances, and confirm building code requirements. All units are in millimeters (mm).",
    {
      measurementType: z
        .enum(["PointToPoint", "ElementToElement", "ElementToPoint", "FaceToFace", "EdgeToEdge"])
        .describe(
          "Type of measurement: 'PointToPoint' for direct distance, 'ElementToElement' for closest point distance, 'ElementToPoint', 'FaceToFace' for surface-to-surface, 'EdgeToEdge' for edge-to-edge."
        ),
      point1: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .optional()
        .describe("First point (for PointToPoint, ElementToPoint)"),
      point2: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .optional()
        .describe("Second point (for PointToPoint)"),
      elementId1: z
        .number()
        .optional()
        .describe("First element ElementId (for ElementToElement, FaceToFace, EdgeToEdge)"),
      elementId2: z
        .number()
        .optional()
        .describe("Second element ElementId (for ElementToElement, FaceToFace, EdgeToEdge)"),
      measurementMode: z
        .enum(["Closest", "Horizontal", "Vertical", "Perpendicular"])
        .optional()
        .default("Closest")
        .describe(
          "'Closest' = shortest 3D distance, 'Horizontal' = XY plane only, 'Vertical' = Z axis only, 'Perpendicular' = perpendicular to face"
        ),
      referenceDirection: z
        .object({
          x: z.number().describe("X component of direction vector"),
          y: z.number().describe("Y component"),
          z: z.number().describe("Z component"),
        })
        .optional()
        .describe("Reference direction for 'Perpendicular' mode"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("measure_distance", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Measure distance failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
