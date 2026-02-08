import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateReferencePlaneTool(server: McpServer) {
  server.tool(
    "create_reference_plane",
    "Create reference planes in Revit for defining work planes, alignment references, and parametric relationships. Reference planes are essential for family creation and complex geometric relationships. Can be named for use in dimensions and constraints.",
    {
      bubbleEnd: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .describe("First endpoint of the reference plane"),
      freeEnd: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .describe("Second endpoint of the reference plane"),
      cutVec: z
        .object({
          x: z.number().describe("X component of normal vector"),
          y: z.number().describe("Y component of normal vector"),
          z: z.number().describe("Z component of normal vector"),
        })
        .describe("Normal vector defining the plane orientation"),
      viewId: z
        .number()
        .describe("ElementId of the view where the reference plane will be visible and created"),
      name: z
        .string()
        .optional()
        .describe("Optional name for the reference plane (useful for dimensioning and identification)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_reference_plane", params);
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
              text: `Create reference plane failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
