import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerImportCadTool(server: McpServer) {
  server.tool(
    "import_cad",
    "Import CAD files (DWG, DXF, DGN) into Revit as reference underlays for tracing, coordination, or site context. Supports importing into views (as 2D underlay) or as 3D model. Configure layer visibility, color mode (black/white, grayscale, preserved), import units, positioning, and orientation. Essential for bringing in survey data, civil drawings, existing building CAD, and site plans. All units are in millimeters (mm).",
    {
      filePath: z
        .string()
        .describe("Full file path to the CAD file to import (.dwg, .dxf, .dgn)"),
      importMode: z
        .enum(["CurrentViewOnly", "AllViews", "ThreeDModel"])
        .describe(
          "'CurrentViewOnly' imports as 2D underlay in active view, 'AllViews' imports into all applicable views, 'ThreeDModel' imports as 3D elements."
        ),
      viewId: z
        .number()
        .optional()
        .describe("Specific view ElementId to import into (for CurrentViewOnly mode)"),
      positioning: z
        .enum(["Auto", "Origin", "Manual"])
        .optional()
        .default("Auto")
        .describe(
          "'Auto' uses CAD internal origin, 'Origin' places at Revit project origin, 'Manual' uses specified placement point."
        ),
      placementPoint: z
        .object({
          x: z.number().describe("X coordinate for placement in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().optional().default(0).describe("Z coordinate in mm"),
        })
        .optional()
        .describe("Manual placement point (for Manual positioning)"),
      importUnits: z
        .enum(["Auto", "Millimeters", "Centimeters", "Meters", "Inches", "Feet"])
        .optional()
        .default("Auto")
        .describe("Units interpretation for the CAD file. 'Auto' reads from file header."),
      layerSettings: z
        .object({
          importMode: z
            .enum(["All", "Visible", "Specify"])
            .optional()
            .default("All")
            .describe("Which layers to import: 'All', 'Visible' (only visible layers), 'Specify' (custom list)"),
          specificLayers: z
            .array(z.string())
            .optional()
            .describe("Array of layer names to import (for 'Specify' mode)"),
        })
        .optional()
        .describe("Layer import configuration"),
      colorMode: z
        .enum(["PreserveColors", "BlackAndWhite", "Grayscale", "Invert"])
        .optional()
        .default("PreserveColors")
        .describe("How to render CAD colors in Revit"),
      orientCorrection: z
        .enum(["Auto", "CorrectOrient", "DoNotCorrect"])
        .optional()
        .default("Auto")
        .describe("Whether to auto-correct CAD orientation (some CAD files have inverted Y-axis)"),
      levelId: z
        .number()
        .optional()
        .describe("Level to associate the import with (for 2D view imports)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("import_cad", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Import CAD failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
