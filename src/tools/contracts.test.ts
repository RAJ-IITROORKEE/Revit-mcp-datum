import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodRawShape } from "zod";
import { normalizedMutationToolResult, normalizedToolResult } from "./_result.js";
import { registerCreateDetailLinesTool } from "./create_detail_lines.js";
import { registerCreateModelLineTool } from "./create_model_line.js";
import { registerCreateOpeningTool } from "./create_opening.js";
import { registerCreateRoomSeparationLineTool } from "./create_room_separation_line.js";
import { registerCreateTagTool } from "./create_tag.js";
import { registerCreateViewTool } from "./create_view.js";
import { registerDetectClashesTool } from "./detect_clashes.js";
import { registerExportViewTool } from "./export_view.js";
import { normalizeExportViewArgs } from "./export_view.js";
import { normalizeMeasureDistanceArgs, registerMeasureDistanceTool } from "./measure_distance.js";
import { registerTools } from "./register.js";
import { splitPlaceComponentBatches } from "./place_component.js";

type RegisteredDefinition = {
  name: string;
  description?: string;
  schema?: ZodRawShape;
};

function captureDefinitions(register: (server: McpServer) => void): RegisteredDefinition[] {
  const definitions: RegisteredDefinition[] = [];
  const server = {
    tool: (...args: unknown[]) => {
      const [name, second, third] = args;
      definitions.push({
        name: String(name),
        description: typeof second === "string" ? second : undefined,
        schema: (typeof second === "string" ? third : second) as ZodRawShape | undefined,
      });
      return {};
    },
  } as unknown as McpServer;

  register(server);
  return definitions;
}

function schemaFor(register: (server: McpServer) => void): z.ZodObject<ZodRawShape> {
  const [definition] = captureDefinitions(register);
  assert.ok(definition?.schema, "tool must register an input schema");
  return z.object(definition.schema);
}

function resultPayload(result: ReturnType<typeof normalizedToolResult>): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

test("place_component defaults to singleton Revit commands", () => {
  const batches = splitPlaceComponentBatches({
    components: [{ familyTypeId: 1 }, { familyTypeId: 2 }],
    transactionName: "Place test components",
  });

  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map((batch) => batch.components), [
    [{ familyTypeId: 1 }],
    [{ familyTypeId: 2 }],
  ]);
  assert.deepEqual(batches.map((batch) => batch.transactionName), [
    "Place test components [1/2]",
    "Place test components [2/2]",
  ]);
});

test("audited schemas expose handler-native fields and normalize documented aliases", () => {
  const measureSchema = schemaFor(registerMeasureDistanceTool);
  const nativeMeasure = measureSchema.parse({
    fromPoint: { x: 0, y: 0, z: 0 },
    toPoint: { x: 1000, y: 0, z: 0 },
  });
  assert.deepEqual(nativeMeasure.fromPoint, { x: 0, y: 0, z: 0 });
  assert.deepEqual(nativeMeasure.toPoint, { x: 1000, y: 0, z: 0 });
  const compatibleMeasure = normalizeMeasureDistanceArgs(measureSchema.parse({
    measurementType: "PointToPoint",
    point1: { x: 0, y: 0, z: 0 },
    point2: { x: 1000, y: 0, z: 0 },
  }));
  assert.deepEqual(compatibleMeasure.fromPoint, { x: 0, y: 0, z: 0 });
  assert.deepEqual(compatibleMeasure.toPoint, { x: 1000, y: 0, z: 0 });

  const exportSchema = schemaFor(registerExportViewTool);
  assert.deepEqual(
    exportSchema.parse({ viewId: 32, filePath: "C:\\tmp\\view.png", format: "png" }),
    { viewId: 32, filePath: "C:\\tmp\\view.png", format: "png" }
  );
  assert.deepEqual(
    normalizeExportViewArgs(exportSchema.parse({
      viewIds: [32],
      outputDirectory: "C:\\tmp",
      fileNamePrefix: "view",
      exportFormat: "PNG",
    })),
    { viewId: 32, filePath: "C:\\tmp\\view.png", format: "png" }
  );
  assert.equal(exportSchema.safeParse({ viewId: 32, filePath: "   ", format: "png" }).success, false);
  assert.throws(() => normalizeExportViewArgs({ format: "png" }), /viewId/i);
  assert.throws(() => normalizeExportViewArgs({ viewId: 32, format: "png" }), /filePath/i);
  assert.throws(
    () => normalizeExportViewArgs({ viewIds: [32, 33], outputDirectory: "C:\\tmp", exportFormat: "PNG" }),
    /exactly one view/i
  );

  const openingSchema = schemaFor(registerCreateOpeningTool);
  const compatibleOpening = openingSchema.parse({
    openings: [{
      openingType: "Wall",
      hostElementId: 10,
      rectangularOpening: {
        centerPoint: { x: 1000, y: 500, z: 2000 },
        width: 1000,
        height: 2000,
      },
    }],
  });
  assert.deepEqual(compatibleOpening.openings[0].rectangularOpening, {
    centerPoint: { x: 1000, y: 500, z: 2000 },
    width: 1000,
    height: 2000,
  });
  const nativeOpening = openingSchema.parse({
    openings: [{
      openingType: "Wall",
      hostElementId: 10,
      rectangularOpening: {
        lowerLeft: { x: 500, y: 500, z: 1000 },
        upperRight: { x: 1500, y: 500, z: 3000 },
      },
    }],
  });
  assert.deepEqual(nativeOpening.openings[0].rectangularOpening, {
    lowerLeft: { x: 500, y: 500, z: 1000 },
    upperRight: { x: 1500, y: 500, z: 3000 },
  });

  const detailSchema = schemaFor(registerCreateDetailLinesTool);
  const detail = detailSchema.parse({
    viewId: 32,
    lines: [{
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1000, y: 0, z: 0 },
    }],
  });
  assert.deepEqual(detail.lines[0], {
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
  });
});

