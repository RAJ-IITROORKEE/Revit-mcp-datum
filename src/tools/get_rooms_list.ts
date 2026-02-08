import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetRoomsListTool(server: McpServer) {
  server.tool(
    "get_rooms_list",
    "Get a list of all rooms in the Revit project with detailed information including name, number, area, perimeter, volume, level, and department. Supports filtering by level, phase, and area ranges. Essential for space programming and area analysis.",
    {
      levelId: z
        .number()
        .optional()
        .describe("Filter rooms by specific level ElementId"),
      phaseId: z
        .number()
        .optional()
        .describe("Filter rooms by specific phase ElementId"),
      minArea: z
        .number()
        .optional()
        .describe("Minimum room area in square millimeters"),
      maxArea: z
        .number()
        .optional()
        .describe("Maximum room area in square millimeters"),
      searchName: z
        .string()
        .optional()
        .describe("Filter rooms by name containing this text (case-insensitive)"),
      searchNumber: z
        .string()
        .optional()
        .describe("Filter rooms by number containing this text (case-insensitive)"),
      includeUnplaced: z
        .boolean()
        .default(false)
        .describe("Include unplaced rooms (rooms not bounded by walls)"),
      includeRedundant: z
        .boolean()
        .default(false)
        .describe("Include redundant rooms (rooms that have been replaced by room separation lines)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_rooms_list", params);
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
              text: `Get rooms list failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
