import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSetViewRangeTool(server: McpServer) {
  server.tool(
    "set_view_range",
    "Configure view range settings for Revit floor plan and ceiling plan views. View range controls which elements are visible based on their height relative to the view's level, defining top, cut plane, bottom, and view depth.",
    {
      viewId: z
        .number()
        .describe("ElementId of the floor plan or ceiling plan view"),
      topOffset: z
        .number()
        .optional()
        .describe("Height offset in mm above the view level for the top clip plane. Elements above this are not shown."),
      cutPlaneOffset: z
        .number()
        .optional()
        .describe("Height offset in mm above the view level where the horizontal cut plane intersects elements. Typically 1200mm (4') for floor plans."),
      bottomOffset: z
        .number()
        .optional()
        .describe("Height offset in mm above view level for the bottom clip plane."),
      viewDepthOffset: z
        .number()
        .optional()
        .describe("Height offset in mm above view level for view depth. Elements below this are not shown."),
      underlayOrientation: z
        .enum(["None", "LookDown", "LookUp"])
        .optional()
        .describe("Display an underlay from adjacent level. None: no underlay. LookDown: show level below. LookUp: show level above."),
      underlayId: z
        .number()
        .optional()
        .describe("ElementId of the level to use as underlay. Required if underlayOrientation is not None."),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("set_view_range", params);
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
              text: `Set view range failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
