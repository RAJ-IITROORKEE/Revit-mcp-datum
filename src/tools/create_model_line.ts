import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedMutationToolResult, normalizedToolCatch } from "./_result.js";

const modelLinePointSchema = z.object({
  x: z.number().describe("X coordinate in mm"),
  y: z.number().describe("Y coordinate in mm"),
  z: z.number().optional().default(0).describe("Z coordinate in mm"),
});

export function registerCreateModelLineTool(server: McpServer) {
  server.tool(
    "create_model_line",
    "Create straight model lines on a Revit level. Model lines are visible in all views. All coordinates are in millimeters (mm).",
    {
      levelId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Level ElementId. Uses the first available level when omitted."),
      lines: z
        .array(
          z.object({
            startPoint: modelLinePointSchema.describe("Start point"),
            endPoint: modelLinePointSchema.describe("End point"),
          })
        )
        .min(1)
        .describe("Array of model line definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_model_line", args);
        });
        return normalizedMutationToolResult("create_model_line", response);
      } catch (error) {
        return normalizedToolCatch("create_model_line", error);
      }
    }
  );
}
