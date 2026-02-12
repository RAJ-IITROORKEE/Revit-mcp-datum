import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerRunEnergyAnalysisTool(server: McpServer) {
  server.tool(
    "run_energy_analysis",
    "Run energy simulation and performance analysis in Revit using the built-in energy analytical model. Calculates annual energy consumption (heating, cooling, lighting), peak loads, carbon emissions, and energy costs. Returns detailed performance metrics and compliance status for energy codes (ASHRAE 90.1, IECC, local codes). Essential for sustainable design, energy code compliance, and performance-driven design decisions. All units are in SI (kWh, W/m²).",
    {
      analysisMode: z
        .enum(["ConceptualMasses", "BuildingElements", "DetailedRooms"])
        .optional()
        .default("BuildingElements")
        .describe(
          "Analysis granularity: 'ConceptualMasses' for early design, 'BuildingElements' for detailed model, 'DetailedRooms' for room-by-room analysis."
        ),
      buildingType: z
        .enum([
          "Office",
          "Residential",
          "Hotel",
          "Retail",
          "School",
          "Hospital",
          "Restaurant",
          "Warehouse",
          "DataCenter",
          "Laboratory",
          "Assembly",
          "Custom",
        ])
        .optional()
        .describe("Building type for occupancy schedules and internal loads"),
      location: z
        .object({
          city: z.string().optional().describe("City name for weather data (e.g., 'New York', 'London', 'Tokyo')"),
          weatherStationId: z.string().optional().describe("Specific weather station ID (overrides city)"),
          latitude: z.number().optional().describe("Latitude in degrees"),
          longitude: z.number().optional().describe("Longitude in degrees"),
          elevation: z.number().optional().describe("Site elevation above sea level in meters"),
        })
        .optional()
        .describe("Building location for weather data. Uses project address if omitted."),
      hvacSystem: z
        .object({
          systemType: z
            .enum([
              "VAV",
              "CAV",
              "PackagedDX",
              "SplitDX",
              "ChilledWater",
              "HotWater",
              "ForcedAir",
              "Radiant",
              "DOAS",
              "Custom",
            ])
            .optional()
            .describe("HVAC system type for energy modeling"),
          heatingEfficiency: z.number().optional().describe("Heating system efficiency (COP or % efficiency)"),
          coolingEfficiency: z.number().optional().describe("Cooling system efficiency (EER or COP)"),
          ventilationRate: z.number().optional().describe("Ventilation rate in CFM per person (ASHRAE 62.1)"),
        })
        .optional()
        .describe("HVAC system configuration for energy calculations"),
      simulationOptions: z
        .object({
          includeHeating: z.boolean().optional().default(true),
          includeCooling: z.boolean().optional().default(true),
          includeLighting: z.boolean().optional().default(true),
          includePlugLoads: z.boolean().optional().default(true),
          includeVentilation: z.boolean().optional().default(true),
          includeSolarGain: z.boolean().optional().default(true),
          simulationPeriod: z
            .enum(["Annual", "Summer", "Winter", "DesignDay", "Custom"])
            .optional()
            .default("Annual"),
        })
        .optional()
        .describe("What to include in the energy simulation"),
      energyCodeCompliance: z
        .enum(["ASHRAE_90.1_2019", "ASHRAE_90.1_2016", "IECC_2021", "IECC_2018", "Custom", "None"])
        .optional()
        .describe("Energy code to check compliance against"),
      includeRenewables: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include renewable energy (solar panels, if modeled)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("run_energy_analysis", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Run energy analysis failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
