import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateTextNoteTool(server: McpServer) {
  server.tool(
    "create_text_note",
    "Create text notes in Revit views for annotations, callouts, and general notes. Supports custom text content, positioning, rotation, and text formatting. Essential for documenting design intent and construction notes.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where the text note will be placed"),
      text: z
        .string()
        .describe("Text content for the note. Supports multiple lines using \\n."),
      location: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .describe("Position where the text note will be placed"),
      textNoteTypeId: z
        .number()
        .optional()
        .describe("ElementId of text note type (controls font, size, style). Uses default if not specified."),
      rotation: z
        .number()
        .optional()
        .describe("Rotation angle in degrees (0-360). Default is 0 (horizontal)."),
      width: z
        .number()
        .optional()
        .describe("Width of text box in mm. Text will wrap within this width. If not specified, uses single line."),
      horizontalAlignment: z
        .enum(["Left", "Center", "Right"])
        .default("Left")
        .describe("Horizontal text alignment within the text box"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_text_note", params);
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
              text: `Create text note failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
