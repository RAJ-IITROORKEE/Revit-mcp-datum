import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerBatchTagElementsTool(server: McpServer) {
  server.tool(
    "batch_tag_elements",
    "Automatically tag multiple elements in a view at once. Efficiently tags all elements of specified categories (doors, windows, rooms, etc.) in the current or specified view. Includes options for tag orientation and leader visibility.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where tags will be placed"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Array of specific element IDs to tag. If not provided, tags all taggable elements in the view."),
      categoryFilter: z
        .array(z.string())
        .optional()
        .describe("Filter by element categories (e.g., ['OST_Doors', 'OST_Windows', 'OST_Rooms']). If not provided, tags all categories."),
      hasLeader: z
        .boolean()
        .default(false)
        .describe("Add leader lines to all tags"),
      tagMode: z
        .enum(["Horizontal", "Vertical", "Auto"])
        .default("Auto")
        .describe("Orientation mode for all tags"),
      skipExistingTags: z
        .boolean()
        .default(true)
        .describe("Skip elements that already have tags in the view"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("batch_tag_elements", params);
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
              text: `Batch tag elements failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
