import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerOffsetElementTool(server: McpServer) {
  server.tool(
    "offset_element",
    "Create offset copies of walls, lines, and curves in Revit. Offset creates a parallel copy at a specified distance — essential for creating parallel walls (corridor walls), setback lines, boundary offsets, and double-line drafting. The offset direction is determined by a reference point or explicit side specification. All units are in millimeters (mm).",
    {
      elementId: z
        .number()
        .describe("ElementId of the element to offset (wall, detail line, model line, room separation line)"),
      offsetDistance: z
        .number()
        .describe("Offset distance in mm (always positive — direction determined by 'side' or 'referencePoint')"),
      side: z
        .enum(["Left", "Right", "Interior", "Exterior", "Auto"])
        .optional()
        .default("Auto")
        .describe(
          "Which side to offset to: 'Left'/'Right' relative to wall direction, 'Interior'/'Exterior' for closed loops, 'Auto' determines side from referencePoint."
        ),
      referencePoint: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().optional().default(0).describe("Z coordinate in mm"),
        })
        .optional()
        .describe("A point on the desired side of the offset (used with 'Auto' side). The offset is created on the same side as this point."),
      createCopy: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true, creates a new element at the offset distance. If false, moves the original element."),
      numberOfOffsets: z
        .number()
        .optional()
        .default(1)
        .describe("Number of offset copies to create (each at incrementing distances)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("offset_element", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Offset element failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
