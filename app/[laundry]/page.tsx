import { notFound, redirect } from "next/navigation";
import { customerPath, type CustomerQuery } from "@/lib/dfable-path";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ laundry: string }>;
  searchParams: Promise<CustomerQuery>;
}) {
  if ((await params).laundry.toLowerCase() !== "dfablelaundry") notFound();
  redirect(customerPath("/", await searchParams));
}
