import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateScopeBoxTool(server: McpServer) {
  server.tool(
    "create_scope_box",
    "Create scope boxes in Revit to define and control the extents of multiple views simultaneously. Scope boxes are 3D boundaries that can be applied to floor plans, ceiling plans, and sections, ensuring consistent view cropping across related drawings.",
    {
      scopeBoxName: z
        .string()
        .describe("Name for the scope box (e.g., 'Building A', 'Floor 1-3', 'Core Area')"),
      boundingBox: z
        .object({
          min: z.object({
            x: z.number().describe("Minimum X coordinate in mm"),
            y: z.number().describe("Minimum Y coordinate in mm"),
            z: z.number().describe("Minimum Z coordinate in mm"),
          }),
          max: z.object({
            x: z.number().describe("Maximum X coordinate in mm"),
            y: z.number().describe("Maximum Y coordinate in mm"),
            z: z.number().describe("Maximum Z coordinate in mm"),
          }),
        })
        .describe("3D bounding box defining the scope box extents"),
      applyToViews: z
        .array(z.number())
        .optional()
        .describe("Array of view ElementIds to apply this scope box to. Views will crop to scope box extents."),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_scope_box", params);
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
              text: `Create scope box failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
