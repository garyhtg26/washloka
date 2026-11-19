import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import CustomerProfile from "@/components/profile-customer";
import { normalizeBranchId } from "@/lib/branches";
import type { CustomerQuery } from "@/lib/dfable-path";

export const metadata: Metadata = {
  title: "Profil Saya — Washloka",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<CustomerQuery> }) {
  const query = await searchParams;
  const branch = normalizeBranchId(Array.isArray(query.branch) ? query.branch[0] : query.branch);
  return (
    <AuthProvider scope="customer">
      <CustomerProfile initialTenant={branch} />
    </AuthProvider>
  );
}
