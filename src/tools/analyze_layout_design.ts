import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * CRITICAL TOOL: Deep AI Design Analysis
 * 
 * This tool performs a comprehensive scan of the entire Revit model structure
 * and returns structured analysis data with precise coordinates, element IDs,
 * and identified issues. This eliminates LLM hallucination by providing
 * ground-truth data from the actual model.
 * 
 * The LLM uses the returned issue list to generate targeted correction code
 * via send_code_to_revit or other modification tools.
 */
export function registerAnalyzeLayoutDesignTool(server: McpServer) {
  server.tool(
    "analyze_layout_design",
    `Perform a DEEP comprehensive analysis of the Revit model layout design. This is the PRIMARY tool for AI design review and quality assurance.

CRITICAL: Always call this tool BEFORE making any design decisions or suggestions. It scans the entire model structure and returns factual, coordinate-accurate data about every element and identified design issues.

What this tool does:
1. STRUCTURAL SCAN: Scans all walls, floors, ceilings, roofs with exact coordinates and dimensions
2. SPATIAL ANALYSIS: Analyzes room boundaries, areas, adjacencies, and circulation paths
3. ELEMENT RELATIONSHIPS: Maps how elements connect, intersect, and relate to each other
4. ISSUE DETECTION: Identifies overlapping elements, misaligned walls, insufficient clearances, orphaned elements, missing boundaries, and design violations
5. FURNITURE AUDIT: Checks furniture placement against room boundaries, clearances, and accessibility
6. ANNOTATION CHECK: Validates dimensions, tags, and notes for completeness
7. CODE COMPLIANCE: Basic building code checks (egress widths, room sizes, door clearances)

Returns a structured JSON report with:
- elements: Complete list of all scanned elements with coordinates and properties
- issues: Array of detected problems with severity, location, affected element IDs, and suggested fixes
- statistics: Summary counts and metrics
- spatial_map: Room-to-element relationships and adjacency data

The LLM should use the returned 'issues' array to generate correction code via send_code_to_revit or other modification tools.`,
    {
      analysisScope: z
        .enum(["full", "structural", "spatial", "furniture", "annotations", "compliance", "custom"])
        .default("full")
        .describe("Scope of analysis: 'full' scans everything (recommended for first analysis), 'structural' checks walls/floors/columns, 'spatial' checks room layouts/adjacencies, 'furniture' audits furniture placement, 'annotations' checks drafting completeness, 'compliance' checks building codes, 'custom' uses customCategories"),
      levelId: z
        .number()
        .optional()
        .describe("Limit analysis to a specific level ElementId. If omitted, analyzes all levels."),
      roomIds: z
        .array(z.number())
        .optional()
        .describe("Limit analysis to specific room ElementIds. If omitted, analyzes all rooms."),
      customCategories: z
        .array(z.string())
        .optional()
        .describe("Custom Revit categories to include when analysisScope is 'custom' (e.g., ['OST_Walls', 'OST_Doors', 'OST_Furniture'])"),
      checkOverlaps: z
        .boolean()
        .default(true)
        .describe("Check for overlapping/intersecting elements that shouldn't overlap"),
      checkAlignment: z
        .boolean()
        .default(true)
        .describe("Check for misaligned walls, columns, and grid elements"),
      checkClearances: z
        .boolean()
        .default(true)
        .describe("Check door clearances, corridor widths, furniture spacing"),
      checkMissingElements: z
        .boolean()
        .default(true)
        .describe("Check for missing room boundaries, untagged elements, rooms without doors"),
      checkFurniturePlacement: z
        .boolean()
        .default(true)
        .describe("Validate furniture is within room boundaries and properly spaced"),
      checkCirculation: z
        .boolean()
        .default(true)
        .describe("Analyze circulation paths, dead ends, and egress routes"),
      minDoorClearanceMm: z
        .number()
        .default(900)
        .describe("Minimum door clearance in mm for compliance checking (default: 900mm ADA)"),
      minCorridorWidthMm: z
        .number()
        .default(1200)
        .describe("Minimum corridor width in mm for compliance checking (default: 1200mm)"),
      minRoomAreaSqMm: z
        .number()
        .default(5000000)
        .describe("Minimum room area in sq mm to flag as potentially too small (default: 5 sq m)"),
      includeElementCoordinates: z
        .boolean()
        .default(true)
        .describe("Include precise XYZ coordinates for every element (essential for accurate AI analysis)"),
      includeRelationships: z
        .boolean()
        .default(true)
        .describe("Include element-to-element and element-to-room relationship mapping"),
      maxElementsPerCategory: z
        .number()
        .default(200)
        .describe("Maximum elements to return per category to manage response size"),
    },
    async (args, extra) => {
      const params = {
        analysisScope: args.analysisScope,
        levelId: args.levelId,
        roomIds: args.roomIds,
        customCategories: args.customCategories || [],
        checks: {
          overlaps: args.checkOverlaps,
          alignment: args.checkAlignment,
          clearances: args.checkClearances,
          missingElements: args.checkMissingElements,
          furniturePlacement: args.checkFurniturePlacement,
          circulation: args.checkCirculation,
        },
        thresholds: {
          minDoorClearanceMm: args.minDoorClearanceMm,
          minCorridorWidthMm: args.minCorridorWidthMm,
          minRoomAreaSqMm: args.minRoomAreaSqMm,
        },
        includeElementCoordinates: args.includeElementCoordinates,
        includeRelationships: args.includeRelationships,
        maxElementsPerCategory: args.maxElementsPerCategory,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "analyze_layout_design",
            params
          );
        });

        // Structure the response for optimal LLM consumption
        const result = {
          analysisComplete: true,
          scope: args.analysisScope,
          data: response,
          instruction: "Use the 'issues' array to identify problems. Each issue has elementIds, coordinates, severity (critical/warning/info), and suggestedFix. Generate correction code using send_code_to_revit or use modify tools for each critical/warning issue.",
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Layout design analysis failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
