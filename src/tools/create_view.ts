import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateViewTool(server: McpServer) {
  server.tool(
    "create_view",
    "Create new views in Revit including floor plans, ceiling plans, sections, elevations, 3D views, and drafting views. Supports setting view name, scale, detail level, and view template. Essential for automated drafting workflows.",
    {
      viewType: z
        .enum([
          "FloorPlan",
          "CeilingPlan",
          "Section",
          "Elevation",
          "ThreeD",
          "DraftingView",
          "AreaPlan",
          "EngineeringPlan"
        ])
        .describe("Type of view to create. FloorPlan: standard floor plan view. CeilingPlan: reflected ceiling plan. Section: building section view. Elevation: exterior or interior elevation. ThreeD: 3D isometric or perspective view. DraftingView: 2D drafting view for details. AreaPlan: area plan for space calculations. EngineeringPlan: structural or MEP plan view."),
      viewName: z
        .string()
        .describe("Name for the new view (e.g., 'Level 1 - Furniture Plan', 'Section A-A')"),
      levelId: z
        .number()
        .optional()
        .describe("ElementId of the level for floor/ceiling/area/engineering plans. Required for plan views."),
      viewFamilyTypeId: z
        .number()
        .optional()
        .describe("ElementId of the ViewFamilyType to use. If not specified, the default type for the view type will be used."),
      scale: z
        .number()
        .optional()
        .describe("View scale (e.g., 100 for 1:100, 50 for 1:50). If not specified, uses default scale."),
      detailLevel: z
        .enum(["Coarse", "Medium", "Fine"])
        .optional()
        .describe("Level of detail to display. Coarse: simplified geometry. Medium: moderate detail. Fine: maximum detail."),
      viewTemplateId: z
        .number()
        .optional()
        .describe("ElementId of a view template to apply. View templates control view properties, filters, and appearance."),
      sectionBox: z
        .object({
          min: z.object({
            x: z.number().describe("Minimum X coordinate in mm"),
            y: z.number().describe("Minimum Y coordinate in mm"),
            z: z.number().describe("Minimum Z coordinate in mm"),
          }),
          max: z.object({
            x: z.number().describe("Maximum X coordinate in mm"),
            y: z.number().describe("Maximum Y coordinate in mm"),
            z: z.number().describe("Maximum Z coordinate in mm"),
          }),
        })
        .optional()
        .describe("Bounding box for 3D views to limit visible content. Only applicable for ThreeD view type."),
      isPerspective: z
        .boolean()
        .optional()
        .describe("For 3D views only. True for perspective projection, false for isometric/orthogonal. Default is false."),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_view", params);
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
              text: `Create view failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
