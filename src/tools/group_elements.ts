import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGroupElementsTool(server: McpServer) {
  server.tool(
    "group_elements",
    "Create, manage, and place element groups in Revit. Groups bundle multiple elements together so they can be copied, placed, and edited as a single unit. Changes to one group instance propagate to all instances. Essential for repeating room configurations (hotel rooms, apartment units, office modules), typical details, and standardized layouts across a building. All units are in millimeters (mm).",
    {
      action: z
        .enum(["Create", "Place", "Ungroup", "AddToGroup", "RemoveFromGroup", "ListGroups", "EditGroup"])
        .describe(
          "Action: 'Create' bundles elements into a new group, 'Place' places an existing group type at a location, 'Ungroup' explodes a group into individual elements, 'AddToGroup' adds elements to an existing group, 'RemoveFromGroup' removes elements, 'ListGroups' lists all group types in project, 'EditGroup' modifies a group definition."
        ),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds to include when creating a group, or to add/remove from a group"),
      groupName: z
        .string()
        .optional()
        .describe("Name for new group (Create action) or filter for ListGroups"),
      groupTypeId: z
        .number()
        .optional()
        .describe("Group type ElementId (for Place, EditGroup actions)"),
      groupInstanceId: z
        .number()
        .optional()
        .describe("Group instance ElementId (for Ungroup, AddToGroup, RemoveFromGroup actions)"),
      placementPoint: z
        .object({
          x: z.number().describe("X coordinate in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().optional().default(0).describe("Z coordinate in mm"),
        })
        .optional()
        .describe("Placement point for Place action (insertion point of the group)"),
      rotation: z
        .number()
        .optional()
        .default(0)
        .describe("Rotation angle in degrees for Place action"),
      levelId: z
        .number()
        .optional()
        .describe("Level for placed group instance"),
      includeAttachedDetails: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include view-specific attached detail groups when creating model groups"),
      groupCategory: z
        .enum(["Model", "Detail", "AttachedDetail"])
        .optional()
        .default("Model")
        .describe("Group category: 'Model' for 3D elements, 'Detail' for 2D annotations, 'AttachedDetail' for details linked to model groups"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("group_elements", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Group elements failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
