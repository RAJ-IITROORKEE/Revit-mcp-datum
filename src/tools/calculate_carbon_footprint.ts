import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCalculateCarbonFootprintTool(server: McpServer) {
  server.tool(
    "calculate_carbon_footprint",
    "Calculate embodied and operational carbon footprint of the Revit model. Embodied carbon comes from material extraction, manufacturing, transportation, and construction. Operational carbon comes from building energy use. Returns total carbon emissions (kg CO2e), carbon intensity (kg CO2e/m²), and breakdown by material/system. Essential for carbon-neutral design, LEED credits, and sustainability certifications. Integrates with material quantities and energy analysis.",
    {
      calculationType: z
        .enum(["EmbodiedCarbon", "OperationalCarbon", "LifeCycle", "MaterialBreakdown", "SystemBreakdown"])
        .describe(
          "'EmbodiedCarbon' = construction materials only, 'OperationalCarbon' = building use over time, 'LifeCycle' = embodied + operational over building lifetime, 'MaterialBreakdown' = by material type, 'SystemBreakdown' = by building system."
        ),
      lifeCycleYears: z
        .number()
        .optional()
        .default(60)
        .describe("Building lifecycle period in years for LifeCycle calculation (typical: 50-100 years)"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Specific elements to calculate carbon for. If omitted, analyzes entire model."),
      categories: z
        .array(z.string())
        .optional()
        .describe("Filter by categories (e.g., ['OST_Walls', 'OST_StructuralFraming', 'OST_Roofs'])"),
      includeTransportation: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include transportation carbon in embodied calculation"),
      transportationDistance: z
        .number()
        .optional()
        .describe("Average material transportation distance in km (default varies by material type)"),
      includeConstruction: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include construction process carbon (equipment, labor transport)"),
      carbonDatabase: z
        .enum(["ICE", "EPD", "BEES", "Athena", "OneClickLCA", "Custom"])
        .optional()
        .default("ICE")
        .describe("Carbon factor database: 'ICE' = UK ICE database, 'EPD' = Environmental Product Declarations, 'BEES' = NIST BEES, 'Athena' = Athena Impact Estimator, 'OneClickLCA' = OneClick LCA data."),
      customCarbonFactors: z
        .array(
          z.object({
            materialName: z.string().describe("Material name"),
            carbonFactorKgCO2ePerKg: z.number().describe("Carbon factor in kg CO2e per kg of material"),
          })
        )
        .optional()
        .describe("Custom carbon factors for materials not in the database"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("calculate_carbon_footprint", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Calculate carbon footprint failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
