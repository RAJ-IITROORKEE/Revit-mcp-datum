import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSetElementPhaseTool(server: McpServer) {
  server.tool(
    "set_element_phase",
    "Assign phase created and phase demolished to Revit elements for renovation and phased construction projects. Phase Created defines when an element is built; Phase Demolished defines when it's removed. Essential for showing existing walls to be demolished, new construction, and temporary elements. Use manage_phases to list available phases first.",
    {
      assignments: z
        .array(
          z.object({
            elementId: z
              .number()
              .describe("ElementId of the element to assign phase to"),
            phaseCreated: z
              .number()
              .optional()
              .describe("ElementId of the phase when this element was/will be created. Use manage_phases to find phase IDs."),
            phaseDemolished: z
              .number()
              .optional()
              .describe("ElementId of the phase when this element is/was demolished. Use -1 for 'None' (element stays permanently)."),
          })
        )
        .min(1)
        .describe("Array of element phase assignments"),
      transactionName: z
        .string()
        .optional()
        .default("Set Element Phases")
        .describe("Transaction name for undo history"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("set_element_phase", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Set element phase failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
