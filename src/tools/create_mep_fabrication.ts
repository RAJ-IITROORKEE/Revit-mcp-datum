import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateMepFabricationTool(server: McpServer) {
  server.tool(
    "create_mep_fabrication",
    "Create fabrication-ready MEP elements in Revit with detailed shop-level information. Fabrication elements include precise dimensions, connection details, material specifications, hanger/support information, and CNC cutting data for direct fabrication. Essential for detached coordination, BIM-to-fabrication workflows, and construction-ready MEP models. Supports ductwork, piping, and electrical conduit/cable tray fabrication parts.",
    {
      action: z
        .enum(["ConvertToFabrication", "CreateFabPart", "AddHangers", "GenerateSpool", "ExportFabData"])
        .describe(
          "Action: 'ConvertToFabrication' converts standard MEP to fabrication, 'CreateFabPart' creates new fabrication part, 'AddHangers' adds supports, 'GenerateSpool' creates spool sheets, 'ExportFabData' exports to fabrication software."
        ),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("ElementIds of MEP elements to convert to fabrication (for ConvertToFabrication)"),
      fabricationConfig: z
        .object({
          serviceType: z
            .enum(["Duct", "Pipe", "Conduit", "CableTray"])
            .optional()
            .describe("Type of MEP fabrication"),
          database: z
            .string()
            .optional()
            .describe("Fabrication database/spec to use (e.g., 'ASHRAE', 'SMACNA', 'Custom')"),
          materialGauge: z
            .string()
            .optional()
            .describe("Material gauge/thickness (e.g., '22 ga', '20 ga', 'Sch 40')"),
          connectorType: z
            .enum(["Flanged", "Welded", "Threaded", "Grooved", "Soldered", "SlipJoint", "TDC", "Custom"])
            .optional()
            .describe("Connector/joint type for fabrication"),
          insulationType: z
            .string()
            .optional()
            .describe("Insulation specification"),
        })
        .optional()
        .describe("Fabrication configuration parameters"),
      hangerSpec: z
        .object({
          maxSpacingFt: z
            .number()
            .optional()
            .describe("Maximum hanger spacing in feet (per code requirements)"),
            hangerType: z.string().optional().describe("Hanger/support type specification"),
          rodSize: z.string().optional().describe("Threaded rod size (e.g., '3/8\"', '1/2\"')"),
        })
        .optional()
        .describe("Hanger and support specifications (for AddHangers action)"),
      spoolConfig: z
        .object({
          maxSpoolLength: z
            .number()
            .optional()
            .describe("Maximum spool length for fabrication shop"),
          includePartList: z.boolean().optional().default(true).describe("Include parts list on spool sheets"),
          includeDimensions: z.boolean().optional().default(true).describe("Include all dimensions"),
        })
        .optional()
        .describe("Spool sheet generation settings (for GenerateSpool action)"),
      exportFormat: z
        .enum(["COD", "MAJ", "ITM", "CSV", "IFC"])
        .optional()
        .describe("Export format for fabrication data (for ExportFabData action)"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_mep_fabrication", args);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create MEP fabrication failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
