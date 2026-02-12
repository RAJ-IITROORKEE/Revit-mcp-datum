import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateAreaPlanTool(server: McpServer) {
  server.tool(
    "create_area_plan",
    "Create area plans and area boundaries in Revit for space analysis and rentable/gross area calculations. Area plans are essential for commercial buildings — they define rentable areas, gross building areas, common areas, and service areas per BOMA standards. Area boundaries can be placed on walls, at wall center, core center, or at custom offsets. Supports multiple area schemes (Gross Building, Rentable). All units are in millimeters (mm).",
    {
      action: z
        .enum(["CreatePlan", "CreateBoundary", "CreateArea", "GetAreaSchemes"])
        .describe(
          "Action: 'CreatePlan' creates an area plan view, 'CreateBoundary' places area boundary lines, 'CreateArea' creates an area element, 'GetAreaSchemes' lists available area schemes."
        ),
      areaSchemeId: z
        .number()
        .optional()
        .describe("ElementId of the area scheme (Gross Building, Rentable, etc.). Use GetAreaSchemes to list available schemes."),
      levelId: z
        .number()
        .optional()
        .describe("ElementId of the level for the area plan (required for CreatePlan)"),
      planName: z
        .string()
        .optional()
        .describe("Name for the area plan view (for CreatePlan)"),
      boundaries: z
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
        .optional()
        .describe("Area boundary line segments (for CreateBoundary)"),
      applyToWalls: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, auto-generate area boundaries on all walls (for CreateBoundary)"),
      wallBoundaryPosition: z
        .enum(["WallCenter", "WallFace", "CoreCenter", "CoreFace"])
        .optional()
        .default("WallCenter")
        .describe("Where to place wall-based area boundaries"),
      areaLocation: z
        .object({
          x: z.number().describe("X coordinate of area tag placement in mm"),
          y: z.number().describe("Y coordinate of area tag placement in mm"),
        })
        .optional()
        .describe("Point inside the area boundary where the area element is placed (for CreateArea)"),
      areaName: z
        .string()
        .optional()
        .describe("Name for the area (e.g., 'Office Suite A', 'Common Area', 'Service Core')"),
      areaNumber: z
        .string()
        .optional()
        .describe("Area number for identification"),
      viewId: z
        .number()
        .optional()
        .describe("Area plan view ID (required for CreateBoundary and CreateArea)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_area_plan", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create area plan failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
