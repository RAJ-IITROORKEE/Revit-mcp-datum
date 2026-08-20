import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerTools } from "../build/tools/register.js";
import { catalogHash } from "./local-runtime-canonical.mjs";

const cloudOnlyTools = new Set(["query_stored_data", "store_project_data", "store_room_data"]);
const prohibitedLlmTools = new Set(["send_code_to_revit"]);
const sessionTagTools = new Set([
  "create_ceiling",
  "create_floor",
  "create_room",
  "create_wall",
  "delete_elements",
  "place_component"
]);
const readTools = new Set([
  "ai_element_filter",
  "analyze_layout_design",
  "analyze_solar_exposure",
  "calculate_carbon_footprint",
  "calculate_costs",
  "calculate_daylighting",
  "calculate_electrical_load",
  "calculate_hvac_load",
  "check_building_code_compliance",
  "compare_design_options",
  "detect_clashes",
  "get_available_family_types",
  "get_current_view_elements",
  "get_current_view_info",
  "get_element_parameters",
  "get_element_relationships",
  "get_element_spatial_data",
  "get_furniture_catalog",
  "get_grids_list",
  "get_levels_list",
  "get_loaded_families",
  "get_project_materials",
  "get_rooms_list",
  "get_selected_elements",
  "get_sheets_list",
  "get_views_list",
  "measure_distance",
  "validate_spatial_relationships"
]);
const dangerousTools = new Set([
  "auto_furnish_room",
  "apply_view_template",
  "create_assembly",
  "create_curtain_grid",
  "create_design_option",
  "create_mullion",
  "create_topography",
  "delete_element",
  "delete_elements",
  "edit_family",
  "group_elements",
  "import_cad",
  "import_ifc",
  "link_model",
  "manage_phases",
  "manage_revisions",
  "manage_view_templates",
  "manage_worksets",
  "operate_element",
  "optimize_model",
  "send_code_to_revit",
  "split_element"
]);
// Reviewed against the v2 tool catalog. This is intentionally explicit: creation evidence
// cannot be inferred safely from naming conventions or multi-action tool names.
const createdIdsRequiredTools = new Set([
  "array_elements", "auto_furnish_room", "batch_dimension_elements", "batch_tag_elements", "copy_elements",
  "create_3d_view", "create_adaptive_component", "create_analytical_model", "create_annotation_symbol",
  "create_area_plan", "create_assembly", "create_beam", "create_brace", "create_building_pad", "create_callout",
  "create_ceiling", "create_color_scheme", "create_column", "create_curtain_grid", "create_curtain_wall",
  "create_design_option", "create_detail_component", "create_detail_lines", "create_dimension", "create_drafting_view",
  "create_duct", "create_electrical_circuit", "create_elevation_marker", "create_family", "create_filled_region",
  "create_floor", "create_foundation", "create_grid", "create_keynote", "create_legend_view", "create_level",
  "create_line_based_element", "create_masking_region", "create_mechanical_system", "create_mep_fabrication",
  "create_mep_space", "create_model_line", "create_mullion", "create_opening", "create_parking_layout", "create_pipe",
  "create_plumbing_system", "create_point_based_element", "create_property_line", "create_quantity_takeoff", "create_railing",
  "create_ramp", "create_reference_plane", "create_revision_cloud", "create_roof", "create_room",
  "create_room_separation_line", "create_schedule", "create_scope_box", "create_section_marker", "create_sheet",
  "create_spot_elevation", "create_sprinkler_system", "create_stairs", "create_surface_based_element", "create_tag",
  "create_text_note", "create_topography", "create_truss", "create_view", "create_wall", "create_wall_reveal",
  "create_wall_sweep", "duplicate_view", "group_elements", "import_cad", "import_ifc", "link_model", "load_family",
  "mirror_copy_layout", "mirror_elements", "place_component", "place_electrical_equipment", "place_electrical_fixture",
  "place_furniture_in_room", "place_mechanical_equipment", "place_plumbing_fixture", "place_site_component", "place_viewport",
  "route_conduit", "route_mep_path", "split_element", "tag_all_walls"
]);

const definitions = [];
const diagnostics = [];
const server = {
  tool: (...args) => {
    definitions.push(String(args[0]));
    return {};
  }
};
const originalConsoleError = console.error;
console.error = (...args) => diagnostics.push(args.map(String).join(" "));
try {
  await registerTools(server);
} finally {
  console.error = originalConsoleError;
}

const registrationErrors = diagnostics.filter((message) => /warning|error registering/i.test(message));
if (registrationErrors.length) throw new Error(`Tool registration failed:\n${registrationErrors.join("\n")}`);
if (definitions.length !== 155) throw new Error(`Expected 155 registered tools, received ${definitions.length}`);
if (new Set(definitions).size !== definitions.length) throw new Error("Tool catalog contains duplicate names");

const names = definitions.filter((name) => !cloudOnlyTools.has(name)).sort();
if (names.length !== 152) throw new Error(`Expected 152 local Revit tools, received ${names.length}`);

const tools = names.map((name) => {
  const mutationClass = readTools.has(name) ? "read" : dangerousTools.has(name) ? "dangerous" : "mutation";
  return {
    name,
    mutationClass,
    retryPolicy: mutationClass === "read" ? "read_only" : "never",
    timeoutMs: name === "place_component" ? 300000 : mutationClass === "read" ? 30000 : 180000,
    createdIdsRequired: createdIdsRequiredTools.has(name),
    sessionTagSupported: sessionTagTools.has(name),
    automaticRollbackAllowed: false,
    maxArgsBytes: 1048576,
    maxResultBytes: 4194304
  };
});
const hash = catalogHash(tools);
const manifest = {
  protocolVersion: 2,
  catalogVersion: "revit-mcp-local-v2",
  catalogHash: hash,
  localToolCount: 152,
  excludedCloudTools: [...cloudOnlyTools].sort(),
  prohibitedLlmTools: [...prohibitedLlmTools].sort(),
  tools
};

const output = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts", "desktop-bridge", "v2", "tool-policy-manifest.json");
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${tools.length} local tool policies with catalog hash ${hash}.`);
