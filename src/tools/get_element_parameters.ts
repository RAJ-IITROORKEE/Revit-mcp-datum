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
         .array(
           z.enum([
             "PG_GEOMETRY",
             "PG_IDENTITY_DATA",
             "PG_MATERIALS",
             "PG_STRUCTURAL",
             "PG_CONSTRAINTS",
             "PG_CONSTRUCTION",
             "PG_GRAPHICS",
             "PG_ANALYSIS",
             "PG_PHASING",
             "PG_KEYNOTING",
             "PG_ADSK_MEP",
             "PG_TEXT",
             "PG_DATA",
           ])
         )
         .optional()
         .describe(
           "Filter by parameter groups. Examples: PG_GEOMETRY (dimensions/coordinates), PG_IDENTITY_DATA (name/mark), PG_MATERIALS (finish), PG_STRUCTURAL (load info), PG_PHASING (phase/workset), PG_ADSK_MEP (MEP data)"
         ),
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
