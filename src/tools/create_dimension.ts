import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateDimensionTool(server: McpServer) {
  server.tool(
    "create_dimension",
    "Create dimensions in Revit views for documenting distances and measurements. Supports linear, angular, radial, and arc dimensions. Essential for construction documentation and detailing.",
    {
      viewId: z
        .number()
        .describe("ElementId of the view where the dimension will be placed"),
      dimensionType: z
        .enum(["Linear", "Angular", "Radial", "ArcLength", "Diameter"])
        .describe("Type of dimension. Linear: straight distance between points. Angular: angle between two lines. Radial: radius of curved element. ArcLength: length along an arc. Diameter: diameter of circular element."),
      references: z
        .array(
          z.object({
            elementId: z.number().describe("ElementId of the element to reference"),
            point: z
              .object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
                z: z.number().describe("Z coordinate in mm"),
              })
              .optional()
              .describe("Specific point on the element (optional, uses element face/edge if not specified)"),
          })
        )
        .describe("Array of references (points or elements) to dimension between"),
      dimensionLine: z
        .object({
          origin: z.object({
            x: z.number().describe("X coordinate in mm"),
            y: z.number().describe("Y coordinate in mm"),
            z: z.number().describe("Z coordinate in mm"),
          }),
          direction: z.object({
            x: z.number().describe("X component of direction vector"),
            y: z.number().describe("Y component of direction vector"),
            z: z.number().describe("Z component of direction vector"),
          }),
        })
        .describe("Line defining the dimension location and orientation"),
      dimensionStyleId: z
        .number()
        .optional()
        .describe("ElementId of dimension style/type to use"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_dimension", params);
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
              text: `Create dimension failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
