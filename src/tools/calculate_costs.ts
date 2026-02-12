import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCalculateCostsTool(server: McpServer) {
  server.tool(
    "calculate_costs",
    "Calculate construction costs in Revit using assembly codes, unit costs, and material quantities. Returns estimated total cost, cost breakdown by CSI division, and cost per square foot/meter. Essential for budget validation, value engineering, and cost-driven design optimization. Supports custom cost databases and regional pricing adjustments.",
    {
      costCalculationType: z
        .enum(["ElementBased", "MaterialBased", "AssemblyBased", "FullProject", "DesignOptionComparison"])
        .describe(
          "'ElementBased' costs by element type, 'MaterialBased' by material quantities, 'AssemblyBased' by RSMeans assemblies, 'FullProject' comprehensive estimate, 'DesignOptionComparison' compares option costs."
        ),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Specific elements to estimate. If omitted, calculates entire model."),
      costDatabase: z
        .enum(["RSMeans", "Custom", "ProjectDatabase"])
        .optional()
        .default("RSMeans")
        .describe("Cost database to use: 'RSMeans' = RSMeans data, 'Custom' = user-provided unit costs, 'ProjectDatabase' = project-specific costs."),
      customUnitCosts: z
        .array(
          z.object({
            item: z.string().describe("Item description or material name"),
            unit: z.enum(["SF", "LF", "CY", "EA", "Ton", "LB", "CWT", "m2", "m3", "m", "kg"]).describe("Unit of measure"),
            unitCost: z.number().describe("Cost per unit in local currency"),
          })
        )
        .optional()
        .describe("Custom unit costs for materials/assemblies"),
      regionalAdjustment: z
        .number()
        .optional()
        .default(1.0)
        .describe("Regional cost adjustment multiplier (e.g., 1.2 for NYC, 0.85 for rural areas)"),
      includeLabor: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include labor costs"),
      includeEquipment: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include equipment costs"),
      includeOverhead: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include overhead and profit (typically 10-20%)"),
      overheadPercentage: z
        .number()
        .optional()
        .default(15)
        .describe("Overhead and profit percentage (e.g., 15 for 15%)"),
      contingency: z
        .number()
        .optional()
        .default(10)
        .describe("Contingency percentage for unknowns (e.g., 10 for 10%)"),
      currencyCode: z
        .string()
        .optional()
        .default("USD")
        .describe("Currency code (USD, EUR, GBP, INR, etc.)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("calculate_costs", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Calculate costs failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
