import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerDetectClashesTool(server: McpServer) {
  server.tool(
    "detect_clashes",
    "Detect geometric clashes (collisions/intersections) between Revit elements. Identifies where elements physically overlap — critical for coordination, constructability review, and avoiding construction conflicts. Returns clash pairs with severity level, overlap volume, and clash location coordinates. Supports filtering by category, tolerance, and severity threshold. All units are in millimeters (mm).",
    {
      scope: z
        .enum(["SelectedElements", "CategoryVsCategory", "DisciplineVsDiscipline", "AllElements"])
        .describe(
          "Clash detection scope: 'SelectedElements' checks specific elements, 'CategoryVsCategory' checks one category against another, 'DisciplineVsDiscipline' checks architectural vs structural/MEP, 'AllElements' checks entire model."
        ),
      elementIds1: z
        .array(z.number())
        .optional()
        .describe("First set of elements (for SelectedElements scope)"),
      elementIds2: z
        .array(z.number())
        .optional()
        .describe("Second set of elements to check against (for SelectedElements scope)"),
       category1: z
         .string()
         .optional()
         .describe("First category for CategoryVsCategory (e.g., 'OST_StructuralFraming', 'OST_Walls', 'OST_DuctCurves', 'OST_Pipes')"),
       category2: z
         .string()
         .optional()
         .describe("Second category for CategoryVsCategory (e.g., 'OST_DuctCurves', 'OST_Pipes', 'OST_Conduit'). Checks all elements of category1 against category2."),
      discipline1: z
        .enum(["Architectural", "Structural", "Mechanical", "Electrical", "Plumbing"])
        .optional()
        .describe("First discipline for DisciplineVsDiscipline"),
      discipline2: z
        .enum(["Architectural", "Structural", "Mechanical", "Electrical", "Plumbing"])
        .optional()
        .describe("Second discipline for DisciplineVsDiscipline"),
       tolerance: z
         .number()
         .min(0.1)
         .max(1000)
         .optional()
         .default(1)
         .describe("Clash tolerance in mm (0.1-1000). Elements closer than this distance are considered clashing. Default 1mm for typical construction tolerance."),
      severityThreshold: z
        .enum(["All", "Minor", "Major", "Critical"])
        .optional()
        .default("All")
        .describe(
          "Minimum severity to report: 'All' = all clashes, 'Minor' = >1mm overlap, 'Major' = >10mm, 'Critical' = >50mm or high clash count."
        ),
      ignoreAcceptableClashes: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true, ignores expected/acceptable clashes (e.g., door hosted in wall, window in wall)."),
      includeClashVolume: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true, calculates the overlap volume for each clash"),
       limit: z
         .number()
         .int()
         .min(1)
         .max(10000)
         .optional()
         .default(100)
         .describe("Maximum number of clashes to return (1-10000, default 100. Increase for comprehensive clash reports on large models)."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("detect_clashes", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Detect clashes failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
