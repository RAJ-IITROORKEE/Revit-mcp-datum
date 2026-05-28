import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetCurrentViewElementsTool(server: McpServer) {
  server.tool(
    "get_current_view_elements",
    "Get elements from the current active view in Revit. You can filter by model categories (like Walls, Floors) or annotation categories (like Dimensions, Text). Use includeHidden to show/hide invisible elements and limit to control the number of returned elements.",
    {
      modelCategoryList: z
         .array(
           z.enum([
             "OST_Walls",
             "OST_Doors",
             "OST_Windows",
             "OST_Floors",
             "OST_Roofs",
             "OST_Ceilings",
             "OST_Stairs",
             "OST_Columns",
             "OST_Beams",
             "OST_Braces",
             "OST_Furniture",
             "OST_Ducts",
             "OST_Pipes",
             "OST_Electrical",
             "OST_Equipment",
             "OST_Ramps",
             "OST_StructuralFraming",
             "OST_Railings",
           ])
         )
         .optional()
         .describe(
           "List of Revit model categories to filter by. Examples: OST_Walls, OST_Doors, OST_Windows, OST_Floors, OST_Roofs, OST_Ceilings, OST_Stairs, OST_Columns, OST_Beams, OST_Furniture, OST_Ducts, OST_Pipes"
         ),
       annotationCategoryList: z
         .array(
           z.enum([
             "OST_Dimensions",
             "OST_WallTags",
             "OST_DoorTags",
             "OST_WindowTags",
             "OST_FloorTags",
             "OST_RoomTags",
             "OST_TextNotes",
             "OST_Symbols",
             "OST_ModelText",
             "OST_SectionMarks",
             "OST_ElevationMarks",
             "OST_DetailMarks",
             "OST_RevisionClouds",
           ])
         )
         .optional()
         .describe(
           "List of Revit annotation categories to filter by. Examples: OST_Dimensions, OST_WallTags, OST_RoomTags, OST_TextNotes, OST_RevisionClouds, OST_SectionMarks"
         ),
      includeHidden: z
        .boolean()
        .optional()
        .describe("Whether to include hidden elements in the results"),
       limit: z
         .number()
         .int()
         .min(1)
         .max(10000)
         .optional()
         .default(100)
         .describe("Maximum number of elements to return from the view (1-10000, default 100)"),
    },
    async (args, extra) => {
      const params = {
        modelCategoryList: args.modelCategoryList || [],
        annotationCategoryList: args.annotationCategoryList || [],
        includeHidden: args.includeHidden || false,
        limit: args.limit || 100,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "get_current_view_elements",
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
              text: `get current view elements failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
