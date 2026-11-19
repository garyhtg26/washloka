import { normalizeBranchId, type BranchId } from "./branches";

/** Canonical paths for the unified Washloka customer app. */
export const DFABLE_HOME = "/";
export const DFABLE_PROFILE = "/profil";
export const DFABLE_ABOUT = "/tentang";

/** Public storefront URLs are independent of the historical storage IDs. */
export function tenantStorePath(branch: BranchId): string {
  return branch === "buzzwash" ? "/buzzwash" : "/dfabel";
}

export function tenantFromSlug(slug: string): BranchId | null {
  switch (slug.toLowerCase()) {
    case "dfabel":
    case "dfable":
    case "dfablelaundry": return "dfablelaundry";
    case "buzzwash": return "buzzwash";
    default: return null;
  }
}

export function dfableTrackingPath(token: string, branchId?: unknown) {
  const branch = normalizeBranchId(branchId);
  return `${branch ? tenantStorePath(branch) : DFABLE_HOME}?track=${encodeURIComponent(token)}`;
}

export type CustomerQuery = Record<string, string | string[] | undefined>;
export function customerPath(
  path: "/" | "/profil" | "/tentang" | "/dfabel" | "/buzzwash",
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
