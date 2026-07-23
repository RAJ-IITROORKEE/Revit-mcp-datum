import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { errorToolResult, okToolResult, normalizedToolCatch, normalizedToolResult } from "./_result.js";

const PLACE_COMPONENT_BATCH_SIZE = 1;
const PLACE_COMPONENT_TIMEOUT_MS = 300000;

export type PlaceComponentArgs = {
  components: unknown[];
  transactionName?: string;
  batchSize?: number;
};

export function splitPlaceComponentBatches(params: PlaceComponentArgs): Array<Record<string, unknown> & { components: unknown[] }> {
  const batchSize = params.batchSize ?? PLACE_COMPONENT_BATCH_SIZE;
  const totalBatches = Math.ceil(params.components.length / batchSize);
  const { batchSize: _batchSize, ...commandParams } = params;

  return Array.from({ length: totalBatches }, (_, batchIndex) => {
    const batch: Record<string, unknown> & { components: unknown[] } = {
      ...commandParams,
      components: params.components.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize),
    };
    if (typeof params.transactionName === "string" && totalBatches > 1) {
      batch.transactionName = `${params.transactionName} [${batchIndex + 1}/${totalBatches}]`;
    }
    return batch;
  });
}

function hasToolError(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }

  return (result as { isError?: unknown }).isError === true;
}

export function registerPlaceComponentTool(server: McpServer) {
  server.tool(
    "place_component",
    "Place component family instances in the Revit model. This is a high-level tool for placing any loaded family type at specified locations with rotation, level, and host element support. Works for all component categories: doors (on walls), windows (on walls), furniture, equipment, fixtures, columns, structural framing, MEP elements, site components, etc. Use get_loaded_families or get_available_family_types first to discover available types and their IDs. All units are in millimeters (mm).",
    {
      components: z
        .array(
          z.object({
            familyTypeId: z
              .number()
              .describe(
                "ElementId of the family type to place. Use get_loaded_families or get_available_family_types to find type IDs."
              ),
            location: z
              .object({
                x: z.number().describe("X coordinate of placement point in mm"),
                y: z.number().describe("Y coordinate of placement point in mm"),
                z: z.number().optional().default(0).describe("Z coordinate in mm (default 0)"),
              })
              .describe("Placement point for the component"),
            rotation: z
              .number()
              .optional()
              .default(0)
              .describe("Rotation angle in degrees (0-360) around the vertical axis"),
            levelId: z
              .number()
              .optional()
              .describe(
                "ElementId of the level for the component. Use get_levels_list to find levels. If omitted, uses the active view's level."
              ),
            hostElementId: z
              .number()
              .optional()
              .describe(
                "ElementId of the host element (e.g., wall for doors/windows, floor for floor-hosted families, ceiling for ceiling-hosted families). Required for hosted family types."
              ),
            hostFace: z
              .enum(["Front", "Back", "Top", "Bottom", "Left", "Right"])
              .optional()
              .describe(
                "Which face of the host element to place the component on. Required for face-hosted families."
              ),
            offset: z
              .number()
              .optional()
              .default(0)
              .describe("Vertical offset from the level or host surface in mm"),
            flipped: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether to flip the component (e.g., flip a door swing direction)"),
            mirrored: z
              .boolean()
              .optional()
              .default(false)
              .describe("Whether to mirror the component"),
            structuralType: z
              .enum(["NonStructural", "Beam", "Brace", "Column", "Footing", "UnknownFraming"])
              .optional()
              .describe("Structural type designation for structural elements"),
            parameterOverrides: z
              .array(
                z.object({
                  parameterName: z.string().describe("Name of the parameter to set"),
                  value: z
                    .union([z.string(), z.number(), z.boolean()])
                    .describe("Value to set for the parameter"),
                })
              )
              .optional()
              .describe(
                "Override instance parameter values after placement (e.g., set dimensions, marks, comments)."
              ),
            sessionTag: z
              .string()
              .optional()
              .describe("Optional session identifier. Stored as shared parameter DatumSessionTag on the created element. Used for bulk rollback via delete_elements."),
          })
        )
        .min(1)
        .describe("Array of component instances to place"),
      transactionName: z
        .string()
        .optional()
        .default("Place Components")
        .describe("Name for the Revit transaction (appears in undo history)"),
      batchSize: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(PLACE_COMPONENT_BATCH_SIZE)
        .describe("Optional batch size to split large placement arrays for reliability"),
    },
    async (args) => {
      const params = args as unknown as PlaceComponentArgs;
      const components = Array.isArray(params.components) ? params.components : [];

      if (components.length === 0) {
        return errorToolResult("place_component", "No components were provided");
      }

      try {
        const commandBatches = splitPlaceComponentBatches({ ...params, components });
        const totalBatches = commandBatches.length;
        const batches: unknown[] = [];

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
          const batchParams = commandBatches[batchIndex];

          const batchResponse = await withRevitConnection(async (revitClient) => {
            return revitClient.sendCommand("place_component", batchParams, PLACE_COMPONENT_TIMEOUT_MS);
          });

          const normalizedBatch = normalizedToolResult("place_component", batchResponse);
          if (hasToolError(normalizedBatch)) {
            return errorToolResult(
              "place_component",
              `Component placement ${batchIndex + 1}/${totalBatches} failed`,
              { completedBatches: batchIndex, batches, failedBatch: normalizedBatch }
            );
          }

          batches.push(batchResponse);
        }

        return okToolResult({
          success: true,
          message: `Placed components in ${totalBatches} batches (${components.length} total components)`,
          batches,
        });
      } catch (error) {
        return normalizedToolCatch("place_component", error);
      }
    }
  );
}
