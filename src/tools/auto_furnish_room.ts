import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Automatically furnish a room based on room type and design standards.
 * Uses room dimensions, door/window positions, and standard furniture
 * layouts to generate an optimal furniture arrangement.
 */
export function registerAutoFurnishRoomTool(server: McpServer) {
  server.tool(
    "auto_furnish_room",
    `Automatically furnish a room in Revit based on its type, dimensions, and standard design practices. This AI-driven tool analyzes the room's shape, door positions, window locations, and available floor area to generate an optimal furniture layout.

Workflow:
1. Analyzes room geometry (boundary, area, aspect ratio)
2. Identifies door and window positions for circulation/light awareness
3. Selects appropriate furniture from the project's loaded families
4. Calculates optimal placement positions with proper clearances
5. Places all furniture with correct rotation and spacing
6. Returns a summary of placed items and any items that couldn't fit

Supports standard room types:
- Office (single/shared): desk, chair, bookshelf, filing cabinet
- Conference Room: conference table, chairs, credenza, whiteboard area
- Living Room: sofa, coffee table, TV unit, side tables, bookshelf
- Bedroom: bed, nightstands, wardrobe, dresser, desk
- Kitchen: (furniture only, not fixtures) dining table, chairs, island
- Dining Room: dining table, chairs, buffet/sideboard
- Bathroom: (furniture only) vanity, storage cabinet
- Reception/Lobby: reception desk, seating area, coffee table
- Classroom: desks, chairs, teacher's desk, podium
- Library: reading tables, chairs, bookshelves
- Custom: user-defined furniture list`,
    {
      roomId: z
        .number()
        .describe("ElementId of the room to furnish"),
      roomType: z
        .enum([
          "single_office",
          "shared_office",
          "conference_room",
          "living_room",
          "bedroom",
          "master_bedroom",
          "kitchen",
          "dining_room",
          "bathroom",
          "reception",
          "lobby",
          "classroom",
          "library",
          "custom",
        ])
        .describe("Type of room which determines the furniture selection and layout pattern"),
      designStyle: z
        .enum(["modern", "traditional", "minimalist", "corporate", "residential", "industrial"])
        .default("modern")
        .describe("Design style preference which influences furniture selection and spacing"),
      occupancy: z
        .number()
        .default(1)
        .describe("Expected number of occupants (affects number of chairs, desk count, etc.)"),
      customFurnitureList: z
        .array(
          z.object({
            typeId: z.number().describe("FamilySymbol/Type ID of the furniture"),
            quantity: z.number().default(1).describe("Number of this furniture piece to place"),
            priority: z.number().default(5).describe("Placement priority (1=highest, 10=lowest). Higher priority items placed first."),
            preferredWall: z
              .enum(["north", "south", "east", "west", "any"])
              .default("any")
              .describe("Preferred wall for placement"),
            minClearanceMm: z.number().default(600).describe("Minimum clearance around this piece"),
          })
        )
        .optional()
        .describe("Custom furniture list for 'custom' roomType. Overrides automatic selection."),
      furnitureScalePreference: z
        .enum(["compact", "standard", "spacious"])
        .default("standard")
        .describe("Size preference: 'compact' uses smaller furniture for tight spaces, 'standard' for typical rooms, 'spacious' for large rooms with generous spacing"),
      preserveExistingFurniture: z
        .boolean()
        .default(false)
        .describe("Keep existing furniture in the room and work around it"),
      clearExistingFirst: z
        .boolean()
        .default(false)
        .describe("Remove all existing furniture before placing new items"),
      respectCirculation: z
        .boolean()
        .default(true)
        .describe("Maintain clear paths from doors to all areas of the room"),
      minCirculationWidthMm: z
        .number()
        .default(900)
        .describe("Minimum circulation path width in mm"),
      levelId: z
        .number()
        .optional()
        .describe("Level ElementId. Uses room's level if omitted."),
    },
    async (args, extra) => {
      const params = {
        roomId: args.roomId,
        roomType: args.roomType,
        designStyle: args.designStyle,
        occupancy: args.occupancy,
        customFurnitureList: args.customFurnitureList || [],
        furnitureScalePreference: args.furnitureScalePreference,
        preserveExistingFurniture: args.preserveExistingFurniture,
        clearExistingFirst: args.clearExistingFirst,
        respectCirculation: args.respectCirculation,
        minCirculationWidthMm: args.minCirculationWidthMm,
        levelId: args.levelId,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("auto_furnish_room", params);
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
              text: `Auto furnish room failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
