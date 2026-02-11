import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Check building code compliance for the Revit model.
 * Validates against common building codes including
 * egress, accessibility, fire safety, and spatial requirements.
 */
export function registerCheckBuildingCodeComplianceTool(server: McpServer) {
  server.tool(
    "check_building_code_compliance",
    `Check building code compliance for the Revit model. Validates the design against common building codes and standards including egress requirements, ADA/accessibility, fire safety, and spatial minimums.

Compliance checks available:
1. EGRESS: Exit door widths, travel distances, exit count, dead-end corridors, exit signage
2. ACCESSIBILITY: ADA clearances, door widths (min 815mm), wheelchair turning spaces, ramp slopes, accessible routes
3. FIRE_SAFETY: Fire-rated wall continuity, exit separation distance, corridor width for occupancy, sprinkler coverage
4. SPATIAL: Minimum room sizes by occupancy type, ceiling heights, window-to-floor area ratios, ventilation openings
5. STRUCTURAL: Column spacing, load path continuity, floor opening guards
6. PLUMBING: Fixture count by occupancy, accessibility at fixtures
7. ALL: Run all compliance checks

Returns a structured compliance report:
- violations: Array of code violations with code reference, severity, location, element IDs, and required vs actual values
- warnings: Potential issues that need professional review
- passed: List of checks that passed
- summary: Overall compliance score and counts

Note: This tool provides preliminary checks based on common codes. Final compliance verification should always be done by qualified professionals.`,
    {
      checkType: z
        .enum(["all", "egress", "accessibility", "fire_safety", "spatial", "structural", "plumbing"])
        .default("all")
        .describe("Type of compliance check to perform"),
      codeStandard: z
        .enum(["ibc_2021", "ibc_2018", "nbc_india", "eurocode", "bs_uk", "custom"])
        .default("ibc_2021")
        .describe("Building code standard to check against. IBC = International Building Code"),
      occupancyType: z
        .enum([
          "assembly",
          "business",
          "educational",
          "factory",
          "high_hazard",
          "institutional",
          "mercantile",
          "residential",
          "storage",
          "utility",
          "mixed",
        ])
        .default("business")
        .describe("Building occupancy classification per building code"),
      occupantLoad: z
        .number()
        .optional()
        .describe("Total building occupant load. If omitted, calculated from room areas and occupancy factors."),
      levelIds: z
        .array(z.number())
        .optional()
        .describe("Specific levels to check. If omitted, checks all levels."),
      roomIds: z
        .array(z.number())
        .optional()
        .describe("Specific rooms to check. If omitted, checks all rooms."),
      customThresholds: z
        .object({
          minDoorWidthMm: z.number().optional().describe("Minimum door width (default: 815mm for ADA)"),
          minCorridorWidthMm: z.number().optional().describe("Minimum corridor width"),
          minCeilingHeightMm: z.number().optional().describe("Minimum ceiling height"),
          maxTravelDistanceMm: z.number().optional().describe("Maximum travel distance to exit"),
          maxDeadEndLengthMm: z.number().optional().describe("Maximum dead-end corridor length"),
          minExitSeparation: z.number().optional().describe("Minimum distance between exits as fraction of diagonal"),
          minWindowAreaRatio: z.number().optional().describe("Minimum window-to-floor area ratio"),
          minRoomAreaSqMm: z.number().optional().describe("Minimum room area"),
        })
        .optional()
        .describe("Custom threshold values to override code defaults"),
      includeRecommendations: z
        .boolean()
        .default(true)
        .describe("Include specific recommendations for fixing each violation"),
      severityFilter: z
        .enum(["all", "critical", "major", "minor"])
        .default("all")
        .describe("Filter results by severity level"),
    },
    async (args, extra) => {
      const params = {
        checkType: args.checkType,
        codeStandard: args.codeStandard,
        occupancyType: args.occupancyType,
        occupantLoad: args.occupantLoad,
        levelIds: args.levelIds || [],
        roomIds: args.roomIds || [],
        customThresholds: args.customThresholds || {},
        includeRecommendations: args.includeRecommendations,
        severityFilter: args.severityFilter,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "check_building_code_compliance",
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
              text: `Building code compliance check failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
