import { redirect } from "next/navigation";
import { customerPath, type CustomerQuery } from "@/lib/dfable-path";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<CustomerQuery>;
}) {
  redirect(customerPath("/profil", await searchParams));
}
