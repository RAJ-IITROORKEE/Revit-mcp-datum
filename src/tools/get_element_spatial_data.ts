import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Get comprehensive spatial and geometric data for elements.
 * Returns bounding boxes, exact coordinates, dimensions, rotation,
 * connected elements, and room containment info.
 * Essential for accurate AI reasoning about element positions.
 */
export function registerGetElementSpatialDataTool(server: McpServer) {
  server.tool(
    "get_element_spatial_data",
    `Retrieve comprehensive spatial and geometric data for Revit elements. Returns precise coordinates, bounding boxes, dimensions, rotation angles, connected/adjacent elements, and room containment.

IMPORTANT: Use this tool to get ground-truth positional data before making any spatial decisions. This prevents incorrect assumptions about element locations.

Returns for each element:
- elementId, category, familyName, typeName
- boundingBox (min/max XYZ coordinates in mm)
- locationPoint or locationCurve (exact placement coordinates)
- dimensions (width, height, depth in mm)
- rotation (degrees)
- levelId and levelName
- containingRoomId (which room the element is in)
- connectedElementIds (elements touching/connected to this one)
- facingDirection (for doors/windows: which way they face)
- hostElementId (for hosted elements like doors in walls)`,
    {
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Specific element IDs to query. If omitted, uses category/room filters."),
      categories: z
        .array(z.string())
        .optional()
        .describe("Revit categories to query (e.g., ['OST_Walls', 'OST_Doors', 'OST_Furniture', 'OST_Windows', 'OST_Columns'])"),
      roomId: z
        .number()
        .optional()
        .describe("Get spatial data for all elements within a specific room"),
      levelId: z
        .number()
        .optional()
        .describe("Filter elements by level"),
      includeConnections: z
        .boolean()
        .default(true)
        .describe("Include connected/adjacent element IDs in the response"),
      includeHostInfo: z
        .boolean()
        .default(true)
        .describe("Include host element information (e.g., which wall a door belongs to)"),
      includeFacingDirection: z
        .boolean()
        .default(true)
        .describe("Include facing/orientation direction vectors for doors, windows, and furniture"),
      boundingBoxFilter: z
        .object({
          minX: z.number().describe("Minimum X coordinate in mm"),
          minY: z.number().describe("Minimum Y coordinate in mm"),
          maxX: z.number().describe("Maximum X coordinate in mm"),
          maxY: z.number().describe("Maximum Y coordinate in mm"),
        })
        .optional()
        .describe("Only return elements within this 2D bounding box region"),
      limit: z
        .number()
        .default(100)
        .describe("Maximum number of elements to return"),
    },
    async (args, extra) => {
      const params = {
        elementIds: args.elementIds || [],
        categories: args.categories || [],
        roomId: args.roomId,
        levelId: args.levelId,
        includeConnections: args.includeConnections,
        includeHostInfo: args.includeHostInfo,
        includeFacingDirection: args.includeFacingDirection,
        boundingBoxFilter: args.boundingBoxFilter,
        limit: args.limit,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "get_element_spatial_data",
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
              text: `Get element spatial data failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
