import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateBeamTool(server: McpServer) {
  server.tool(
    "create_beam",
    "Create structural beam and framing elements in Revit between two points. Supports steel beams, concrete beams, wood beams, lintels, headers, joists, and purlins. Beams connect columns, support floors, and transfer loads. Automatically calculates rotation based on connected elements. Use get_available_family_types with categoryList ['OST_StructuralFraming'] to discover available beam types. All units are in millimeters (mm).",
    {
      beams: z
        .array(
          z.object({
            beamTypeId: z
              .number()
              .optional()
              .describe(
                "ElementId of the structural framing type. Use get_available_family_types with 'OST_StructuralFraming'. If omitted, uses default beam type."
              ),
            startPoint: z.object({
              x: z.number().describe("X coordinate of beam start in mm"),
              y: z.number().describe("Y coordinate of beam start in mm"),
              z: z.number().describe("Z coordinate of beam start in mm (elevation)"),
            }),
            endPoint: z.object({
              x: z.number().describe("X coordinate of beam end in mm"),
              y: z.number().describe("Y coordinate of beam end in mm"),
              z: z.number().describe("Z coordinate of beam end in mm (elevation)"),
            }),
            levelId: z
              .number()
              .optional()
              .describe("ElementId of the reference level for the beam"),
            structuralType: z
              .enum(["Beam", "Joist", "Purlin", "GirderTruss", "Other"])
              .optional()
              .default("Beam")
              .describe("Structural usage type of the framing member"),
            rotation: z
              .number()
              .optional()
              .default(0)
              .describe("Cross-section rotation angle in degrees (0 = default orientation)"),
            startOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Vertical offset at the start point in mm"),
            endOffset: z
              .number()
              .optional()
              .default(0)
              .describe("Vertical offset at the end point in mm"),
            justification: z
              .enum(["Center", "Top", "Bottom", "Origin"])
              .optional()
              .default("Center")
              .describe("Vertical justification of the beam relative to the level"),
            lateralJustification: z
              .enum(["Center", "Left", "Right", "Origin"])
              .optional()
              .default("Center")
              .describe("Lateral (horizontal) justification of the beam"),
            startConnection: z
              .object({
                elementId: z.number().describe("ElementId of the element to connect to at start"),
                connectionType: z.enum(["Pinned", "Fixed", "MomentFrame"]).optional(),
              })
              .optional()
              .describe("Start end connection to column or other structural element"),
            endConnection: z
              .object({
                elementId: z.number().describe("ElementId of the element to connect to at end"),
                connectionType: z.enum(["Pinned", "Fixed", "MomentFrame"]).optional(),
              })
              .optional()
              .describe("End connection to column or other structural element"),
          })
        )
        .min(1)
        .describe("Array of beam definitions to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_beam", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create beam failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
