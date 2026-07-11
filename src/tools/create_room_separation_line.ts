import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedMutationToolResult, normalizedToolCatch } from "./_result.js";

export function registerCreateRoomSeparationLineTool(server: McpServer) {
  server.tool(
    "create_room_separation_line",
    "Create room separation lines in Revit to define room boundaries where walls don't exist. Essential for creating rooms in open plan areas or defining virtual boundaries. Room separation lines are view-specific and help control room extent calculations.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where room separation lines will be created"),
      lines: z
        .array(
          z.object({
            startPoint: z.object({
              x: z.number().describe("X coordinate of start point in mm"),
              y: z.number().describe("Y coordinate of start point in mm"),
            }),
            endPoint: z.object({
              x: z.number().describe("X coordinate of end point in mm"),
              y: z.number().describe("Y coordinate of end point in mm"),
            }),
          })
        )
        .min(1)
        .describe("Array of line segments to create as room separation lines"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "create_room_separation_line",
            params
          );
        });

        return normalizedMutationToolResult("create_room_separation_line", response);
      } catch (error) {
        return normalizedToolCatch("create_room_separation_line", error);
      }
    }
  );
}
