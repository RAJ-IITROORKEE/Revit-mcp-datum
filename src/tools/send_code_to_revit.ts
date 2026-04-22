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
      // PYTHON CODE DETECTION: Reject Python/pyRevit code before sending to Revit
      const code = args.code;
      const pythonIndicators = [
        'import ',
        'from ',
        'def ',
        'pyrevit',
        'clr.AddReference',
        '__revit__',
        'IN[',
        'OUT =',
        'TransactionManager',
        'UnwrapElement',
      ];

      const hasPythonSyntax = pythonIndicators.some(indicator => 
        code.toLowerCase().includes(indicator.toLowerCase())
      );

      if (hasPythonSyntax) {
        return {
          content: [
            {
              type: "text",
              text: `❌ REJECTED: Python/pyRevit code detected!\n\nThis tool ONLY supports C# code via Roslyn compiler.\n\n🚫 Python, pyRevit, Dynamo Python, and IronPython are NOT supported.\n\n✅ Please rewrite using C# syntax:\n- Use 'new FilteredElementCollector(document)' instead of Python iterators\n- Use 'typeof(Wall)' instead of Python type syntax\n- Use 'var' or explicit types instead of Python dynamic typing\n- Must include a return statement\n\nExample C# code:\nvar walls = new FilteredElementCollector(document)\n    .OfClass(typeof(Wall))\n    .WhereElementIsNotElementType()\n    .ToElements();\nreturn $"Found {walls.Count} walls";`,
            },
          ],
        };
      }

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
              text: `✅ Code execution successful!\n\nResult:\n${JSON.stringify(
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
              text: `❌ Code execution failed: ${
                error instanceof Error ? error.message : String(error)
              }\n\nTip: Ensure you're using C# syntax, not Python. Code must include a return statement.`,
            },
          ],
        };
      }
    }
  );
}
