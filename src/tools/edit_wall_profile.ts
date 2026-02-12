import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerEditWallProfileTool(server: McpServer) {
  server.tool(
    "edit_wall_profile",
    "Edit wall profiles in Revit to create non-rectangular wall shapes. Supports parapets (wall extending above roof), stepped walls, walls with arched openings, tapered walls, and custom-shaped wall profiles. This modifies the wall's elevation profile (the 2D shape visible in section/elevation views) without changing the wall type. Essential for creating architecturally shaped walls. All units are in millimeters (mm).",
    {
      wallId: z
        .number()
        .describe("ElementId of the wall to edit the profile of"),
      viewId: z
        .number()
        .optional()
        .describe("ElementId of an elevation or section view to perform the edit in. If omitted, uses current view."),
      profile: z
        .array(
          z.object({
            startPoint: z.object({
              x: z.number().describe("X coordinate (horizontal position along wall) in mm"),
              y: z.number().describe("Y coordinate (vertical height) in mm"),
            }),
            endPoint: z.object({
              x: z.number().describe("X coordinate in mm"),
              y: z.number().describe("Y coordinate in mm"),
            }),
            isCurved: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether this segment is a curve (arc)"),
            centerPoint: z
              .object({
                x: z.number().describe("X coordinate of arc center"),
                y: z.number().describe("Y coordinate of arc center"),
              })
              .optional()
              .describe("Center point for curved segments"),
          })
        )
        .min(3)
        .describe(
          "Profile lines defining the wall shape in elevation (closed loop). The X axis runs along the wall length, Y axis is vertical height. Must form a closed loop."
        ),
      openings: z
        .array(
          z.object({
            loop: z
              .array(
                z.object({
                  startPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                  }),
                  endPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                  }),
                  isCurved: z.boolean().optional().default(false),
                  centerPoint: z
                    .object({
                      x: z.number().describe("X center of arc"),
                      y: z.number().describe("Y center of arc"),
                    })
                    .optional(),
                })
              )
              .min(3)
              .describe("Closed loop defining the opening shape"),
          })
        )
        .optional()
        .describe("Additional openings to cut within the wall profile (arched openings, custom shapes)"),
      resetToDefault: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, resets the wall profile to its default rectangular shape. Ignores profile and openings."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("edit_wall_profile", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Edit wall profile failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
