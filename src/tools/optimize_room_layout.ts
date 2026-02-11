import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * AI-driven room layout optimization.
 * Analyzes current layout and suggests/applies optimizations
 * for space efficiency, circulation, ergonomics, and aesthetics.
 */
export function registerOptimizeRoomLayoutTool(server: McpServer) {
  server.tool(
    "optimize_room_layout",
    `AI-driven room layout optimization tool. Analyzes the current furniture and element arrangement in a room and either suggests optimizations or directly applies them.

Optimization strategies include:
1. SPACE_EFFICIENCY: Maximize usable floor area, reduce dead space
2. CIRCULATION: Improve traffic flow, ensure clear paths from door to all areas
3. ERGONOMICS: Optimize desk-to-window distance, monitor glare reduction, reach distances
4. NATURAL_LIGHT: Arrange elements to maximize natural light access for occupants
5. COLLABORATION: Optimize seating for team interaction and communication
6. PRIVACY: Arrange for maximum visual/acoustic privacy
7. SYMMETRY: Create balanced, symmetrical arrangements
8. CUSTOM: Apply custom rules provided by the user

Process:
1. Reads current room geometry, doors, windows, and furniture positions
2. Evaluates current layout against selected optimization criteria
3. Generates optimized positions for all moveable elements
4. Optionally applies the changes or returns them as suggestions
5. Reports before/after metrics (utilization %, circulation score, etc.)`,
    {
      roomId: z
        .number()
        .describe("ElementId of the room to optimize"),
      optimizationStrategy: z
        .enum([
          "space_efficiency",
          "circulation",
          "ergonomics",
          "natural_light",
          "collaboration",
          "privacy",
          "symmetry",
          "balanced",
          "custom",
        ])
        .default("balanced")
        .describe("Primary optimization strategy. 'balanced' applies a mix of all strategies."),
      applyChanges: z
        .boolean()
        .default(false)
        .describe("If true, directly moves elements to optimized positions. If false, returns suggestions only (recommended for review first)."),
      fixedElementIds: z
        .array(z.number())
        .optional()
        .describe("Element IDs that should NOT be moved (e.g., built-in furniture, reception desks)"),
      moveableCategories: z
        .array(z.string())
        .default(["OST_Furniture", "OST_FurnitureSystems", "OST_SpecialityEquipment"])
        .describe("Revit categories of elements that can be repositioned"),
      constraintRules: z
        .array(
          z.object({
            elementId: z.number().describe("Element to constrain"),
            constraint: z
              .enum(["keep_wall", "keep_corner", "keep_center", "near_window", "near_door", "face_door", "face_window"])
              .describe("Constraint type for this element"),
          })
        )
        .optional()
        .describe("Specific constraints for individual elements"),
      customRules: z
        .array(z.string())
        .optional()
        .describe("Custom optimization rules as natural language instructions (e.g., 'desk must face window', 'chairs should form a circle')"),
      maxIterations: z
        .number()
        .default(100)
        .describe("Maximum optimization iterations for convergence"),
      includeMetrics: z
        .boolean()
        .default(true)
        .describe("Include before/after metrics in the response (utilization %, circulation score, etc.)"),
    },
    async (args, extra) => {
      const params = {
        roomId: args.roomId,
        optimizationStrategy: args.optimizationStrategy,
        applyChanges: args.applyChanges,
        fixedElementIds: args.fixedElementIds || [],
        moveableCategories: args.moveableCategories,
        constraintRules: args.constraintRules || [],
        customRules: args.customRules || [],
        maxIterations: args.maxIterations,
        includeMetrics: args.includeMetrics,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "optimize_room_layout",
            params
          );
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
              text: `Optimize room layout failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
