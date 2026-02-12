import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateSprinklerSystemTool(server: McpServer) {
  server.tool(
    "create_sprinkler_system",
    "Create fire protection sprinkler systems in Revit. Includes sprinkler pipes, sprinkler heads, standpipes, fire hydrants, and fire pumps. Auto-calculates head spacing per NFPA 13 standards. Essential for building fire safety systems. Use get_loaded_families with categories ['OST_Sprinklers', 'OST_PipeCurves'] for components. All units are in millimeters (mm).",
    {
      action: z
        .enum(["CreatePipe", "PlaceHead", "CreateSystem", "CalculateCoverage"])
        .describe(
          "Action: 'CreatePipe' for sprinkler piping, 'PlaceHead' for sprinkler heads, 'CreateSystem' to group components, 'CalculateCoverage' to verify NFPA compliance."
        ),
      pipes: z
        .array(
          z.object({
            pipeTypeId: z.number().optional().describe("ElementId of sprinkler pipe type"),
            path: z
              .array(
                z.object({
                  x: z.number().describe("X coordinate in mm"),
                  y: z.number().describe("Y coordinate in mm"),
                  z: z.number().describe("Z coordinate in mm"),
                })
              )
              .min(2)
              .describe("Pipe path points"),
            diameter: z
              .number()
              .optional()
              .describe("Pipe diameter in mm (e.g., 25mm = 1\", 32mm = 1.25\", 50mm = 2\")"),
          })
        )
        .optional()
        .describe("Sprinkler pipes to create (for CreatePipe action)"),
      sprinklerHeads: z
        .array(
          z.object({
            sprinklerTypeId: z
              .number()
              .describe("ElementId of sprinkler head type. Use get_loaded_families with 'OST_Sprinklers'."),
            location: z.object({
              x: z.number().describe("X coordinate in mm"),
              y: z.number().describe("Y coordinate in mm"),
              z: z.number().describe("Z coordinate in mm"),
            }),
            levelId: z.number().optional().describe("Level for the sprinkler head"),
            headType: z
              .enum(["Pendant", "Upright", "Sidewall", "Concealed", "ESFR", "Deluge"])
              .optional()
              .describe("Type of sprinkler head"),
            coverageRadiusFt: z
              .number()
              .optional()
              .describe("Coverage radius in feet (NFPA 13: typically 7.5-15 ft depending on hazard class)"),
            kFactor: z
              .number()
              .optional()
              .describe("K-factor for flow calculation (typical: 5.6, 8.0, 11.2)"),
          })
        )
        .optional()
        .describe("Sprinkler heads to place (for PlaceHead action)"),
      systemConfig: z
        .object({
          systemName: z.string().describe("Fire protection system name"),
          systemType: z
            .enum(["WetPipe", "DryPipe", "Preaction", "Deluge", "Antifreeze"])
            .optional()
            .default("WetPipe")
            .describe("Type of sprinkler system"),
          hazardClassification: z
            .enum(["LightHazard", "OrdinaryHazard1", "OrdinaryHazard2", "ExtraHazard1", "ExtraHazard2"])
            .optional()
            .describe("NFPA 13 hazard classification"),
          designDensityGPM: z
            .number()
            .optional()
            .describe("Design density in GPM per square foot (per NFPA 13)"),
          areaOfApplication: z
            .number()
            .optional()
            .describe("Design area of application in square feet"),
        })
        .optional()
        .describe("System configuration (for CreateSystem action)"),
      roomId: z
        .number()
        .optional()
        .describe("Room to calculate coverage for (CalculateCoverage action)"),
      autoLayout: z
        .boolean()
        .optional()
        .default(false)
        .describe("Auto-place sprinkler heads per NFPA spacing rules"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_sprinkler_system", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create sprinkler system failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
