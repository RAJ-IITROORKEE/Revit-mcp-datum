import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateFoundationTool(server: McpServer) {
  server.tool(
    "create_foundation",
    "Create structural foundation elements in Revit. Supports wall foundations (continuous strip footings under walls), isolated foundations (pad footings under columns), strip foundations (standalone continuous footings), and mat/raft foundations. Essential for completing the structural system of any building. Use get_available_family_types with categoryList ['OST_StructuralFoundation'] to discover available foundation types. All units are in millimeters (mm).",
    {
      foundations: z
        .array(
          z.object({
            foundationTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the foundation type. Use get_available_family_types with 'OST_StructuralFoundation'. If omitted, uses default type."
              ),
            foundationType: z
              .enum(["WallFoundation", "Isolated", "Strip", "Mat"])
              .describe(
                "Type: 'WallFoundation' under walls, 'Isolated' under columns, 'Strip' standalone continuous, 'Mat' slab foundation."
              ),
            hostElementId: z
              .number()
              .optional()
              .describe(
                "ElementId of the host element (wall for WallFoundation, column for Isolated). Required for WallFoundation and Isolated types."
              ),
            location: z
              .object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
                z: z.number().optional().default(0).describe("Z coordinate in mm"),
              })
              .optional()
              .describe("Placement point for Isolated foundations (center of pad)"),
            boundary: z
              .array(
                z.object({
                  startPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm"),
                  }),
                  endPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                    z: z.number().optional().default(0).describe("Z coordinate in mm"),
                  }),
                })
              )
              .optional()
              .describe("Boundary loop for Strip and Mat foundations (closed loop of line segments)"),
            levelId: z
              .number()
              .describe("ElementId of the foundation level (typically the lowest level)"),
            width: z
              .number()
              .optional()
              .describe("Foundation width in mm (for wall foundations and strip footings)"),
            thickness: z
              .number()
              .optional()
              .describe("Foundation thickness/depth in mm"),
            offset: z
              .number()
              .optional()
              .default(0)
              .describe("Vertical offset from the level in mm (typically negative, below grade)"),
            eccentricity: z
              .number()
              .optional()
              .default(0)
              .describe("Lateral offset of foundation centerline from wall/column center in mm"),
          })
        )
        .min(1)
        .describe("Array of foundation definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_foundation", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create foundation failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
