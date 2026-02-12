import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSetElementMaterialTool(server: McpServer) {
  server.tool(
    "set_element_material",
    "Assign or change materials on Revit elements. Supports setting materials by parameter (e.g., wall finish material, floor surface material), by element face, or by paint operation (visual override without changing the element's actual material). Use get_project_materials first to discover available material names and IDs.",
    {
      assignments: z
        .array(
          z.object({
            elementId: z
              .number()
              .describe("ElementId of the element to assign material to"),
            materialId: z
              .number()
              .optional()
              .describe("ElementId of the material to assign (from get_project_materials)"),
            materialName: z
              .string()
              .optional()
              .describe("Material name (alternative to materialId). Tool will look up the ID."),
            assignmentMode: z
              .enum(["Parameter", "Paint", "TypeMaterial"])
              .optional()
              .default("Parameter")
              .describe(
                "'Parameter' sets a material parameter on the element, 'Paint' applies visual material to a face (like painting a wall), 'TypeMaterial' changes the type's structural/finish material."
              ),
            parameterName: z
              .string()
              .optional()
              .describe("Specific material parameter to set (e.g., 'Structural Material', 'Finish Material', 'Surface Material'). Required for Parameter mode."),
            faceIndex: z
              .number()
              .optional()
              .describe("Face index for Paint mode (0 = first face). Use get_element_spatial_data to identify faces."),
          })
        )
        .min(1)
        .describe("Array of material assignments"),
      transactionName: z
        .string()
        .optional()
        .default("Set Materials")
        .describe("Transaction name for undo history"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("set_element_material", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Set element material failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
