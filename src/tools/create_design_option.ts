import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateDesignOptionTool(server: McpServer) {
  server.tool(
    "create_design_option",
    "Create and manage design options in Revit for exploring design alternatives within a single model. Design options allow comparing different layouts, façade systems, structural schemes, or equipment configurations. Each option set can have multiple options (Option 1, Option 2, etc.) with only one option visible at a time. Essential for AI-driven design exploration and A/B testing. Actions: CreateSet, CreateOption, AddToOption, RemoveFromOption, SetPrimary, ListOptions, AcceptOption.",
    {
      action: z
        .enum(["CreateSet", "CreateOption", "AddToOption", "RemoveFromOption", "SetPrimary", "ListOptions", "AcceptOption", "DeleteOption"])
        .describe(
          "Action: 'CreateSet' creates a new option set, 'CreateOption' adds an option to a set, 'AddToOption' moves elements into an option, 'RemoveFromOption' removes elements, 'SetPrimary' sets which option is primary, 'ListOptions' lists all option sets/options, 'AcceptOption' makes an option permanent and deletes alternatives, 'DeleteOption' removes an option."
        ),
      optionSetName: z
        .string()
        .optional()
        .describe("Name for the option set (e.g., 'Facade Options', 'Layout Schemes', 'Structural System')"),
      optionSetId: z
        .number()
        .optional()
        .describe("ElementId of existing option set (for CreateOption, SetPrimary, AcceptOption)"),
      optionName: z
        .string()
        .optional()
        .describe("Name for the option (e.g., 'Option 1 - Glass Curtain Wall', 'Option 2 - Precast Panels')"),
      optionId: z
        .number()
        .optional()
        .describe("ElementId of design option (for AddToOption, RemoveFromOption, SetPrimary, AcceptOption, DeleteOption)"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds to add to or remove from the option"),
      makePrimary: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to make this the primary option when creating"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_design_option", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Design option operation failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
