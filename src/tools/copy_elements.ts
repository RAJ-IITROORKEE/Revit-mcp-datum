import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCopyElementsTool(server: McpServer) {
  server.tool(
    "copy_elements",
    "Copy one or more Revit elements with a translation vector or between levels. Essential for replicating elements across a multi-story building (e.g., copy all walls from Level 1 to Level 2), duplicating room layouts, or copying elements with an offset. Returns the ElementIds of the newly created copies. All units are in millimeters (mm).",
    {
      elementIds: z
        .array(z.number())
        .min(1)
        .describe("Array of ElementIds to copy"),
      copyMode: z
        .enum(["Translation", "BetweenLevels", "ToPoint"])
        .describe(
          "Copy mode: 'Translation' moves copies by a vector offset, 'BetweenLevels' copies from one level to another (maintaining XY positions), 'ToPoint' copies from a base point to a destination point."
        ),
      translation: z
        .object({
          x: z.number().describe("X translation offset in mm"),
          y: z.number().describe("Y translation offset in mm"),
          z: z.number().describe("Z translation offset in mm"),
        })
        .optional()
        .describe("Translation vector for 'Translation' mode"),
      sourceLevelId: z
        .number()
        .optional()
        .describe("Source level ElementId for 'BetweenLevels' mode"),
      destinationLevelIds: z
        .array(z.number())
        .optional()
        .describe("Array of destination level ElementIds for 'BetweenLevels' mode (copy to multiple levels at once)"),
      basePoint: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().optional().default(0).describe("Z coordinate in mm"),
        })
        .optional()
        .describe("Base reference point for 'ToPoint' mode"),
      destinationPoint: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().optional().default(0).describe("Z coordinate in mm"),
        })
        .optional()
        .describe("Destination point for 'ToPoint' mode"),
      numberOfCopies: z
        .number()
        .optional()
        .default(1)
        .describe("Number of copies to make (each subsequent copy offset by the same translation)"),
      copyViewSpecific: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to copy view-specific elements (annotations, detail lines) as well"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("copy_elements", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Copy elements failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
