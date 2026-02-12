import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateRampTool(server: McpServer) {
  server.tool(
    "create_ramp",
    "Create ramp elements in Revit for accessible circulation between levels. Supports specifying ramp type, run path, landings, slope, width, and railing options. Ramps can have multiple runs with intermediate landings for ADA/accessibility compliance. Use get_available_family_types with categoryList ['OST_Ramps'] to discover available ramp types. All units are in millimeters (mm).",
    {
      ramps: z
        .array(
          z.object({
            rampTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the ramp type. Use get_available_family_types with 'OST_Ramps'. If omitted, uses the default ramp type."
              ),
            baseLevelId: z
              .number()
              .describe(
                "ElementId of the base (bottom) level. Use get_levels_list to find available levels."
              ),
            topLevelId: z
              .number()
              .optional()
              .describe(
                "ElementId of the top level. If omitted, uses baseOffset + calculatedHeight."
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
              .describe(
                "Ramp width in mm. Default is typically 1100mm. Minimum for ADA compliance is 915mm (36 inches)."
              ),
            maxSlope: z
              .number()
              .optional()
              .describe(
                "Maximum slope ratio (e.g., 0.083 for 1:12 ADA compliant slope). Expressed as rise/run."
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
                  isCurved: z
                    .boolean()
                    .optional()
                    .default(false)
                    .describe("Whether this run is curved"),
                  centerPoint: z
                    .object({
                      x: z.number().describe("X coordinate of arc center in mm"),
                      y: z.number().describe("Y coordinate of arc center in mm"),
                      z: z.number().optional().default(0).describe("Z coordinate in mm"),
                    })
                    .optional()
                    .describe("Center point for curved runs (required when isCurved is true)"),
                })
              )
              .min(1)
              .describe(
                "Array of ramp run segments. Multiple runs create a multi-segment ramp with automatic landings between runs."
              ),
            landings: z
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
                    .describe("Boundary lines of the landing area (closed loop)"),
                  elevation: z
                    .number()
                    .optional()
                    .describe("Elevation of the landing in mm (relative to base level)"),
                })
              )
              .optional()
              .describe(
                "Custom landing definitions. If omitted, landings are auto-generated between runs."
              ),
            createRailings: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether to automatically create railings on both sides of the ramp"),
            railingTypeId: z
              .number()
              .optional()
              .describe("ElementId of the railing type to use. Only applies when createRailings is true."),
            shapeEditing: z
              .enum(["Straight", "Spiral", "LShape", "UShape"])
              .optional()
              .default("Straight")
              .describe("Overall ramp shape configuration"),
          })
        )
        .min(1)
        .describe("Array of ramp definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_ramp", params);
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
              text: `Create ramp failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
