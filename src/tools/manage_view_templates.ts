import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerManageViewTemplatesTool(server: McpServer) {
  server.tool(
    "manage_view_templates",
    "Create, edit, duplicate, and manage view templates in Revit. View templates control all view graphics settings: visibility, detail level, graphic overrides, filters, view scale, discipline, and underlay settings. Essential for standardizing documentation across large sheet sets, enforcing corporate graphic standards, and enabling AI to propagate settings to hundreds of views instantly. Actions: CreateTemplate, EditTemplate, DuplicateTemplate, DeleteTemplate, ListTemplates, GetTemplateSettings, CompareTemplates.",
    {
      action: z
        .enum([
          "CreateTemplate",
          "EditTemplate",
          "DuplicateTemplate",
          "DeleteTemplate",
          "ListTemplates",
          "GetTemplateSettings",
          "CompareTemplates",
          "ImportTemplatesFromProject",
        ])
        .describe("Action to perform on view templates"),
      templateName: z
        .string()
        .optional()
        .describe("View template name (e.g., 'A-FPLAN-ARCH', 'S-FPLAN-STRUC', 'Level 1 - Reflected Ceiling Plan')"),
      templateId: z
        .number()
        .optional()
        .describe("ElementId of existing view template (for Edit, Duplicate, Delete, GetSettings)"),
      sourceTemplateId: z
        .number()
        .optional()
        .describe("Source template ElementId for DuplicateTemplate or CompareTemplates"),
      baseViewType: z
        .enum(["FloorPlan", "CeilingPlan", "Elevation", "Section", "ThreeD", "DraftingView", "AreaPlan", "Schedule"])
        .optional()
        .describe("View type for template creation (for CreateTemplate action)"),
      templateSettings: z
        .object({
          discipline: z
            .enum(["Architectural", "Structural", "Mechanical", "Electrical", "Plumbing", "Coordination"])
            .optional()
            .describe("Discipline for the template (affects default visibility)"),
          detailLevel: z
            .enum(["Coarse", "Medium", "Fine"])
            .optional()
            .describe("Detail level of detail (LOD) for elements"),
          viewScale: z
            .number()
            .optional()
            .describe("View scale (e.g., 96 for 1/8\" = 1'-0\", 48 for 1/4\" = 1'-0\")"),
          categoryVisibility: z
            .array(
              z.object({
                category: z.string().describe("Category name (e.g., 'OST_Walls', 'OST_Doors', 'OST_Furniture')"),
                visible: z.boolean().describe("Visibility state for category"),
              })
            )
            .optional()
            .describe("Category-level visibility overrides"),
          filters: z
            .array(
              z.object({
                filterName: z.string().optional().describe("View filter name"),
                filterId: z.number().optional().describe("View filter ElementId"),
                enabled: z.boolean().optional().describe("Whether filter is enabled"),
                visibility: z.boolean().optional().describe("Whether filter makes elements visible or hidden"),
              })
            )
            .optional()
            .describe("View filters applied by this template"),
          graphicOverrides: z
            .object({
              lineWeight: z.number().optional().describe("Override line weight (1-16)"),
              lineColor: z
                .object({
                  red: z.number().min(0).max(255),
                  green: z.number().min(0).max(255),
                  blue: z.number().min(0).max(255),
                })
                .optional()
                .describe("Override line color RGB"),
              transparency: z.number().min(0).max(100).optional().describe("Surface transparency percentage (0-100)"),
              halftone: z.boolean().optional().describe("Whether to display as halftone"),
            })
            .optional()
            .describe("Graphic display overrides"),
          underlayOrientation: z
            .enum(["None", "LookDown", "LookUp"])
            .optional()
            .describe("Underlay orientation (for floor/ceiling plans)"),
          underlayLevelId: z
            .number()
            .optional()
            .describe("Level ElementId for underlay (show level below/above)"),
          viewRange: z
            .object({
              topClipOffset: z.number().optional().describe("Top clip plane offset from level in mm"),
              cutPlaneOffset: z.number().optional().describe("Cut plane offset from level in mm (where elements are cut)"),
              viewDepthOffset: z.number().optional().describe("View depth (bottom of visible region) offset in mm"),
              bottomClipOffset: z.number().optional().describe("Bottom clip plane offset in mm"),
            })
            .optional()
            .describe("View range settings (for plan views)"),
        })
        .optional()
        .describe("Template settings to apply (for CreateTemplate, EditTemplate)"),
      filterByDiscipline: z
        .enum(["Architectural", "Structural", "Mechanical", "Electrical", "Plumbing", "Coordination", "All"])
        .optional()
        .describe("Filter templates by discipline (for ListTemplates)"),
      importFromProjectPath: z
        .string()
        .optional()
        .describe("Path to Revit project (.rvt) to import view templates from (for ImportTemplatesFromProject)"),
      templateNamesToImport: z
        .array(z.string())
        .optional()
        .describe("Specific template names to import (if omitted, imports all templates from source project)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("manage_view_templates", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Manage view templates failed: ${error instanceof Error ? error.message : String(error)}` },
          ],
        };
      }
    }
  );
}
