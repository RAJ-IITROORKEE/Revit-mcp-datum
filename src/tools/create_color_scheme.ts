import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateColorSchemeTool(server: McpServer) {
  server.tool(
    "create_color_scheme",
    "Create color schemes for rooms and areas in Revit to visualize data through color-coded plans. Automatically assigns colors based on parameter values like department, occupancy type, or area ranges. Essential for space planning presentations and analysis diagrams.",
    {
      schemeName: z
        .string()
        .describe("Name for the color scheme (e.g., 'Department Colors', 'Occupancy Type')"),
      schemeType: z
        .enum(["Room", "Area"])
        .describe("Apply color scheme to Rooms or Areas"),
      parameterName: z
        .string()
        .describe("Parameter to base colors on (e.g., 'Department', 'Name', 'Occupancy', 'Area')"),
      colorEntries: z
        .array(
          z.object({
            value: z.union([z.string(), z.number()]).describe("Parameter value to match (e.g., 'Office', 'Conference Room', '100')"),
            color: z
              .array(z.number())
              .describe("RGB color [R, G, B] (0-255) for this value"),
            fillPattern: z
              .string()
              .optional()
              .describe("Fill pattern name (e.g., 'Solid fill', 'Diagonal crosshatch', 'Dots'). Uses solid if not specified."),
          })
        )
        .describe("Color assignments for different parameter values"),
      includeAreaBoundaries: z
        .boolean()
        .default(true)
        .describe("Show area/room boundaries in the color scheme"),
      showTitle: z
        .boolean()
        .default(true)
        .describe("Display color scheme title and legend"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_color_scheme", params);
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
              text: `Create color scheme failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
