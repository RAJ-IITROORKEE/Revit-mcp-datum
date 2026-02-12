import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateQuantityTakeoffTool(server: McpServer) {
  server.tool(
    "create_quantity_takeoff",
    "Create material quantity takeoff schedules in Revit. Extracts volumes, areas, lengths, and counts by material type or element category. Essential for cost estimation, procurement, and construction planning. Returns formatted schedules with quantities organized by material (concrete, steel, drywall, etc.) or CSI division. Supports exporting to CSV for integration with estimating software.",
    {
      takeoffType: z
        .enum(["MaterialTakeoff", "ElementTakeoff", "AreaTakeoff", "VolumeTakeoff", "Custom"])
        .describe(
          "'MaterialTakeoff' groups by material, 'ElementTakeoff' by element type, 'AreaTakeoff' for area-based quantities (flooring, painting), 'VolumeTakeoff' for volume-based (concrete, excavation)."
        ),
      scheduleName: z
        .string()
        .describe("Name for the quantity takeoff schedule (e.g., 'Concrete Quantities', 'Steel Tonnage', 'Drywall SF')"),
      categories: z
        .array(z.string())
        .optional()
        .describe(
          "Revit categories to include (e.g., ['OST_Walls', 'OST_Floors', 'OST_StructuralFraming']). If omitted, includes all categories."
        ),
      materials: z
        .array(z.string())
        .optional()
        .describe("Specific materials to include (e.g., ['Concrete - Cast-in-Place', 'Steel - W-Shape']). If omitted, includes all materials."),
      fields: z
        .array(
          z.object({
            fieldName: z
              .string()
              .describe("Field to include in schedule (e.g., 'Material: Name', 'Material: Volume', 'Family', 'Type', 'Area', 'Length')"),
            calculationType: z
              .enum(["Sum", "Average", "Maximum", "Minimum", "Count"])
              .optional()
              .describe("How to aggregate values"),
          })
        )
        .optional()
        .describe("Fields to include in the schedule. Default includes material, volume, area, and count."),
      groupBy: z
        .array(z.string())
        .optional()
        .describe("Fields to group by (e.g., ['Material: Name', 'Family']). Creates subtotals."),
      phaseFilter: z
        .string()
        .optional()
        .describe("Phase filter name to show quantities for specific construction phase"),
      csiFormat: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to organize by CSI MasterFormat divisions (03 Concrete, 05 Metals, etc.)"),
      exportToCSV: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to export the schedule to CSV file"),
      csvPath: z
        .string()
        .optional()
        .describe("Output path for CSV export"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_quantity_takeoff", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create quantity takeoff failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
