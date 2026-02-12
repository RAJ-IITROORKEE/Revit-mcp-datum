import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateDuctTool(server: McpServer) {
  server.tool(
    "create_duct",
    "Create HVAC ductwork in Revit for air distribution. Supports rectangular, round, oval, and flexible ducts. Auto-generates fittings (elbows, tees, transitions, take-offs) at direction changes and connections. Use get_available_family_types with categoryList ['OST_DuctCurves'] to discover duct types. Essential for supply air, return air, exhaust, and outside air systems. All units are in millimeters (mm).",
    {
      ducts: z
        .array(
          z.object({
            ductTypeId: z
              .number()
              .optional()
              .describe("ElementId of duct type. Use get_available_family_types with 'OST_DuctCurves'."),
            ductShape: z
              .enum(["Rectangular", "Round", "Oval", "Flexible"])
              .describe("Cross-section shape of the duct"),
            path: z
              .array(
                z.object({
                  x: z.number().describe("X coordinate in mm"),
                  y: z.number().describe("Y coordinate in mm"),
                  z: z.number().describe("Z coordinate in mm"),
                })
              )
              .min(2)
              .describe("Array of points defining the duct path (minimum 2 points)"),
            width: z
              .number()
              .optional()
              .describe("Duct width in mm (for rectangular/oval). Typical: 200-1200mm."),
            height: z
              .number()
              .optional()
              .describe("Duct height in mm (for rectangular/oval). Typical: 150-800mm."),
            diameter: z
              .number()
              .optional()
              .describe("Duct diameter in mm (for round/flexible). Typical: 100-600mm."),
            systemClassification: z
              .enum(["SupplyAir", "ReturnAir", "ExhaustAir", "OutsideAir", "VentilationAir", "KitchenExhaust", "Smoke"])
              .optional()
              .default("SupplyAir")
              .describe("HVAC system type"),
            autoFittings: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether to auto-generate fittings at direction changes"),
            insulationThickness: z
              .number()
              .optional()
              .describe("Insulation thickness in mm (for external insulation)"),
            levelId: z
              .number()
              .optional()
              .describe("Reference level for the duct route"),
          })
        )
        .min(1)
        .describe("Array of duct definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_duct", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create duct failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
