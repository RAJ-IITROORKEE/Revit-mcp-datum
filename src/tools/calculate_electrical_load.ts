import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCalculateElectricalLoadTool(server: McpServer) {
  server.tool(
    "calculate_electrical_load",
    "Calculate electrical loads in Revit per NEC (National Electrical Code) standards. Analyzes connected loads, applies demand factors, calculates panel loads, and sizes electrical equipment. Essential for panel sizing, transformer sizing, service entrance calculations, and electrical design validation. Returns load calculations, panel summaries, and equipment sizing recommendations.",
    {
      calculationType: z
        .enum(["PanelLoad", "CircuitLoad", "ServiceEntrance", "TransformerSizing", "GeneratorSizing", "FullBuilding"])
        .describe(
          "Type of load calculation: 'PanelLoad' for panel sizing, 'CircuitLoad' for circuit breaker sizing, 'ServiceEntrance' for main service, 'TransformerSizing', 'GeneratorSizing', 'FullBuilding' for complete analysis."
        ),
      panelId: z
        .number()
        .optional()
        .describe("ElementId of panel for PanelLoad calculation"),
      circuitId: z
        .number()
        .optional()
        .describe("ElementId of circuit for CircuitLoad calculation"),
      buildingType: z
        .enum(["Residential", "Commercial", "Industrial", "Healthcare", "Educational", "Hospitality", "Office", "Retail", "Warehouse"])
        .optional()
        .describe("Building type for applying appropriate demand factors per NEC"),
      voltageSystem: z
        .object({
          voltage: z.number().describe("System voltage in volts (e.g., 120/208, 277/480)"),
          phaseConfiguration: z.enum(["SinglePhase", "ThreePhase"]),
        })
        .optional()
        .describe("Voltage system configuration"),
      demandFactors: z
        .object({
          lighting: z.number().optional().describe("Lighting demand factor (0-1, e.g., 0.9 = 90%)"),
          receptacles: z.number().optional().describe("Receptacle demand factor"),
          hvac: z.number().optional().describe("HVAC demand factor"),
          appliances: z.number().optional().describe("Appliance demand factor"),
          motors: z.number().optional().describe("Motor demand factor"),
        })
        .optional()
        .describe("Custom demand factors (NEC defaults used if omitted)"),
      includeReserve: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include 25% spare capacity reserve per NEC"),
      includeDiversityFactor: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to apply diversity factor (not all loads operate simultaneously)"),
      powerFactor: z
        .number()
        .optional()
        .default(0.9)
        .describe("Power factor for load calculations (0-1, typical 0.8-0.95)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("calculate_electrical_load", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Calculate electrical load failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
