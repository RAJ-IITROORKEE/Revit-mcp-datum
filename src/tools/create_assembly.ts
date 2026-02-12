import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateAssemblyTool(server: McpServer) {
  server.tool(
    "create_assembly",
    "Create assembly views in Revit for construction details and shop drawings. Assemblies group related elements (e.g., typical wall section, stair assembly, curtain wall panel) and automatically generate orthographic views, sections, and 3D views of just those elements. Essential for detailed construction documentation, prefab coordination, and shop drawing generation. All units are in millimeters (mm).",
    {
      action: z
        .enum(["Create", "AddElements", "RemoveElements", "CreateViews", "ListAssemblies"])
        .describe(
          "Action: 'Create' makes a new assembly, 'AddElements' adds to existing, 'RemoveElements' removes from existing, 'CreateViews' auto-generates assembly views, 'ListAssemblies' shows all assemblies."
        ),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds to include in the assembly (for Create, AddElements)"),
      assemblyId: z
        .number()
        .optional()
        .describe("ElementId of existing assembly (for AddElements, RemoveElements, CreateViews)"),
      assemblyName: z
        .string()
        .optional()
        .describe("Name for the assembly (e.g., 'Typical Wall Section', 'Stair Detail', 'Curtain Wall Panel A')"),
      assemblyCode: z
        .string()
        .optional()
        .describe("Assembly code for identification (e.g., 'A-101', 'S-201')"),
      namingCategory: z
        .string()
        .optional()
        .describe("Category name for naming convention (e.g., 'Walls', 'Stairs', 'Curtain Panels')"),
      viewTypes: z
        .array(
          z.enum([
            "Front",
            "Back",
            "Left",
            "Right",
            "Top",
            "Bottom",
            "ThreeD",
            "Section",
            "Detail",
            "PartList",
            "MaterialTakeoff",
          ])
        )
        .optional()
        .describe(
          "Types of views to auto-generate for the assembly (for CreateViews action). Default creates Front, ThreeD, and PartList."
        ),
      sheetId: z
        .number()
        .optional()
        .describe("Sheet ElementId to place assembly views on"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_assembly", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create assembly failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
