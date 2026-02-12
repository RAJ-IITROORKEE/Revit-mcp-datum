import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerExportScheduleDataTool(server: McpServer) {
  server.tool(
    "export_schedule_data",
    "Export Revit schedule data to CSV, Excel (XLSX), or TXT for integration with external systems: specifications, estimating software, facility management (FM) databases, procurement systems, and AI-driven document generation. Supports all schedule types: door/window schedules, room/area schedules, equipment schedules, material takeoffs, keynote legends, and custom schedules. Essential for AI to generate specifications from model data, create BOMs (bills of materials), and feed cost/FM systems.",
    {
      scheduleIdentifier: z
        .object({
          scheduleId: z.number().optional().describe("ElementId of specific schedule to export"),
          scheduleName: z.string().optional().describe("Schedule name to export (alternative to scheduleId)"),
          scheduleCategory: z
            .enum([
              "Doors",
              "Windows",
              "Rooms",
              "Areas",
              "Furniture",
              "Equipment",
              "Walls",
              "Floors",
              "Roofs",
              "Structural",
              "MEP",
              "KeynoteLegend",
              "MaterialTakeoff",
              "Custom",
            ])
            .optional()
            .describe("Category filter to find schedule (if name/id not specified)"),
        })
        .describe("Identify the schedule to export. Provide scheduleId, scheduleName, or scheduleCategory."),
      exportPath: z
        .string()
        .describe("Output file path for schedule export. Extension determines format (.csv, .xlsx, .txt)."),
      exportFormat: z
        .enum(["CSV", "Excel", "TXT", "JSON"])
        .optional()
        .default("CSV")
        .describe(
          "'CSV' = comma-separated (most compatible), 'Excel' = .xlsx workbook (formatted), 'TXT' = tab-delimited text, 'JSON' = structured JSON (for API/AI integration)."
        ),
      exportOptions: z
        .object({
          includeHeaders: z
            .boolean()
            .optional()
            .default(true)
            .describe("Include column headers in first row (field names)"),
          includeTitle: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include schedule title as first row (before headers)"),
          includeFooter: z
            .boolean()
            .optional()
            .default(true)
            .describe("Include totals/summary footer rows"),
          exportHiddenFields: z
            .boolean()
            .optional()
            .default(false)
            .describe("Export hidden/conditional fields (normally excluded)"),
          exportOnlyVisibleRows: z
            .boolean()
            .optional()
            .default(true)
            .describe("Export only rows visible per current filters (vs all rows)"),
          delimiter: z
            .string()
            .optional()
            .default(",")
            .describe("Delimiter for CSV/TXT export (e.g., ',', '|', tab character)"),
          textEncoding: z
            .enum(["UTF8", "UTF16", "ASCII", "Windows1252"])
            .optional()
            .default("UTF8")
            .describe("Text encoding for export file"),
          dateFormat: z
            .string()
            .optional()
            .describe("Date format string (e.g., 'YYYY-MM-DD', 'MM/DD/YYYY'). Uses Revit default if omitted."),
          numberFormat: z
            .object({
              decimalPlaces: z.number().optional().describe("Number of decimal places (e.g., 2 for currency)"),
              useThousandsSeparator: z.boolean().optional().describe("Whether to use thousands separator (e.g., 1,000)"),
            })
            .optional()
            .describe("Number formatting options"),
        })
        .optional()
        .describe("Advanced export formatting options"),
      excelOptions: z
        .object({
          worksheetName: z.string().optional().describe("Excel worksheet name (default: schedule name)"),
          applyFormatting: z
            .boolean()
            .optional()
            .default(true)
            .describe("Apply cell formatting (colors, fonts, borders) from Revit schedule appearance"),
          includeFormulas: z
            .boolean()
            .optional()
            .default(false)
            .describe("Export calculated fields as Excel formulas (vs values)"),
          createPivotTable: z
            .boolean()
            .optional()
            .default(false)
            .describe("Auto-create pivot table on separate worksheet for analysis"),
        })
        .optional()
        .describe("Excel-specific export options (only applies to Excel format)"),
      batchExport: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Export all schedules of the specified category (or all schedules) into separate files/sheets. File naming: [ScheduleName].[ext]"
        ),
      batchOutputDirectory: z
        .string()
        .optional()
        .describe("Output directory for batch export (required if batchExport = true)"),
      postExportActions: z
        .object({
          openFileAfterExport: z.boolean().optional().default(false).describe("Open exported file in default application"),
          uploadToCloud: z.boolean().optional().default(false).describe("Upload to BIM 360 / ACC cloud storage"),
          cloudFolderPath: z.string().optional().describe("Cloud folder path for upload"),
        })
        .optional()
        .describe("Actions to perform after export completes"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_schedule_data", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Export schedule data failed: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
