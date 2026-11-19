import { notFound, redirect } from "next/navigation";
import { AuthProvider } from "@/components/auth-provider";
import Studio from "@/components/studio";
import { customerPath, tenantFromSlug, type CustomerQuery } from "@/lib/dfable-path";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ laundry: string }> }): Promise<Metadata> {
  const branch = tenantFromSlug((await params).laundry);
  return {
    title: branch === "buzzwash" ? "BuzzWash" : branch === "dfablelaundry" ? "D’Fable Laundry" : "Washloka",
    ...(branch === "buzzwash" ? { icons: { icon: "/buzzwash-icon.png" } } : {}),
    referrer: "no-referrer",
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ laundry: string }>;
  searchParams: Promise<CustomerQuery>;
}) {
  const laundry = (await params).laundry.toLowerCase();
  const branch = tenantFromSlug(laundry);
  if (!branch) notFound();
  if (laundry !== "dfabel" && laundry !== "buzzwash")
    redirect(customerPath(branch === "buzzwash" ? "/buzzwash" : "/dfabel", await searchParams));
  return <AuthProvider scope="customer"><Studio tenantBranch={branch} /></AuthProvider>;
}
