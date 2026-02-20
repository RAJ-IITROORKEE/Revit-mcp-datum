import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSendCodeToRevitTool(server: McpServer) {
  server.tool(
    "send_code_to_revit",
    "❌ WARNING: This tool ONLY executes C# code via Roslyn compiler. Python, pyRevit, and IronPython are NOT supported and will fail. ✅ Use C# syntax only. Code executes inside: `public static object Execute(Document document, object[] parameters)`. Available: `document` (Autodesk.Revit.DB.Document), `parameters` (object[]). Pre-imported namespaces: System, System.Linq, System.Collections.Generic, Autodesk.Revit.DB, Autodesk.Revit.UI. MUST end with return statement (use `return null;` if no value). Example: `var walls = new FilteredElementCollector(document).OfClass(typeof(Wall)).ToElements(); return $\"Found {walls.Count} walls\";`",
    {
      code: z
        .string()
        .describe(
          "✅ C# code ONLY (NOT Python/pyRevit/IronPython). Executes in: `public static object Execute(Document document, object[] parameters)`. Use C# syntax like: 'new FilteredElementCollector(document)', 'typeof(Wall)', '$\"string {var}\"'. MUST include return statement. Example: `var collector = new FilteredElementCollector(document).OfClass(typeof(Wall)); return collector.GetElementCount();`"
        ),
      parameters: z
        .array(z.any())
        .optional()
        .describe(
          "Optional execution parameters that will be passed to your code"
        ),
    },
    async (args, extra) => {
      const params = {
        code: args.code,
        parameters: args.parameters || [],
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("send_code_to_revit", params);
        });

        return {
          content: [
            {
              type: "text",
              text: `Code execution successful!\nResult: ${JSON.stringify(
                response,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Code execution failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
