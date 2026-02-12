import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateMepSpaceTool(server: McpServer) {
  server.tool(
    "create_mep_space",
    "Create MEP spaces in Revit for mechanical rooms, electrical rooms, telecom rooms, shafts, and equipment spaces. MEP spaces define volumes for energy analysis, HVAC load calculations, and equipment placement validation. Similar to rooms but specifically for MEP systems. Essential for coordinating MEP equipment locations and space requirements. All units are in millimeters (mm).",
    {
      spaces: z
        .array(
          z.object({
            levelId: z
              .number()
              .describe("ElementId of the level for the space"),
            location: z
              .object({
                x: z.number().describe("X coordinate for space tag placement in mm"),
                y: z.number().describe("Y coordinate in mm"),
              })
              .describe("Point inside the space boundary where the space tag is placed"),
            spaceName: z
              .string()
              .optional()
              .describe("Space name (e.g., 'Mechanical Room 1', 'Electrical Room B', 'IT Closet', 'Riser Shaft')"),
            spaceNumber: z
              .string()
              .optional()
              .describe("Space number for identification"),
            spaceType: z
              .enum([
                "MechanicalRoom",
                "ElectricalRoom",
                "TelecomRoom",
                "ITCloset",
                "Shaft",
                "PlumbingChase",
                "EquipmentRoom",
                "DataCenter",
              ])
              .optional()
              .describe("Functional type of MEP space"),
            phaseId: z
              .number()
              .optional()
              .describe("Phase for the space"),
            condition: z
              .enum(["Conditioned", "Unconditioned", "Plenum"])
              .optional()
              .default("Conditioned")
              .describe("Space conditioning type for HVAC calculations"),
            occupancyCount: z
              .number()
              .optional()
              .describe("Number of occupants for ventilation calculations"),
            designHeatingLoad: z
              .number()
              .optional()
              .describe("Design heating load in BTU/hr"),
            designCoolingLoad: z
              .number()
              .optional()
              .describe("Design cooling load in BTU/hr"),
          })
        )
        .min(1)
        .describe("Array of MEP space definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_mep_space", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create MEP space failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
