import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Modify existing Revit elements - move, rotate, resize, change type,
 * update parameters, and transform elements.
 */
export function registerModifyElementTool(server: McpServer) {
  server.tool(
    "modify_element",
    `Modify existing Revit elements with comprehensive transformation and property update capabilities. This tool supports moving, rotating, resizing, changing types, and updating parameters for one or more elements.

Modification types:
- MOVE: Translate element(s) by a delta or to an absolute position
- ROTATE: Rotate element(s) around a point by a specified angle
- RESIZE: Change element dimensions (wall height/length, floor area, etc.)
- CHANGE_TYPE: Change the family type of an element (e.g., change wall type)
- SET_PARAMETER: Set instance or type parameter values
- TRANSFORM: Apply a combined move+rotate transformation
- PIN/UNPIN: Pin or unpin elements to prevent accidental modification
- FLIP: Flip element orientation (for doors, windows, walls)
- MIRROR: Mirror an element across an axis

Supports batch modification of multiple elements with the same or different operations.
All coordinate units are in millimeters (mm).`,
    {
      modifications: z
        .array(
          z.object({
            elementId: z
              .number()
              .describe("ElementId of the element to modify"),
            action: z
              .enum(["move", "rotate", "resize", "change_type", "set_parameter", "transform", "pin", "unpin", "flip", "mirror"])
              .describe("Type of modification to apply"),
            moveVector: z
              .object({
                x: z.number().describe("X translation in mm"),
                y: z.number().describe("Y translation in mm"),
                z: z.number().default(0).describe("Z translation in mm"),
              })
              .optional()
              .describe("Translation vector for 'move' action (relative displacement)"),
            moveToPoint: z
              .object({
                x: z.number().describe("Target X coordinate in mm"),
                y: z.number().describe("Target Y coordinate in mm"),
                z: z.number().optional().describe("Target Z coordinate in mm"),
              })
              .optional()
              .describe("Absolute target position for 'move' action (moves element center to this point)"),
            rotationAngleDeg: z
              .number()
              .optional()
              .describe("Rotation angle in degrees for 'rotate' action. Positive = counter-clockwise."),
            rotationCenter: z
              .object({
                x: z.number().describe("X coordinate of rotation center in mm"),
                y: z.number().describe("Y coordinate of rotation center in mm"),
              })
              .optional()
              .describe("Center point for rotation. If omitted, rotates around element's own center."),
            newWidth: z
              .number()
              .optional()
              .describe("New width in mm for 'resize' action"),
            newHeight: z
              .number()
              .optional()
              .describe("New height in mm for 'resize' action"),
            newLength: z
              .number()
              .optional()
              .describe("New length in mm for 'resize' action (for walls, beams)"),
            newDepth: z
              .number()
              .optional()
              .describe("New depth in mm for 'resize' action"),
            newTypeId: z
              .number()
              .optional()
              .describe("New FamilySymbol/Type ElementId for 'change_type' action"),
            parameters: z
              .record(z.any())
              .optional()
              .describe("Parameter name-value pairs for 'set_parameter' action (e.g., { 'Comments': 'Updated by AI', 'Mark': 'A1' })"),
            flipDirection: z
              .enum(["hand", "facing", "workplane"])
              .optional()
              .describe("Flip direction for 'flip' action: 'hand' flips left/right, 'facing' flips front/back, 'workplane' flips on work plane"),
            mirrorAxisStart: z
              .object({ x: z.number(), y: z.number() })
              .optional()
              .describe("Start point of mirror axis for 'mirror' action"),
            mirrorAxisEnd: z
              .object({ x: z.number(), y: z.number() })
              .optional()
              .describe("End point of mirror axis for 'mirror' action"),
            copyOnMirror: z
              .boolean()
              .default(false)
              .describe("Create a copy when mirroring instead of moving the original"),
          })
        )
        .min(1)
        .describe("Array of modifications to apply. Each modification targets one element with one action."),
      transactionName: z
        .string()
        .default("AI Element Modification")
        .describe("Name for the Revit transaction (appears in undo history)"),
    },
    async (args, extra) => {
      const params = {
        modifications: args.modifications,
        transactionName: args.transactionName,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("modify_element", params);
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
              text: `Modify element failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
