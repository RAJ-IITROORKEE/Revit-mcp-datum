import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerUpdateRoomPropertiesTool(server: McpServer) {
  server.tool(
    "update_room_properties",
    "Update properties of existing rooms including name, number, department, occupancy, finishes, and custom parameters. Supports batch updates for efficient room schedule management and space planning modifications.",
    {
      roomId: z
        .number()
        .describe("ElementId of the room to update"),
      roomName: z
        .string()
        .optional()
        .describe("New room name"),
      roomNumber: z
        .string()
        .optional()
        .describe("New room number"),
      department: z
        .string()
        .optional()
        .describe("Department or space type"),
      comments: z
        .string()
        .optional()
        .describe("Comments or notes about the room"),
      occupancy: z
        .number()
        .optional()
        .describe("Occupant load or capacity"),
      baseFinish: z
        .string()
        .optional()
        .describe("Floor finish specification"),
      wallFinish: z
        .string()
        .optional()
        .describe("Wall finish specification"),
      ceilingFinish: z
        .string()
        .optional()
        .describe("Ceiling finish specification"),
      customParameters: z
        .record(z.any())
        .optional()
        .describe("Additional custom parameters as key-value pairs"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("update_room_properties", params);
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
              text: `Update room properties failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
