import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateAdaptiveComponentTool(server: McpServer) {
  server.tool(
    "create_adaptive_component",
    "Create and place adaptive component families in Revit. Adaptive components use adaptive points that can be positioned anywhere in 3D space — the component geometry adapts/stretches to fit. Essential for complex facades, parametric structures, and free-form designs (curtain panels, structural nodes, cladding systems). Use get_loaded_families with filter for adaptive families.",
    {
      action: z
        .enum(["Place", "ModifyPoints", "CreateAdaptiveFamily"])
        .describe(
          "'Place' places an adaptive component by positioning its adaptive points, 'ModifyPoints' moves adaptive points of existing instance, 'CreateAdaptiveFamily' creates a new adaptive family definition."
        ),
      adaptiveTypeId: z
        .number()
        .optional()
        .describe("ElementId of adaptive component type to place (for Place action)"),
      adaptivePoints: z
        .array(
          z.object({
            x: z.number().describe("X coordinate in mm"),
            y: z.number().describe("Y coordinate in mm"),
            z: z.number().describe("Z coordinate in mm"),
            pointNumber: z.number().optional().describe("Adaptive point number (1, 2, 3, 4...)"),
          })
        )
        .optional()
        .describe("Adaptive point positions. Number of points must match the family's adaptive point count (typically 3-4)."),
      instanceId: z
        .number()
        .optional()
        .describe("ElementId of existing adaptive component instance (for ModifyPoints)"),
      familyDefinition: z
        .object({
          familyName: z.string().describe("Name for the new adaptive family"),
          numberOfAdaptivePoints: z.number().min(2).max(16).describe("Number of adaptive points (2-16)"),
          geometryTemplate: z
            .enum(["Panel", "StructuralNode", "CurtainPanel", "RoofTile", "Custom"])
            .optional()
            .describe("Template geometry type"),
        })
        .optional()
        .describe("Configuration for CreateAdaptiveFamily action"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_adaptive_component", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create adaptive component failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
