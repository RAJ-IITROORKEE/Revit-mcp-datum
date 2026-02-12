import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateLevelTool(server: McpServer) {
  server.tool(
    "create_level",
    "Create new levels in Revit at specified elevations. Levels are CRITICAL for multi-story building design — they define floor plates, floor plans, ceiling plans, and are required for placing walls, floors, ceilings, roofs, and other level-hosted elements. Automatically creates associated floor plan and ceiling plan views. Use get_levels_list to check existing levels before creating new ones. All units are in millimeters (mm).",
    {
      levels: z
        .array(
          z.object({
            name: z
              .string()
              .describe(
                "Level name (e.g., 'Ground Floor', 'Level 1', 'Level 2', 'Roof', 'Foundation', 'Basement')"
              ),
            elevation: z
              .number()
              .describe(
                "Level elevation in mm from project origin (e.g., 0 for ground, 3500 for first floor, -3000 for basement). Typical floor-to-floor height is 3000-4000mm."
              ),
            createFloorPlan: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether to automatically create a floor plan view for this level"),
            createCeilingPlan: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether to automatically create a ceiling plan view for this level"),
            createStructuralPlan: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether to create a structural plan view for this level"),
            isStructural: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether this is a structural level (affects plan view types created)"),
            isBuildingStory: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether this level represents a building story (affects schedules, area plans, etc.)"),
            levelTypeId: z
              .number()
              .optional()
              .describe("ElementId of the level type (controls line style and head symbol)"),
          })
        )
        .min(1)
        .describe("Array of level definitions to create"),
      autoSpaceFloors: z
        .object({
          startElevation: z.number().describe("Starting elevation in mm (e.g., 0 for ground)"),
          numberOfFloors: z.number().min(1).describe("Number of floors to create"),
          floorToFloorHeight: z.number().describe("Floor-to-floor height in mm (typical: 3000-4000)"),
          namePrefix: z.string().optional().default("Level").describe("Prefix for auto-generated names"),
          includeBasement: z.boolean().optional().default(false).describe("Whether to include a basement level"),
          basementDepth: z.number().optional().describe("Basement depth below grade in mm"),
          includeRoof: z.boolean().optional().default(true).describe("Whether to include a roof level at the top"),
        })
        .optional()
        .describe("Alternative: auto-generate evenly spaced levels for a multi-story building. If provided, the 'levels' array is ignored."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_level", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create level failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
