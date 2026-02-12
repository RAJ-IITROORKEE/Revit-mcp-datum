import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateBuildingPadTool(server: McpServer) {
  server.tool(
    "create_building_pad",
    "Create building pad elements in Revit that cut into topography surfaces to define the building footprint at grade. Building pads flatten the terrain to a specified elevation where the building sits. Essential for showing correct ground levels around buildings in site plans. Use get_available_family_types with categoryList ['OST_BuildingPad'] for pad types. All units are in millimeters (mm).",
    {
      pads: z
        .array(
          z.object({
            padTypeId: z
              .number()
              .optional()
              .describe("ElementId of the building pad type. If omitted, uses default."),
            boundary: z
              .array(
                z.object({
                  startPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                  }),
                  endPoint: z.object({
                    x: z.number().describe("X coordinate in mm"),
                    y: z.number().describe("Y coordinate in mm"),
                  }),
                })
              )
              .min(3)
              .describe("Boundary lines forming a closed loop for the pad footprint"),
            elevation: z
              .number()
              .describe("Pad elevation in mm (the flat finished grade elevation)"),
            levelId: z
              .number()
              .describe("ElementId of the associated level"),
            heightOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Height offset from the level in mm"),
            thickness: z
              .number()
              .optional()
              .describe("Pad thickness in mm (depth of cut into terrain)"),
          })
        )
        .min(1)
        .describe("Array of building pad definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_building_pad", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create building pad failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
