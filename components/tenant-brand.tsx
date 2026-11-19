import type { BranchId } from "@/lib/branches";
import { tenantStorePath } from "@/lib/dfable-path";

/** The partner logo belongs to the selected laundry, not the platform. */
export default function TenantBrand({ branch }: { branch: BranchId }) {
  const buzz = branch === "buzzwash";
  return <a className="tenant-brand" href={tenantStorePath(branch)} aria-label={`${buzz ? "BuzzWash" : "D’Fable"} beranda`}>
    <img src={buzz ? "/buzzwash-logo-compact.webp" : "/dfable-logo-compact.webp"} alt={buzz ? "BuzzWash" : "D’Fable Laundry"} />
  </a>;
}
