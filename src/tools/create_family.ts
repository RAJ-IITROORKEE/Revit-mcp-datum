import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateFamilyTool(server: McpServer) {
  server.tool(
    "create_family",
    "Create new Revit families programmatically from templates. Families are parametric components (furniture, fixtures, doors, windows, equipment) that can be placed multiple times in projects. This tool enables AI to generate custom components instead of being limited to existing libraries. Supports creating families from templates, adding geometry, defining parameters, and setting constraints. Returns the created family for further editing or loading into the project.",
    {
      familyTemplate: z
        .enum([
          "GenericModel",
          "Door",
          "Window",
          "Furniture",
          "Column",
          "StructuralFraming",
          "LightingFixture",
          "ElectricalFixture",
          "PlumbingFixture",
          "MechanicalEquipment",
          "Casework",
          "Railing",
          "Custom",
        ])
        .describe("Family template category to start from. Defines behavior and hosting properties."),
      customTemplatePath: z
        .string()
        .optional()
        .describe("Path to custom family template file (.rft) if using 'Custom' template"),
      familyName: z
        .string()
        .describe("Name for the new family (e.g., 'Custom Desk 1800x900', 'LED Panel 2x4')"),
      geometry: z
        .array(
          z.object({
            geometryType: z
              .enum(["Extrusion", "Blend", "Revolve", "Sweep", "SweptBlend", "Void"])
              .describe("Type of 3D geometry to create"),
            profile: z
              .array(
                z.object({
                  x: z.number().describe("X coordinate in mm"),
                  y: z.number().describe("Y coordinate in mm"),
                })
              )
              .optional()
              .describe("2D profile for extrusion/revolve/sweep"),
            extrusionDepth: z.number().optional().describe("Extrusion depth in mm"),
            revolveAxis: z
              .object({
                startPoint: z.object({ x: z.number(), y: z.number() }),
                endPoint: z.object({ x: z.number(), y: z.number() }),
              })
              .optional()
              .describe("Axis line for revolve operation"),
            material: z.string().optional().describe("Material to assign to geometry"),
          })
        )
        .optional()
        .describe("Geometry definitions for the family. If omitted, creates empty family for manual editing."),
      parameters: z
        .array(
          z.object({
            parameterName: z.string().describe("Parameter name (e.g., 'Width', 'Height', 'Depth')"),
            parameterType: z
              .enum(["Length", "Area", "Volume", "Angle", "Number", "Integer", "YesNo", "Text", "Material", "URL"])
              .describe("Parameter data type"),
            defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional().describe("Default value"),
            isInstance: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether this is an instance parameter (true) or type parameter (false)"),
            group: z.string().optional().describe("Parameter group (e.g., 'Dimensions', 'Identity Data')"),
          })
        )
        .optional()
        .describe("Parameters to add to the family"),
      savePath: z
        .string()
        .optional()
        .describe("File path to save the created family (.rfa). If omitted, family is created in memory and can be loaded immediately."),
      loadIntoProject: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to automatically load the created family into the current project"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_family", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create family failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
