import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSetElementParametersTool(server: McpServer) {
  server.tool(
    "set_element_parameters",
    "Set parameter values on one or more Revit elements in batch. Supports setting instance parameters, type parameters, shared parameters, and custom parameters. Essential for assigning marks, comments, phase data, room numbers, material assignments, dimension overrides, structural properties, and any custom project data. Use get_element_parameters first to discover available parameter names and their data types.",
    {
      modifications: z
        .array(
          z.object({
            elementId: z
              .number()
              .describe("ElementId of the element to modify"),
            parameters: z
              .array(
                z.object({
                  parameterName: z
                    .string()
                    .describe("Name of the parameter to set (as returned by get_element_parameters)"),
                   value: z
                     .union([z.string(), z.number(), z.boolean()])
                     .describe("Value to set. Type depends on parameter: string for text/ElementId/length-type params, number for numeric dimensions (in project units), boolean for Yes/No type parameters."),
                  isTypeParameter: z
                    .boolean()
                    .optional()
                    .default(false)
                    .describe("If true, sets the type parameter (affects all instances of this type). If false, sets instance parameter."),
                })
              )
              .min(1)
              .describe("Array of parameter name-value pairs to set on this element"),
          })
        )
        .min(1)
        .describe("Array of element modifications, each with elementId and parameters to set"),
      transactionName: z
        .string()
        .optional()
        .default("Set Parameters")
        .describe("Name for the Revit transaction (appears in undo history)"),
      continueOnError: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true, continues setting parameters on remaining elements even if one fails. If false, rolls back entire transaction on first error."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("set_element_parameters", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Set element parameters failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
