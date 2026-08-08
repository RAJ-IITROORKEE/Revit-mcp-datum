import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedMutationToolResult, normalizedToolCatch } from "./_result.js";

const detailPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const detailLineSchema = z.union([
  z.object({
    start: detailPointSchema,
    end: detailPointSchema,
    lineStyleName: z.string().optional(),
  }),
  z.object({
    startPoint: detailPointSchema,
    endPoint: detailPointSchema,
    lineStyleName: z.string().optional(),
  }).transform(({ startPoint, endPoint, lineStyleName }) => ({
    start: startPoint,
    end: endPoint,
    ...(lineStyleName === undefined ? {} : { lineStyleName }),
  })),
]);

export function registerCreateDetailLinesTool(server: McpServer) {
  server.tool(
    "create_detail_lines",
    "Create detail lines in Revit views for 2D drafting, annotations, and detailing. Detail lines are view-specific and don't represent model geometry. Supports multiple line styles including solid, dashed, and dotted patterns.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where detail lines will be placed"),
      lines: z
        .array(
          detailLineSchema
        )
        .describe("Array of handler-native start/end lines. Legacy startPoint/endPoint is normalized."),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_detail_lines", params);
        });

        return normalizedMutationToolResult("create_detail_lines", response);
      } catch (error) {
        return normalizedToolCatch("create_detail_lines", error);
      }
    }
  );
}
