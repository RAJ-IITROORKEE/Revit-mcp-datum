import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerManageWorksetsTool(server: McpServer) {
  server.tool(
    "manage_worksets",
    "Manage worksets in Revit workshared models for multi-user collaboration. Worksets organize model elements by discipline, zone, or design phase, allowing team members to work concurrently. Actions: CreateWorkset, ListWorksets, AssignElementsToWorkset, SetActiveWorkset, SetWorksetVisibility, CloseWorkset, GetElementWorkset. Essential for large projects with multiple users and AI-driven element organization by discipline/zone.",
    {
      action: z
        .enum([
          "CreateWorkset",
          "ListWorksets",
          "AssignElementsToWorkset",
          "SetActiveWorkset",
          "SetWorksetVisibility",
          "CloseWorkset",
          "OpenWorkset",
          "GetElementWorkset",
          "RenameWorkset",
        ])
        .describe("Workset management action to perform"),
      worksetName: z
        .string()
        .optional()
        .describe("Workset name (e.g., 'Architecture', 'Structure', 'MEP-Plumbing', 'Level 1', 'Core-Shell', 'Tenant Improvements')"),
      worksetId: z
        .number()
        .optional()
        .describe("Workset ElementId (for AssignElementsToWorkset, SetActiveWorkset, SetWorksetVisibility, CloseWorkset, OpenWorkset, RenameWorkset)"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds to assign to workset (for AssignElementsToWorkset)"),
      visible: z
        .boolean()
        .optional()
        .describe("Visibility state for workset (for SetWorksetVisibility): true = visible, false = hidden"),
      defaultVisibility: z
        .enum(["Visible", "Hidden"])
        .optional()
        .describe("Default visibility for new workset (for CreateWorkset)"),
      isEditable: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether the workset can be edited by users (for CreateWorkset)"),
      organizationStrategy: z
        .enum(["ByDiscipline", "ByLevel", "ByZone", "ByPhase", "Custom"])
        .optional()
        .describe("Strategy for organizing worksets when creating multiple at once"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("manage_worksets", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Manage worksets failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
