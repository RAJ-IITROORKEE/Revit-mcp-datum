import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreatePipeTool(server: McpServer) {
  server.tool(
    "create_pipe",
    "Create plumbing pipes in Revit for water distribution, sanitary drainage, storm drainage, and gas piping. Auto-generates fittings (elbows, tees, couplings, reducers) at direction changes and connections. Use get_available_family_types with categoryList ['OST_PipeCurves'] to discover pipe types. All units are in millimeters (mm).",
    {
      pipes: z
        .array(
          z.object({
            pipeTypeId: z
              .number()
              .optional()
              .describe("ElementId of pipe type. Use get_available_family_types with 'OST_PipeCurves'."),
            systemClassification: z
              .enum([
                "DomesticColdWater",
                "DomesticHotWater",
                "DomesticHotWaterReturn",
                "Sanitary",
                "StormDrainage",
                "Vent",
                "NaturalGas",
                "MedicalGas",
                "Fire",
                "ChilledWater",
                "HotWater",
                "CondenserWater",
              ])
              .describe("Plumbing/mechanical piping system type"),
            path: z
              .array(
                z.object({
                  x: z.number().describe("X coordinate in mm"),
                  y: z.number().describe("Y coordinate in mm"),
                  z: z.number().describe("Z coordinate in mm"),
                })
              )
              .min(2)
              .describe("Array of points defining the pipe path (minimum 2 points)"),
            diameter: z
              .number()
              .optional()
              .describe("Pipe diameter in mm (e.g., 13mm = 1/2\", 19mm = 3/4\", 25mm = 1\", 50mm = 2\", 100mm = 4\")"),
            autoFittings: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether to auto-generate fittings at direction changes"),
            insulationThickness: z
              .number()
              .optional()
              .describe("Insulation thickness in mm (for hot/chilled water pipes)"),
            levelId: z
              .number()
              .optional()
              .describe("Reference level for the pipe route"),
            slope: z
              .number()
              .optional()
              .describe("Pipe slope in % (for drainage pipes, typically 1-4%)"),
          })
        )
        .min(1)
        .describe("Array of pipe definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_pipe", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create pipe failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
