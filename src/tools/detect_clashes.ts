import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedToolCatch, normalizedToolResult } from "./_result.js";

export function registerDetectClashesTool(server: McpServer) {
  server.tool(
    "detect_clashes",
    "Detect confirmed geometric intersections between two explicitly selected, non-empty sets of Revit elements. Returns at most limit clashes.",
    {
      scope: z
        .literal("SelectedElements")
        .describe("Only the safely bounded SelectedElements mode is supported."),
      elementIds1: z
        .array(z.number().int().positive())
        .min(1)
        .max(500)
        .describe("First non-empty set of Revit ElementIds (maximum 500)"),
      elementIds2: z
        .array(z.number().int().positive())
        .min(1)
        .max(500)
        .describe("Second non-empty set of Revit ElementIds (maximum 500)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10000)
        .optional()
        .default(100)
        .describe("Maximum number of clashes to return (1-10000, default 100)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("detect_clashes", args);
        });
        return normalizedToolResult("detect_clashes", response);
      } catch (error) {
        return normalizedToolCatch("detect_clashes", error);
      }
    }
  );
}
