import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerApplyViewTemplateTool(server: McpServer) {
  server.tool(
    "apply_view_template",
    "Apply view templates to views for standardized documentation. View templates instantly propagate graphic settings (visibility, detail level, filters, scale) to multiple views, ensuring consistent documentation across large sheet sets. Essential for AI to standardize 100s of views, enforce corporate graphic standards, and update existing views when standards change. Supports batch application to views by type, level, discipline, or naming pattern. Can also remove templates from views.",
    {
      action: z
        .enum(["ApplyTemplate", "RemoveTemplate", "ApplyBatchByLevel", "ApplyBatchByNaming", "UpdateAllViewsWithTemplate"])
        .describe(
          "Action: 'ApplyTemplate' = apply to specific views, 'RemoveTemplate' = remove template (revert to custom settings), 'ApplyBatchByLevel' = apply to all views of a level, 'ApplyBatchByNaming' = apply to views matching naming pattern, 'UpdateAllViewsWithTemplate' = reapply template to all views currently using it (to push template changes)."
        ),
      templateId: z
        .number()
        .optional()
        .describe(
          "ElementId of view template to apply. Use manage_view_templates with action 'ListTemplates' to get available templates."
        ),
      templateName: z
        .string()
        .optional()
        .describe("View template name to apply (alternative to templateId)"),
      viewIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds of specific views to apply template to (for ApplyTemplate action)"),
      batchCriteria: z
        .object({
          viewType: z
            .enum(["FloorPlan", "CeilingPlan", "Elevation", "Section", "ThreeD", "DraftingView", "AreaPlan", "Schedule", "All"])
            .optional()
            .describe("View type filter for batch application"),
          levelIds: z
            .array(z.number())
            .optional()
            .describe("Level ElementIds to filter views (for ApplyBatchByLevel or additional filtering)"),
          namingPattern: z
            .string()
            .optional()
            .describe("View name pattern for batch application (supports wildcards: * for any, ? for single character)"),
          discipline: z
            .enum(["Architectural", "Structural", "Mechanical", "Electrical", "Plumbing", "Coordination", "All"])
            .optional()
            .describe("Discipline filter for batch application"),
          onSheet: z
            .boolean()
            .optional()
            .describe("Filter by placement: true = only views on sheets, false = only views not on sheets, undefined = all"),
          excludeTemplates: z
            .boolean()
            .optional()
            .default(true)
            .describe("Exclude view templates themselves from batch application"),
        })
        .optional()
        .describe("Criteria for batch template application (for batch actions)"),
      templateApplicationOptions: z
        .object({
          applyVisibility: z.boolean().optional().default(true).describe("Apply category visibility settings from template"),
          applyDetailLevel: z.boolean().optional().default(true).describe("Apply detail level from template"),
          applyFilters: z.boolean().optional().default(true).describe("Apply view filters from template"),
          applyGraphicOverrides: z
            .boolean()
            .optional()
            .default(true)
            .describe("Apply graphic overrides (line weights, colors) from template"),
          applyViewRange: z.boolean().optional().default(true).describe("Apply view range settings from template"),
          applyScale: z.boolean().optional().default(true).describe("Apply view scale from template"),
          applyUnderlay: z.boolean().optional().default(true).describe("Apply underlay settings from template"),
          preserveExistingOverrides: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether to preserve existing element-level overrides (true) or reset them per template (false)"),
        })
        .optional()
        .describe("Control which template settings to apply (selective application)"),
      dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe("Preview mode: returns list of views that would be affected without actually applying template"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("apply_view_template", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Apply view template failed: ${error instanceof Error ? error.message : String(error)}` },
          ],
        };
      }
    }
  );
}
