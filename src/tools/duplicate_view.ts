import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerDuplicateViewTool(server: McpServer) {
  server.tool(
    "duplicate_view",
    "Duplicate an existing view in Revit with options for duplication type. Can create duplicates, duplicates with detailing, or duplicates as dependent views. Useful for creating multiple variations of a view with different filters or annotations.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view to duplicate"),
      newViewName: z
        .string()
        .describe("Name for the duplicated view"),
      duplicateOption: z
        .enum(["Duplicate", "WithDetailing", "AsDependent"])
        .default("Duplicate")
        .describe("Duplication option. Duplicate: creates a copy of the view without annotation elements. WithDetailing: includes all annotation elements (dimensions, tags, text). AsDependent: creates a dependent view linked to the parent view."),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("duplicate_view", params);
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
              text: `Duplicate view failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
