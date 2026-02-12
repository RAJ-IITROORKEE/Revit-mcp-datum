import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateMechanicalSystemTool(server: McpServer) {
  server.tool(
    "create_mechanical_system",
    "Create mechanical (HVAC) systems in Revit that group ducts and equipment. Systems define airflow paths from source (AHU) to terminals (diffusers). Essential for system analysis, airflow calculations, and MEP coordination. Supports supply air, return air, exhaust, outside air systems. Use place_mechanical_equipment and create_duct first, then organize them into systems.",
    {
      systems: z
        .array(
          z.object({
            systemName: z
              .string()
              .describe("System name (e.g., 'SA-1 Supply Air', 'RA-1 Return Air', 'EXH-Kitchen Exhaust')"),
            systemType: z
              .enum(["SupplyAir", "ReturnAir", "ExhaustAir", "OutsideAir", "VentilationAir", "KitchenExhaust", "SmokControl"])
              .describe("Type of mechanical system"),
            sourceEquipmentId: z
              .number()
              .describe("ElementId of source equipment (AHU, fan, exhaust fan). Air flows FROM this equipment."),
            terminalIds: z
              .array(z.number())
              .optional()
              .describe("ElementIds of terminal equipment (diffusers, grilles, VAV boxes) that belong to this system. Air flows TO these terminals."),
            ductIds: z
              .array(z.number())
              .optional()
              .describe("ElementIds of ducts that are part of this system"),
            designAirflowCFM: z
              .number()
              .optional()
              .describe("Design airflow in CFM for the system"),
            staticPressure: z
              .number()
              .optional()
              .describe("Static pressure in inches of water gauge (typical: 0.5-3.0)"),
            systemClassification: z
              .string()
              .optional()
              .describe("System classification or zone name (e.g., 'Zone 1', 'East Wing', 'Perimeter')"),
          })
        )
        .min(1)
        .describe("Array of mechanical system definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_mechanical_system", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create mechanical system failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
