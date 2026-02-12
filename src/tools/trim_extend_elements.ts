import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerTrimExtendElementsTool(server: McpServer) {
  server.tool(
    "trim_extend_elements",
    "Trim or extend walls and lines to meet a boundary element or each other in Revit. Trim removes the portion beyond a cutting element. Extend lengthens an element to reach a target. Supports trim/extend single elements, trim two elements to their intersection (corner), and trim/extend multiple elements to a common boundary. Essential for creating clean wall intersections and room boundaries. All units are in millimeters (mm).",
    {
      action: z
        .enum(["TrimToElement", "ExtendToElement", "TrimCorner", "TrimExtendMultiple"])
        .describe(
          "Action: 'TrimToElement' trims element to a boundary, 'ExtendToElement' extends to reach a boundary, 'TrimCorner' trims two elements to their intersection, 'TrimExtendMultiple' trims/extends multiple elements to a single boundary."
        ),
      elementId: z
        .number()
        .optional()
        .describe("ElementId of the element to trim or extend (for TrimToElement, ExtendToElement)"),
      boundaryElementId: z
        .number()
        .optional()
        .describe("ElementId of the boundary element to trim/extend to"),
      elementId1: z
        .number()
        .optional()
        .describe("First ElementId for TrimCorner"),
      elementId2: z
        .number()
        .optional()
        .describe("Second ElementId for TrimCorner"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Array of ElementIds for TrimExtendMultiple (all will be trimmed/extended to the boundary)"),
      pickPoint: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().optional().default(0).describe("Z coordinate in mm"),
        })
        .optional()
        .describe("Pick point indicating which side of the element to keep (for trim operations). The portion nearest this point is preserved."),
      extendBothEnds: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, extend from both ends. If false, only extend the nearer end."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("trim_extend_elements", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Trim/extend failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
