import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateSectionMarkerTool(server: McpServer) {
  server.tool(
    "create_section_marker",
    "Create building section cut markers in Revit floor plans and elevations that automatically generate section views. Section markers show the cutting plane with direction arrows and reference bubbles for coordinated documentation.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where section marker will be placed"),
      sectionLine: z
        .object({
          startPoint: z.object({
            x: z.number().describe("X coordinate of section start in mm"),
            y: z.number().describe("Y coordinate of section start in mm"),
          }),
          endPoint: z.object({
            x: z.number().describe("X coordinate of section end in mm"),
            y: z.number().describe("Y coordinate of section end in mm"),
          }),
        })
        .describe("Line defining the section cutting plane"),
      viewDirection: z
        .enum(["Up", "Down", "Left", "Right"])
        .describe("Direction the section view looks toward. Up: looking upward from line. Down: looking downward. Left/Right: looking perpendicular to line."),
      sectionViewName: z
        .string()
        .optional()
        .describe("Name for the generated section view"),
      scale: z
        .number()
        .optional()
        .describe("Scale for the section view (e.g., 50 for 1:50)"),
      farClipOffset: z
        .number()
        .optional()
        .describe("Distance in mm beyond the section line to include elements (depth of view)"),
      sectionTypeId: z
        .number()
        .optional()
        .describe("ElementId of section type (controls marker appearance)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_section_marker", params);
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
              text: `Create section marker failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
