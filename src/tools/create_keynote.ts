import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateKeynoteTool(server: McpServer) {
  server.tool(
    "create_keynote",
    "Create keynote annotations in Revit views for standardized notation referencing specifications. Keynotes link to external keynote files (text or database) and maintain consistent numbering across the project. Essential for specification-heavy documentation.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where keynote will be placed"),
      elementId: z
        .number()
        .optional()
        .describe("ElementId of element to keynote. Creates element keynote if provided."),
      location: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .describe("Placement location for the keynote. For element keynotes, this is the leader endpoint."),
      keynoteType: z
        .enum(["Element", "Material", "User"])
        .describe("Type of keynote. Element: links to element's keynote parameter. Material: links to material keynote. User: custom text keynote."),
      keynoteText: z
        .string()
        .optional()
        .describe("Keynote number or text (e.g., '09 51 00', 'A.3'). Required for User keynote type. For Element/Material types, retrieves from keynote file."),
      hasLeader: z
        .boolean()
        .default(true)
        .describe("Include leader line pointing to element"),
      keynoteTypeId: z
        .number()
        .optional()
        .describe("ElementId of keynote type (controls text style and format)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_keynote", params);
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Create keynote failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
