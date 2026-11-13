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

/** Legacy staff were assigned before shops were introduced: they retain only
 * D’Fable access. An explicit empty grant does not implicitly grant a shop. */
export function accessBranches(role: AccessRole, assigned: unknown): ("dfablelaundry" | "buzzwash")[] {
  if (role === "owner") return ["dfablelaundry", "buzzwash"];
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
