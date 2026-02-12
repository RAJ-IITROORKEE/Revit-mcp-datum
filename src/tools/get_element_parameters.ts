import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetElementParametersTool(server: McpServer) {
  server.tool(
    "get_element_parameters",
    "Get all parameters (instance and type) of one or more Revit elements. Returns parameter names, values, units, data types, and whether they are read-only. Essential for LLM to understand element properties before modification, for reading material assignments, dimensions, marks, comments, structural properties, MEP data, and any custom parameters. Supports filtering by parameter group or name pattern.",
    {
      elementIds: z
        .array(z.number())
        .min(1)
        .describe("Array of ElementIds to retrieve parameters from"),
      includeTypeParameters: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include type parameters in addition to instance parameters"),
      includeBuiltInParameters: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include Revit built-in parameters"),
      includeSharedParameters: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include shared (project/family) parameters"),
      parameterNameFilter: z
        .string()
        .optional()
        .describe("Filter parameters by name (partial match). Example: 'Width' returns all parameters containing 'Width'."),
      parameterGroupFilter: z
        .array(z.string())
        .optional()
        .describe("Filter by parameter group names (e.g., 'PG_GEOMETRY', 'PG_IDENTITY_DATA', 'PG_MATERIALS', 'PG_STRUCTURAL')"),
      includeEmptyValues: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include parameters with empty/null values"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_element_parameters", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Get element parameters failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
