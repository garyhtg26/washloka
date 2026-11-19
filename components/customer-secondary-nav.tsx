import Link from "next/link";
import { ArrowLeft, LayoutDashboard, Package, Shirt, Store } from "lucide-react";
import type { BranchId } from "@/lib/branches";
import { customerContextPaths } from "@/lib/customer-context";

/** The shared account and about pages use the same navigation as their context. */
export default function CustomerSecondaryNav({ branch, active }: {
  branch: BranchId | null;
  active?: "about" | "profile";
}) {
  const paths = customerContextPaths(branch);
  return <nav className="mobile-nav" aria-label="Navigasi utama">
    {branch ? <>
      <Link href="/"><ArrowLeft size={20} />Washloka</Link>
      <Link href={paths.home}><LayoutDashboard size={20} />Beranda</Link>
      <Link href={paths.view("services")}><Shirt size={20} />Layanan &amp; harga</Link>
      <Link href={paths.view("tracking")}><Package size={20} />Lacak pesanan</Link>
    </> : <>
      <Link href="/"><LayoutDashboard size={20} />Beranda</Link>
      <Link className={active === "about" ? "active" : undefined} aria-current={active === "about" ? "page" : undefined} href={paths.about}><Store size={20} />Tentang</Link>
    </>}
  </nav>;
}
