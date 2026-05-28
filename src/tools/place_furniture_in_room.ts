import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Intelligent furniture placement within room boundaries.
 * Places furniture at precise locations with proper rotation,
 * wall-relative positioning, and clearance awareness.
 */
export function registerPlaceFurnitureInRoomTool(server: McpServer) {
  server.tool(
    "place_furniture_in_room",
    `Place furniture elements intelligently within a room in Revit. Supports precise positioning with wall-relative placement, automatic rotation to face the correct direction, and clearance-aware spacing.

Unlike basic create_point_based_element, this tool is ROOM-AWARE:
- Validates that furniture fits within the room boundary
- Supports wall-relative positioning (e.g., "against north wall", "centered in room")
- Automatically calculates rotation based on facing direction
- Checks clearances against existing furniture and walls
- Supports batch placement of multiple furniture pieces

Use get_furniture_catalog first to find available furniture family type IDs.
Use get_rooms_list or get_element_spatial_data to get room boundaries and dimensions.`,
    {
      roomId: z
        .number()
        .describe("ElementId of the room where furniture will be placed"),
      furniture: z
        .array(
          z.object({
            typeId: z
              .number()
              .describe("FamilySymbol/Type ID of the furniture to place. Use get_furniture_catalog to find valid IDs."),
            name: z
              .string()
              .optional()
              .describe("Descriptive name for the furniture piece (e.g., 'Executive Desk', 'Office Chair')"),
            placement: z
              .enum(["absolute", "wall_relative", "center", "corner"])
              .default("absolute")
              .describe("Placement strategy: 'absolute' uses exact coordinates, 'wall_relative' places against a wall, 'center' centers in room, 'corner' places in a room corner"),
            locationPoint: z
              .object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
                z: z.number().default(0).describe("Z coordinate in mm (usually 0 for floor-level furniture)"),
              })
              .optional()
              .describe("Exact placement point. Required for 'absolute' placement. For other modes, acts as an offset/hint."),
            wallSide: z
              .enum(["north", "south", "east", "west", "nearest"])
              .optional()
              .describe("Which wall to place against when using 'wall_relative' placement"),
             wallOffsetMm: z
               .number()
               .min(0)
               .optional()
               .default(0)
               .describe("Distance from the wall in mm when using 'wall_relative' placement (>= 0, default 0 means against wall)"),
            positionAlongWall: z
              .number()
              .min(0)
              .max(1)
              .default(0.5)
              .describe("Position along the wall as a ratio (0.0 = start, 0.5 = center, 1.0 = end) for 'wall_relative'"),
            cornerIndex: z
              .number()
              .min(0)
              .max(3)
              .optional()
              .describe("Which corner (0-3, clockwise from top-left) for 'corner' placement"),
             cornerOffsetMm: z
               .number()
               .min(0)
               .optional()
               .default(300)
               .describe("Offset from corner in mm for 'corner' placement (>= 0, default 300mm)"),
             rotation: z
               .number()
               .min(0)
               .max(360)
               .optional()
               .describe("Rotation angle in degrees (0-360). If omitted, auto-calculated based on faceDirection and wall/room orientation."),
            faceDirection: z
              .enum(["wall", "center", "door", "window", "custom"])
              .default("wall")
              .describe("Direction the furniture should face: 'wall' faces the nearest wall, 'center' faces room center, 'door' faces the main door, 'window' faces nearest window, 'custom' uses rotation angle"),
            ensureClearance: z
              .boolean()
              .default(true)
              .describe("Verify minimum clearance around the furniture piece"),
             minClearanceMm: z
               .number()
               .min(0)
               .optional()
               .default(600)
               .describe("Minimum clearance required around this furniture piece in mm (>= 0, default 600mm for comfortable access)"),
          })
        )
        .min(1)
        .describe("Array of furniture pieces to place in the room"),
      validateBoundary: z
        .boolean()
        .default(true)
        .describe("Ensure all furniture is within the room boundary. Set to false to allow placement outside room."),
      levelId: z
        .number()
        .optional()
        .describe("Level ElementId. If omitted, uses the room's level."),
    },
    async (args, extra) => {
      const params = {
        roomId: args.roomId,
        furniture: args.furniture,
        validateBoundary: args.validateBoundary,
        levelId: args.levelId,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          // Use 10 minute timeout for complex furniture placement operations
          // that may involve multiple furniture pieces and boundary validation
          return await revitClient.sendCommand(
            "place_furniture_in_room",
            params,
            600000 // 10 minutes
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
              text: `Place furniture in room failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
