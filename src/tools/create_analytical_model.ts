import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateAnalyticalModelTool(server: McpServer) {
  server.tool(
    "create_analytical_model",
    "Create and manage structural analytical models in Revit for structural analysis software integration (Robot, SAP2000, ETABS, STAAD). Analytical models are simplified stick/surface representations of the physical structure for FEA calculations. Actions: CreateFromPhysical (auto-generate from structural elements), AdjustModel (modify analytical geometry), ValidateModel (check consistency), ExportModel (to analysis software formats). Essential for structural engineering workflows.",
    {
      action: z
        .enum(["CreateFromPhysical", "AdjustModel", "ValidateModel", "ExportModel", "GetAnalyticalProperties", "SetBoundaryConditions"])
        .describe(
          "Action: 'CreateFromPhysical' generates analytical from physical model, 'AdjustModel' modifies analytical elements, 'ValidateModel' checks consistency, 'ExportModel' exports to analysis software, 'GetAnalyticalProperties' reads analytical model properties, 'SetBoundaryConditions' defines supports."
        ),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds of structural elements (walls, floors, columns, beams) to create analytical model from"),
      analyticalModelType: z
        .enum(["StickModel", "SurfaceModel", "Hybrid"])
        .optional()
        .default("Hybrid")
        .describe("'StickModel' for framing (1D elements), 'SurfaceModel' for walls/floors (2D), 'Hybrid' uses both."),
      adjustments: z
        .array(
          z.object({
            analyticalElementId: z.number().describe("ElementId of analytical element to adjust"),
            adjustment: z.enum(["ExtendToCore", "Project", "Disconnect", "Reconnect"]).optional(),
            offset: z
              .object({
                x: z.number().optional().describe("X offset in mm"),
                y: z.number().optional().describe("Y offset in mm"),
                z: z.number().optional().describe("Z offset in mm"),
              })
              .optional()
              .describe("Offset from physical element"),
          })
        )
        .optional()
        .describe("Adjustments to analytical model (for AdjustModel action)"),
      exportFormat: z
        .enum(["IFC", "CIS2", "SAF", "SDNF", "Custom"])
        .optional()
        .describe("Export format: 'IFC' = IFC Structural Analysis View, 'CIS2' = CIMsteel, 'SAF' = Structural Analysis Format, 'SDNF' = STAAD format."),
      exportPath: z
        .string()
        .optional()
        .describe("Output file path for ExportModel action"),
      includeLoads: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include applied loads in the export"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_analytical_model", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create analytical model failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
