import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateElectricalCircuitTool(server: McpServer) {
  server.tool(
    "create_electrical_circuit",
    "Create electrical circuits in Revit connecting electrical devices (lights, receptacles, equipment) to panels. Circuits define electrical distribution, wire sizing, voltage, and load calculations. Supports power circuits, lighting circuits, data/telecom, fire alarm, and specialty systems. Essential for electrical design, load analysis, and panel schedules. Use place_electrical_fixture first to create devices, then connect them to circuits.",
    {
      circuits: z
        .array(
          z.object({
            circuitName: z
              .string()
              .optional()
              .describe("Circuit name/number (e.g., '1', 'A-101', 'L1.1'). Auto-generated if omitted."),
            panelId: z
              .number()
              .describe(
                "ElementId of the electrical panel this circuit connects to. Use place_electrical_equipment to create panels first."
              ),
            deviceIds: z
              .array(z.number())
              .min(1)
              .describe("ElementIds of electrical devices/fixtures to connect to this circuit (lights, receptacles, equipment)."),
            circuitType: z
              .enum(["Power", "Lighting", "DataTelecom", "FireAlarm", "SecurityAlarm", "NurseCall", "SpecialtySystem"])
              .optional()
              .default("Power")
              .describe("Type of electrical circuit"),
            voltage: z
              .number()
              .optional()
              .describe("Circuit voltage in volts (e.g., 120, 208, 277, 480). Defaults to panel voltage."),
            phaseConfiguration: z
              .enum(["SinglePhase", "ThreePhase", "TwoPhase"])
              .optional()
              .default("SinglePhase")
              .describe("Phase configuration for the circuit"),
            numberOfPoles: z
              .number()
              .optional()
              .describe("Number of poles (1, 2, or 3). Typically 1 for 120V, 2 for 240V, 3 for 3-phase."),
            wireSize: z
              .string()
              .optional()
              .describe("Wire gauge (e.g., '12 AWG', '10 AWG', '8 AWG', '6 AWG'). Auto-calculated if omitted based on load."),
            conduitType: z
              .string()
              .optional()
              .describe("Conduit type (e.g., 'EMT', 'PVC', 'Rigid', 'MC Cable', 'Romex'). Defaults to project standard."),
            ratingAmps: z
              .number()
              .optional()
              .describe("Circuit breaker rating in amps (e.g., 15, 20, 30, 50). Auto-calculated if omitted."),
            groundingRequired: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether circuit requires grounding conductor"),
            loadClassification: z
              .enum(["Continuous", "NonContinuous", "Motor", "HVAC"])
              .optional()
              .describe("Load classification for NEC calculations"),
          })
        )
        .min(1)
        .describe("Array of circuit definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_electrical_circuit", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create electrical circuit failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
