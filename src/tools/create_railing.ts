import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateRailingTool(server: McpServer) {
  server.tool(
    "create_railing",
    "Create railing elements in Revit along paths, on stairs, on ramps, or along floor/balcony edges. Supports specifying railing type, path geometry, host element (stairs/ramp), level, and offset. Railings can be placed as standalone path-based elements or hosted on stairs and ramps. Use get_available_family_types with categoryList ['OST_StairsRailing'] to discover available railing types. All units are in millimeters (mm).",
    {
      railings: z
        .array(
          z.object({
            railingTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the railing type. Use get_available_family_types with 'OST_StairsRailing'. If omitted, uses the default railing type."
              ),
            placementMode: z
              .enum(["Path", "HostedOnStairs", "HostedOnRamp", "OnFloorEdge"])
              .describe(
                "How to place the railing: 'Path' for freestanding along a path, 'HostedOnStairs' to attach to stairs, 'HostedOnRamp' to attach to a ramp, 'OnFloorEdge' along a floor/slab edge."
              ),
            path: z
              .array(
                z.object({
                  startPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm (default 0)"),
                  }),
                  endPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm (default 0)"),
                  }),
                  isCurved: z
                    .boolean()
                    .optional()
                    .default(false)
                    .describe("Whether this segment is a curve"),
                  centerPoint: z
                    .object({
                      x: z.number().describe("X coordinate of arc center in mm"),
                      y: z.number().describe("Y coordinate of arc center in mm"),
                      z: z.number().optional().default(0).describe("Z coordinate in mm"),
                    })
                    .optional()
                    .describe("Center point for curved segments (required when isCurved is true)"),
                })
              )
              .optional()
              .describe(
                "Path segments for the railing. Required when placementMode is 'Path' or 'OnFloorEdge'. Each segment defines a section of the railing path."
              ),
            hostElementId: z
              .number()
              .optional()
              .describe(
                "ElementId of the host element (stairs or ramp). Required when placementMode is 'HostedOnStairs' or 'HostedOnRamp'."
              ),
            levelId: z
              .number()
              .optional()
              .describe(
                "ElementId of the level for the railing. Use get_levels_list to find available levels."
              ),
            offset: z
              .number()
              .optional()
              .default(0)
              .describe("Horizontal offset from the path/edge in mm. Positive = outward, negative = inward."),
            flipped: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether to flip the railing to the opposite side of the path"),
            side: z
              .enum(["Left", "Right", "Both"])
              .optional()
              .describe(
                "Which side to place the railing on when hosted on stairs/ramp. 'Both' creates railings on both sides."
              ),
          })
        )
        .min(1)
        .describe("Array of railing definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_railing", params);
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
              text: `Create railing failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
