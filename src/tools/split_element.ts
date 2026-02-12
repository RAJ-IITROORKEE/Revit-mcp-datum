import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSplitElementTool(server: McpServer) {
  server.tool(
    "split_element",
    "Split Revit elements (walls, lines, pipes, ducts) at specified points or by intersecting elements. Splitting a wall creates two separate walls at the split point — useful for changing wall types midway, creating control joints, or inserting different wall segments. Supports splitting with gap for expansion joints. All units are in millimeters (mm).",
    {
      elementId: z
        .number()
        .describe("ElementId of the element to split"),
      splitMode: z
        .enum(["AtPoint", "ByIntersection", "WithGap"])
        .describe(
          "Split mode: 'AtPoint' splits at a specific point, 'ByIntersection' splits where another element crosses, 'WithGap' splits and removes a segment (creates a gap)."
        ),
      splitPoint: z
        .object({
          x: z.number().describe("X coordinate of split point in mm"),
          y: z.number().describe("Y coordinate of split point in mm"),
          z: z.number().optional().default(0).describe("Z coordinate in mm"),
        })
        .optional()
        .describe("Point where the element should be split (for 'AtPoint' mode)"),
      intersectingElementId: z
        .number()
        .optional()
        .describe("ElementId of the intersecting element to split at (for 'ByIntersection' mode)"),
      gapWidth: z
        .number()
        .optional()
        .describe("Width of gap in mm (for 'WithGap' mode — element is split and a segment is removed)"),
      deleteMiddleSegment: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true with 'WithGap', deletes the middle segment. If false, keeps it as a separate element."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("split_element", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Split element failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
