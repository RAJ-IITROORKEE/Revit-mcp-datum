import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateWallTool(server: McpServer) {
  server.tool(
    "create_wall",
    "Create walls in Revit with full control over wall type, layer structure, stacked walls, and embedded walls. Supports basic walls (single layer structure), curtain walls, stacked walls (different wall types at different heights), and embedded walls (walls inserted into other walls like parapets). Use get_available_family_types with categoryList ['OST_Walls'] to discover wall types. All units are in millimeters (mm).",
    {
      walls: z
        .array(
          z.object({
            wallTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the wall type. Use get_available_family_types with 'OST_Walls'. If omitted, uses default wall type."
              ),
            locationLine: z
              .object({
                startPoint: z.object({
                  x: z.number().describe("X coordinate of wall start in mm"),
                  y: z.number().describe("Y coordinate of wall start in mm"),
                  z: z.number().optional().default(0).describe("Z coordinate in mm"),
                }),
                endPoint: z.object({
                  x: z.number().describe("X coordinate of wall end in mm"),
                  y: z.number().describe("Y coordinate of wall end in mm"),
                  z: z.number().optional().default(0).describe("Z coordinate in mm"),
                }),
              })
              .describe("Line defining the wall location"),
            baseLevelId: z
              .number()
              .describe("ElementId of the base level. Use get_levels_list to find levels."),
            topLevelId: z
              .number()
              .optional()
              .describe("ElementId of the top level. If omitted, uses unconnectedHeight."),
            baseOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset from base level in mm"),
            topOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Offset from top level in mm"),
            unconnectedHeight: z
              .number()
              .optional()
              .describe("Wall height in mm when not connected to a top level"),
            isStructural: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether this is a structural wall"),
            locationLinePosition: z
              .enum(["WallCenterline", "CoreCenterline", "FinishFaceExterior", "FinishFaceInterior", "CoreFaceExterior", "CoreFaceInterior"])
              .optional()
              .default("WallCenterline")
              .describe("Where the location line is positioned relative to the wall layers"),
            flipped: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether to flip the wall orientation (exterior/interior faces)"),
            stackedWallConfig: z
              .object({
                isStacked: z.boolean().describe("Whether this is a stacked wall (multiple wall types at different heights)"),
                segments: z
                  .array(
                    z.object({
                      wallTypeId: z.number().describe("Wall type for this segment"),
                      startHeight: z.number().describe("Starting height of this segment from base in mm"),
                      endHeight: z.number().describe("Ending height of this segment from base in mm"),
                    })
                  )
                  .optional()
                  .describe("Wall type segments for stacked walls (bottom to top)"),
              })
              .optional()
              .describe("Stacked wall configuration (e.g., CMU base + wood frame above)"),
            embeddedWall: z
              .object({
                hostWallId: z.number().describe("ElementId of the host wall to embed this wall into"),
                embedDepth: z.number().optional().describe("How deep to embed into the host wall in mm"),
              })
              .optional()
              .describe("Configuration for embedding this wall into another wall (e.g., parapet embedded in exterior wall)"),
          })
        )
        .min(1)
        .describe("Array of wall definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_wall", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create wall failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
