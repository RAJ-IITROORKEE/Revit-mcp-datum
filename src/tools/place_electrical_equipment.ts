import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerPlaceElectricalEquipmentTool(server: McpServer) {
  server.tool(
    "place_electrical_equipment",
    "Place electrical equipment in Revit: panels, transformers, switchgear, generators, UPS systems, motor control centers, transfer switches. Use get_loaded_families with categoryList ['OST_ElectricalEquipment'] to discover available equipment types. Essential for power distribution design. All units are in millimeters (mm).",
    {
      equipment: z
        .array(
          z.object({
            equipmentTypeId: z
              .number()
              .describe("ElementId of the electrical equipment type. Use get_loaded_families with 'OST_ElectricalEquipment'."),
            location: z.object({
              x: z.number().describe("X coordinate in mm"),
              y: z.number().describe("Y coordinate in mm"),
              z: z.number().optional().default(0).describe("Z coordinate in mm"),
            }),
            levelId: z
              .number()
              .describe("ElementId of the level for placement"),
            rotation: z
              .number()
              .optional()
              .default(0)
              .describe("Rotation angle in degrees"),
            equipmentType: z
              .enum(["Panel", "Transformer", "Switchgear", "Generator", "UPS", "MCC", "TransferSwitch", "Disconnect"])
              .optional()
              .describe("Functional type of equipment (for classification)"),
            voltage: z
              .number()
              .optional()
              .describe("Primary voltage in volts (e.g., 120, 208, 277, 480, 4160)"),
            ratingAmps: z
              .number()
              .optional()
              .describe("Equipment rating in amps"),
            ratingKVA: z
              .number()
              .optional()
              .describe("Transformer/generator rating in kVA"),
            numberOfCircuits: z
              .number()
              .optional()
              .describe("Number of circuits for panels (e.g., 12, 24, 42)"),
            hostWallId: z
              .number()
              .optional()
              .describe("ElementId of host wall for wall-mounted panels"),
            spaceId: z
              .number()
              .optional()
              .describe("ElementId of MEP space (electrical room) for equipment"),
            mark: z
              .string()
              .optional()
              .describe("Equipment mark/designation (e.g., 'P-1', 'T-1', 'G-1')"),
          })
        )
        .min(1)
        .describe("Array of electrical equipment to place"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("place_electrical_equipment", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Place electrical equipment failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
