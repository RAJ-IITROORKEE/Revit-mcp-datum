import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateParkingLayoutTool(server: McpServer) {
  server.tool(
    "create_parking_layout",
    "Automatically generate parking lot layouts in Revit with parking stalls, drive aisles, and circulation patterns. AI calculates optimal layouts based on site boundaries, parking count requirements, ADA compliance (accessible stalls), and local code requirements. Supports surface parking, structured parking, and angled/perpendicular stall arrangements. Returns parking count, circulation efficiency, and code compliance status.",
    {
      layoutArea: z
        .object({
          boundaryPoints: z
            .array(
              z.object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
              })
            )
            .min(3)
            .describe("Parking area boundary polygon"),
          levelId: z.number().optional().describe("Level ElementId for the parking area"),
        })
        .describe("Area boundary for parking layout generation"),
      parkingRequirements: z
        .object({
          totalStalls: z.number().optional().describe("Total required parking stalls (calculated from area if omitted)"),
          accessibleStalls: z.number().optional().describe("Required accessible (ADA/disability) stalls. Auto-calculated per code if omitted."),
          compactStalls: z.number().optional().describe("Number of compact car stalls (if allowed by code)"),
          evChargingStalls: z.number().optional().describe("Electric vehicle charging stalls"),
        })
        .optional()
        .describe("Parking requirements. If omitted, maximizes stall count for the given area."),
      stallConfiguration: z
        .object({
          stallAngle: z
            .enum(["90", "60", "45", "30", "Parallel"])
            .optional()
            .default("90")
            .describe("Parking stall angle relative to aisle (90° = perpendicular, 45°/60° = angled, Parallel = parallel)"),
          stallWidth: z
            .number()
            .optional()
            .describe("Stall width in mm (default: 2750mm standard, 2450mm compact)"),
          stallDepth: z
            .number()
            .optional()
            .describe("Stall depth in mm (default: 5500mm for 90°, varies by angle)"),
          aisleWidth: z
            .number()
            .optional()
            .describe("Drive aisle width in mm (code minimum varies by angle: typically 7300mm for 90° two-way)"),
        })
        .optional()
        .describe("Stall dimensions and configuration. Defaults to code-compliant values."),
      codeStandard: z
        .enum(["IBC", "ADA", "Custom", "Metric"])
        .optional()
        .default("IBC")
        .describe("Code standard for parking dimensions and accessible stall requirements"),
      layoutPattern: z
        .enum(["AutoOptimize", "SingleLoaded", "DoubleLoaded", "Herringbone", "Custom"])
        .optional()
        .default("AutoOptimize")
        .describe(
          "'AutoOptimize' maximizes stall count, 'SingleLoaded' = stalls on one side of aisle, 'DoubleLoaded' = both sides, 'Herringbone' = angled pattern."
        ),
      includeCirculation: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include drive aisles, entry/exit points, and circulation paths"),
      structuredParking: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether this is structured/garage parking (affects ramp placement and floor-to-floor heights)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_parking_layout", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create parking layout failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
