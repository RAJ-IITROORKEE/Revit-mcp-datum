import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateRoofTool(server: McpServer) {
  server.tool(
    "create_roof",
    "Create roof elements in Revit with support for footprint roofs (by boundary), extrusion roofs (by profile), and flat roofs. Supports specifying roof type, slope, level, overhang, fascia, soffit, and gutter options. Use get_available_family_types with categoryList ['OST_Roofs'] to discover available roof types. All units are in millimeters (mm).",
    {
      roofs: z
        .array(
          z.object({
            roofTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the roof type. Use get_available_family_types with 'OST_Roofs'. If omitted, uses the default roof type."
              ),
            roofCreationMethod: z
              .enum(["Footprint", "Extrusion", "FaceBase"])
              .describe(
                "Method to create the roof: 'Footprint' creates roof by boundary with slope, 'Extrusion' creates roof by extruding a profile, 'FaceBase' creates roof on a mass face."
              ),
            levelId: z
              .number()
              .describe(
                "ElementId of the level for the roof base. Use get_levels_list to find available levels."
              ),
            heightOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Height offset from the level in mm"),
            boundary: z
              .union([
                z.array(
                  z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm (default 0)"),
                  })
                ).min(3).describe("Simple array of corner points [{x, y}, ...] forming a closed roof footprint (minimum 3 points)."),
                z.object({
                  outerLoop: z
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
                        definesSlope: z
                          .boolean()
                          .optional()
                          .default(true)
                          .describe(
                            "Whether this boundary edge defines a slope. If false, the edge is a gable (vertical) end."
                          ),
                        slopeAngle: z
                          .number()
                          .optional()
                          .describe(
                            "Slope angle in degrees from horizontal for this edge (e.g., 30 degrees). Overrides the default slope."
                          ),
                        overhang: z
                          .number()
                          .optional()
                          .describe("Roof overhang beyond this edge in mm"),
                      })
                    )
                    .min(3)
                    .describe(
                      "Array of boundary line segments forming the roof footprint. Must form a closed loop."
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
                    .describe("Array of inner loops for roof openings (skylights, shafts)"),
                }),
              ])
              .optional()
              .describe("Roof boundary. Accepts simple point array [{x,y}, ...] or object with outerLoop. For 'Footprint' method."),
            extrusionProfile: z
              .object({
                profileLines: z
                  .array(
                    z.object({
                      startPoint: z.object({
                        x: z.number().describe("X coordinate in mm (profile plane)"),
                        y: z.number().describe("Y coordinate in mm (elevation)"),
                      }),
                      endPoint: z.object({
                        x: z.number().describe("X coordinate in mm"),
                        y: z.number().describe("Y coordinate in mm"),
                      }),
                    })
                  )
                  .min(1)
                  .describe("Profile lines defining the roof cross-section"),
                extrusionStart: z.number().describe("Start point of extrusion along reference plane in mm"),
                extrusionEnd: z.number().describe("End point of extrusion along reference plane in mm"),
                referencePlaneLine: z
                  .object({
                    startPoint: z.object({
                      x: z.number().describe("X coordinate in mm"),
                      y: z.number().describe("Y coordinate in mm"),
                    }),
                    endPoint: z.object({
                      x: z.number().describe("X coordinate in mm"),
                      y: z.number().describe("Y coordinate in mm"),
                    }),
                  })
                  .describe("Reference plane line along which the profile is extruded"),
              })
              .optional()
              .describe("Extrusion profile definition for 'Extrusion' method"),
            defaultSlopeAngle: z
              .number()
              .optional()
              .describe(
                "Default slope angle in degrees for all boundary edges that define slope (for Footprint roofs)"
              ),
            defaultOverhang: z
              .number()
              .optional()
              .describe("Default roof overhang in mm applied to all edges"),
            cutoffLevelId: z
              .number()
              .optional()
              .describe("ElementId of the cutoff level (for multi-story roofs that are cut by a level)"),
          })
        )
        .min(1)
        .describe("Array of roof definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_roof", params);
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
              text: `Create roof failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
