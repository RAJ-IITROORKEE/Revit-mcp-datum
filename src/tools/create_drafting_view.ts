import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Create drafting views for 2D detail work.
 * Drafting views are independent of the model and used for
 * standard details, typical sections, and reference drawings.
 */
export function registerCreateDraftingViewTool(server: McpServer) {
  server.tool(
    "create_drafting_view",
    `Create a new drafting view in Revit. Drafting views are 2D views independent of the 3D model, used for creating standard construction details, typical sections, notes, diagrams, and reference drawings.

After creating a drafting view, use these tools to add content:
- create_detail_lines: Draw lines and shapes
- create_detail_component: Place detail components
- create_filled_region: Create hatched/filled areas
- create_text_note: Add text annotations
- create_dimension: Add dimensions
- create_annotation_symbol: Place symbols

The drafting view can then be placed on sheets using place_viewport.`,
    {
      viewName: z
        .string()
        .describe("Name for the drafting view (e.g., 'Typical Wall Section', 'Foundation Detail 01', 'Door Frame Detail')"),
      scale: z
        .number()
        .default(50)
        .describe("View scale denominator (e.g., 50 means 1:50, 20 means 1:20, 100 means 1:100)"),
      detailLevel: z
        .enum(["coarse", "medium", "fine"])
        .default("fine")
        .describe("Detail level for the drafting view"),
      viewTemplateId: z
        .number()
        .optional()
        .describe("ElementId of a view template to apply. If omitted, uses default."),
      discipline: z
        .enum(["architectural", "structural", "mechanical", "electrical", "plumbing", "coordination"])
        .default("architectural")
        .describe("Design discipline for the view"),
      sheetId: z
        .number()
        .optional()
        .describe("Optionally place the drafting view on a sheet immediately after creation"),
      viewportLocationOnSheet: z
        .object({
          x: z.number().describe("X position on sheet in mm"),
          y: z.number().describe("Y position on sheet in mm"),
        })
        .optional()
        .describe("Position on the sheet for the viewport (required if sheetId is provided)"),
    },
    async (args, extra) => {
      const params = {
        viewName: args.viewName,
        scale: args.scale,
        detailLevel: args.detailLevel,
        viewTemplateId: args.viewTemplateId,
        discipline: args.discipline,
        sheetId: args.sheetId,
        viewportLocationOnSheet: args.viewportLocationOnSheet,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "create_drafting_view",
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
              text: `Create drafting view failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
