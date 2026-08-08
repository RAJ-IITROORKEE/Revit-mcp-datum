type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function semanticFailureText(text: string): string | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;

  const nonErrorHints = ["no error", "without error", "errors: 0", "error count: 0", "no issues"];
  if (nonErrorHints.some((hint) => normalized.includes(hint))) {
    return null;
  }

  const errorHints = [
    "error",
    "failed",
    "failure",
    "exception",
    "timed out",
    "timeout",
    "not connected",
    "not paired",
    "open a project",
    "open a revit project",
    "active view",
    "no active document",
    "invalid",
    "cannot",
    "unable to",
    "missing",
  ];

  return errorHints.some((hint) => normalized.includes(hint)) ? text.trim() : null;
}

function extractSemanticFailure(value: unknown, depth = 0): string | null {
  if (depth > 5 || value == null) return null;

  if (typeof value === "string") {
    return semanticFailureText(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractSemanticFailure(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  if (
    value.success === false ||
    value.Success === false ||
    value.isError === true ||
    value.IsError === true
  ) {
    const explicit =
      (typeof value.error === "string" && value.error.trim()) ||
      (typeof value.Error === "string" && value.Error.trim()) ||
      (typeof value.message === "string" && value.message.trim()) ||
      (typeof value.Message === "string" && value.Message.trim()) ||
      null;
    if (explicit) return explicit;
    return "Tool execution failed";
  }

  const directKeys = [
    "error", "Error", "message", "Message", "reason", "Reason",
    "details", "Details", "exception", "Exception",
  ];
  for (const key of directKeys) {
    const candidate = value[key];
    if (typeof candidate === "string") {
      if ((key.toLowerCase() === "error" || key.toLowerCase() === "exception") && candidate.trim()) {
        return candidate.trim();
      }
      const matched = semanticFailureText(candidate);
      if (matched) return matched;
    }
  }

  const nestedKeys = [
    "result", "Result", "results", "Results", "content", "Content",
    "errors", "Errors", "failures", "Failures", "items", "Items",
    "data", "Data", "response", "Response",
  ];
  for (const key of nestedKeys) {
    if (key in value) {
      const candidate = value[key];
      const nested = extractSemanticFailure(candidate, depth + 1);
      if (nested) return nested;
      if (
        (key.toLowerCase() === "errors" || key.toLowerCase() === "failures") &&
        Array.isArray(candidate) &&
        candidate.length > 0
      ) {
        return typeof candidate[0] === "string" ? candidate[0] : "Tool reported one or more errors";
      }
    }
  }

  return null;
}

export function okToolResult(response: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
  };
}

export function errorToolResult(toolName: string, message: string, details?: unknown) {
  const payload: UnknownRecord = {
    success: false,
    tool: toolName,
    error: message,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function normalizedToolResult(toolName: string, response: unknown) {
  const semanticError = extractSemanticFailure(response);
  if (semanticError) {
    return errorToolResult(toolName, semanticError, response);
  }
  return okToolResult(response);
}

function hasZeroMutationEffect(value: unknown, depth = 0): boolean {
  if (depth > 5 || value == null) return false;
  if (typeof value === "string") {
    return /\b(?:created|mirrored|copied|placed|updated|deleted|affected)\s+0\b/i.test(value);
  }
  if (Array.isArray(value)) {
    if (depth === 0 && value.length === 0) return true;
    return value.some((item) => hasZeroMutationEffect(item, depth + 1));
  }
  if (!isRecord(value)) return false;

  for (const key of [
    "count", "Count", "createdCount", "CreatedCount", "affectedCount", "AffectedCount",
    "deletedCount", "DeletedCount",
  ]) {
    if (value[key] === 0) return true;
  }
  for (const key of [
    "elementIds", "ElementIds", "createdIds", "CreatedIds",
    "affectedElementIds", "AffectedElementIds",
  ]) {
    if (Array.isArray(value[key]) && value[key].length === 0) return true;
  }
  for (const key of [
    "message", "Message", "result", "Result", "results", "Results",
    "data", "Data", "response", "Response",
  ]) {
    if (key in value && hasZeroMutationEffect(value[key], depth + 1)) return true;
  }
  return false;
}

export function normalizedMutationToolResult(toolName: string, response: unknown) {
  const normalized = normalizedToolResult(toolName, response);
  if ("isError" in normalized || !hasZeroMutationEffect(response)) return normalized;
  return errorToolResult(toolName, `${toolName} completed with zero affected elements`, response);
}

export function normalizedToolCatch(toolName: string, error: unknown) {
  return errorToolResult(toolName, `${toolName} failed: ${toErrorMessage(error)}`);
}
