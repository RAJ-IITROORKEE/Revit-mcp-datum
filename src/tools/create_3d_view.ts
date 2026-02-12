import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreate3dViewTool(server: McpServer) {
  server.tool(
    "create_3d_view",
    "Create 3D views in Revit with precise camera control. Supports orthographic (isometric, axonometric) and perspective views. Configure eye position, target point, up direction, field of view, crop box, and section box. Essential for creating presentation views, construction sequence views, detail blow-ups, and design review angles. All units are in millimeters (mm).",
    {
      viewName: z
        .string()
        .describe("Name for the 3D view (e.g., 'Exterior View - SW', 'Interior - Living Room', 'Construction Detail')"),
      viewType: z
        .enum(["Orthographic", "Perspective"])
        .optional()
        .default("Orthographic")
        .describe("View projection type: 'Orthographic' for isometric/parallel, 'Perspective' for realistic vanishing points."),
      camera: z
        .object({
          eyePosition: z.object({
            x: z.number().describe("Camera eye X position in mm"),
            y: z.number().describe("Camera eye Y position in mm"),
            z: z.number().describe("Camera eye Z elevation in mm"),
          }),
          targetPoint: z.object({
            x: z.number().describe("Camera target X (what the camera looks at) in mm"),
            y: z.number().describe("Camera target Y in mm"),
            z: z.number().describe("Camera target Z in mm"),
          }),
          upDirection: z
            .object({
              x: z.number().describe("Up direction X component (typically 0 for horizontal)"),
              y: z.number().describe("Up direction Y component (typically 0)"),
              z: z.number().describe("Up direction Z component (typically 1 for vertical)"),
            })
            .optional()
            .describe("Camera up vector (defines which way is up in the view). Default is Z=1 (vertical)."),
        })
        .optional()
        .describe("Custom camera position and orientation. If omitted, uses default isometric view."),
      fieldOfView: z
        .number()
        .optional()
        .describe("Field of view angle in degrees (for perspective views only). Typical: 60 degrees."),
      presetOrientation: z
        .enum([
          "Isometric",
          "TopDown",
          "BottomUp",
          "North",
          "South",
          "East",
          "West",
          "NorthEast",
          "NorthWest",
          "SouthEast",
          "SouthWest",
        ])
        .optional()
        .describe("Quick preset camera orientations. Overrides custom camera if provided."),
      sectionBox: z
        .object({
          enabled: z.boolean().describe("Whether to enable the section box (crop 3D geometry)"),
          min: z.object({
            x: z.number().describe("Min X coordinate of section box in mm"),
            y: z.number().describe("Min Y coordinate in mm"),
            z: z.number().describe("Min Z coordinate in mm"),
          }),
          max: z.object({
            x: z.number().describe("Max X coordinate of section box in mm"),
            y: z.number().describe("Max Y coordinate in mm"),
            z: z.number().describe("Max Z coordinate in mm"),
          }),
        })
        .optional()
        .describe("Section box to crop the 3D view to a specific region"),
      detailLevel: z
        .enum(["Coarse", "Medium", "Fine"])
        .optional()
        .default("Medium")
        .describe("Level of detail shown in the view"),
      displayStyle: z
        .enum([
          "Wireframe",
          "HiddenLine",
          "Shaded",
          "ShadedWithEdges",
          "RealisticWithEdges",
          "Realistic",
          "RaytracedWithEdges",
          "Raytraced",
        ])
        .optional()
        .default("Shaded")
        .describe("Visual style for the 3D view"),
      viewTemplateId: z
        .number()
        .optional()
        .describe("ElementId of a 3D view template to apply"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_3d_view", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create 3D view failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
