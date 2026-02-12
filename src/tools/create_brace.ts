import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateBraceTool(server: McpServer) {
  server.tool(
    "create_brace",
    "Create structural brace elements in Revit for lateral load resistance. Braces connect between columns and beams diagonally to resist wind and seismic forces. Supports various brace configurations (X-brace, V-brace, chevron, single diagonal). Use get_available_family_types with categoryList ['OST_StructuralFraming'] to discover available brace types. All units are in millimeters (mm).",
    {
      braces: z
        .array(
          z.object({
            braceTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the structural framing type to use as brace. Use get_available_family_types with 'OST_StructuralFraming'."
              ),
            startPoint: z.object({
              x: z.number().describe("X coordinate of brace start (typically at beam/column junction) in mm"),
              y: z.number().describe("Y coordinate of brace start in mm"),
              z: z.number().describe("Z coordinate (elevation) of brace start in mm"),
            }),
            endPoint: z.object({
              x: z.number().describe("X coordinate of brace end in mm"),
              y: z.number().describe("Y coordinate of brace end in mm"),
              z: z.number().describe("Z coordinate (elevation) of brace end in mm"),
            }),
            levelId: z
              .number()
              .optional()
              .describe("ElementId of the reference level"),
            rotation: z
              .number()
              .optional()
              .default(0)
              .describe("Cross-section rotation in degrees"),
            startOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset at start point in mm"),
            endOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset at end point in mm"),
            braceConfiguration: z
              .enum(["SingleDiagonal", "XBrace", "VBrace", "Chevron", "KBrace"])
              .optional()
              .default("SingleDiagonal")
              .describe("Brace configuration pattern. For X/V/Chevron/K, provide the primary diagonal — the tool creates the complementary member(s)."),
          })
        )
        .min(1)
        .describe("Array of brace definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_brace", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create brace failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
