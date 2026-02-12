import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerLinkModelTool(server: McpServer) {
  server.tool(
    "link_model",
    "Link external Revit models (.rvt) into the current project for coordination between disciplines (architectural, structural, MEP). Linked models update automatically when the source file changes. Supports positioning (auto-center, shared coordinates, manual), visibility control, and workset assignment. Essential for multi-discipline coordination, clash detection between models, and large project workflows. Actions: LinkModel, UnlinkModel, ReloadLink, ListLinks.",
    {
      action: z
        .enum(["LinkModel", "UnlinkModel", "ReloadLink", "ReloadAll", "ListLinks"])
        .describe(
          "Action: 'LinkModel' creates a new link, 'UnlinkModel' removes a link, 'ReloadLink' updates a link from source file, 'ReloadAll' updates all links, 'ListLinks' shows all linked models."
        ),
      filePath: z
        .string()
        .optional()
        .describe("Full file path to the Revit model to link (.rvt) — required for LinkModel"),
      linkId: z
        .number()
        .optional()
        .describe("ElementId of an existing link (for UnlinkModel, ReloadLink)"),
      positioning: z
        .enum(["AutoCenterToCenter", "AutoOriginToOrigin", "SharedCoordinates", "Manual"])
        .optional()
        .default("AutoOriginToOrigin")
        .describe(
          "'AutoCenterToCenter' aligns model centers, 'AutoOriginToOrigin' aligns project base points, 'SharedCoordinates' uses shared coordinate system, 'Manual' uses specified placement."
        ),
      placementPoint: z
        .object({
          x: z.number().describe("X coordinate for placement in mm"),
          y: z.number().describe("Y coordinate in mm"),
          z: z.number().describe("Z coordinate in mm"),
        })
        .optional()
        .describe("Manual placement point (for Manual positioning)"),
      roomBoundingBehavior: z
        .enum(["NotDefined", "RoomBounding", "NotRoomBounding"])
        .optional()
        .default("NotDefined")
        .describe("Whether linked model elements act as room boundaries"),
      worksetName: z
        .string()
        .optional()
        .describe("Workset to place the link on (for workshared projects)"),
      linkType: z
        .enum(["Overlay", "Attachment"])
        .optional()
        .default("Attachment")
        .describe(
          "'Attachment' means this link appears in nested links too. 'Overlay' means it only appears in this project."
        ),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("link_model", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Link model failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
