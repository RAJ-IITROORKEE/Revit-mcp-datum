import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateModelLineTool(server: McpServer) {
  server.tool(
    "create_model_line",
    "Create 3D model lines and curves in Revit for reference geometry, setback lines, property boundaries, construction layout lines, and design guides. Model lines are visible in all views (unlike detail lines which are view-specific). Supports straight lines, arcs, circles, ellipses, and splines. All units are in millimeters (mm).",
    {
      lines: z
        .array(
          z.object({
            lineType: z
              .enum(["Straight", "Arc", "Circle", "Ellipse", "Spline"])
              .describe("Type of model line to create"),
            startPoint: z
              .object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
                z: z.number().optional().default(0).describe("Z coordinate in mm"),
              })
              .optional()
              .describe("Start point (for Straight and Arc)"),
            endPoint: z
              .object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
                z: z.number().optional().default(0).describe("Z coordinate in mm"),
              })
              .optional()
              .describe("End point (for Straight and Arc)"),
            centerPoint: z
              .object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
                z: z.number().optional().default(0).describe("Z coordinate in mm"),
              })
              .optional()
              .describe("Center point (for Arc, Circle, Ellipse)"),
            radius: z
              .number()
              .optional()
              .describe("Radius in mm (for Circle and Arc)"),
            semiAxisA: z
              .number()
              .optional()
              .describe("Semi-major axis in mm (for Ellipse)"),
            semiAxisB: z
              .number()
              .optional()
              .describe("Semi-minor axis in mm (for Ellipse)"),
            splinePoints: z
              .array(
                z.object({
                  x: z.number().describe("X coordinate in mm"),
                  y: z.number().describe("Y coordinate in mm"),
                  z: z.number().optional().default(0).describe("Z coordinate in mm"),
                })
              )
              .optional()
              .describe("Control points for Spline curves (minimum 3 points)"),
            lineStyleName: z
              .string()
              .optional()
              .describe("Line style name (e.g., 'Thin Lines', 'Medium Lines', 'Wide Lines', 'Centerline', 'Hidden')"),
            workPlaneId: z
              .number()
              .optional()
              .describe("ElementId of the work plane (level or reference plane) to draw on"),
            isReferenceLine: z
              .boolean()
              .optional()
              .default(false)
              .describe("If true, creates a reference line (parameterized, with named planes) instead of a model line"),
          })
        )
        .min(1)
        .describe("Array of model line definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_model_line", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create model line failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
