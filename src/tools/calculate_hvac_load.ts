import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCalculateHvacLoadTool(server: McpServer) {
  server.tool(
    "calculate_hvac_load",
    "Calculate heating and cooling loads in Revit per ASHRAE standards. Analyzes building envelope (walls, windows, roof), internal heat gains (occupancy, lighting, equipment), ventilation requirements, and weather data to size HVAC equipment. Returns load calculations, equipment sizing recommendations, and airflow requirements for rooms and zones. Essential for mechanical design.",
    {
      calculationType: z
        .enum(["RoomLoad", "ZoneLoad", "BuildingLoad", "EquipmentSizing", "AirflowCalculation"])
        .describe(
          "Type: 'RoomLoad' for individual rooms, 'ZoneLoad' for HVAC zones, 'BuildingLoad' for whole building, 'EquipmentSizing' for AHU/chiller/boiler sizing, 'AirflowCalculation' for duct sizing."
        ),
      roomId: z
        .number()
        .optional()
        .describe("ElementId of room for RoomLoad calculation"),
      roomIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds of rooms in a zone for ZoneLoad calculation"),
      buildingType: z
        .enum(["Office", "Residential", "Retail", "Healthcare", "Educational", "Hospitality", "Industrial", "Warehouse", "Laboratory"])
        .optional()
        .describe("Building type for applying appropriate load factors"),
      climateZone: z
        .string()
        .optional()
        .describe("ASHRAE climate zone (e.g., '4A', '5B', '6A') or city name for weather data"),
      designTemperatures: z
        .object({
          summerOutdoor: z.number().optional().describe("Summer design temperature in °F (e.g., 95)"),
          winterOutdoor: z.number().optional().describe("Winter design temperature in °F (e.g., 10)"),
          indoorCooling: z.number().optional().default(75).describe("Indoor cooling setpoint °F"),
          indoorHeating: z.number().optional().default(70).describe("Indoor heating setpoint °F"),
        })
        .optional()
        .describe("Design temperatures (ASHRAE 99.6% values used if omitted)"),
      internalLoads: z
        .object({
          occupancyDensity: z.number().optional().describe("People per 1000 sq ft"),
          lightingWattsPerSqFt: z.number().optional().describe("Lighting power density W/sq ft"),
          equipmentWattsPerSqFt: z.number().optional().describe("Equipment power density W/sq ft"),
        })
        .optional()
        .describe("Internal heat gain factors (building-type defaults used if omitted)"),
      ventilationStandard: z
        .enum(["ASHRAE_62.1", "IMC", "Custom"])
        .optional()
        .default("ASHRAE_62.1")
        .describe("Ventilation standard for outside air requirements"),
      includeLatentLoad: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include latent (humidity) loads in calculation"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("calculate_hvac_load", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Calculate HVAC load failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
