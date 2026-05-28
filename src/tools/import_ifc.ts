import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerImportIfcTool(server: McpServer) {
  server.tool(
    "import_ifc",
    "Import IFC (Industry Foundation Classes) models into Revit for coordination, renovation, and multi-platform BIM workflows. IFC is the universal exchange format from other authoring tools (ArchiCAD, Tekla, Bentley, Vectorworks, SketchUp Pro, BricsCAD BIM). Imported IFC can be linked (for coordination) or opened (for editing). Essential for receiving contractor models, specialty consultant deliverables (structural steel, precast, MEP fabrication), and renovation projects where existing conditions are provided as IFC.",
    {
      ifcFilePath: z
        .string()
        .describe("Path to IFC file to import (.ifc). Supports IFC2x3, IFC4, and IFC4x3 schemas."),
      importMode: z
        .enum(["LinkModel", "ImportIntoCurrentProject", "OpenAsNewProject"])
        .describe(
          "'LinkModel' = link IFC as external reference (read-only, updates with source), 'ImportIntoCurrentProject' = import and convert to Revit elements (editable), 'OpenAsNewProject' = open IFC as new Revit project."
        ),
      positioning: z
        .enum(["AutoCenterToCenter", "AutoOriginToOrigin", "SharedCoordinates", "Manual"])
        .optional()
        .default("SharedCoordinates")
        .describe(
          "How to position the imported IFC: 'AutoCenterToCenter' = align centers, 'AutoOriginToOrigin' = align origins, 'SharedCoordinates' = use IFC site location (recommended for coordination), 'Manual' = specify position."
        ),
       manualPosition: z
         .object({
           x: z.number().describe("X offset in mm (0=project origin east-west)"),
           y: z.number().describe("Y offset in mm (0=project origin north-south)"),
           z: z.number().describe("Z offset in mm (elevation, positive=up)"),
           rotation: z.number().min(0).max(360).optional().describe("Rotation angle in degrees (0-360)"),
         })
         .optional()
         .describe("Manual position offset. Only used when positioning='Manual'."),
      importOptions: z
        .object({
          convertUnits: z
            .boolean()
            .optional()
            .default(true)
            .describe("Auto-convert IFC units to project units (mm, m, ft, etc.)"),
          importCustomPropertySets: z
            .boolean()
            .optional()
            .default(true)
            .describe("Import IFC property sets (Psets) as Revit shared parameters"),
          createDirectShapes: z
            .boolean()
            .optional()
            .default(false)
            .describe("Import geometry as DirectShapes (for complex/unsupported geometry) vs native Revit elements"),
          importRooms: z
            .boolean()
            .optional()
            .default(true)
            .describe("Import IFC spaces as Revit rooms"),
          replaceExisting: z
            .boolean()
            .optional()
            .default(false)
            .describe("Replace existing link with the same name (for LinkModel mode)"),
          createLevels: z
            .boolean()
            .optional()
            .default(true)
            .describe("Auto-create Revit levels from IFC building storeys (IfcBuildingStorey)"),
          importTypeMapping: z
            .enum(["UseIFCTypes", "MapToRevitTypes", "Custom"])
            .optional()
            .default("MapToRevitTypes")
            .describe(
              "'UseIFCTypes' = preserve original IFC type names, 'MapToRevitTypes' = map to equivalent Revit types (IfcWall → Basic Wall), 'Custom' = use custom mapping file."
            ),
          customMappingFile: z
            .string()
            .optional()
            .describe("Path to custom type mapping file (.txt) for Custom import mode"),
        })
        .optional()
        .describe("Advanced IFC import settings"),
      linkType: z
        .enum(["Overlay", "Attachment"])
        .optional()
        .default("Overlay")
        .describe(
          "Link type (for LinkModel mode): 'Overlay' = not visible in nested links, 'Attachment' = visible in nested links. Overlay is typical for coordination."
        ),
      worksetName: z
        .string()
        .optional()
        .describe("Workset name to assign imported/linked elements (for workshared projects)"),
      levelMappingStrategy: z
        .enum(["AutoByElevation", "ManualMapping", "CreateNew"])
        .optional()
        .default("AutoByElevation")
        .describe(
          "'AutoByElevation' = match IFC storeys to Revit levels by elevation, 'ManualMapping' = specify storey-to-level mapping, 'CreateNew' = always create new levels."
        ),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("import_ifc", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Import IFC failed: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
