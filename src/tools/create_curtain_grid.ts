import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateCurtainGridTool(server: McpServer) {
  server.tool(
    "create_curtain_grid",
    "Add, modify, or remove curtain grid lines on existing curtain walls, curtain systems, or curtain roofs in Revit. Curtain grids divide the curtain element into panels and define where mullions are placed. Supports adding individual grid lines at specific positions or modifying existing grid line spacing. All units are in millimeters (mm).",
    {
      hostElementId: z
        .number()
        .describe(
          "ElementId of the curtain wall, curtain system, or curtain roof to modify. Use ai_element_filter or get_selected_elements to find curtain elements."
        ),
      action: z
        .enum(["add", "remove", "modify"])
        .describe(
          "Action to perform: 'add' adds new grid lines, 'remove' removes specified grid lines, 'modify' adjusts existing grid line positions."
        ),
      gridLines: z
        .array(
          z.object({
            direction: z
              .enum(["U", "V"])
              .describe(
                "Grid line direction: 'U' for horizontal grid lines, 'V' for vertical grid lines."
              ),
            position: z
              .number()
              .describe(
                "Position along the curtain wall for the grid line in mm. For 'U' direction: distance from bottom. For 'V' direction: distance from start point."
              ),
            gridLineId: z
              .number()
              .optional()
              .describe(
                "ElementId of an existing grid line (required for 'remove' and 'modify' actions)."
              ),
            newPosition: z
              .number()
              .optional()
              .describe(
                "New position for the grid line in mm (only used with 'modify' action)."
              ),
            isOneSegment: z
              .boolean()
              .optional()
              .default(false)
              .describe(
                "If true, the grid line only spans one segment (between adjacent perpendicular grid lines). If false, spans the entire curtain wall."
              ),
            excludedSegments: z
              .array(z.number())
              .optional()
              .describe(
                "Array of segment indices where the grid line should NOT appear (for partial grid lines)."
              ),
          })
        )
        .min(1)
        .describe("Array of grid line operations to perform"),
      lockGridLines: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "If true, pin/lock the grid lines after creation to prevent accidental modification."
        ),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_curtain_grid", params);
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
              text: `Curtain grid operation failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
