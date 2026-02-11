import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Place annotation and drafting symbols in views.
 * Supports north arrows, section marks, detail markers,
 * revision triangles, drawing symbols, and custom symbols.
 */
export function registerCreateAnnotationSymbolTool(server: McpServer) {
  server.tool(
    "create_annotation_symbol",
    `Place annotation symbols and drafting symbols in Revit views. Annotation symbols are view-specific 2D elements used for documentation, including north arrows, section markers, detail callout symbols, revision markers, graphic scales, and custom symbols.

Common annotation symbol types:
- North Arrow
- Graphic Scale Bar
- Section Head/Tail
- Detail Callout Head
- Elevation Mark
- Spot Elevation
- Spot Coordinate
- Revision Triangle/Cloud
- Matchline
- Break Line
- Center Mark
- Door/Window Mark Symbol
- Custom annotation families

Supports batch placement of multiple symbols and automatic numbering/sequencing.`,
    {
      symbols: z
        .array(
          z.object({
            typeId: z
              .number()
              .describe("ElementId of the annotation symbol family type. Use get_available_family_types with category 'OST_GenericAnnotation' to find available types."),
            location: z
              .object({
                x: z.number().describe("X coordinate in the view (mm in model space)"),
                y: z.number().describe("Y coordinate in the view (mm in model space)"),
              })
              .describe("Placement location in the view"),
            rotation: z
              .number()
              .default(0)
              .describe("Rotation angle in degrees (0-360)"),
            label: z
              .string()
              .optional()
              .describe("Text label to set on the symbol (if the symbol family supports a label parameter)"),
            number: z
              .string()
              .optional()
              .describe("Number/identifier to set on the symbol (e.g., detail number, section number)"),
            customParameters: z
              .record(z.any())
              .optional()
              .describe("Additional parameter values to set on the symbol instance"),
          })
        )
        .min(1)
        .describe("Array of annotation symbols to place"),
      viewId: z
        .number()
        .optional()
        .describe("View to place symbols in. Uses the active view if omitted."),
      autoNumber: z
        .boolean()
        .default(false)
        .describe("Automatically assign sequential numbers to symbols"),
      startNumber: z
        .number()
        .default(1)
        .describe("Starting number for auto-numbering"),
      numberPrefix: z
        .string()
        .default("")
        .describe("Prefix for auto-numbered symbols (e.g., 'D' for D1, D2, D3)"),
    },
    async (args, extra) => {
      const params = {
        symbols: args.symbols,
        viewId: args.viewId,
        autoNumber: args.autoNumber,
        startNumber: args.startNumber,
        numberPrefix: args.numberPrefix,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "create_annotation_symbol",
            params
          );
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
              text: `Create annotation symbol failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
