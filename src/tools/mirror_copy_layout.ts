import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Mirror or copy layout patterns between rooms, floors, or regions.
 * Supports mirroring furniture layouts, copying room configurations,
 * and replicating design patterns across the project.
 */
export function registerMirrorCopyLayoutTool(server: McpServer) {
  server.tool(
    "mirror_copy_layout",
    `Mirror or copy layout patterns between rooms, levels, or regions in Revit. This tool enables efficient design replication across the project.

Operations:
1. MIRROR_ROOM: Mirror all furniture/elements in a room across an axis
2. COPY_ROOM_LAYOUT: Copy the furniture layout from one room to another (same or different floor)
3. COPY_LEVEL_LAYOUT: Copy all elements from one level to another (typical floor replication)
4. COPY_REGION: Copy elements within a bounding box to another location
5. MIRROR_REGION: Mirror elements within a bounding box across an axis
6. ARRAY_COPY: Create linear or radial arrays of element groups

Smart features:
- Automatically adjusts furniture placement when destination room has different dimensions
- Maintains relative positions and rotations
- Preserves clearances and wall-relative positioning
- Can filter which element categories to include in the copy
- Supports transformation (scale, rotate) during copy`,
    {
      operation: z
        .enum(["mirror_room", "copy_room_layout", "copy_level_layout", "copy_region", "mirror_region", "array_copy"])
        .describe("The layout operation to perform"),
      sourceRoomId: z
        .number()
        .optional()
        .describe("Source room ElementId (for mirror_room and copy_room_layout)"),
      destinationRoomIds: z
        .array(z.number())
        .optional()
        .describe("Destination room ElementIds for copy_room_layout. Supports copying to multiple rooms."),
      sourceLevelId: z
        .number()
        .optional()
        .describe("Source level ElementId (for copy_level_layout)"),
      destinationLevelIds: z
        .array(z.number())
        .optional()
        .describe("Destination level ElementIds for copy_level_layout. Supports copying to multiple floors."),
      sourceRegion: z
        .object({
          minX: z.number().describe("Minimum X coordinate in mm"),
          minY: z.number().describe("Minimum Y coordinate in mm"),
          maxX: z.number().describe("Maximum X coordinate in mm"),
          maxY: z.number().describe("Maximum Y coordinate in mm"),
        })
        .optional()
        .describe("Source bounding box for copy_region and mirror_region"),
      destinationPoint: z
        .object({
          x: z.number().describe("X coordinate of destination anchor point in mm"),
          y: z.number().describe("Y coordinate of destination anchor point in mm"),
        })
        .optional()
        .describe("Destination anchor point for copy_region"),
      mirrorAxis: z
        .enum(["x", "y", "custom"])
        .optional()
        .describe("Mirror axis: 'x' mirrors horizontally (left-right), 'y' mirrors vertically (top-bottom), 'custom' uses customAxisPoint"),
      customAxisPoint1: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe("First point of custom mirror axis line"),
      customAxisPoint2: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe("Second point of custom mirror axis line"),
      categoriesToCopy: z
        .array(z.string())
        .default(["OST_Furniture", "OST_FurnitureSystems", "OST_SpecialityEquipment", "OST_Casework", "OST_GenericModel"])
        .describe("Revit categories to include in the copy/mirror operation"),
      includeWalls: z
        .boolean()
        .default(false)
        .describe("Include walls in the copy operation (typically false for furniture-only copies)"),
      includeDoors: z
        .boolean()
        .default(false)
        .describe("Include doors in the copy operation"),
      includeWindows: z
        .boolean()
        .default(false)
        .describe("Include windows in the copy operation"),
      adaptToDestination: z
        .boolean()
        .default(true)
        .describe("Intelligently adapt placement when destination room has different dimensions than source"),
      arrayCount: z
        .number()
        .optional()
        .describe("Number of copies for array_copy operation"),
      arraySpacingMm: z
        .number()
        .optional()
        .describe("Spacing between copies for linear array in mm"),
      arrayDirection: z
        .object({
          x: z.number().describe("X component of array direction vector"),
          y: z.number().describe("Y component of array direction vector"),
        })
        .optional()
        .describe("Direction vector for linear array_copy"),
    },
    async (args, extra) => {
      const params = {
        operation: args.operation,
        sourceRoomId: args.sourceRoomId,
        destinationRoomIds: args.destinationRoomIds || [],
        sourceLevelId: args.sourceLevelId,
        destinationLevelIds: args.destinationLevelIds || [],
        sourceRegion: args.sourceRegion,
        destinationPoint: args.destinationPoint,
        mirror: {
          axis: args.mirrorAxis,
          customAxisPoint1: args.customAxisPoint1,
          customAxisPoint2: args.customAxisPoint2,
        },
        categoriesToCopy: args.categoriesToCopy,
        includeWalls: args.includeWalls,
        includeDoors: args.includeDoors,
        includeWindows: args.includeWindows,
        adaptToDestination: args.adaptToDestination,
        array: {
          count: args.arrayCount,
          spacingMm: args.arraySpacingMm,
          direction: args.arrayDirection,
        },
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "mirror_copy_layout",
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
              text: `Mirror/copy layout failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
