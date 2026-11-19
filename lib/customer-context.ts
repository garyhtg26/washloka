import { normalizeBranchId, type BranchId } from "./branches";
import { DFABLE_ABOUT, DFABLE_HOME, DFABLE_PROFILE, tenantStorePath } from "./dfable-path";

/** Shared profile and about pages keep their platform identity unless a store
 * context was explicitly included in the link. Membership remains shared. */
export function customerTenantContext(search: string): BranchId | null {
  return normalizeBranchId(new URLSearchParams(search).get("branch"));
}

export function customerContextPaths(branch: BranchId | null) {
  const home = branch ? tenantStorePath(branch) : DFABLE_HOME;
  const suffix = branch ? `?branch=${encodeURIComponent(branch)}` : "";
  return {
    home,
    profile: `${DFABLE_PROFILE}${suffix}`,
    about: `${DFABLE_ABOUT}${suffix}`,
    view: (name: "home" | "services" | "tracking") => `${home}?view=${name}`,
    login: `${home}?account=1`,
  };
}
