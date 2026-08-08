import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedMutationToolResult, normalizedToolCatch } from "./_result.js";

export function registerCreateTagTool(server: McpServer) {
  server.tool(
    "create_tag",
    "Create tags for Revit elements including room tags, door tags, window tags, and generic element tags. Tags display element properties and identifiers in views. Supports automatic and manual tag placement with leader options.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where the tag will be placed"),
      elementId: z
        .number()
        .describe("ElementId of the element to tag (door, window, wall, room, etc.)"),
      tagMode: z
        .enum(["Horizontal", "Vertical", "Leader", "Auto"])
        .default("Auto")
        .describe("Tag orientation mode. Horizontal: horizontal text. Vertical: vertical text. Leader: tag with leader line. Auto: automatic orientation based on element."),
      location: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .describe("Required tag placement location in mm."),
      hasLeader: z
        .boolean()
        .default(false)
        .describe("Add a leader line from tag to element"),
      tagTypeId: z
        .number()
        .optional()
        .describe("ElementId of specific tag type to use (controls tag appearance and properties displayed)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_tag", params);
        });

        return normalizedMutationToolResult("create_tag", response);
      } catch (error) {
        return normalizedToolCatch("create_tag", error);
      }
    }
  );
}
