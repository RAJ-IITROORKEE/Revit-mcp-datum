import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetLoadedFamiliesTool(server: McpServer) {
  server.tool(
    "get_loaded_families",
    "Get a comprehensive catalog of all families currently loaded in the Revit project, organized by category. Returns family names, type names, type IDs, and key parameters for each loaded family. This is essential for LLM-assisted component placement — call this tool first to discover what components are available, then use place_component or create_point_based_element to place them. Supports filtering by category, family name, and includes parameter details for intelligent type selection.",
    {
      categoryFilter: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by Revit built-in category names. Examples: ['OST_Doors', 'OST_Windows', 'OST_Furniture', 'OST_Columns', 'OST_StructuralColumns', 'OST_StructuralFraming', 'OST_Floors', 'OST_Roofs', 'OST_Ceilings', 'OST_Stairs', 'OST_Ramps', 'OST_Railings', 'OST_CurtainWallPanels', 'OST_CurtainWallMullions', 'OST_GenericModel', 'OST_Planting', 'OST_Site', 'OST_Parking', 'OST_Casework', 'OST_ElectricalFixtures', 'OST_LightingFixtures', 'OST_MechanicalEquipment', 'OST_PlumbingFixtures', 'OST_SpecialityEquipment']. If omitted, returns all categories."
        ),
      familyNameFilter: z
        .string()
        .optional()
        .describe(
          "Filter by family name (partial match). Example: 'Single-Flush' to find door families matching that name."
        ),
      includeParameters: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Whether to include detailed parameter values for each type (dimensions, materials, etc.). Useful for LLM to select the right type based on requirements."
        ),
      includeTypeImage: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include type preview image data (base64 encoded)"),
      groupByCategory: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to group results by category for easier browsing"),
      limit: z
        .number()
        .optional()
        .default(200)
        .describe("Maximum number of family types to return"),
    },
    async (args) => {
      const params = {
        categoryFilter: args.categoryFilter || [],
        familyNameFilter: args.familyNameFilter || "",
        includeParameters: args.includeParameters ?? false,
        includeTypeImage: args.includeTypeImage ?? false,
        groupByCategory: args.groupByCategory ?? true,
        limit: args.limit || 200,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_loaded_families", params);
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
              text: `Get loaded families failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
