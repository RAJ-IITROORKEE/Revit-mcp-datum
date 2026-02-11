import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Auto-align misaligned elements in the model.
 * Detects and corrects small misalignments in walls, columns,
 * grids, doors, windows, and furniture.
 */
export function registerAutoAlignElementsTool(server: McpServer) {
  server.tool(
    "auto_align_elements",
    `Automatically detect and correct misaligned elements in Revit. This tool finds elements that are slightly off-grid, not quite parallel, or have small positional errors, and snaps them to proper alignment.

Alignment operations:
- WALLS: Align wall endpoints to nearest grid, make near-parallel walls truly parallel, straighten slightly curved walls
- COLUMNS: Snap columns to grid intersections, align column rows
- DOORS/WINDOWS: Center doors/windows in wall segments, align across rooms
- FURNITURE: Align to walls, align to each other, snap to grid
- GRIDS: Make near-orthogonal grids truly orthogonal, equalize spacing
- ANNOTATIONS: Align dimension strings, align text notes, align tags

Detection thresholds are configurable - elements within the tolerance are auto-corrected, those beyond are flagged for manual review.

Returns:
- corrected: Array of elements that were auto-aligned with before/after coordinates
- flagged: Array of elements beyond tolerance that need manual review
- unchanged: Count of elements already properly aligned`,
    {
      alignmentMode: z
        .enum(["all", "walls", "columns", "doors_windows", "furniture", "grids", "annotations", "custom"])
        .default("all")
        .describe("Which element categories to check and align"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Specific elements to align. If omitted, checks all elements matching alignmentMode."),
      levelId: z
        .number()
        .optional()
        .describe("Limit alignment to a specific level"),
      roomId: z
        .number()
        .optional()
        .describe("Limit alignment to elements within a specific room"),
      toleranceMm: z
        .number()
        .default(10)
        .describe("Alignment tolerance in mm. Elements within this distance of alignment are auto-corrected. Default: 10mm."),
      maxCorrectionMm: z
        .number()
        .default(50)
        .describe("Maximum correction distance in mm. Elements needing more correction are flagged instead of auto-corrected. Default: 50mm."),
      alignToGrid: z
        .boolean()
        .default(true)
        .describe("Snap elements to the nearest grid line when within tolerance"),
      alignToWalls: z
        .boolean()
        .default(true)
        .describe("Align furniture and fixtures to nearby walls"),
      makeParallel: z
        .boolean()
        .default(true)
        .describe("Make near-parallel walls/elements truly parallel"),
      makeOrthogonal: z
        .boolean()
        .default(true)
        .describe("Make near-orthogonal elements truly perpendicular (90 degrees)"),
      equalizeSpacing: z
        .boolean()
        .default(false)
        .describe("Equalize spacing between evenly-distributed elements (e.g., column rows, grid lines)"),
      centerInWall: z
        .boolean()
        .default(true)
        .describe("Center doors and windows in their wall segments when nearly centered"),
      applyCorrections: z
        .boolean()
        .default(false)
        .describe("If true, directly apply corrections. If false (recommended), returns suggestions only for review."),
    },
    async (args, extra) => {
      const params = {
        alignmentMode: args.alignmentMode,
        elementIds: args.elementIds || [],
        levelId: args.levelId,
        roomId: args.roomId,
        toleranceMm: args.toleranceMm,
        maxCorrectionMm: args.maxCorrectionMm,
        options: {
          alignToGrid: args.alignToGrid,
          alignToWalls: args.alignToWalls,
          makeParallel: args.makeParallel,
          makeOrthogonal: args.makeOrthogonal,
          equalizeSpacing: args.equalizeSpacing,
          centerInWall: args.centerInWall,
        },
        applyCorrections: args.applyCorrections,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "auto_align_elements",
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
              text: `Auto align elements failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