test("create_tag requires handler-required location", () => {
  const schema = schemaFor(registerCreateTagTool);
  assert.equal(schema.safeParse({ viewId: 32, elementId: 10 }).success, false);
  assert.equal(schema.safeParse({
    viewId: 32,
    elementId: 10,
    location: { x: 0, y: 0, z: 0 },
  }).success, true);
});

test("generic create_view exposes only handler-supported view types", () => {
  const definition = captureDefinitions(registerCreateViewTool)[0];
  assert.match(definition.description ?? "", /dedicated .* tools/i);
  const schema = z.object(definition.schema!);
  for (const viewType of ["FloorPlan", "CeilingPlan", "Section"]) {
    assert.equal(schema.safeParse({ viewType, viewName: "Supported" }).success, true);
  }
  for (const viewType of ["DraftingView", "Elevation", "ThreeD", "AreaPlan", "EngineeringPlan"]) {
    assert.equal(schema.safeParse({ viewType, viewName: "Unsupported" }).success, false);
  }
});

test("detect_clashes exposes only bounded SelectedElements checks", () => {
  const definition = captureDefinitions(registerDetectClashesTool)[0];
  assert.doesNotMatch(definition.description ?? "", /category|discipline|all elements/i);
  const schema = z.object(definition.schema!);

  assert.deepEqual(schema.parse({
    scope: "SelectedElements",
    elementIds1: [10],
    elementIds2: [20],
    limit: 7,
  }), {
    scope: "SelectedElements",
    elementIds1: [10],
    elementIds2: [20],
    limit: 7,
  });
  assert.equal(schema.safeParse({ scope: "SelectedElements", elementIds1: [], elementIds2: [20] }).success, false);
  assert.equal(schema.safeParse({ scope: "SelectedElements", elementIds1: [10], elementIds2: [] }).success, false);
  assert.equal(schema.safeParse({ scope: "CategoryVsCategory", elementIds1: [10], elementIds2: [20] }).success, false);
  assert.equal(schema.safeParse({ scope: "SelectedElements", elementIds1: [10], elementIds2: [20], limit: 10001 }).success, false);
});

test("create_model_line exposes the installed straight-line contract", () => {
  const schema = schemaFor(registerCreateModelLineTool);
  assert.equal(schema.safeParse({
    levelId: 30,
    lines: [{
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1000, y: 0, z: 0 },
    }],
  }).success, true);
  assert.equal(schema.safeParse({
    lines: [{ lineType: "Circle", centerPoint: { x: 0, y: 0, z: 0 }, radius: 1000 }],
  }).success, false);

  const roomSeparationSchema = schemaFor(registerCreateRoomSeparationLineTool);
  assert.equal(roomSeparationSchema.safeParse({ viewId: 32, lines: [] }).success, false);
  assert.equal(roomSeparationSchema.safeParse({
    viewId: 32,
    lines: [{ startPoint: { x: 0, y: 0 }, endPoint: { x: 1000, y: 0 } }],
  }).success, true);
});

