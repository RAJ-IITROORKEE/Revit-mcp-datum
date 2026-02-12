import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCalculateDaylightingTool(server: McpServer) {
  server.tool(
    "calculate_daylighting",
    "Calculate daylighting metrics in Revit for rooms and spaces. Computes spatial Daylight Autonomy (sDA), Annual Sunlight Exposure (ASE), Daylight Factor (DF), and Useful Daylight Illuminance (UDI). Essential for LEED v4 certification (sDA 55%/75% thresholds), WELL Building Standard, and optimizing window placement/sizing for natural light. Returns compliance status and identifies under/over-lit zones.",
    {
      roomIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds of rooms to analyze. If omitted, analyzes all rooms."),
      metric: z
        .enum(["sDA", "ASE", "DaylightFactor", "UDI", "IlluminanceMap", "All"])
        .optional()
        .default("All")
        .describe(
          "'sDA' = spatial Daylight Autonomy (% area ≥300 lux for ≥50% occupied hours), 'ASE' = Annual Sunlight Exposure (% area >1000 lux for >250hrs/year), 'DaylightFactor' = ratio of indoor to outdoor illuminance, 'UDI' = Useful Daylight Illuminance (100-2000 lux), 'IlluminanceMap' = point-by-point lux values, 'All' = compute all metrics."
        ),
      targetIlluminance: z
        .number()
        .optional()
        .default(300)
        .describe("Target illuminance in lux (typical: 300 for offices, 500 for detailed work)"),
      analysisHeight: z
        .number()
        .optional()
        .default(760)
        .describe("Work plane height above floor in mm (typical: 760mm = desk height)"),
      gridSpacing: z
        .number()
        .optional()
        .default(600)
        .describe("Analysis grid point spacing in mm (smaller = more detailed, slower)"),
      skyModel: z
        .enum(["CIE_Overcast", "CIE_Clear", "CIE_Intermediate", "Perez_AllWeather"])
        .optional()
        .default("CIE_Overcast")
        .describe("Sky luminance distribution model"),
      includeReflections: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include inter-reflections between surfaces"),
      leedCompliance: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to check LEED v4 EQ Credit 8 compliance (sDA ≥55% for 2 points, ≥75% for 3 points; ASE ≤10%)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("calculate_daylighting", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Calculate daylighting failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
