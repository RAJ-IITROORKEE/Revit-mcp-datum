import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Create legend views for drawing documentation.
 * Legends display symbols, line types, and element representations
 * with descriptions for construction documentation.
 */
export function registerCreateLegendViewTool(server: McpServer) {
  server.tool(
    "create_legend_view",
    `Create a legend view in Revit for construction documentation. Legends display symbols, hatching patterns, line types, color codes, and element representations with text descriptions.

Legend types supported:
- SYMBOL_LEGEND: Shows annotation symbols with descriptions
- MATERIAL_LEGEND: Shows material hatching patterns with names
- COLOR_LEGEND: Shows color codes used in color scheme views
- DOOR_SCHEDULE_LEGEND: Shows door types with key dimensions
- WINDOW_SCHEDULE_LEGEND: Shows window types with key dimensions
- FURNITURE_LEGEND: Shows furniture symbols with names
- GENERAL_NOTES: Text-based general notes and abbreviations
- CUSTOM: User-defined legend content

The legend view can be placed on multiple sheets using place_viewport (unlike model views which can only appear on one sheet).`,
    {
      legendName: z
        .string()
        .describe("Name for the legend view (e.g., 'Door Legend', 'Material Legend', 'Abbreviations')"),
      legendType: z
        .enum([
          "symbol_legend",
          "material_legend",
          "color_legend",
          "door_schedule_legend",
          "window_schedule_legend",
          "furniture_legend",
          "general_notes",
          "custom",
        ])
        .default("symbol_legend")
        .describe("Type of legend to create, which determines auto-populated content"),
      scale: z
        .number()
        .default(50)
        .describe("View scale denominator (e.g., 50 means 1:50)"),
      autoPopulate: z
        .boolean()
        .default(true)
        .describe("Automatically populate the legend with relevant items from the project (e.g., all door types for door_schedule_legend)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories to include when auto-populating (e.g., ['OST_Doors', 'OST_Windows'])"),
      includeDescription: z
        .boolean()
        .default(true)
        .describe("Add text descriptions next to each legend item"),
      includeDimensions: z
        .boolean()
        .default(false)
        .describe("Include key dimensions for each legend item"),
      columnCount: z
        .number()
        .default(1)
        .describe("Number of columns for legend layout (1-4)"),
      itemSpacingMm: z
        .number()
        .default(10)
        .describe("Spacing between legend items in mm at print scale"),
      sheetId: z
        .number()
        .optional()
        .describe("Optionally place the legend on a sheet immediately"),
      viewportLocationOnSheet: z
        .object({
          x: z.number().describe("X position on sheet in mm"),
          y: z.number().describe("Y position on sheet in mm"),
        })
        .optional()
        .describe("Position on the sheet for the viewport"),
    },
    async (args, extra) => {
      const params = {
        legendName: args.legendName,
        legendType: args.legendType,
        scale: args.scale,
        autoPopulate: args.autoPopulate,
        categories: args.categories || [],
        includeDescription: args.includeDescription,
        includeDimensions: args.includeDimensions,
        columnCount: args.columnCount,
        itemSpacingMm: args.itemSpacingMm,
        sheetId: args.sheetId,
        viewportLocationOnSheet: args.viewportLocationOnSheet,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "create_legend_view",
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
              text: `Create legend view failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
