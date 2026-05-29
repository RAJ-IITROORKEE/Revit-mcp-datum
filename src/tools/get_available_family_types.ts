import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { normalizedToolCatch, normalizedToolResult } from "./_result.js";

export function registerGetAvailableFamilyTypesTool(server: McpServer) {
  server.tool(
    "get_available_family_types",
    "Get available family types in the current Revit project. You can filter by category and family name, and limit the number of returned types.",
    {
      categoryList: z
        .array(
          z.enum([
            "OST_Walls",
            "OST_Doors",
            "OST_Windows",
            "OST_Furniture",
            "OST_Floors",
            "OST_Roofs",
            "OST_Ceilings",
            "OST_Stairs",
            "OST_Railings",
            "OST_Columns",
            "OST_Beams",
            "OST_Braces",
            "OST_Ducts",
            "OST_Pipes",
            "OST_Electrical",
            "OST_Equipment",
            "OST_Ramps",
            "OST_StructuralFraming",
          ])
        )
        .optional()
        .describe(
          "List of Revit category names to filter by. Examples: OST_Walls, OST_Doors, OST_Windows, OST_Furniture, OST_Floors, OST_Roofs, OST_Ceilings, OST_Stairs, OST_Railings, OST_Columns, OST_Beams, OST_Braces, OST_Ducts, OST_Pipes, OST_Electrical, OST_Equipment, OST_Ramps, OST_StructuralFraming"
        ),
      familyNameFilter: z
        .string()
        .optional()
        .describe("Filter family types by family name (partial match, case-insensitive)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .default(100)
        .describe("Maximum number of family types to return (1-1000, default 100)"),
    },
    async (args, extra) => {
      const params = {
        categoryList: args.categoryList || [],
        familyNameFilter: args.familyNameFilter || "",
        limit: args.limit || 100,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "get_available_family_types",
            params
          );
        });

        return normalizedToolResult("get_available_family_types", response);
      } catch (error) {
        return normalizedToolCatch("get_available_family_types", error);
      }
    }
  );
}
