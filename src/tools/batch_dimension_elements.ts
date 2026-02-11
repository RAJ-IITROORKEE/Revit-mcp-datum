import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Intelligent auto-dimensioning tool.
 * Automatically creates dimensions for walls, doors, windows,
 * grids, and other elements with smart placement and chaining.
 */
export function registerBatchDimensionElementsTool(server: McpServer) {
  server.tool(
    "batch_dimension_elements",
    `Automatically create dimensions for multiple elements in Revit with intelligent placement. This tool analyzes element geometry and creates properly placed, non-overlapping dimension chains.

Dimensioning modes:
- WALL_LENGTHS: Dimension all wall segments showing their lengths
- WALL_TO_WALL: Dimension distances between parallel walls (room widths)
- DOOR_POSITIONS: Dimension door positions relative to adjacent walls
- WINDOW_POSITIONS: Dimension window positions and heights
- GRID_SPACING: Dimension distances between grid lines
- ROOM_DIMENSIONS: Create overall room width/depth dimensions
- ELEMENT_SPACING: Dimension gaps between selected elements
- OVERALL: Create overall building dimensions with intermediate points
- CUSTOM: Dimension between specific reference points

Features:
- Automatic offset placement to avoid overlapping
- Dimension chain creation for aligned elements
- String/continuous dimensioning support
- Respects existing dimensions to avoid duplicates`,
    {
      dimensionMode: z
        .enum([
          "wall_lengths",
          "wall_to_wall",
          "door_positions",
          "window_positions",
          "grid_spacing",
          "room_dimensions",
          "element_spacing",
          "overall",
          "custom",
        ])
        .describe("The dimensioning mode/strategy to use"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Specific element IDs to dimension. Required for 'element_spacing' and 'custom' modes. For other modes, if omitted, dimensions all relevant elements in view."),
      viewId: z
        .number()
        .optional()
        .describe("View to create dimensions in. Uses active view if omitted."),
      roomIds: z
        .array(z.number())
        .optional()
        .describe("Room IDs for 'room_dimensions' mode. Dimensions width and depth of each room."),
      levelId: z
        .number()
        .optional()
        .describe("Filter elements by level for dimensioning"),
      dimensionTypeId: z
        .number()
        .optional()
        .describe("Dimension type/style to use. Uses default project dimension type if omitted."),
      offsetFromElementMm: z
        .number()
        .default(500)
        .describe("Distance to offset dimension lines from the elements being dimensioned (mm)"),
      chainDimensions: z
        .boolean()
        .default(true)
        .describe("Create continuous dimension chains where elements are aligned"),
      includeOverallDimension: z
        .boolean()
        .default(true)
        .describe("Add an overall dimension spanning the full chain"),
      dimensionDirection: z
        .enum(["horizontal", "vertical", "both", "auto"])
        .default("auto")
        .describe("Direction of dimensions: 'auto' determines based on element orientation"),
      skipExisting: z
        .boolean()
        .default(true)
        .describe("Skip creating dimensions that already exist in the view"),
      customReferences: z
        .array(
          z.object({
            startElementId: z.number().describe("Start reference element ID"),
            endElementId: z.number().describe("End reference element ID"),
            offsetMm: z.number().default(500).describe("Offset from elements"),
          })
        )
        .optional()
        .describe("Custom dimension pairs for 'custom' mode"),
    },
    async (args, extra) => {
      const params = {
        dimensionMode: args.dimensionMode,
        elementIds: args.elementIds || [],
        viewId: args.viewId,
        roomIds: args.roomIds || [],
        levelId: args.levelId,
        dimensionTypeId: args.dimensionTypeId,
        offsetFromElementMm: args.offsetFromElementMm,
        chainDimensions: args.chainDimensions,
        includeOverallDimension: args.includeOverallDimension,
        dimensionDirection: args.dimensionDirection,
        skipExisting: args.skipExisting,
        customReferences: args.customReferences || [],
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "batch_dimension_elements",
            params
          );
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
              text: `Batch dimension elements failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