test("semantic result normalization rejects item errors and zero-effect mutations", () => {
  const productionItemError = normalizedToolResult("create_opening", {
    Success: true,
    Message: "Create opening command completed",
    Response: {
      Success: true,
      Message: "Processed 1 opening(s)",
      Errors: [],
      Items: [{ Success: false, Message: "Wall/host element not found" }],
    },
  });
  assert.equal("isError" in productionItemError && productionItemError.isError, true);
  assert.equal(resultPayload(productionItemError).success, false);
  assert.match(String(resultPayload(productionItemError).error), /Wall\/host element not found/);

  const productionErrors = normalizedToolResult("create_opening", {
    Success: true,
    Response: {
      Message: "Processed opening request",
      Errors: ["Host element was not found"],
      Items: [],
    },
  });
  assert.equal("isError" in productionErrors && productionErrors.isError, true);

  const noEffect = normalizedMutationToolResult("mirror_elements", {
    Success: true,
    Message: "Mirrored 0 element(s)",
    Response: { ElementIds: [], Count: 0, Errors: [], Items: [] },
  });
  assert.equal("isError" in noEffect && noEffect.isError, true);
  assert.match(String(resultPayload(noEffect).error), /zero|no elements/i);

  const unrelatedEmptyArrays = normalizedMutationToolResult("create_view", {
    Success: true,
    Message: "View created",
    Response: {
      ElementId: 1240620,
      Errors: [],
      Items: [],
      Warnings: [],
    },
  });
  assert.equal("isError" in unrelatedEmptyArrays, false);

  const clashFailure = normalizedToolResult("detect_clashes", {
    Success: false,
    Message: "Detect Clashes failed: invalid solid operation",
    Response: null,
    Errors: ["invalid solid operation"],
    Items: [],
  });
  assert.equal("isError" in clashFailure && clashFailure.isError, true);

  for (const toolName of ["create_room_separation_line", "create_model_line"]) {
    const handlerFailure = normalizedMutationToolResult(toolName, {
      Success: false,
      Message: "Modifying is forbidden because the document has no open transaction.",
      Response: null,
      Errors: ["Modifying is forbidden because the document has no open transaction."],
      Items: [],
    });
    assert.equal("isError" in handlerFailure && handlerFailure.isError, true);

    const zeroEffect = normalizedMutationToolResult(toolName, {
      Success: true,
      Message: "Created 0 line(s)",
      Response: { Count: 0, ElementIds: [], Errors: [], Items: [] },
    });
    assert.equal("isError" in zeroEffect && zeroEffect.isError, true);
  }
});

test("catalog registers unique names with valid Zod input shapes", async () => {
  const definitions: RegisteredDefinition[] = [];
  const diagnostics: string[] = [];
  const server = {
    tool: (...args: unknown[]) => {
      const [name, second, third] = args;
      const schema = (typeof second === "string" ? third : second) as ZodRawShape | undefined;
      definitions.push({ name: String(name), schema });
      return {};
    },
  } as unknown as McpServer;

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => diagnostics.push(args.map(String).join(" "));
  try {
    await registerTools(server);
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(definitions.length, 155, `expected exact catalog, received ${definitions.length} tools`);
  assert.deepEqual(
    diagnostics.filter((message) => /warning|error registering/i.test(message)),
    [],
    "every included tool module must load and expose a registration function"
  );

  const names = definitions.map(({ name }) => name);
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))].sort();
  assert.deepEqual(duplicates, []);

  for (const definition of definitions) {
    assert.ok(definition.name.trim(), "tool name must not be empty");
    if (!definition.schema) continue;
    const schema = definition.schema;
    assert.doesNotThrow(() => z.object(schema), `${definition.name} has an invalid schema`);
    for (const [key, field] of Object.entries(schema)) {
      assert.ok(field instanceof z.ZodType, `${definition.name}.${key} is not a Zod schema`);
    }
  }
});
