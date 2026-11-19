import { z } from "zod";

export const DEFAULT_BRANCH = "dfablelaundry" as const;
export const activeBranchIds = [DEFAULT_BRANCH, "buzzwash"] as const;
export type BranchId = (typeof activeBranchIds)[number];

// These are storage aliases belonging to D’Fable, never additional stores.
// Keep them readable so existing orders, media and payment links remain valid.
export const persistedBranchIds = [
  DEFAULT_BRANCH,
  "cinere",
  "bogor",
  "buzzwash",
] as const;
export type PersistedBranchId = (typeof persistedBranchIds)[number];
const persistedBranchSchema = z.enum(persistedBranchIds);
export const branchSchema = persistedBranchSchema.transform(
  (value): BranchId => (value === "buzzwash" ? "buzzwash" : DEFAULT_BRANCH),
);

export function normalizeBranchId(value: unknown): BranchId | null {
  const parsed = branchSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isBranchId(value: unknown): value is BranchId {
  return activeBranchIds.some((branch) => branch === value);
}

export function sameBranch(first: unknown, second: unknown) {
  const normalized = normalizeBranchId(first);
  return normalized !== null && normalized === normalizeBranchId(second);
}

/** A tracking token identifies the shop that owns the order, even for older
 * links without a branch parameter. Unknown shops and the current shop do not
 * trigger navigation. Dashboard workspaces are always selected separately. */
export function trackingBranch(current: BranchId, orderBranch: unknown, dashboard: boolean): BranchId | null {
  if (dashboard) return null;
  const branch = normalizeBranchId(orderBranch);
  return branch && branch !== current ? branch : null;
}

export function branchAliases(branch: unknown): readonly PersistedBranchId[] {
  const store = branchSchema.parse(branch);
  return store === "buzzwash"
    ? ["buzzwash"]
    : [DEFAULT_BRANCH, "cinere", "bogor"];
}

export function branchLabel(value: unknown) {
  const store = normalizeBranchId(value);
  return store ? branches[store] : "Toko tidak tersedia";
}

export type BranchLocation = {
  name: string;
  area: string;
  latitude: number;
  longitude: number;
};

export const branches: Record<BranchId, string> = {
  dfablelaundry: "D’Fable",
  buzzwash: "BuzzWash",
};

// A map fallback only. A customer's coordinates select their pickup address,
// while their selected partner remains unchanged.
export const branchLocations: Record<BranchId, BranchLocation> = {
  dfablelaundry: {
    name: "D’Fable",
    area: "Karang Tengah",
    latitude: -6.3286,
    longitude: 106.7844,
  },
  // Approximate map center for the Cibubur area, not a verified shop address.
  buzzwash: {
    name: "BuzzWash",
    area: "Cibubur",
    latitude: -6.362,
    longitude: 106.895,
  },
};

export function nearestBranch(_latitude: number, _longitude: number): BranchId {
  return DEFAULT_BRANCH;
}

export function resolveCustomerBranch({
  requested,
  saved,
}: {
  detected?: { latitude: number; longitude: number } | null;
  requested?: unknown;
  saved?: unknown;
}): BranchId {
  return (
    normalizeBranchId(requested) || normalizeBranchId(saved) || DEFAULT_BRANCH
  );
}

export function requestBranch(url: string): BranchId {
  return branchSchema.parse(
    new URL(url).searchParams.get("branch") ?? DEFAULT_BRANCH,
  );
}

// D’Fable's existing primary settings and banner paths stay in place. Only the
// public store identity changes; no production data is renamed or deleted.
export function branchSettingsId(branch: unknown): PersistedBranchId {
  return branchSchema.parse(branch) === "buzzwash" ? "buzzwash" : "cinere";
}

export function branchSettingsReadIds(
  branch: unknown,
): readonly PersistedBranchId[] {
  return branchSchema.parse(branch) === "buzzwash"
    ? ["buzzwash"]
    : ["cinere", DEFAULT_BRANCH, "bogor"];
}

export function branchMediaPath(branch: unknown, slot: string) {
  if (branchSchema.parse(branch) === "buzzwash")
    return `banners/buzzwash/${slot}/image.jpg`;
  return branch === "bogor"
    ? `banners/bogor/${slot}/image.jpg`
    : `banners/${slot}/image.jpg`;
}
