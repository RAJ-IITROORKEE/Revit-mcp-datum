import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Validate spatial relationships between elements.
 * Checks clearances, adjacencies, overlaps, and accessibility compliance.
 */
export function registerValidateSpatialRelationshipsTool(server: McpServer) {
  server.tool(
    "validate_spatial_relationships",
    `Validate spatial relationships between Revit elements. Checks for proper clearances around doors and windows, furniture spacing, wall-to-wall adjacencies, element overlaps, and accessibility compliance.

Use this tool to verify that a design meets spatial requirements BEFORE and AFTER making changes. Returns a list of violations with exact coordinates, affected element IDs, required vs actual measurements, and severity levels.

Validation checks include:
- Door swing clearances (both sides)
- Window sill heights and accessibility
- Furniture minimum spacing from walls and other furniture
- Corridor and passage width minimums
- Room-to-room adjacency requirements
- Element overlap/intersection detection
- Stair and ramp compliance
- ADA/accessibility clearance zones`,
    {
      validationType: z
        .enum(["all", "clearances", "overlaps", "adjacencies", "accessibility", "furniture_spacing"])
        .default("all")
        .describe("Type of validation to perform"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Specific elements to validate. If omitted, validates all elements in scope."),
      roomIds: z
        .array(z.number())
        .optional()
        .describe("Rooms to validate. If omitted, validates all rooms."),
      levelId: z
        .number()
        .optional()
        .describe("Limit validation to a specific level"),
      clearanceRules: z
        .object({
          doorFrontClearanceMm: z.number().default(1200).describe("Required clearance in front of doors (mm)"),
          doorBackClearanceMm: z.number().default(900).describe("Required clearance behind doors (mm)"),
          doorSideClearanceMm: z.number().default(300).describe("Required clearance on hinge side of doors (mm)"),
          windowMinSillHeightMm: z.number().default(900).describe("Minimum window sill height (mm)"),
          furnitureToWallMinMm: z.number().default(50).describe("Minimum gap between furniture and walls (mm)"),
          furnitureToFurnitureMinMm: z.number().default(600).describe("Minimum gap between furniture pieces (mm)"),
          passageMinWidthMm: z.number().default(900).describe("Minimum passage width between obstacles (mm)"),
          corridorMinWidthMm: z.number().default(1200).describe("Minimum corridor width (mm)"),
          wheelchairTurnRadiusMm: z.number().default(1500).describe("Wheelchair turning radius requirement (mm)"),
        })
        .optional()
        .describe("Custom clearance rules. Uses defaults if not specified."),
      adjacencyRequirements: z
        .array(
          z.object({
            roomType1: z.string().describe("First room type/name (e.g., 'Kitchen')"),
            roomType2: z.string().describe("Second room type/name (e.g., 'Dining Room')"),
            shouldBeAdjacent: z.boolean().describe("Whether these rooms should be adjacent"),
            maxDistanceMm: z.number().optional().describe("Maximum acceptable distance between rooms (mm)"),
          })
        )
        .optional()
        .describe("Room adjacency requirements to validate"),
    },
    async (args, extra) => {
      const params = {
        validationType: args.validationType,
        elementIds: args.elementIds || [],
        roomIds: args.roomIds || [],
        levelId: args.levelId,
        clearanceRules: args.clearanceRules || {
          doorFrontClearanceMm: 1200,
          doorBackClearanceMm: 900,
          doorSideClearanceMm: 300,
          windowMinSillHeightMm: 900,
          furnitureToWallMinMm: 50,
          furnitureToFurnitureMinMm: 600,
          passageMinWidthMm: 900,
          corridorMinWidthMm: 1200,
          wheelchairTurnRadiusMm: 1500,
        },
        adjacencyRequirements: args.adjacencyRequirements || [],
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "validate_spatial_relationships",
            params
          );
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
              text: `Validate spatial relationships failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
