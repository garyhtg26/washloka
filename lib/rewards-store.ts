import "server-only";
import { normalizeBranchId } from "./branches";
import { ApiError } from "./firebase/access";

// Washloka rewards are shared across supported partner stores for each user.
export function isRewardsStore(branch: unknown): boolean {
  return normalizeBranchId(branch) !== null;
}

export function requireRewardsStore(branch: unknown): void {
  if (!normalizeBranchId(branch))
    throw new ApiError(404, "Toko tidak ditemukan.");
  if (!isRewardsStore(branch))
    throw new ApiError(
      409,
      "Membership dan poin belum tersedia untuk toko ini.",
    );
}
