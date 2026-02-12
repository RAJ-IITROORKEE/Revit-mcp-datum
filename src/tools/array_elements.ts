import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerArrayElementsTool(server: McpServer) {
  server.tool(
    "array_elements",
    "Create linear or radial arrays of Revit elements. Arrays duplicate elements at regular intervals — critical for repeating patterns like columns along a grid, windows along a wall, parking stalls, light fixtures, structural bays, etc. Supports grouping and associating array members so they update together. All units are in millimeters (mm).",
    {
      elementIds: z
        .array(z.number())
        .min(1)
        .describe("Array of ElementIds to array"),
      arrayType: z
        .enum(["Linear", "Radial"])
        .describe("Array type: 'Linear' for straight-line arrays, 'Radial' for circular/polar arrays"),
      numberOfInstances: z
        .number()
        .min(2)
        .describe("Total number of instances in the array (including the original). Minimum 2."),
      linear: z
        .object({
          direction: z.object({
            x: z.number().describe("X component of array direction vector"),
            y: z.number().describe("Y component of array direction vector"),
            z: z.number().optional().default(0).describe("Z component (0 for horizontal arrays)"),
          }),
          spacing: z
            .number()
            .describe("Distance between each instance in mm"),
          moveToLast: z
            .boolean()
            .optional()
            .default(false)
            .describe("If true, 'spacing' is the total distance and instances are evenly distributed. If false, 'spacing' is the distance between each consecutive instance."),
          secondDirection: z
            .object({
              direction: z.object({
                x: z.number().describe("X component of second direction"),
                y: z.number().describe("Y component of second direction"),
                z: z.number().optional().default(0).describe("Z component"),
              }),
              spacing: z.number().describe("Spacing in second direction in mm"),
              count: z.number().min(2).describe("Number of instances in second direction"),
            })
            .optional()
            .describe("Optional second direction for 2D grid arrays (e.g., column grids)"),
        })
        .optional()
        .describe("Configuration for linear arrays"),
      radial: z
        .object({
          centerPoint: z.object({
            x: z.number().describe("X coordinate of rotation center in mm"),
            y: z.number().describe("Y coordinate of rotation center in mm"),
            z: z.number().optional().default(0).describe("Z coordinate in mm"),
          }),
          totalAngle: z
            .number()
            .optional()
            .default(360)
            .describe("Total angle span in degrees (360 for full circle)"),
          rotateInstances: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether each instance rotates to face outward from center"),
        })
        .optional()
        .describe("Configuration for radial (polar) arrays"),
      groupArray: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to group the array members (so editing one updates all)"),
      associative: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether the array is associative (changing count or spacing updates all members)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("array_elements", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Array elements failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
