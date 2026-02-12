import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateColumnTool(server: McpServer) {
  server.tool(
    "create_column",
    "Create architectural and structural column elements in Revit. Supports placing columns at specific points with level constraints, rotation, and slant options. Columns can be placed as vertical columns between levels or as slanted columns between two points. Use get_available_family_types with categoryList ['OST_Columns'] for architectural or ['OST_StructuralColumns'] for structural columns to discover available types. All units are in millimeters (mm).",
    {
      columns: z
        .array(
          z.object({
            columnTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the column family type. Use get_available_family_types with 'OST_Columns' (architectural) or 'OST_StructuralColumns' (structural). If omitted, uses the default column type."
              ),
            columnCategory: z
              .enum(["Architectural", "Structural"])
              .optional()
              .default("Structural")
              .describe("Whether this is an architectural or structural column"),
            location: z
              .object({
                x: z.number().describe("X coordinate of column center in mm"),
                y: z.number().describe("Y coordinate of column center in mm"),
                z: z.number().optional().default(0).describe("Z coordinate in mm (default 0)"),
              })
              .describe("Base point location of the column"),
            baseLevelId: z
              .number()
              .describe(
                "ElementId of the base level. Use get_levels_list to find available levels."
              ),
            topLevelId: z
              .number()
              .optional()
              .describe(
                "ElementId of the top level. If omitted, column height is determined by unconnectedHeight."
              ),
            baseOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset from the base level in mm"),
            topOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset from the top level in mm"),
            unconnectedHeight: z
              .number()
              .optional()
              .describe(
                "Column height in mm when not connected to a top level. Used when topLevelId is not provided."
              ),
            rotation: z
              .number()
              .optional()
              .default(0)
              .describe("Rotation angle in degrees (0-360) around the vertical axis"),
            isSlanted: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether to create a slanted column"),
            topPoint: z
              .object({
                x: z.number().describe("X coordinate of column top in mm"),
                y: z.number().describe("Y coordinate of column top in mm"),
                z: z.number().describe("Z coordinate of column top in mm"),
              })
              .optional()
              .describe(
                "Top point for slanted columns. When isSlanted is true, the column leans from location to topPoint."
              ),
            attachToGrid: z
              .number()
              .optional()
              .describe(
                "ElementId of a grid intersection to snap the column to. Overrides location coordinates."
              ),
            gridIntersection: z
              .object({
                gridId1: z.number().describe("ElementId of first grid line"),
                gridId2: z.number().describe("ElementId of second grid line"),
              })
              .optional()
              .describe("Place column at the intersection of two grid lines"),
          })
        )
        .min(1)
        .describe("Array of column definitions to create"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_column", params);
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Create column failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
