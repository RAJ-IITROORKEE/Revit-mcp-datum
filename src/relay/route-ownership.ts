import type { ClientType } from "./types.js";

export interface RouteOwner {
  clientId: string;
  generation: number;
}

export interface RouteBinding {
  revit?: RouteOwner;
  mcp?: RouteOwner;
  generation: number;
}

export function createRouteBinding(): RouteBinding {
  return { generation: 0 };
}

export function claimRouteOwner(
  binding: RouteBinding,
  clientType: ClientType,
  clientId: string
): { owner: RouteOwner; previous?: RouteOwner } {
  const generation = binding.generation + 1;
  binding.generation = generation;
  const owner = { clientId, generation };
  const key = clientType === "revit-plugin" ? "revit" : "mcp";
  const previous = binding[key];
  binding[key] = owner;
  return { owner, previous };
}

export function isCurrentRouteOwner(
  binding: RouteBinding | undefined,
  clientType: ClientType,
  clientId: string,
  generation: number
): boolean {
  if (!binding) return false;
  const owner = clientType === "revit-plugin" ? binding.revit : binding.mcp;
  return owner?.clientId === clientId && owner.generation === generation;
}

export function releaseRouteOwner(
  binding: RouteBinding | undefined,
  clientType: ClientType,
  clientId: string,
  generation: number
): boolean {
  if (!isCurrentRouteOwner(binding, clientType, clientId, generation) || !binding) return false;
  if (clientType === "revit-plugin") delete binding.revit;
  else delete binding.mcp;
  return true;
}
