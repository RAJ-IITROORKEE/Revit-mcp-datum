import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerRouteConduitTool(server: McpServer) {
  server.tool(
    "route_conduit",
    "Route electrical conduit and cable trays in Revit between points. Conduits protect electrical wiring; cable trays support multiple cables. Supports EMT, rigid, PVC, flexible conduit, and cable trays. Auto-generates fittings (elbows, tees, connectors) at direction changes. Use get_available_family_types with categoryList ['OST_Conduit', 'OST_CableTray'] to discover types. All units are in millimeters (mm).",
    {
      routes: z
        .array(
          z.object({
            conduitTypeId: z
              .number()
              .optional()
              .describe("ElementId of conduit/cable tray type. Use get_available_family_types with 'OST_Conduit' or 'OST_CableTray'."),
            routeType: z
              .enum(["Conduit", "CableTray", "CableTrayWithLid", "Wireway"])
              .describe("Type of electrical raceway to create"),
            path: z
              .array(
                z.object({
                  x: z.number().describe("X coordinate in mm"),
                  y: z.number().describe("Y coordinate in mm"),
                  z: z.number().describe("Z coordinate in mm"),
                })
              )
              .min(2)
              .describe("Array of points defining the conduit/tray path. Minimum 2 points (start and end)."),
            diameter: z
              .number()
              .optional()
              .describe("Conduit diameter in mm (e.g., 20mm = 3/4\", 25mm = 1\", 50mm = 2\")"),
            width: z
              .number()
              .optional()
              .describe("Cable tray width in mm (e.g., 150mm, 300mm, 600mm)"),
            height: z
              .number()
              .optional()
              .describe("Cable tray height/depth in mm (e.g., 50mm, 100mm)"),
            autoFittings: z
              .boolean()
              .optional()
              .default(true)
              .describe("Whether to auto-generate fittings (elbows, tees) at direction changes"),
            levelId: z
              .number()
              .optional()
              .describe("Reference level for the route"),
            systemClassification: z
              .enum(["Power", "Lighting", "FireAlarm", "DataTelecom", "Security", "Specialty"])
              .optional()
              .describe("Electrical system classification"),
          })
        )
        .min(1)
        .describe("Array of conduit/cable tray routes to create"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("route_conduit", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Route conduit failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
