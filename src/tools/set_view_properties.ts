import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSetViewPropertiesTool(server: McpServer) {
  server.tool(
    "set_view_properties",
    "Modify properties of an existing view including scale, detail level, view template, crop region, and display settings. Allows fine-tuning of view appearance and behavior for documentation and presentation.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view to modify"),
      scale: z
        .number()
        .optional()
        .describe("New view scale (e.g., 100 for 1:100, 50 for 1:50)"),
      detailLevel: z
        .enum(["Coarse", "Medium", "Fine"])
        .optional()
        .describe("Level of detail to display in the view"),
      viewTemplateId: z
        .number()
        .optional()
        .describe("ElementId of view template to apply. Use -1 to remove current template."),
      cropBoxVisible: z
        .boolean()
        .optional()
        .describe("Show or hide the crop region boundary"),
      annotationCropActive: z
        .boolean()
        .optional()
        .describe("Enable or disable annotation crop (crops annotations outside crop region)"),
      cropRegion: z
        .object({
          min: z.object({
            x: z.number().describe("Minimum X coordinate in mm"),
            y: z.number().describe("Minimum Y coordinate in mm"),
          }),
          max: z.object({
            x: z.number().describe("Maximum X coordinate in mm"),
            y: z.number().describe("Maximum Y coordinate in mm"),
          }),
        })
        .optional()
        .describe("Define crop region boundaries to limit visible area in the view"),
      showHiddenLines: z
        .boolean()
        .optional()
        .describe("Display hidden lines (dashed) for elements obscured by other elements"),
      displayStyle: z
        .enum(["Wireframe", "HiddenLine", "Shaded", "Realistic", "Consistent"])
        .optional()
        .describe("Visual style for the view. Wireframe: lines only. HiddenLine: solid with hidden lines. Shaded: surfaces with basic shading. Realistic: photorealistic rendering. Consistent: consistent colors."),
      phaseFilter: z
        .string()
        .optional()
        .describe("Name of phase filter to apply (e.g., 'Show Complete', 'Show Previous + New')"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("set_view_properties", params);
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
              text: `Set view properties failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
