import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateStairsTool(server: McpServer) {
  server.tool(
    "create_stairs",
    "Create stair elements in Revit connecting two levels. Supports straight, L-shaped, U-shaped, spiral, and custom stairs with configurable runs, landings, risers, treads, and railing options. Stairs automatically calculate riser count and tread depth based on floor-to-floor height. Use get_available_family_types with categoryList ['OST_Stairs'] to discover available stair types. All units are in millimeters (mm).",
    {
      stairs: z
        .array(
          z.object({
            stairTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the stair type. Use get_available_family_types with 'OST_Stairs'. If omitted, uses the default stair type."
              ),
            baseLevelId: z
              .number()
              .describe(
                "ElementId of the base (bottom) level. Use get_levels_list to find available levels."
              ),
            topLevelId: z
              .number()
              .describe(
                "ElementId of the top level the stairs connect to."
              ),
            baseOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset from the base level in mm"),
            topOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset from the top level in mm"),
            width: z
              .number()
              .optional()
              .describe("Stair width in mm. Default is typically 900mm."),
            desiredRiserHeight: z
              .number()
              .optional()
              .describe(
                "Desired riser height in mm (e.g., 175mm). Revit adjusts to evenly divide the floor-to-floor height."
              ),
            desiredTreadDepth: z
              .number()
              .optional()
              .describe(
                "Desired tread depth (going) in mm (e.g., 280mm). Minimum 250mm for building code compliance."
              ),
            actualNumberOfRisers: z
              .number()
              .optional()
              .describe(
                "Desired number of risers. If specified, Revit calculates riser height to match. Otherwise auto-calculated from desiredRiserHeight."
              ),
            stairShape: z
              .enum(["Straight", "LShape", "UShape", "Spiral", "ThreeRun"])
              .optional()
              .default("Straight")
              .describe(
                "Overall stair shape: 'Straight' for single-run, 'LShape' for 90-degree turn, 'UShape' for 180-degree turn, 'Spiral' for helical, 'ThreeRun' for two landings."
              ),
            runs: z
              .array(
                z.object({
                  startPoint: z.object({
                    x: z.number().describe("X coordinate of run start in mm"),
                    y: z.number().describe("Y coordinate of run start in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm"),
                  }),
                  endPoint: z.object({
                    x: z.number().describe("X coordinate of run end in mm"),
                    y: z.number().describe("Y coordinate of run end in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm"),
                  }),
                  runWidth: z
                    .number()
                    .optional()
                    .describe("Override width for this specific run in mm"),
                  numberOfRisers: z
                    .number()
                    .optional()
                    .describe("Number of risers in this specific run"),
                  isCurved: z
                    .boolean()
                    .optional()
                    .default(false)
                    .describe("Whether this run follows a curved path"),
                  centerPoint: z
                    .object({
                      x: z.number().describe("X coordinate of arc center in mm"),
                      y: z.number().describe("Y coordinate of arc center in mm"),
                      z: z.number().optional().default(0).describe("Z coordinate in mm"),
                    })
                    .optional()
                    .describe("Center point for spiral/curved runs"),
                  innerRadius: z
                    .number()
                    .optional()
                    .describe("Inner radius for spiral stairs in mm"),
                })
              )
              .optional()
              .describe(
                "Custom run definitions. If omitted, runs are auto-generated based on stairShape, location, and floor-to-floor height."
              ),
            location: z
              .object({
                x: z.number().describe("X coordinate of stair insertion point in mm"),
                y: z.number().describe("Y coordinate of stair insertion point in mm"),
                z: z.number().optional().default(0).describe("Z coordinate in mm"),
              })
              .optional()
              .describe(
                "Insertion point for auto-generated stairs (when runs are not specified). Bottom-center of the first run."
              ),
            direction: z
              .number()
              .optional()
              .default(0)
              .describe("Direction angle in degrees for auto-generated stairs (0 = positive Y direction)"),
            landingType: z
              .enum(["Automatic", "Custom"])
              .optional()
              .default("Automatic")
              .describe(
                "How landings are created: 'Automatic' lets Revit generate landings between runs, 'Custom' uses custom landing definitions."
              ),
            customLandings: z
              .array(
                z.object({
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
                    .min(3)
                    .describe("Boundary of the landing (closed loop)"),
                  elevation: z
                    .number()
                    .optional()
                    .describe("Landing elevation relative to base level in mm"),
                })
              )
              .optional()
              .describe("Custom landing definitions (only used when landingType is 'Custom')"),
            createRailings: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether to automatically create railings on both sides"),
            railingTypeId: z
              .number()
              .optional()
              .describe("ElementId of the railing type. Only applies when createRailings is true."),
            supportType: z
              .enum(["None", "Stringer", "Carriage"])
              .optional()
              .describe("Type of structural support for the stairs"),
            rightSupport: z
              .enum(["None", "Stringer", "Carriage"])
              .optional()
              .describe("Support type for the right side"),
            leftSupport: z
              .enum(["None", "Stringer", "Carriage"])
              .optional()
              .describe("Support type for the left side"),
          })
        )
        .min(1)
        .describe("Array of stair definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_stairs", params);
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
              text: `Create stairs failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
