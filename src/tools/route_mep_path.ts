import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerRouteMepPathTool(server: McpServer) {
  server.tool(
    "route_mep_path",
    "Auto-route MEP elements (pipes, ducts, conduits, cable trays) in Revit from source to destination points. Uses intelligent pathfinding to avoid obstructions (walls, floors, structural elements, other MEP), maintain clearances, follow preferred routing zones, and minimize length. Essential for MEP coordination and clash-free routing. All units are in millimeters (mm).",
    {
      routes: z
        .array(
          z.object({
            elementType: z
              .enum(["Pipe", "Duct", "Conduit", "CableTray"])
              .describe("Type of MEP element to route"),
            typeId: z
              .number()
              .optional()
              .describe("ElementId of specific pipe/duct/conduit type to use"),
            startPoint: z.object({
              x: z.number().describe("X coordinate of route start in mm"),
              y: z.number().describe("Y coordinate in mm"),
              z: z.number().describe("Z coordinate in mm"),
            }),
            endPoint: z.object({
              x: z.number().describe("X coordinate of route end in mm"),
              y: z.number().describe("Y coordinate in mm"),
              z: z.number().describe("Z coordinate in mm"),
            }),
            size: z
              .number()
              .optional()
              .describe("Diameter (pipes/conduits) or width (ducts/cable trays) in mm"),
            routingPreferences: z
              .object({
                preferHorizontalFirst: z
                  .boolean()
                  .optional()
                  .default(true)
                  .describe("Route horizontally before vertical drops"),
                avoidWalls: z.boolean().optional().default(true),
                avoidFloors: z.boolean().optional().default(true),
                avoidStructural: z.boolean().optional().default(true),
                avoidOtherMEP: z.boolean().optional().default(true),
                minimumClearance: z
                  .number()
                  .optional()
                  .default(100)
                  .describe("Minimum clearance from obstructions in mm"),
                preferredElevation: z
                  .number()
                  .optional()
                  .describe("Preferred ceiling/floor offset elevation in mm"),
              })
              .optional()
              .describe("Routing behavior preferences"),
            systemClassification: z
              .string()
              .optional()
              .describe("System type for coordination (e.g., 'Supply Air', 'Cold Water', 'Power')"),
          })
        )
        .min(1)
        .describe("Array of MEP routing requests"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("route_mep_path", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Route MEP path failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
