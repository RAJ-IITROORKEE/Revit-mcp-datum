import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateFloorTool(server: McpServer) {
  server.tool(
    "create_floor",
    "Create floor elements in Revit with advanced options including structural floors, sloped floors, and span direction. Supports specifying floor type, boundary profile, level, offset, slope arrow, and structural properties. Use get_available_family_types with categoryList ['OST_Floors'] to discover available floor types first. All units are in millimeters (mm).",
    {
      floors: z
        .array(
          z.object({
            floorTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the floor type. Use get_available_family_types to find available floor types. If omitted, uses the default floor type."
              ),
            levelId: z
              .number()
              .describe(
                "ElementId of the level on which the floor is placed. Use get_levels_list to find available levels."
              ),
            boundary: z
              .union([
                z.array(
                  z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm (default 0)"),
                  })
                ).min(3).describe("Simple array of corner points [{x, y}, ...] forming a closed boundary (minimum 3 points)."),
                z.object({
                  outerLoop: z
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
                      })
                    )
                    .min(3)
                    .describe(
                      "Array of line segments forming the outer boundary. Must form a closed loop (minimum 3 segments)."
                    ),
                  innerLoops: z
                    .array(
                      z.array(
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
                    )
                    .optional()
                    .describe(
                      "Array of inner loops for floor openings/holes. Each inner loop is an array of line segments forming a closed loop."
                    ),
                }),
              ])
              .describe("Floor boundary. Accepts simple point array [{x,y}, ...] or object with outerLoop and optional innerLoops."),
            heightOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Height offset from the level in mm"),
            isStructural: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether this is a structural floor (true) or architectural floor (false)"),
            slopeArrow: z
              .object({
                tailPoint: z.object({
                  x: z.number().describe("X coordinate of slope tail (low point) in mm"),
                  y: z.number().describe("Y coordinate of slope tail in mm"),
                }),
                headPoint: z.object({
                  x: z.number().describe("X coordinate of slope head (high point) in mm"),
                  y: z.number().describe("Y coordinate of slope head in mm"),
                }),
                slopeAngle: z
                  .number()
                  .optional()
                  .describe("Slope angle in degrees. If not provided, calculated from tail/head elevation difference."),
                levelAtTail: z
                  .number()
                  .optional()
                  .describe("Elevation at the tail point in mm"),
                levelAtHead: z
                  .number()
                  .optional()
                  .describe("Elevation at the head point in mm"),
              })
              .optional()
              .describe("Slope arrow definition for creating sloped floors"),
            spanDirection: z
              .number()
              .optional()
              .describe("Span direction angle in degrees (0-360) for structural floors. Defines the direction of structural span."),
            sessionTag: z
              .string()
              .optional()
              .describe("Optional session identifier. Stored as shared parameter DatumSessionTag on the created element. Used for bulk rollback via delete_elements."),
          })
        )
        .min(1)
        .describe("Array of floor definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_floor", params);
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
              text: `Create floor failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
