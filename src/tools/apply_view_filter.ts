import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerApplyViewFilterTool(server: McpServer) {
  server.tool(
    "apply_view_filter",
    "Create and apply view filters to control element visibility and graphic overrides in Revit views. Filters can highlight elements by color, pattern, line weight, and transparency based on parameter values. Perfect for visual analysis and presentation drawings.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where the filter will be applied"),
      filterName: z
        .string()
        .describe("Name for the view filter (e.g., 'Structural Walls', 'Load Bearing')"),
      categories: z
        .array(z.string())
        .describe("Built-in categories to filter (e.g., ['OST_Walls', 'OST_Floors', 'OST_StructuralFraming'])"),
      rules: z
        .array(
          z.object({
            parameterName: z.string().describe("Parameter name to evaluate (e.g., 'Structural', 'Fire Rating', 'Phase Created')"),
            condition: z
              .enum([
                "Equals",
                "NotEquals",
                "GreaterThan",
                "LessThan",
                "GreaterThanOrEqual",
                "LessThanOrEqual",
                "Contains",
                "NotContains",
                "BeginsWith",
                "EndsWith"
              ])
              .describe("Comparison condition"),
            value: z.union([z.string(), z.number(), z.boolean()]).describe("Value to compare against"),
          })
        )
        .describe("Filter rules that elements must match. Multiple rules use AND logic."),
      graphicOverrides: z
        .object({
          projectionLineColor: z
            .array(z.number())
            .optional()
            .describe("RGB color for projection lines [R, G, B] (0-255)"),
          projectionLineWeight: z
            .number()
            .optional()
            .describe("Line weight for projection lines (1-16)"),
          projectionLinePattern: z
            .string()
            .optional()
            .describe("Line pattern name (e.g., 'Solid', 'Dash', 'Hidden')"),
          cutLineColor: z
            .array(z.number())
            .optional()
            .describe("RGB color for cut lines [R, G, B]"),
          cutLineWeight: z
            .number()
            .optional()
            .describe("Line weight for cut lines (1-16)"),
          surfaceBackgroundColor: z
            .array(z.number())
            .optional()
            .describe("RGB color for surface fill [R, G, B]"),
          surfacePattern: z
            .string()
            .optional()
            .describe("Surface pattern name (e.g., 'Solid fill', 'Diagonal crosshatch')"),
          transparency: z
            .number()
            .optional()
            .describe("Element transparency (0-100, where 0 is opaque)"),
          halftone: z
            .boolean()
            .optional()
            .describe("Display elements in halftone (grayed out)"),
        })
        .optional()
        .describe("Visual overrides to apply to filtered elements. Omit for visibility filter only."),
      visibilityMode: z
        .enum(["Show", "Hide"])
        .default("Show")
        .describe("Whether to show or hide elements matching the filter"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("apply_view_filter", params);
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
              text: `Apply view filter failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
