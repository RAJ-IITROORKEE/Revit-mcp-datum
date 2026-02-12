import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerLoadFamilyTool(server: McpServer) {
  server.tool(
    "load_family",
    "Load Revit family files (.rfa) from the library into the current project. This tool allows LLM-assisted component selection by first listing available families in specified library paths, then loading selected families. Supports loading from default Revit library, custom paths, and searching by category or name pattern. Essential for making components available before placement.",
    {
      action: z
        .enum(["list", "load", "search", "listCategories"])
        .describe(
          "Action to perform: 'list' lists families in a directory, 'load' loads a specific family file, 'search' searches for families by name across library paths, 'listCategories' lists all available family categories in the library."
        ),
      libraryPaths: z
        .array(z.string())
        .optional()
        .describe(
          "Array of directory paths to search for family files. If omitted, uses the default Revit family library path (e.g., C:\\ProgramData\\Autodesk\\RVT 2024\\Libraries)."
        ),
      familyFilePath: z
        .string()
        .optional()
        .describe(
          "Full file path to a specific .rfa family file to load (required for 'load' action)."
        ),
      categoryFilter: z
        .string()
        .optional()
        .describe(
          "Filter families by Revit category name (e.g., 'Doors', 'Windows', 'Furniture', 'Columns', 'Structural Framing'). Used with 'list' and 'search' actions."
        ),
      searchPattern: z
        .string()
        .optional()
        .describe(
          "Name pattern to search for (supports partial matching). Example: 'Single-Flush' to find door families matching that name."
        ),
      overwriteExisting: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Whether to overwrite if a family with the same name already exists in the project. If false and family exists, returns existing family info."
        ),
      overwriteParameterValues: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Whether to overwrite parameter values of existing types when reloading a family."
        ),
      includeSubfolders: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to search in subfolders when listing or searching"),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe("Maximum number of results to return for list and search actions"),
    },
    async (args) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("load_family", params);
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Load family operation failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
