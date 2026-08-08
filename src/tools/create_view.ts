import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedMutationToolResult, normalizedToolCatch } from "./_result.js";

export function registerCreateViewTool(server: McpServer) {
  server.tool(
    "create_view",
    "Create FloorPlan, CeilingPlan, or Section views. Use dedicated view tools such as create_drafting_view, create_3d_view, create_area_plan, and create_elevation_marker for other view types.",
    {
      viewType: z
        .enum([
          "FloorPlan",
          "CeilingPlan",
          "Section"
        ])
        .describe("Handler-supported generic view type. Use the dedicated view tools for all other types."),
      viewName: z
        .string()
        .describe("Name for the new view (e.g., 'Level 1 - Furniture Plan', 'Section A-A')"),
      levelId: z
        .number()
        .optional()
        .describe("ElementId of the level for floor and ceiling plans."),
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
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_view", params);
        });

        return normalizedMutationToolResult("create_view", response);
      } catch (error) {
        return normalizedToolCatch("create_view", error);
      }
    }
  );
}
