import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateCurtainWallTool(server: McpServer) {
  server.tool(
    "create_curtain_wall",
    "Create curtain wall elements in Revit. Curtain walls are non-bearing walls made of panels (glass, opaque, or custom) held together by mullions in a grid pattern. Supports specifying wall type, location line, grid layout, panel types, and mullion types. Use get_available_family_types with categoryList ['OST_Walls'] and familyNameFilter 'Curtain' to discover available curtain wall types. All units are in millimeters (mm).",
    {
      curtainWalls: z
        .array(
          z.object({
            curtainWallTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the curtain wall type. Use get_available_family_types with 'OST_Walls' category and 'Curtain' filter. If omitted, uses the default curtain wall type."
              ),
            locationLine: z
              .object({
                startPoint: z.object({
                  x: z.number().describe("X coordinate of wall start point in mm"),
                  y: z.number().describe("Y coordinate of wall start point in mm"),
                  z: z.number().optional().default(0).describe("Z coordinate in mm (default 0)"),
                }),
                endPoint: z.object({
                  x: z.number().describe("X coordinate of wall end point in mm"),
                  y: z.number().describe("Y coordinate of wall end point in mm"),
                  z: z.number().optional().default(0).describe("Z coordinate in mm (default 0)"),
                }),
              })
              .describe("The line defining the curtain wall location"),
            baseLevelId: z
              .number()
              .describe("ElementId of the base level. Use get_levels_list to find available levels."),
            topLevelId: z
              .number()
              .optional()
              .describe(
                "ElementId of the top level. If omitted, wall height is determined by unconnectedHeight."
              ),
            baseOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset from the base level in mm"),
            topOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset from the top level in mm"),
            unconnectedHeight: z
              .number()
              .optional()
              .describe(
                "Wall height in mm when not connected to a top level. Used when topLevelId is not provided."
              ),
            gridLayout: z
              .object({
                verticalGridSpacing: z
                  .number()
                  .optional()
                  .describe("Spacing between vertical curtain grid lines in mm"),
                horizontalGridSpacing: z
                  .number()
                  .optional()
                  .describe("Spacing between horizontal curtain grid lines in mm"),
                verticalGridPattern: z
                  .enum(["FixedDistance", "FixedNumber", "MaximumSpacing", "MinimumSpacing"])
                  .optional()
                  .describe("Layout rule for vertical grid lines"),
                horizontalGridPattern: z
                  .enum(["FixedDistance", "FixedNumber", "MaximumSpacing", "MinimumSpacing"])
                  .optional()
                  .describe("Layout rule for horizontal grid lines"),
                verticalJustification: z
                  .enum(["Beginning", "Center", "End"])
                  .optional()
                  .describe("Justification of vertical grid layout"),
                horizontalJustification: z
                  .enum(["Beginning", "Center", "End"])
                  .optional()
                  .describe("Justification of horizontal grid layout"),
                verticalGridCount: z
                  .number()
                  .optional()
                  .describe("Number of vertical grid lines (for FixedNumber pattern)"),
                horizontalGridCount: z
                  .number()
                  .optional()
                  .describe("Number of horizontal grid lines (for FixedNumber pattern)"),
              })
              .optional()
              .describe("Grid layout configuration for the curtain wall"),
            panelTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the default panel type. Use get_available_family_types with 'OST_CurtainWallPanels' to find panel types."
              ),
            mullionTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the default mullion type. Use get_available_family_types with 'OST_CurtainWallMullions' to find mullion types."
              ),
          })
        )
        .min(1)
        .describe("Array of curtain wall definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_curtain_wall", params);
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
              text: `Create curtain wall failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
