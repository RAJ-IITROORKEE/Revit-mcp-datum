import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerPlaceMechanicalEquipmentTool(server: McpServer) {
  server.tool(
    "place_mechanical_equipment",
    "Place mechanical (HVAC) equipment in Revit: air handling units (AHUs), VAV boxes, fans, boilers, chillers, cooling towers, heat pumps, air diffusers, grilles, dampers. Use get_loaded_families with categoryList ['OST_MechanicalEquipment', 'OST_AirTerminals'] to discover available types. All units are in millimeters (mm).",
    {
      equipment: z
        .array(
          z.object({
            equipmentTypeId: z
              .number()
              .describe("ElementId of mechanical equipment type. Use get_loaded_families with 'OST_MechanicalEquipment' or 'OST_AirTerminals'."),
            location: z.object({
              x: z.number().describe("X coordinate in mm"),
              y: z.number().describe("Y coordinate in mm"),
              z: z.number().describe("Z coordinate in mm"),
            }),
            levelId: z
              .number()
              .optional()
              .describe("ElementId of the level"),
            rotation: z
              .number()
              .optional()
              .default(0)
              .describe("Rotation angle in degrees"),
            equipmentCategory: z
              .enum([
                "AHU",
                "VAV",
                "Fan",
                "Boiler",
                "Chiller",
                "CoolingTower",
                "HeatPump",
                "Diffuser",
                "Grille",
                "Damper",
                "HeatExchanger",
                "Pump",
              ])
              .optional()
              .describe("Functional category of equipment"),
            hostSurface: z
              .enum(["Floor", "Ceiling", "Wall", "Roof", "Freestanding"])
              .optional()
              .default("Floor")
              .describe("Where the equipment is mounted"),
            hostElementId: z
              .number()
              .optional()
              .describe("ElementId of host ceiling/wall/floor for face-hosted equipment (diffusers, grilles)"),
            airflowCFM: z
              .number()
              .optional()
              .describe("Airflow capacity in cubic feet per minute (CFM). Typical: 50-20,000 CFM."),
            coolingCapacityBTU: z
              .number()
              .optional()
              .describe("Cooling capacity in BTU/hr (for chillers, heat pumps, ACs)"),
            heatingCapacityBTU: z
              .number()
              .optional()
              .describe("Heating capacity in BTU/hr (for boilers, heat pumps, heaters)"),
            spaceId: z
              .number()
              .optional()
              .describe("ElementId of MEP space (mechanical room) for equipment"),
            mark: z
              .string()
              .optional()
              .describe("Equipment mark/tag (e.g., 'AHU-1', 'VAV-2.1', 'D-101')"),
          })
        )
        .min(1)
        .describe("Array of mechanical equipment to place"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("place_mechanical_equipment", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Place mechanical equipment failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
