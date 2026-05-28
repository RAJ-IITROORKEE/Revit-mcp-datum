import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerDeleteElementsTool(server: McpServer) {
  server.tool(
    "delete_elements",
    "Delete one or more Revit elements by their element IDs or by sessionTag. Used for rollback after a failed agent session or bulk cleanup. Returns count of successfully deleted elements and list of failed element IDs with reasons.",
    {
      elementIds: z
        .array(z.union([z.string(), z.number()]))
        .optional()
        .describe(
          "Array of Revit element IDs to delete (string or integer ElementId values). Get these from create_wall, place_component, create_room, create_floor, create_ceiling responses. Mutually exclusive with sessionTag."
        ),
      sessionTag: z
        .string()
        .optional()
        .describe(
          "Optional: delete all elements tagged with this sessionTag parameter instead of providing elementIds. Use when you want to undo an entire session. Mutually exclusive with elementIds."
        ),
    },
    async (args) => {
      // Validate that at least one of elementIds or sessionTag is provided
      if (!args.elementIds && !args.sessionTag) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Either elementIds or sessionTag must be provided",
                deleted: 0,
                failed: [],
              }, null, 2),
            },
          ],
        };
      }

      // Validate mutual exclusivity
      if (args.elementIds && args.sessionTag) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "elementIds and sessionTag are mutually exclusive - provide only one",
                deleted: 0,
                failed: [],
              }, null, 2),
            },
          ],
        };
      }

      const params = {
        elementIds: (args.elementIds || []).map((id) => String(id)),
        sessionTag: args.sessionTag || "",
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("delete_elements", params);
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
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                deleted: 0,
                failed: (args.elementIds || []).map((id) => String(id)),
              }, null, 2),
            },
          ],
        };
      }
    }
  );
}
