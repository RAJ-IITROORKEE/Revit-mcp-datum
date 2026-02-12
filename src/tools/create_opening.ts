import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateOpeningTool(server: McpServer) {
  server.tool(
    "create_opening",
    "Create openings (rectangular, circular, or custom-shaped holes) in floors, walls, roofs, and ceilings in Revit. Supports wall openings, shaft openings (through multiple floors), dormer openings in roofs, and vertical/horizontal openings in slabs. Essential for creating door/window rough openings, mechanical shafts, skylights, and floor penetrations. All units are in millimeters (mm).",
    {
      openings: z
        .array(
          z.object({
            openingType: z
              .enum(["Wall", "Floor", "Roof", "Ceiling", "Shaft"])
              .describe(
                "Type of opening: 'Wall' for wall openings, 'Floor' for floor penetrations, 'Roof' for roof openings, 'Ceiling' for ceiling openings, 'Shaft' for vertical shaft through multiple floors."
              ),
            hostElementId: z
              .number()
              .optional()
              .describe(
                "ElementId of the host element (wall, floor, roof, or ceiling) to cut the opening in. Required for Wall, Floor, Roof, and Ceiling types."
              ),
            boundary: z
              .array(
                z.object({
                  startPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm"),
                  }),
                  endPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm"),
                  }),
                })
              )
              .min(3)
              .optional()
              .describe(
                "Custom boundary lines for the opening (closed loop). Used for non-rectangular openings."
              ),
            rectangularOpening: z
              .object({
                centerPoint: z.object({
                  x: z.number().describe("X coordinate of center in mm"),
                  y: z.number().describe("Y coordinate of center in mm"),
                  z: z.number().optional().default(0).describe("Z coordinate in mm"),
                }),
                width: z.number().describe("Width of the opening in mm"),
                height: z.number().describe("Height of the opening in mm"),
                sillHeight: z
                  .number()
                  .optional()
                  .describe(
                    "Height from floor to bottom of opening in mm (for wall openings, e.g., window sill height)"
                  ),
              })
              .optional()
              .describe(
                "Simplified rectangular opening definition. Use either this OR boundary, not both."
              ),
            circularOpening: z
              .object({
                centerPoint: z.object({
                  x: z.number().describe("X coordinate of center in mm"),
                  y: z.number().describe("Y coordinate of center in mm"),
                  z: z.number().optional().default(0).describe("Z coordinate in mm"),
                }),
                radius: z.number().describe("Radius of the circular opening in mm"),
              })
              .optional()
              .describe("Circular opening definition (e.g., for circular ducts, pipes)"),
            shaftConfig: z
              .object({
                baseLevelId: z
                  .number()
                  .describe("ElementId of the base level for the shaft"),
                topLevelId: z
                  .number()
                  .describe("ElementId of the top level for the shaft"),
                baseOffset: z
                  .number()
                  .optional()
                  .default(0)
                  .describe("Offset from base level in mm"),
                topOffset: z
                  .number()
                  .optional()
                  .default(0)
                  .describe("Offset from top level in mm"),
                symbolicRepresentation: z
                  .boolean()
                  .optional()
                  .default(true)
                  .describe("Whether to show symbolic representation in plan views"),
              })
              .optional()
              .describe("Configuration for shaft openings that span multiple levels"),
          })
        )
        .min(1)
        .describe("Array of opening definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_opening", params);
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
              text: `Create opening failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
