import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerOptimizeModelTool(server: McpServer) {
  server.tool(
    "optimize_model",
    "Optimize and clean up Revit models for performance. Actions: PurgeUnused (removes unused families, types, materials, line styles), AuditModel (checks/repairs database), CompressModel (reduces file size), OptimizeViews (removes unnecessary view-specific elements), DeleteUnplacedRooms, RemoveEmptyGroups, FindLargeElements (identifies heavy families), FixWarnings. Essential for maintaining model health, especially after AI-driven bulk element creation. Returns cleaned element counts and file size reduction.",
    {
      operations: z
        .array(
          z.enum([
            "PurgeUnused",
            "AuditModel",
            "CompressModel",
            "OptimizeViews",
            "DeleteUnplacedRooms",
            "RemoveEmptyGroups",
            "FindLargeElements",
            "FixWarnings",
            "RemoveDuplicateSheets",
            "CleanSchedules",
          ])
        )
        .describe("Optimization operations to perform. Can specify multiple operations to run in sequence."),
      purgeOptions: z
        .object({
          families: z.boolean().optional().default(true).describe("Purge unused families"),
          types: z.boolean().optional().default(true).describe("Purge unused types"),
          materials: z.boolean().optional().default(true).describe("Purge unused materials"),
          linePatterns: z.boolean().optional().default(true).describe("Purge unused line patterns"),
          fillPatterns: z.boolean().optional().default(true).describe("Purge unused fill patterns"),
          views: z.boolean().optional().default(false).describe("Purge unused views (use with caution)"),
        })
        .optional()
        .describe("What to purge (for PurgeUnused operation)"),
      warningActions: z
        .enum(["ListOnly", "AutoFix", "DeleteElements"])
        .optional()
        .default("ListOnly")
        .describe(
          "How to handle warnings (for FixWarnings operation): 'ListOnly' reports warnings, 'AutoFix' attempts automatic fixes, 'DeleteElements' deletes problematic elements."
        ),
      elementSizeThreshold: z
        .number()
        .optional()
        .default(5)
        .describe("Size threshold in MB for identifying large elements (for FindLargeElements operation)"),
      generateReport: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to generate detailed report of optimization results"),
      backupBeforeOptimization: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to create backup before making changes"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("optimize_model", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Optimize model failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
