import { z } from "zod";

export const DEFAULT_BRANCH = "dfablelaundry" as const;
export const activeBranchIds = [DEFAULT_BRANCH] as const;
export type BranchId = (typeof activeBranchIds)[number];

// These are storage aliases belonging to D’Fable, never additional stores.
// Keep them readable so existing orders, media and payment links remain valid.
export const persistedBranchIds = [DEFAULT_BRANCH, "cinere", "bogor"] as const;
export type PersistedBranchId = (typeof persistedBranchIds)[number];
const persistedBranchSchema = z.enum(persistedBranchIds);
export const branchSchema = persistedBranchSchema.transform(
  () => DEFAULT_BRANCH,
);

export function normalizeBranchId(value: unknown): BranchId | null {
  return persistedBranchSchema.safeParse(value).success ? DEFAULT_BRANCH : null;
}

export function isBranchId(value: unknown): value is BranchId {
  return value === DEFAULT_BRANCH;
}

export function sameBranch(first: unknown, second: unknown) {
  const normalized = normalizeBranchId(first);
  return normalized !== null && normalized === normalizeBranchId(second);
}

export function branchAliases(branch: unknown): readonly PersistedBranchId[] {
  branchSchema.parse(branch);
  return persistedBranchIds;
}

export function branchLabel(value: unknown) {
  return normalizeBranchId(value) ? "D’Fable" : "Toko tidak tersedia";
}

export type BranchLocation = {
  name: string;
  area: string;
  latitude: number;
  longitude: number;
};

export const branches: Record<BranchId, string> = {
  dfablelaundry: "D’Fable",
};

// A map fallback only. A customer's coordinates select their pickup address,
// while their selected partner remains unchanged.
export const branchLocations: Record<BranchId, BranchLocation> = {
  dfablelaundry: {
    name: "D’Fable",
    area: "D’Fable Laundry",
    latitude: -6.3286,
    longitude: 106.7844,
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
  branchSchema.parse(branch);
  return "cinere";
}

export function branchSettingsReadIds(
  branch: unknown,
): readonly PersistedBranchId[] {
  branchSchema.parse(branch);
  return ["cinere", DEFAULT_BRANCH, "bogor"];
}

export function branchMediaPath(branch: unknown, slot: string) {
  branchSchema.parse(branch);
  return branch === "bogor"
    ? `banners/bogor/${slot}/image.jpg`
    : `banners/${slot}/image.jpg`;
}
