import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateCeilingTool(server: McpServer) {
  server.tool(
    "create_ceiling",
    "Create ceiling elements in Revit with support for automatic and sketch-based ceilings, grid patterns, bulkheads, and height offsets. Supports specifying ceiling type, boundary profile, level, and offset from level. Use get_available_family_types with categoryList ['OST_Ceilings'] to discover available ceiling types. All units are in millimeters (mm).",
    {
      ceilings: z
        .array(
          z.object({
            ceilingTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the ceiling type. Use get_available_family_types to find available ceiling types. If omitted, uses the default ceiling type."
              ),
            levelId: z
              .number()
              .describe(
                "ElementId of the level for the ceiling. Use get_levels_list to find available levels."
              ),
            boundary: z
              .object({
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
                    "Array of inner loops for ceiling openings (e.g., for light fixtures, HVAC). Each inner loop is an array of line segments forming a closed loop."
                  ),
              })
              .optional()
              .describe(
                "Ceiling boundary definition. If omitted, Revit auto-detects the room boundary (automatic ceiling)."
              ),
            heightOffset: z
              .number()
              .optional()
              .default(0)
              .describe(
                "Height offset from the level in mm. Default ceiling height is typically 2700mm above floor level."
              ),
            roomId: z
              .number()
              .optional()
              .describe(
                "ElementId of the room for automatic ceiling creation. When provided without boundary, the ceiling fills the room boundary automatically."
              ),
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
                  .describe("Slope angle in degrees"),
              })
              .optional()
              .describe("Slope arrow definition for creating sloped ceilings"),
            bulkhead: z
              .object({
                enabled: z.boolean().describe("Whether to create a bulkhead (dropped ceiling section)"),
                dropHeight: z
                  .number()
                  .optional()
                  .describe("How far the bulkhead drops below the main ceiling in mm"),
                boundary: z
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
                    })
                  )
                  .optional()
                  .describe("Boundary of the bulkhead area"),
              })
              .optional()
              .describe("Bulkhead (dropped ceiling) configuration"),
          })
        )
        .min(1)
        .describe("Array of ceiling definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_ceiling", params);
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
              text: `Create ceiling failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
