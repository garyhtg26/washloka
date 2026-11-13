import { notFound, redirect } from "next/navigation";
import { customerPath, type CustomerQuery } from "@/lib/dfable-path";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ laundry: string }>;
  searchParams: Promise<CustomerQuery>;
}) {
  const laundry = (await params).laundry.toLowerCase();
  if (laundry !== "dfablelaundry" && laundry !== "buzzwash") notFound();
  redirect(customerPath("/", { ...(await searchParams), branch: laundry }));
}
