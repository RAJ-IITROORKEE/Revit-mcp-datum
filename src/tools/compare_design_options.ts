import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCompareDesignOptionsTool(server: McpServer) {
  server.tool(
    "compare_design_options",
    "Compare design options in Revit by quantitative metrics: cost, area, volume, element count, energy performance, carbon footprint, and custom parameters. Returns side-by-side comparison matrix enabling AI to recommend the optimal design option based on project criteria. Essential for data-driven design decisions and value engineering.",
    {
      optionSetId: z
        .number()
        .describe("ElementId of the design option set to compare"),
      comparisonMetrics: z
        .array(
          z.enum([
            "TotalCost",
            "MaterialQuantities",
            "FloorArea",
            "Volume",
            "ElementCount",
            "EnergyCost",
            "EnergyConsumption",
            "CarbonFootprint",
            "ConstructionTime",
            "LaborCost",
            "CustomParameter",
          ])
        )
        .optional()
        .describe("Metrics to compare. If omitted, compares all available metrics."),
      customParameters: z
        .array(z.string())
        .optional()
        .describe("Custom parameter names to include in comparison (e.g., 'Fire Rating', 'R-Value', 'Acoustic Rating')"),
      includeEnergyAnalysis: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to run energy analysis for each option (requires energy model)"),
      includeCarbonAnalysis: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to run carbon footprint analysis for each option"),
      weightingFactors: z
        .object({
          cost: z.number().optional().describe("Weight for cost (0-1)"),
          energy: z.number().optional().describe("Weight for energy performance (0-1)"),
          carbon: z.number().optional().describe("Weight for carbon footprint (0-1)"),
          time: z.number().optional().describe("Weight for construction time (0-1)"),
        })
        .optional()
        .describe("Weighting factors for multi-criteria optimization (should sum to 1.0). Returns weighted score for each option."),
      generateReport: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to generate a comparison report with charts and recommendations"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("compare_design_options", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Compare design options failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
