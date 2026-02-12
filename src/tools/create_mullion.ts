import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateMullionTool(server: McpServer) {
  server.tool(
    "create_mullion",
    "Place mullion elements on curtain wall grid lines in Revit. Mullions are the structural framing members (typically aluminum, steel, or wood) that hold curtain wall panels in place. Supports placing mullions on specific grid line segments, setting mullion types, and configuring corner mullions. Use get_available_family_types with categoryList ['OST_CurtainWallMullions'] to discover available mullion types. All units are in millimeters (mm).",
    {
      hostElementId: z
        .number()
        .describe(
          "ElementId of the curtain wall or curtain system on which to place mullions."
        ),
      action: z
        .enum(["place", "remove", "replace", "placeAll"])
        .describe(
          "Action: 'place' adds mullions on specified grid segments, 'remove' removes mullions, 'replace' swaps mullion types, 'placeAll' places mullions on all grid lines."
        ),
      mullions: z
        .array(
          z.object({
            mullionTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the mullion type. Use get_available_family_types with 'OST_CurtainWallMullions'. If omitted, uses the curtain wall's default mullion type."
              ),
            gridLineId: z
              .number()
              .optional()
              .describe(
                "ElementId of the grid line on which to place the mullion. Required for 'place' and 'remove' actions."
              ),
            segmentIndex: z
              .number()
              .optional()
              .describe(
                "Index of the specific segment on the grid line (0-based). If omitted, mullion is placed on all segments of the grid line."
              ),
            mullionId: z
              .number()
              .optional()
              .describe(
                "ElementId of an existing mullion (required for 'remove' and 'replace' actions)."
              ),
            position: z
              .enum(["Perpendicular", "Parallel", "Corner"])
              .optional()
              .describe(
                "Mullion position type: 'Perpendicular' for grid-crossing mullions, 'Parallel' for same-direction mullions, 'Corner' for corner conditions."
              ),
          })
        )
        .optional()
        .describe("Array of mullion placement operations. Not required when action is 'placeAll'."),
      defaultMullionTypeId: z
        .number()
        .optional()
        .describe(
          "Default mullion type for 'placeAll' action. Applies this mullion type to all grid lines."
        ),
      borderMullionTypeId: z
        .number()
        .optional()
        .describe(
          "Mullion type to use specifically for border (edge) mullions when using 'placeAll'."
        ),
      cornerMullionConfig: z
        .object({
          cornerMullionTypeId: z
            .number()
            .optional()
            .describe("ElementId of corner mullion type"),
          joinCondition: z
            .enum(["NotDefined", "Miter", "Border1OverlapsBorder2", "Border2OverlapsBorder1"])
            .optional()
            .describe("How mullions join at curtain wall corners"),
        })
        .optional()
        .describe("Configuration for corner mullion conditions"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_mullion", params);
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
              text: `Mullion operation failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
