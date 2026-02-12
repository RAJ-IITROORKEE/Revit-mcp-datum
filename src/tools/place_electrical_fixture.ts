import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerPlaceElectricalFixtureTool(server: McpServer) {
  server.tool(
    "place_electrical_fixture",
    "Place electrical fixtures and devices in Revit: lighting fixtures (ceiling, wall, pendant), switches, receptacles (outlets), data/telecom devices, fire alarm devices, security devices. Use get_loaded_families with categories ['OST_LightingFixtures', 'OST_ElectricalFixtures', 'OST_DataDevices', 'OST_FireAlarmDevices'] to discover available types. All units are in millimeters (mm).",
    {
      fixtures: z
        .array(
          z.object({
            fixtureTypeId: z
              .number()
              .describe("ElementId of the fixture type. Use get_loaded_families to find type IDs."),
            location: z.object({
              x: z.number().describe("X coordinate in mm"),
              y: z.number().describe("Y coordinate in mm"),
              z: z.number().optional().default(0).describe("Z coordinate in mm"),
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
            hostSurface: z
              .enum(["Ceiling", "Wall", "Floor", "Freestanding"])
              .optional()
              .default("Ceiling")
              .describe("Where the fixture is mounted"),
            hostElementId: z
              .number()
              .optional()
              .describe("ElementId of host ceiling/wall/floor for face-hosted fixtures"),
            fixtureCategory: z
              .enum([
                "LightingFixture",
                "Receptacle",
                "Switch",
                "DataOutlet",
                "PhoneOutlet",
                "FireAlarmDevice",
                "SecurityDevice",
                "EmergencyLight",
                "ExitSign",
              ])
              .optional()
              .describe("Functional category of fixture"),
            circuitId: z
              .number()
              .optional()
              .describe("ElementId of circuit to connect this fixture to (can be assigned later with create_electrical_circuit)"),
            watts: z
              .number()
              .optional()
              .describe("Power consumption in watts (for load calculations)"),
            voltage: z
              .number()
              .optional()
              .describe("Operating voltage in volts (120, 277, etc.)"),
            switchLegNumber: z
              .number()
              .optional()
              .describe("Switch leg number (for multi-way switching)"),
          })
        )
        .min(1)
        .describe("Array of electrical fixtures to place"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("place_electrical_fixture", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Place electrical fixture failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
