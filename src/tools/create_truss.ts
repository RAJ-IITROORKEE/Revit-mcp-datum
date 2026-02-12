import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateTrussTool(server: McpServer) {
  server.tool(
    "create_truss",
    "Create truss elements in Revit for roof and floor structural systems. Trusses span between supports and provide efficient load transfer. Supports various truss profiles (parallel chord, pitched, scissor, bowstring) with configurable span, bearing width, and top/bottom chord profiles. Use get_available_family_types with categoryList ['OST_StructuralTruss'] to discover available truss types. All units are in millimeters (mm).",
    {
      trusses: z
        .array(
          z.object({
            trussTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the truss type. Use get_available_family_types with 'OST_StructuralTruss'. If omitted, uses default truss type."
              ),
            startPoint: z.object({
              x: z.number().describe("X coordinate of truss start (left bearing) in mm"),
              y: z.number().describe("Y coordinate of truss start in mm"),
              z: z.number().optional().default(0).describe("Z coordinate in mm"),
            }),
            endPoint: z.object({
              x: z.number().describe("X coordinate of truss end (right bearing) in mm"),
              y: z.number().describe("Y coordinate of truss end in mm"),
              z: z.number().optional().default(0).describe("Z coordinate in mm"),
            }),
            levelId: z
              .number()
              .describe("ElementId of the level for the truss base"),
            topChordProfile: z
              .enum(["Flat", "Pitched", "Curved", "Scissor"])
              .optional()
              .default("Pitched")
              .describe("Shape of the top chord"),
            height: z
              .number()
              .optional()
              .describe("Overall truss height (depth) at midspan in mm"),
            pitch: z
              .number()
              .optional()
              .describe("Roof pitch as rise/run ratio (e.g., 0.5 for 6:12 pitch). Used for pitched trusses."),
            bearingWidth: z
              .number()
              .optional()
              .describe("Width of bearing support at each end in mm"),
            overhang: z
              .number()
              .optional()
              .default(0)
              .describe("Overhang beyond the bearing points in mm"),
            rotation: z
              .number()
              .optional()
              .default(0)
              .describe("Rotation angle in degrees around the span axis"),
          })
        )
        .min(1)
        .describe("Array of truss definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_truss", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create truss failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
