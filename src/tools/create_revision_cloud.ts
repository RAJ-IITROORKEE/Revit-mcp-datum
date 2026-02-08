import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateRevisionCloudTool(server: McpServer) {
  server.tool(
    "create_revision_cloud",
    "Create revision clouds in Revit views to highlight areas of design changes for construction documentation. Revision clouds automatically link to revision schedules on sheets and track design evolution through project phases.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where revision cloud will be created"),
      boundary: z
        .array(
          z.object({
            x: z.number().describe("X coordinate in mm"),
            y: z.number().describe("Y coordinate in mm"),
          })
        )
        .describe("Points defining the revision cloud boundary. Creates cloud arcs around these points."),
      revisionId: z
        .number()
        .optional()
        .describe("ElementId of the revision to associate with this cloud. Uses active revision if not specified."),
      comments: z
        .string()
        .optional()
        .describe("Comments describing the revision (e.g., 'Relocated door per client review')"),
      cloudArcLength: z
        .number()
        .optional()
        .describe("Length of individual cloud arcs in mm. Default uses project standards."),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_revision_cloud", params);
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
              text: `Create revision cloud failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
