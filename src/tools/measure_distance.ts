import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedToolCatch, normalizedToolResult } from "./_result.js";

const pointSchema = z.object({
  x: z.number().describe("X coordinate in mm"),
  y: z.number().describe("Y coordinate in mm"),
  z: z.number().describe("Z coordinate in mm"),
});

type MeasureDistanceArgs = {
  fromPoint?: z.infer<typeof pointSchema>;
  toPoint?: z.infer<typeof pointSchema>;
  point1?: z.infer<typeof pointSchema>;
  point2?: z.infer<typeof pointSchema>;
  elementIds?: number[];
  elementId1?: number;
  elementId2?: number;
  [key: string]: unknown;
};

export function normalizeMeasureDistanceArgs(args: MeasureDistanceArgs): MeasureDistanceArgs {
  const elementIds = args.elementIds ??
    (args.elementId1 !== undefined && args.elementId2 !== undefined
      ? [args.elementId1, args.elementId2]
      : undefined);

  return {
    ...args,
    fromPoint: args.fromPoint ?? args.point1,
    toPoint: args.toPoint ?? args.point2,
    elementIds,
  };
}

export function registerMeasureDistanceTool(server: McpServer) {
  server.tool(
    "measure_distance",
    "Measure distances in Revit between points, between elements, from element to point, or between element faces/surfaces. Returns distance in millimeters with 3D coordinates. Essential for LLM to verify clearances, check spacing compliance, validate furniture placement distances, and confirm building code requirements. All units are in millimeters (mm).",
    {
      measurementType: z
        .enum(["PointToPoint", "ElementToElement", "ElementToPoint", "FaceToFace", "EdgeToEdge"])
        .optional()
        .describe(
          "Deprecated compatibility hint. The installed handler selects point or element measurement from the supplied fields."
        ),
      fromPoint: pointSchema
        .optional()
        .describe("Start point for point-to-point measurement, in mm"),
      toPoint: pointSchema
        .optional()
        .describe("End point for point-to-point measurement, in mm"),
      elementIds: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("Two Revit ElementIds to measure"),
      point1: pointSchema
        .optional()
        .describe("Deprecated alias for fromPoint"),
      point2: pointSchema
        .optional()
        .describe("Deprecated alias for toPoint"),
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
          return await revitClient.sendCommand("measure_distance", normalizeMeasureDistanceArgs(args));
        });
        return normalizedToolResult("measure_distance", response);
      } catch (error) {
        return normalizedToolCatch("measure_distance", error);
      }
    }
  );
}
