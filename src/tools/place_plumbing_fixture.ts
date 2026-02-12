import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerPlacePlumbingFixtureTool(server: McpServer) {
  server.tool(
    "place_plumbing_fixture",
    "Place plumbing fixtures in Revit: sinks, toilets, urinals, showers, bathtubs, water heaters, water coolers, drinking fountains, floor drains, cleanouts. Use get_loaded_families with categoryList ['OST_PlumbingFixtures'] to discover available types. All units are in millimeters (mm).",
    {
      fixtures: z
        .array(
          z.object({
            fixtureTypeId: z
              .number()
              .describe("ElementId of plumbing fixture type. Use get_loaded_families with 'OST_PlumbingFixtures'."),
            location: z.object({
              x: z.number().describe("X coordinate in mm"),
              y: z.number().describe("Y coordinate in mm"),
              z: z.number().describe("Z coordinate in mm"),
            }),
            levelId: z
              .number()
              .describe("ElementId of the level"),
            rotation: z
              .number()
              .optional()
              .default(0)
              .describe("Rotation angle in degrees"),
            fixtureCategory: z
              .enum([
                "Sink",
                "Toilet",
                "Urinal",
                "Shower",
                "Bathtub",
                "WaterHeater",
                "WaterCooler",
                "DrinkingFountain",
                "FloorDrain",
                "Cleanout",
                "Bidet",
                "Dishwasher",
                "WashingMachine",
              ])
              .optional()
              .describe("Functional category of fixture"),
            hostWallId: z
              .number()
              .optional()
              .describe("ElementId of host wall for wall-mounted fixtures"),
            hostFloorId: z
              .number()
              .optional()
              .describe("ElementId of host floor for floor-mounted fixtures"),
            coldWaterSupply: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether fixture requires cold water connection"),
            hotWaterSupply: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether fixture requires hot water connection"),
            drainConnection: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether fixture requires drain connection"),
            ventConnection: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether fixture requires vent connection"),
            flowRateGPM: z
              .number()
              .optional()
              .describe("Flow rate in gallons per minute (GPM) for fixture unit calculations"),
          })
        )
        .min(1)
        .describe("Array of plumbing fixtures to place"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("place_plumbing_fixture", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Place plumbing fixture failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
