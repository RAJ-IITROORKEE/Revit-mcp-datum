import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerExportViewTool(server: McpServer) {
  server.tool(
    "export_view",
    "Export Revit views and sheets to image files (PNG, JPEG, BMP, TIFF), DWG, DXF, or PDF. Essential for generating deliverables, sharing design snapshots with stakeholders, creating presentation images, and archiving project documentation. Supports batch export of multiple views/sheets at once with configurable resolution and paper size.",
    {
      exportFormat: z
        .enum(["PNG", "JPEG", "BMP", "TIFF", "DWG", "DXF", "PDF"])
        .describe("Output format for the export"),
      viewIds: z
        .array(z.number())
        .optional()
        .describe("Array of view/sheet ElementIds to export. If omitted, exports the current active view."),
      exportAllSheets: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, exports all sheets in the project (ignores viewIds)"),
      outputDirectory: z
        .string()
        .optional()
        .describe("Output directory path. If omitted, exports to a default 'Exports' folder in the project directory."),
      fileNamePrefix: z
        .string()
        .optional()
        .describe("Prefix for output file names. Default uses view/sheet name."),
      imageSettings: z
        .object({
          resolution: z
             .enum(["72", "150", "300", "600"])
             .optional()
             .default("300")
             .describe("Image resolution in DPI (standard values: 72 screen, 150 draft, 300 print, 600 high quality)"),
           pixelWidth: z
             .number()
             .int()
             .min(100)
             .max(16000)
             .optional()
             .describe("Image width in pixels (100-16000, alternative to resolution-based sizing)"),
           pixelHeight: z
             .number()
             .int()
             .min(100)
             .max(16000)
             .optional()
             .describe("Image height in pixels (100-16000)"),
          fitToPage: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to fit the view contents to the image dimensions"),
           quality: z
             .number()
             .int()
             .min(1)
             .max(100)
             .optional()
             .default(85)
             .describe("JPEG quality (1-100, only for JPEG format. 85 recommended for good quality/size tradeoff)"),
        })
        .optional()
        .describe("Settings for image exports (PNG, JPEG, BMP, TIFF)"),
      dwgSettings: z
        .object({
          exportSetupName: z
            .string()
            .optional()
            .describe("Name of a saved DWG/DXF export setup in the project"),
          layerMapping: z
            .enum(["AIA", "ISO13567", "BS1192", "CP83", "Custom"])
            .optional()
            .default("AIA")
            .describe("Layer naming standard for DWG export"),
          solidsMode: z
            .enum(["ACIS", "Polymesh"])
            .optional()
            .default("ACIS")
            .describe("How to export 3D solids"),
          hideRefPlanes: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to hide reference planes in export"),
          mergeViews: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether to merge multiple views into a single DWG file"),
        })
        .optional()
        .describe("Settings for DWG/DXF exports"),
      pdfSettings: z
        .object({
          paperSize: z
            .enum(["A0", "A1", "A2", "A3", "A4", "Letter", "Legal", "Tabloid", "ANSI_D", "ANSI_E", "Custom"])
            .optional()
            .default("A3")
            .describe("Paper size for PDF export"),
          orientation: z
            .enum(["Portrait", "Landscape", "Auto"])
            .optional()
            .default("Auto")
            .describe("Page orientation"),
          colorMode: z
            .enum(["Color", "GrayScale", "BlackAndWhite"])
            .optional()
            .default("Color")
            .describe("Color mode for PDF"),
           rasterQuality: z
             .enum(["72", "150", "300", "600"])
             .optional()
             .default("300")
             .describe("Raster quality in DPI for rasterized elements within PDF (72 draft, 150 screen, 300 print, 600 high)"),
          combineIntoSingle: z
            .boolean()
            .optional()
            .default(false)
            .describe("If true, combine all views/sheets into a single PDF file"),
        })
        .optional()
        .describe("Settings for PDF exports"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_view", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Export view failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
