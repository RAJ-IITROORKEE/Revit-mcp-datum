import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerApplyStructuralLoadsTool(server: McpServer) {
  server.tool(
    "apply_structural_loads",
    "Apply structural loads to Revit analytical model elements. Supports point loads (columns), line loads (beams), area loads (floors, roofs), and load cases (dead, live, wind, seismic, snow). Defines load combinations per ASCE 7 or Eurocode. Essential for structural analysis workflows and load-aware design. Loads are applied to analytical model elements (not physical elements).",
    {
      loads: z
        .array(
          z.object({
            loadType: z
              .enum(["Point", "Line", "Area", "UniformArea", "Wind", "Seismic", "Temperature"])
              .describe("Type of load to apply"),
            loadCase: z
              .enum(["Dead", "Live", "LiveRoof", "Snow", "Wind", "Seismic", "Temperature", "ConstructionLive", "Custom"])
              .describe("Load case classification per ASCE 7 / Eurocode"),
            elementId: z
              .number()
              .optional()
              .describe("ElementId of structural analytical element to apply load to"),
            location: z
              .object({
                x: z.number().describe("X coordinate in mm"),
                y: z.number().describe("Y coordinate in mm"),
                z: z.number().describe("Z coordinate in mm"),
              })
              .optional()
              .describe("Load application point (for Point loads)"),
            magnitude: z
              .number()
              .describe("Load magnitude in N (Newtons) for point loads, N/m for line loads, N/m² (Pa) for area loads"),
            direction: z
              .object({
                x: z.number().describe("X component of load direction vector"),
                y: z.number().describe("Y component"),
                z: z.number().describe("Z component (typically -1 for gravity loads)"),
              })
              .optional()
              .describe("Load direction vector. Default is -Z (downward) for gravity loads."),
            distributionType: z
              .enum(["Uniform", "Varying", "Concentrated"])
              .optional()
              .default("Uniform")
              .describe("How the load is distributed over the element"),
            loadCaseName: z
              .string()
              .optional()
              .describe("Custom load case name"),
          })
        )
        .min(1)
        .describe("Array of load definitions to apply"),
      loadCombinations: z
        .array(
          z.object({
            combinationName: z.string().describe("Load combination name (e.g., '1.2D + 1.6L', 'D + L + W')"),
            loadFactors: z
              .array(
                z.object({
                  loadCaseName: z.string().describe("Load case name"),
                  factor: z.number().describe("Load factor (e.g., 1.2 for dead, 1.6 for live per ASCE 7)"),
                })
              )
              .describe("Load cases and their factors in this combination"),
            combinationType: z
              .enum(["Strength", "Service", "UltimateLimit", "ServiceabilityLimit"])
              .optional()
              .describe("Type of load combination per code requirements"),
          })
        )
        .optional()
        .describe("Load combinations per ASCE 7-16 or Eurocode"),
      codeStandard: z
        .enum(["ASCE_7", "Eurocode", "IS_Code", "NBCC", "AS_NZS", "Custom"])
        .optional()
        .default("ASCE_7")
        .describe("Structural code standard for load factors and combinations"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("apply_structural_loads", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Apply structural loads failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
