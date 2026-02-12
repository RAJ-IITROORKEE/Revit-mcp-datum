import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerJoinUnjoinGeometryTool(server: McpServer) {
  server.tool(
    "join_unjoin_geometry",
    "Join or unjoin the geometry of overlapping Revit elements to create clean intersections. When walls, floors, ceilings, roofs, and columns overlap, joining removes the overlapping material for clean construction details. Essential for producing accurate section views and quantity takeoffs. Supports join order switching to control which element is cut by which. All units are in millimeters (mm).",
    {
      action: z
        .enum(["Join", "Unjoin", "SwitchJoinOrder", "AreJoined", "JoinMultiple"])
        .describe(
          "Action: 'Join' joins two elements, 'Unjoin' unjoins them, 'SwitchJoinOrder' swaps which element cuts which, 'AreJoined' checks if two elements are joined, 'JoinMultiple' batch-joins all pairs in the list."
        ),
      elementId1: z
        .number()
        .optional()
        .describe("First ElementId (required for Join, Unjoin, SwitchJoinOrder, AreJoined)"),
      elementId2: z
        .number()
        .optional()
        .describe("Second ElementId (required for Join, Unjoin, SwitchJoinOrder, AreJoined)"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Array of ElementIds for 'JoinMultiple' — all overlapping pairs within this set will be joined"),
      joinWallsToFloors: z
        .boolean()
        .optional()
        .default(false)
        .describe("When using JoinMultiple, also join walls to floors/ceilings they intersect"),
      joinWallsToRoofs: z
        .boolean()
        .optional()
        .default(false)
        .describe("When using JoinMultiple, also join walls to roofs they intersect"),
      joinWallsToColumns: z
        .boolean()
        .optional()
        .default(false)
        .describe("When using JoinMultiple, also join walls to columns they intersect"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("join_unjoin_geometry", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Join/unjoin geometry failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
