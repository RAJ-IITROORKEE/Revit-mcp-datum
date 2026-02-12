import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerAnalyzeSolarExposureTool(server: McpServer) {
  server.tool(
    "analyze_solar_exposure",
    "Analyze solar exposure and shading in Revit. Calculates sun path, shadow studies, solar heat gain on surfaces, and shading effectiveness. Returns solar incident radiation (kWh/m²/year) on building faces, identifies over-glazed facades, and recommends shading devices. Essential for facade design, window sizing, solar panel placement, and passive solar design strategies.",
    {
      analysisType: z
        .enum(["SunPath", "ShadowStudy", "SolarGain", "ShadingAnalysis", "AnnualSolarExposure"])
        .describe(
          "'SunPath' shows sun trajectory, 'ShadowStudy' creates time-series shadows, 'SolarGain' calculates heat gain by surface, 'ShadingAnalysis' evaluates shading devices, 'AnnualSolarExposure' computes yearly radiation."
        ),
      dateTime: z
        .object({
          month: z.number().min(1).max(12).optional().describe("Month (1-12)"),
          day: z.number().min(1).max(31).optional().describe("Day of month"),
          hour: z.number().min(0).max(23).optional().describe("Hour (0-23)"),
        })
        .optional()
        .describe("Specific date/time for SunPath and ShadowStudy (uses summer/winter solstice if omitted)"),
      timeRange: z
        .object({
          startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
          endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
          timeInterval: z.number().optional().describe("Time interval in hours (e.g., 1 hour increments)"),
        })
        .optional()
        .describe("Time range for shadow studies and annual analysis"),
      surfaceIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds of specific surfaces (walls, roofs, windows) to analyze. If omitted, analyzes all exterior surfaces."),
      includeContext: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include surrounding buildings/topography in shading calculations"),
      outputFormat: z
        .enum(["SolarRadiation", "ShadowImages", "HeatGainValues", "TimeSeriesData", "FalseColorMap"])
        .optional()
        .describe("How to return the analysis results"),
      shadingDevices: z
        .array(
          z.object({
            deviceType: z.enum(["Overhang", "VerticalFin", "LightShelf", "Louver", "BriseSoleil"]),
            elementId: z.number().optional().describe("ElementId of existing shading element to analyze"),
          })
        )
        .optional()
        .describe("Shading devices to evaluate effectiveness (for ShadingAnalysis)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("analyze_solar_exposure", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Analyze solar exposure failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
