import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateMaskingRegionTool(server: McpServer) {
  server.tool(
    "create_masking_region",
    "Create masking regions in Revit views to hide portions of the drawing with an opaque white region. Useful for covering unwanted elements in specific views without deleting them, creating clean detail drawings, and masking background information.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where masking region will be created"),
      boundary: z
        .array(
          z.object({
            x: z.number().describe("X coordinate in mm"),
            y: z.number().describe("Y coordinate in mm"),
          })
        )
        .describe("Points defining a closed boundary. Last point connects to first point."),
      maskingRegionTypeId: z
        .number()
        .optional()
        .describe("ElementId of masking region type (controls line style)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_masking_region", params);
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
              text: `Create masking region failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
