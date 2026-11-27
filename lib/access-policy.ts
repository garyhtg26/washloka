import { activeBranchIds, type BranchId } from "./branches";

export function adminEmailAllowed(
  email: string,
  verified: boolean,
  allowlist: string,
) {
  if (!verified || !email.trim()) return false;
  return allowlist
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}
export type AccessRole = "owner" | "admin" | "staff" | "customer";

/** The owner may grant any of their stores from either workspace. Store admins
 * can only grant their own stores and must keep the current workspace selected. */
export function canAssignStoreAccess(
  actorRole: AccessRole,
  actorBranches: readonly string[],
  workspace: string,
  branches: readonly string[],
) {
  if (actorRole !== "owner" && actorRole !== "admin") return false;
  if (!branches.length || branches.some((branch) => !actorBranches.includes(branch))) return false;
  return actorRole === "owner" || branches.includes(workspace);
}

/** Legacy staff were assigned before shops were introduced: they retain only
 * D’Fable access. An explicit empty grant does not implicitly grant a shop. */
export function accessBranches(role: AccessRole, assigned: unknown): BranchId[] {
  if (role === "owner") return [...activeBranchIds];
  if (role === "customer") return [];
  if (!Array.isArray(assigned)) return ["dfablelaundry"];
  return [...new Set(assigned.flatMap((value) =>
    value === "buzzwash" ? ["buzzwash" as const] :
    value === "dfablelaundry" || value === "cinere" || value === "bogor" ? ["dfablelaundry" as const] : []
  ))];
}
export function resolveAccess(
  email: string,
  verified: boolean,
  provider: string,
  assigned: unknown,
  allowlist: string,
) {
  const owner = adminEmailAllowed(email, verified, allowlist);
  const role: AccessRole = owner
    ? "owner"
    : assigned === "admin" || assigned === "staff"
      ? assigned
      : "customer";
  const dashboard = verified && provider === "password" && role !== "customer";
  return {
    role,
    dashboard,
    manageUsers: dashboard && (role === "owner" || role === "admin"),
  };
}
