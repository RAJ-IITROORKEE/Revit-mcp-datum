import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateRoomTool(server: McpServer) {
  server.tool(
    "create_room",
    "Create rooms in Revit for space planning and area documentation. Rooms are bounded by walls, room separation lines, and other room-bounding elements. Automatically calculates area and can store custom properties like room name, number, department, and finish specifications.",
    {
      levelId: z
        .number()
        .describe("ElementId of the level where the room will be placed"),
      location: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
        })
        .describe("Point inside the desired room boundary (must be within closed boundaries)"),
      roomName: z
        .string()
        .optional()
        .describe("Name for the room (e.g., 'Conference Room', 'Office', 'Lobby')"),
      roomNumber: z
        .string()
        .optional()
        .describe("Room number/identifier (e.g., '101', 'A-203', 'CR-01')"),
      phaseId: z
        .number()
        .optional()
        .describe("ElementId of the phase for the room. Uses current project phase if not specified."),
      sessionTag: z
        .string()
        .optional()
        .describe("Optional session identifier. Stored as shared parameter DatumSessionTag on the created element. Used for bulk rollback via delete_elements."),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_room", params);
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
              text: `Create room failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
