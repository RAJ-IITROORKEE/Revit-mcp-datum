import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateCalloutTool(server: McpServer) {
  server.tool(
    "create_callout",
    "Create callout views in Revit to reference detailed areas of floor plans, sections, or elevations. Callouts create child views with closeup detail and automatic reference bubbles. Essential for coordinated detail documentation.",
    {
      parentViewId: z
        .number()
        .describe("ElementId of the parent view where callout will be placed"),
      calloutType: z
        .enum(["Rectangle", "Sketch"])
        .default("Rectangle")
        .describe("Callout boundary type. Rectangle: standard rectangular callout. Sketch: custom sketched boundary."),
      boundingBox: z
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
        .describe("Rectangular boundary defining the callout area"),
      calloutViewName: z
        .string()
        .optional()
        .describe("Name for the created callout view. Auto-generated if not specified."),
      scale: z
        .number()
        .optional()
        .describe("Scale for the callout view (e.g., 50 for 1:50). Inherits parent scale if not specified."),
      detailLevel: z
        .enum(["Coarse", "Medium", "Fine"])
        .optional()
        .describe("Detail level for the callout view"),
      calloutTypeId: z
        .number()
        .optional()
        .describe("ElementId of specific callout type to use (controls bubble appearance)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_callout", params);
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
              text: `Create callout failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
