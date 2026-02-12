import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerMirrorElementsTool(server: McpServer) {
  server.tool(
    "mirror_elements",
    "Mirror Revit elements across an axis line. Creates a mirrored copy of selected elements (or moves them to mirrored position). Essential for symmetric building designs — mirror one half of a floor plan to create the other half, mirror facades, or create symmetric room layouts. All units are in millimeters (mm).",
    {
      elementIds: z
        .array(z.number())
        .min(1)
        .describe("Array of ElementIds to mirror"),
      mirrorAxis: z
        .object({
          startPoint: z.object({
            x: z.number().describe("X coordinate of mirror axis start in mm"),
            y: z.number().describe("Y coordinate of mirror axis start in mm"),
            z: z.number().optional().default(0).describe("Z coordinate in mm"),
          }),
          endPoint: z.object({
            x: z.number().describe("X coordinate of mirror axis end in mm"),
            y: z.number().describe("Y coordinate of mirror axis end in mm"),
            z: z.number().optional().default(0).describe("Z coordinate in mm"),
          }),
        })
        .describe("The axis line to mirror across. Elements are reflected on the opposite side of this line."),
      copyInsteadOfMove: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true, creates mirrored copies (keeps originals). If false, moves elements to mirrored positions."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("mirror_elements", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Mirror elements failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
