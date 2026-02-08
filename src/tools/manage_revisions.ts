import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerManageRevisionsTool(server: McpServer) {
  server.tool(
    "manage_revisions",
    "Create and manage project revisions in Revit for tracking design changes and issuance history. Revisions appear on sheets and link to revision clouds, maintaining a complete record of document evolution.",
    {
      action: z
        .enum(["Create", "Update", "List", "Issue", "Delete"])
        .describe("Action to perform. Create: add new revision. Update: modify existing revision. List: get all revisions. Issue: mark revision as issued. Delete: remove revision."),
      revisionId: z
        .number()
        .optional()
        .describe("ElementId of revision to update/issue/delete. Required for Update, Issue, Delete actions."),
      revisionDate: z
        .string()
        .optional()
        .describe("Date of the revision (YYYY-MM-DD format)"),
      description: z
        .string()
        .optional()
        .describe("Description of changes (e.g., 'Client review comments', 'Code compliance updates')"),
      issuedTo: z
        .string()
        .optional()
        .describe("Party to whom revision was issued (e.g., 'Contractor', 'Client', 'Building Department')"),
      issuedBy: z
        .string()
        .optional()
        .describe("Person or firm issuing the revision"),
      numberType: z
        .enum(["Numeric", "Alphabetic", "Alphanumeric"])
        .optional()
        .describe("Numbering scheme for revisions (1,2,3 or A,B,C)"),
    },
    async (args, extra) => {
      const params = args;

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("manage_revisions", params);
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
              text: `Manage revisions failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
