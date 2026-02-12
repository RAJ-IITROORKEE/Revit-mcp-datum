import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetElementRelationshipsTool(server: McpServer) {
  server.tool(
    "get_element_relationships",
    "Analyze element relationships and dependencies in Revit. Returns host/hosted relationships (doors in walls, windows in walls, furniture on floors), spatial containment (elements in rooms), level associations, and element dependencies. Essential for LLM to understand model hierarchy before making changes — prevents deleting host elements before hosted elements, understands room containment, and identifies connected elements.",
    {
      elementIds: z
        .array(z.number())
        .min(1)
        .describe("Array of ElementIds to analyze relationships for"),
      relationshipTypes: z
        .array(
          z.enum([
            "Host",
            "Hosted",
            "Room",
            "Level",
            "View",
            "Phase",
            "Workset",
            "Group",
            "Assembly",
            "FromToRoom",
            "ConnectedElements",
            "Dependent",
          ])
        )
        .optional()
        .describe(
          "Types of relationships to retrieve. If omitted, returns all. 'Host' = what this element is hosted on, 'Hosted' = what's hosted on this element, 'Room' = room containment, 'ConnectedElements' = structural connections, 'FromToRoom' = door/window from/to rooms."
        ),
      includeHostChain: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, returns the entire host chain (e.g., window → wall → level)"),
      includeHostedChain: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, returns all elements hosted on this element recursively"),
      includeSpatialNeighbors: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, returns nearby elements in the same room or within specified radius"),
      spatialRadius: z
        .number()
        .optional()
        .describe("Radius in mm for spatial neighbor detection"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_element_relationships", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Get element relationships failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
