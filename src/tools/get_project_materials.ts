import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetProjectMaterialsTool(server: McpServer) {
  server.tool(
    "get_project_materials",
    "Get all materials available in the current Revit project with their properties. Returns material names, IDs, appearance (color, transparency, texture), physical properties (density, strength), thermal properties, and assigned asset info. Essential for LLM to understand available finishes and for assigning materials to elements. Use with set_element_material to apply materials.",
    {
      searchName: z
        .string()
        .optional()
        .describe("Filter materials by name (partial match). Example: 'Concrete' returns all concrete materials."),
      materialClass: z
        .string()
        .optional()
        .describe("Filter by material class (e.g., 'Concrete', 'Metal', 'Wood', 'Glass', 'Paint', 'Ceramic', 'Plastic', 'Stone', 'Masonry')"),
      includeAppearance: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include visual appearance properties (color, transparency, texture path)"),
      includePhysical: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include physical/structural properties (density, Young's modulus, Poisson ratio)"),
      includeThermal: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include thermal properties (conductivity, specific heat, emissivity)"),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum number of materials to return"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_project_materials", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Get project materials failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
