/** Canonical paths for the unified Eazywash customer app. */
export const DFABLE_HOME = "/";
export const DFABLE_PROFILE = "/profil";
export const DFABLE_ABOUT = "/tentang";

export function dfableTrackingPath(token: string) {
  return `${DFABLE_HOME}?track=${encodeURIComponent(token)}`;
}

export type CustomerQuery = Record<string, string | string[] | undefined>;
export function customerPath(
  path: "/" | "/profil" | "/tentang",
  source: CustomerQuery,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(source)) {
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      query.append(key, item);
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}
