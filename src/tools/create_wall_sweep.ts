import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateWallSweepTool(server: McpServer) {
  server.tool(
    "create_wall_sweep",
    "Create wall sweep elements in Revit — horizontal profiles that run along walls for architectural detailing. Includes cornices (top of wall), baseboards/skirting (bottom of wall), crown molding, chair rails, wainscoting caps, belt courses, and water tables. Wall sweeps follow the wall geometry including corners. Use get_available_family_types with categoryList ['OST_Cornices'] for sweep profiles. All units are in millimeters (mm).",
    {
      sweeps: z
        .array(
          z.object({
            wallId: z
              .number()
              .describe("ElementId of the wall to add the sweep to"),
            sweepType: z
              .enum(["Sweep", "Reveal"])
              .optional()
              .default("Sweep")
              .describe("Type: 'Sweep' for protruding profiles (cornices, baseboards), 'Reveal' for cut-in grooves"),
            profileTypeId: z
              .number()
              .optional()
              .describe("ElementId of the sweep profile type. Use get_available_family_types with 'OST_Cornices' to find profiles."),
            wallSide: z
              .enum(["Exterior", "Interior", "Both"])
              .optional()
              .default("Exterior")
              .describe("Which side of the wall to apply the sweep"),
            distanceFromBase: z
              .number()
              .optional()
              .describe("Vertical distance from the wall base in mm. Use 0 for baseboard, wall height for cornice."),
            distanceFromTop: z
              .number()
              .optional()
              .describe("Vertical distance from the wall top in mm. Alternative to distanceFromBase."),
            offset: z
              .number()
              .optional()
              .default(0)
              .describe("Horizontal offset from the wall face in mm (positive = outward)"),
            isCut: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether the sweep cuts into the wall (true) or projects outward (false)"),
            flipToInside: z
              .boolean()
              .optional()
              .default(false)
              .describe("Flip the sweep profile to the inside of the wall"),
            material: z
              .string()
              .optional()
              .describe("Material name to apply to the sweep (e.g., 'Wood - Cherry', 'Paint - White')"),
            subcategory: z
              .enum(["Cornice", "Baseboard", "CrownMolding", "ChairRail", "WainscotCap", "BeltCourse", "WaterTable", "Custom"])
              .optional()
              .describe("Functional subcategory for the sweep (aids in scheduling and visibility control)"),
          })
        )
        .min(1)
        .describe("Array of wall sweep definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_wall_sweep", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create wall sweep failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
