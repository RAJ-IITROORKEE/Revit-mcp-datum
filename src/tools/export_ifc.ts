import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerExportIfcTool(server: McpServer) {
  server.tool(
    "export_ifc",
    "Export Revit model to IFC (Industry Foundation Classes) format for open BIM workflows and cross-platform coordination. IFC is the universal BIM exchange format supported by all major platforms (Navisworks, Solibri, Tekla, ArchiCAD, Bentley, Trimble). Supports IFC2x3, IFC4, and domain-specific views (Coordination View, Reference View, Design Transfer View). Essential for multi-discipline coordination, owner handover (COBie), clash detection, cost estimating, and energy analysis workflows.",
    {
      exportPath: z
        .string()
        .describe("Output file path for IFC export (.ifc). Directory will be created if it doesn't exist."),
      ifcVersion: z
        .enum(["IFC2x3", "IFC4", "IFC4x3"])
        .optional()
        .default("IFC4")
        .describe(
          "IFC schema version: 'IFC2x3' = older standard (broader compatibility), 'IFC4' = current standard (recommended), 'IFC4x3' = latest with infrastructure support."
        ),
      ifcView: z
        .enum([
          "CoordinationView",
          "ReferenceView",
          "DesignTransferView",
          "StructuralAnalysisView",
          "CodeComplianceView",
          "QuantityTakeOffView",
          "Default",
        ])
        .optional()
        .default("CoordinationView")
        .describe(
          "'CoordinationView' = model coordination and clash detection (most common), 'ReferenceView' = lightweight reference overlay, 'DesignTransferView' = full parametric exchange for editing, 'StructuralAnalysisView' = structural analysis software, 'CodeComplianceView' = building code checking, 'QuantityTakeOffView' = cost estimating."
        ),
      exportScope: z
        .enum(["EntireProject", "CurrentView", "SelectedElements", "SpecificLevels", "ByWorkset"])
        .optional()
        .default("EntireProject")
        .describe("Scope of export: what elements to include in the IFC file"),
      levelIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds of levels to export (for SpecificLevels scope)"),
      worksetNames: z
        .array(z.string())
        .optional()
        .describe("Workset names to export (for ByWorkset scope)"),
      phaseFilter: z
        .string()
        .optional()
        .describe("Phase to export (e.g., 'New Construction', 'Existing'). Uses current phase if omitted."),
      exportOptions: z
        .object({
          splitWalls: z
            .boolean()
            .optional()
            .default(true)
            .describe("Split walls by level (improves coordination for multi-story)"),
          exportBaseQuantities: z
            .boolean()
            .optional()
            .default(true)
            .describe("Include geometric quantities (length, area, volume) for takeoff"),
          exportSchedulesAsPsets: z
            .boolean()
            .optional()
            .default(false)
            .describe("Export schedule data as IFC property sets (custom properties)"),
          exportUserDefinedPsets: z
            .boolean()
            .optional()
            .default(true)
            .describe("Export Revit parameters as custom IFC properties"),
          exportLinkedFiles: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include linked Revit models in the export"),
          use2DRoomBoundary: z
            .boolean()
            .optional()
            .default(false)
            .describe("Export rooms as 2D boundaries vs 3D volumes (for space planning)"),
          exportPartsAsBuildingElements: z
            .boolean()
            .optional()
            .default(false)
            .describe("Export parts (for assemblies/precast) as building elements"),
          includeIfcSiteElevation: z
            .boolean()
            .optional()
            .default(true)
            .describe("Include site elevation and coordinates"),
          tessellationLevelOfDetail: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .default(0.5)
            .describe("Geometry tessellation detail (0 = low, 1 = high). Higher = larger file, more accurate curves."),
        })
        .optional()
        .describe("Advanced IFC export settings"),
      coordinateBase: z
        .enum(["ProjectBase", "SharedCoordinates", "SiteLocation", "Internal"])
        .optional()
        .default("SharedCoordinates")
        .describe(
          "Coordinate system for IFC export: 'ProjectBase' = project base point, 'SharedCoordinates' = shared coordinates (for site alignment), 'SiteLocation' = survey point, 'Internal' = Revit internal origin."
        ),
      classificationSystem: z
        .enum(["Uniformat", "Omniclass", "Uniclass", "CoClass", "None"])
        .optional()
        .describe("Classification system to include (for owner requirements, COBie)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_ifc", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Export IFC failed: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
