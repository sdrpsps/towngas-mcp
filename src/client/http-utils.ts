export function headerValue(headers, name) {
  const lowerName = name.toLowerCase();
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName)?.[1];
  return Array.isArray(value) ? value.join(", ") : String(value ?? "").toLowerCase();
}

export function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

export function normalizeExpiresAt(value) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
