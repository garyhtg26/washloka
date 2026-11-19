import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import Studio from "@/components/studio";
import { redirect } from "next/navigation";
import { normalizeBranchId } from "@/lib/branches";
import { customerPath, type CustomerQuery } from "@/lib/dfable-path";

export const metadata: Metadata = {
  title: "Washloka",
  description: "Temukan laundry pilihanmu dan pantau pesanan dengan Washloka.",
  // Guest tracking links are bearer credentials; do not forward them as referrers.
  referrer: "no-referrer",
};

export default async function Page({ searchParams }: { searchParams: Promise<CustomerQuery> }) {
  const query = await searchParams;
  const branch = normalizeBranchId(Array.isArray(query.branch) ? query.branch[0] : query.branch);
  if (branch) {
    const { branch: _legacyBranch, ...rest } = query;
    redirect(customerPath(branch === "buzzwash" ? "/buzzwash" : "/dfabel", rest));
  }
  if (query.view === "services") redirect(customerPath("/dfabel", query));
  return (
    <AuthProvider scope="customer">
      <Studio />
    </AuthProvider>
  );
}
