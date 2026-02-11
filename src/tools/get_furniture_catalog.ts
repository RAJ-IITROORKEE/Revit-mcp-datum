import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Browse available furniture families loaded in the project.
 * Returns furniture types with dimensions, categories, and preview info.
 */
export function registerGetFurnitureCatalogTool(server: McpServer) {
  server.tool(
    "get_furniture_catalog",
    `Browse the complete catalog of furniture families and types available in the current Revit project. Returns detailed information about each furniture piece including dimensions, category, family name, type name, and type ID needed for placement.

This tool searches across multiple furniture-related categories:
- OST_Furniture (standard furniture)
- OST_FurnitureSystems (furniture systems/workstations)
- OST_SpecialityEquipment (specialty items)
- OST_Casework (casework/cabinetry)
- OST_Planting (indoor plants)
- OST_GenericModel (generic models that may be furniture)

Use the returned typeId values with place_furniture_in_room or auto_furnish_room tools.
Use search filters to find specific furniture types by name, category, or size range.`,
    {
      searchName: z
        .string()
        .optional()
        .describe("Search furniture by name (partial match, case-insensitive). Example: 'desk', 'chair', 'sofa', 'table'"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Filter by specific Revit categories. Defaults to all furniture categories. Options: 'OST_Furniture', 'OST_FurnitureSystems', 'OST_SpecialityEquipment', 'OST_Casework', 'OST_Planting', 'OST_GenericModel'"),
      furnitureType: z
        .enum(["all", "seating", "tables", "desks", "storage", "beds", "sofas", "lighting", "accessories", "workstations"])
        .default("all")
        .describe("Filter by furniture functional type"),
      minWidthMm: z
        .number()
        .optional()
        .describe("Minimum width filter in mm"),
      maxWidthMm: z
        .number()
        .optional()
        .describe("Maximum width filter in mm"),
      minDepthMm: z
        .number()
        .optional()
        .describe("Minimum depth filter in mm"),
      maxDepthMm: z
        .number()
        .optional()
        .describe("Maximum depth filter in mm"),
      includeDimensions: z
        .boolean()
        .default(true)
        .describe("Include width, depth, height dimensions for each furniture type"),
      includeParameterValues: z
        .boolean()
        .default(false)
        .describe("Include all parameter values for each type (more data but comprehensive)"),
      limit: z
        .number()
        .default(50)
        .describe("Maximum number of furniture types to return"),
    },
    async (args, extra) => {
      const params = {
        searchName: args.searchName || "",
        categories: args.categories || [
          "OST_Furniture",
          "OST_FurnitureSystems",
          "OST_SpecialityEquipment",
          "OST_Casework",
          "OST_Planting",
          "OST_GenericModel",
        ],
        furnitureType: args.furnitureType,
        minWidthMm: args.minWidthMm,
        maxWidthMm: args.maxWidthMm,
        minDepthMm: args.minDepthMm,
        maxDepthMm: args.maxDepthMm,
        includeDimensions: args.includeDimensions,
        includeParameterValues: args.includeParameterValues,
        limit: args.limit,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "get_furniture_catalog",
            params
          );
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
              text: `Get furniture catalog failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
