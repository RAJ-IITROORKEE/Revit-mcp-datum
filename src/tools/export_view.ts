import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import path from "node:path";
import { normalizedToolCatch, normalizedToolResult } from "./_result.js";

type ExportViewArgs = {
  viewId?: number;
  filePath?: string;
  format?: string;
  viewIds?: number[];
  outputDirectory?: string;
  fileNamePrefix?: string;
  exportFormat?: string;
  [key: string]: unknown;
};

type NormalizedExportViewArgs = {
  viewId: number;
  filePath: string;
  format: "png" | "jpeg" | "pdf";
};

export function normalizeExportViewArgs(args: ExportViewArgs): NormalizedExportViewArgs {
  if (args.viewIds && args.viewIds.length !== 1) {
    throw new Error("export_view compatibility viewIds must contain exactly one view");
  }

  const viewId = args.viewId ?? args.viewIds?.[0];
  if (typeof viewId !== "number" || !Number.isInteger(viewId) || viewId <= 0) {
    throw new Error("export_view viewId is required");
  }

  const format = (args.format ?? args.exportFormat ?? "png").toLowerCase();
  if (format !== "png" && format !== "jpeg" && format !== "pdf") {
    throw new Error("export_view format must be png, jpeg, or pdf");
  }

  const directFilePath = args.filePath?.trim();
  const outputDirectory = args.outputDirectory?.trim();
  const fileNamePrefix = args.fileNamePrefix?.trim();
  const filePath = directFilePath ??
    (outputDirectory
      ? path.win32.join(outputDirectory, `${fileNamePrefix ?? "export"}.${format}`)
      : undefined);
  if (!filePath) {
    throw new Error("export_view filePath is required");
  }

  return {
    viewId,
    filePath,
    format,
  };
}

export function registerExportViewTool(server: McpServer) {
  server.tool(
    "export_view",
    "Export one Revit view or sheet to PNG, JPEG, or PDF.",
    {
      viewId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("ElementId of the single view or sheet to export. Required unless deprecated viewIds is supplied."),
      filePath: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Full destination file path. Required unless deprecated outputDirectory is supplied."),
      format: z
        .enum(["png", "jpeg", "pdf", "PNG", "JPEG", "PDF"])
        .optional()
        .describe("Handler-native output format"),
      exportFormat: z
        .enum(["PNG", "JPEG", "PDF"])
        .optional()
        .describe("Deprecated alias for format"),
      viewIds: z
        .array(z.number().int().positive())
        .length(1)
        .optional()
        .describe("Deprecated compatibility field containing exactly one view ElementId."),
      outputDirectory: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Deprecated compatibility field used with fileNamePrefix to build filePath."),
      fileNamePrefix: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Deprecated compatibility field used to build filePath."),
    },
    async (args) => {
      try {
        const params = normalizeExportViewArgs(args);
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_view", params);
        });
        return normalizedToolResult("export_view", response);
      } catch (error) {
        return normalizedToolCatch("export_view", error);
      }
    }
  );
}
