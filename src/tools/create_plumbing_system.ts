import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreatePlumbingSystemTool(server: McpServer) {
  server.tool(
    "create_plumbing_system",
    "Create plumbing systems in Revit that group pipes and fixtures. Systems define water distribution or drainage paths. Essential for system analysis, pressure calculations, and fixture unit calculations. Supports domestic water (hot/cold), sanitary, storm drainage, vent, and gas systems. Use place_plumbing_fixture and create_pipe first, then organize them into systems.",
    {
      systems: z
        .array(
          z.object({
            systemName: z
              .string()
              .describe("System name (e.g., 'DCW-1 Cold Water', 'DHW-1 Hot Water', 'SAN-1 Sanitary', 'STRM-1 Storm')"),
            systemType: z
              .enum([
                "DomesticColdWater",
                "DomesticHotWater",
                "DomesticHotWaterReturn",
                "Sanitary",
                "StormDrainage",
                "Vent",
                "NaturalGas",
                "MedicalGas",
                "ChilledWater",
                "HotWater",
                "CondenserWater",
              ])
              .describe("Type of plumbing system"),
            sourceEquipmentId: z
              .number()
              .optional()
              .describe("ElementId of source equipment (water heater, main, pump). Water/drainage flows FROM this."),
            fixtureIds: z
              .array(z.number())
              .optional()
              .describe("ElementIds of plumbing fixtures that belong to this system"),
            pipeIds: z
              .array(z.number())
              .optional()
              .describe("ElementIds of pipes that are part of this system"),
            designFlowGPM: z
              .number()
              .optional()
              .describe("Design flow rate in gallons per minute (GPM)"),
            staticPressurePSI: z
              .number()
              .optional()
              .describe("Static pressure in pounds per square inch (PSI, typical: 40-80)"),
            systemClassification: z
              .string()
              .optional()
              .describe("System classification or zone (e.g., 'Building A', 'West Wing')"),
          })
        )
        .min(1)
        .describe("Array of plumbing system definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_plumbing_system", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create plumbing system failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
