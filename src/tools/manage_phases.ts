import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerManagePhasesTool(server: McpServer) {
  server.tool(
    "manage_phases",
    "Create and manage construction phases in Revit for renovation and phased construction projects. Phases define temporal states: Existing conditions, Demolition, New Construction, Future phases, etc. Essential for showing what's being demolished vs. built new, creating phased floor plans, and tracking construction sequencing. Actions: ListPhases, CreatePhase, DeletePhase, ReorderPhases, GetPhaseFilters.",
    {
      action: z
        .enum(["ListPhases", "CreatePhase", "DeletePhase", "ReorderPhases", "GetPhaseFilters"])
        .describe(
          "Action: 'ListPhases' gets all project phases, 'CreatePhase' adds a new phase, 'DeletePhase' removes a phase, 'ReorderPhases' changes phase sequence, 'GetPhaseFilters' lists available phase filters for views."
        ),
      phaseName: z
        .string()
        .optional()
        .describe("Name for new phase (CreatePhase) or filter pattern (ListPhases)"),
      phaseId: z
        .number()
        .optional()
        .describe("ElementId of phase (for DeletePhase)"),
      insertAfterPhaseId: z
        .number()
        .optional()
        .describe("Insert new phase after this phase (for CreatePhase)"),
      phaseOrder: z
        .array(z.number())
        .optional()
        .describe("Array of phase ElementIds in desired order (for ReorderPhases)"),
      description: z
        .string()
        .optional()
        .describe("Description for the new phase"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("manage_phases", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Manage phases failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
