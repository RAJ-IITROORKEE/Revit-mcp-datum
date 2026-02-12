import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerEditFamilyTool(server: McpServer) {
  server.tool(
    "edit_family",
    "Edit existing Revit families programmatically. Open a family for editing, modify geometry, add/remove/edit parameters, set constraints, change materials, and save changes. Enables AI to customize existing components or create variations. Actions: OpenFamily, AddGeometry, ModifyGeometry, AddParameter, SetParameterFormula, SetConstraint, SaveFamily.",
    {
      action: z
        .enum([
          "OpenFamily",
          "AddGeometry",
          "ModifyGeometry",
          "DeleteGeometry",
          "AddParameter",
          "ModifyParameter",
          "SetParameterFormula",
          "AddConstraint",
          "SetMaterial",
          "SaveFamily",
          "SaveAsNewFamily",
        ])
        .describe("Action to perform on the family"),
      familyPath: z
        .string()
        .optional()
        .describe("File path to the family (.rfa) to open (for OpenFamily action)"),
      familyName: z
        .string()
        .optional()
        .describe("Name of loaded family to edit (alternative to familyPath)"),
      geometry: z
        .array(
          z.object({
            geometryId: z.number().optional().describe("ElementId of existing geometry to modify/delete"),
            geometryType: z.enum(["Extrusion", "Blend", "Revolve", "Sweep", "Void"]).optional(),
            profile: z
              .array(
                z.object({
                  x: z.number().describe("X in mm"),
                  y: z.number().describe("Y in mm"),
                })
              )
              .optional()
              .describe("New profile for geometry"),
            extrusionDepth: z.number().optional().describe("Extrusion depth in mm"),
            material: z.string().optional().describe("Material assignment"),
          })
        )
        .optional()
        .describe("Geometry operations (for AddGeometry, ModifyGeometry, DeleteGeometry)"),
      parameters: z
        .array(
          z.object({
            parameterName: z.string().describe("Parameter name"),
            parameterType: z
              .enum(["Length", "Area", "Volume", "Angle", "Number", "Integer", "YesNo", "Text", "Material"])
              .optional(),
            defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
            formula: z.string().optional().describe("Parameter formula (e.g., 'Width / 2', 'Height + 100')"),
            isReporting: z.boolean().optional().describe("Whether this is a reporting parameter"),
          })
        )
        .optional()
        .describe("Parameter operations (for AddParameter, ModifyParameter, SetParameterFormula)"),
      saveAsPath: z
        .string()
        .optional()
        .describe("Path to save modified family (for SaveFamily, SaveAsNewFamily)"),
      reloadIntoProject: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to reload the family into the current project after saving"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("edit_family", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Edit family failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
