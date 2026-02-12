import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateWallRevealTool(server: McpServer) {
  server.tool(
    "create_wall_reveal",
    "Create wall reveal elements in Revit — horizontal grooves/channels cut into the wall surface for architectural detailing. Reveals create shadow lines, material transitions, and decorative patterns on wall faces. Common uses: rustication joints, panel delineation, and expansion joint representation. All units are in millimeters (mm).",
    {
      reveals: z
        .array(
          z.object({
            wallId: z
              .number()
              .describe("ElementId of the wall to add the reveal to"),
            revealProfileTypeId: z
              .number()
              .optional()
              .describe("ElementId of the reveal profile type"),
            wallSide: z
              .enum(["Exterior", "Interior", "Both"])
              .optional()
              .default("Exterior")
              .describe("Which side of the wall to cut the reveal"),
            distanceFromBase: z
              .number()
              .optional()
              .describe("Vertical distance from the wall base in mm"),
            distanceFromTop: z
              .number()
              .optional()
              .describe("Vertical distance from the wall top in mm (alternative to distanceFromBase)"),
            depth: z
              .number()
              .optional()
              .describe("How deep the reveal cuts into the wall surface in mm"),
            width: z
              .number()
              .optional()
              .describe("Width of the reveal groove in mm"),
            offset: z
              .number()
              .optional()
              .default(0)
              .describe("Horizontal offset from the wall face in mm"),
          })
        )
        .min(1)
        .describe("Array of wall reveal definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_wall_reveal", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create wall reveal failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
