import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateScheduleTool(server: McpServer) {
  server.tool(
    "create_schedule",
    "Create schedules in Revit for material takeoffs, room schedules, door/window schedules, and equipment lists. Schedules automatically tabulate element data with customizable fields, filters, and sorting. Essential for quantity analysis and documentation.",
    {
      scheduleType: z
        .enum([
          "RoomSchedule",
          "DoorSchedule",
          "WindowSchedule",
          "WallSchedule",
          "FloorSchedule",
          "FurnitureSchedule",
          "GenericSchedule",
          "MaterialTakeoff",
          "SheetList",
          "ViewList",
          "NoteBlock",
          "KeySchedule"
        ])
        .describe("Type of schedule to create. RoomSchedule: list rooms with areas and finishes. DoorSchedule: door types and locations. WindowSchedule: window specifications. MaterialTakeoff: quantities and materials. SheetList: drawing sheet index. ViewList: all project views. KeySchedule: key notes and specifications."),
      scheduleName: z
        .string()
        .describe("Name for the schedule (e.g., 'Door Schedule', 'Room Finish Schedule')"),
      category: z
        .string()
        .optional()
        .describe("Built-in category for generic schedules (e.g., 'OST_Doors', 'OST_Windows', 'OST_Furniture'). Required for GenericSchedule type."),
       fields: z
         .array(
           z.object({
             parameterName: z.string().describe("Parameter name to include as column (e.g., 'Mark', 'Family', 'Type', 'Width', 'Height', 'Area', 'Level', 'Phase')"),
             heading: z.string().optional().describe("Custom column heading (displays above parameter name)"),
             width: z.number().min(50).optional().describe("Column width in mm (minimum 50mm for readability)"),
             alignment: z.enum(["Left", "Center", "Right"]).optional().describe("Text alignment in column"),
           })
         )
         .min(1)
         .optional()
         .describe("Fields (columns) to include in the schedule. If not specified, uses default fields for the schedule type. Recommend at least 1-3 fields."),
      sortBy: z
        .array(
          z.object({
            parameterName: z.string().describe("Parameter name to sort by"),
            ascending: z.boolean().default(true).describe("Sort in ascending order (A-Z, 0-9)"),
          })
        )
        .optional()
        .describe("Sorting criteria for schedule rows"),
      filterBy: z
        .array(
          z.object({
            parameterName: z.string().describe("Parameter name to filter by"),
            condition: z.enum(["Equals", "NotEquals", "GreaterThan", "LessThan", "Contains", "NotContains"]).describe("Filter condition"),
            value: z.union([z.string(), z.number()]).describe("Value to compare against"),
          })
        )
        .optional()
        .describe("Filters to limit which elements appear in the schedule"),
      groupBy: z
        .string()
        .optional()
        .describe("Parameter name to group rows by (creates headers for each group)"),
      includeTitle: z
        .boolean()
        .default(true)
        .describe("Show schedule title on sheets"),
      includeHeaders: z
        .boolean()
        .default(true)
        .describe("Show column headers"),
      itemizeEveryInstance: z
        .boolean()
        .default(false)
        .describe("List every instance separately (true) or group by type (false)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_schedule", params);
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
              text: `Create schedule failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
