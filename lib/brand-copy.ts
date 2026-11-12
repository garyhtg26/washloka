/** Refresh public-facing copy from older settings without modifying stored data. */
export function brandCopy(value: unknown, fallback = ""): string {
  return typeof value === "string"
    ? value.replace(/(?:buzzwash|eazywash|easywash|\bbuzz\b)/gi, "Washloka")
    : fallback;
}
