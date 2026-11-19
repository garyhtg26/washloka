"use client";

import Link from "next/link";
import { ArrowLeft, LayoutDashboard, Package, Shirt, Store } from "lucide-react";
import { DFABLE_ABOUT, DFABLE_HOME } from "@/lib/dfable-path";

/** Main site and partner storefronts deliberately have separate menus. */
export default function CustomerNavigation({ tenant, view, mobile, onView }: {
  tenant: boolean;
  view: string;
  mobile?: boolean;
  onView: (view: "home" | "services" | "tracking") => void;
}) {
  return <nav className={mobile ? "mobile-nav" : undefined} aria-label={tenant ? "Navigasi toko" : "Navigasi Washloka"}>
    {tenant && <Link href={DFABLE_HOME} className={mobile ? undefined : "customer-nav-back"} aria-label="Kembali ke Washloka">
      <ArrowLeft size={mobile ? 20 : 16} aria-hidden="true" /> {mobile ? "Washloka" : "Kembali ke Washloka"}
    </Link>}
    {tenant ? <>
      <button type="button" className={view === "home" ? "active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => onView("home")}>
        {mobile && <LayoutDashboard size={20} aria-hidden="true" />} Beranda
      </button>
      <button type="button" className={view === "services" ? "active" : ""} aria-current={view === "services" ? "page" : undefined} onClick={() => onView("services")}>
        {mobile && <Shirt size={20} aria-hidden="true" />} Layanan &amp; harga
      </button>
      <button type="button" className={view === "tracking" ? "active" : ""} aria-current={view === "tracking" ? "page" : undefined} onClick={() => onView("tracking")}>
        {mobile && <Package size={20} aria-hidden="true" />} Lacak pesanan
      </button>
    </> : <>
      <button type="button" className={view === "home" ? "active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => onView("home")}>
        {mobile && <LayoutDashboard size={20} aria-hidden="true" />} Beranda
      </button>
      <Link href={DFABLE_ABOUT}>{mobile && <Store size={20} aria-hidden="true" />} Tentang</Link>
    </>}
  </nav>;
}
