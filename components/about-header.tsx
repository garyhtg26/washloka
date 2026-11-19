"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import AccountPanel from "./account-panel";
import { AuthProvider } from "./auth-provider";
import CustomerAccount from "./customer-account";
import ShopSelector from "./shop-selector";
import { tenantStorePath } from "@/lib/dfable-path";
import { resolveCustomerBranch, type BranchId } from "@/lib/branches";
import { customerContextPaths, customerTenantContext } from "@/lib/customer-context";
import TenantBrand from "./tenant-brand";
import "./tenant-brand.css";
import "./customer-tenant-context.css";

export function CustomerHeader({
  active = "about",
  initialTenant = null,
}: {
  active?: "about" | "profile";
  initialTenant?: BranchId | null;
}) {
  const [branch, setBranch] = useState<BranchId>(initialTenant ?? "dfablelaundry");
  const [tenant, setTenant] = useState<BranchId | null>(initialTenant);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("branch");
    const explicitTenant = customerTenantContext(window.location.search);
    setTenant(explicitTenant);
    let saved: string | null = null;
    try {
      saved =
        localStorage.getItem("eazywash-selected-store") ||
        localStorage.getItem("dfable-customer-branch");
    } catch {}
    const selectedStore = resolveCustomerBranch({ requested, saved });
    setBranch(selectedStore);
    try {
      localStorage.setItem("eazywash-selected-store", selectedStore);
      localStorage.removeItem("dfable-customer-branch");
    } catch {}
    if (requested && requested !== explicitTenant) {
      const url = new URL(window.location.href);
      if (explicitTenant) url.searchParams.set("branch", explicitTenant);
      else url.searchParams.delete("branch");
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousOverflow = document.body.style.overflow;
    if (!element.open) element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const paths = customerContextPaths(tenant);
  const useStoreBrand = !!tenant && active !== "profile";
  return (
    <>
      <header className={`customer-header${useStoreBrand ? ` tenant-${tenant === "dfablelaundry" ? "dfable" : "buzzwash"}` : ""}`}>
        {useStoreBrand && tenant ? <TenantBrand branch={tenant} /> : (
        <Link
          className="brand eazy-customer-brand washloka-lockup"
          href={active === "profile" ? "/" : paths.home}
          aria-label="Washloka beranda"
        >
          <img
            className="washloka-mark"
            src="/washloka/app-icon-burgundy.svg"
            alt=""
          />
          <img
            className="washloka-wordmark"
            src="/washloka/wordmark-burgundy.svg?v=20261112"
            alt="Washloka"
          />
        </Link>
        )}
        <nav aria-label="Navigasi utama">
          {tenant ? <>
            <Link className="customer-nav-back" href="/"><ArrowLeft size={16} /> Kembali ke Washloka</Link>
            <Link href={paths.home}>Beranda</Link>
            <Link href={paths.view("services")}>Layanan &amp; harga</Link>
            <Link href={paths.view("tracking")}>Lacak pesanan</Link>
          </> : <>
            <Link href="/">Beranda</Link>
            <Link className={active === "about" ? "active" : ""} aria-current={active === "about" ? "page" : undefined} href={paths.about}>Tentang</Link>
          </>}
        </nav>
        <div className="header-right">
          {tenant ? <ShopSelector
            branch={branch}
            onBranchChange={(next) => {
              setBranch(next);
              try {
                localStorage.setItem("eazywash-selected-store", next);
              } catch {}
              window.location.assign(tenantStorePath(next));
            }}
          /> : null}
          <CustomerAccount onLogin={() => setOpen(true)} profileHref={paths.profile} />
        </div>
      </header>
      <dialog
        ref={dialog}
        className="auth-dialog"
        aria-label="Akun pelanggan"
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
      >
        <button
          className="close-button"
          aria-label="Tutup"
          onClick={() => setOpen(false)}
        >
          <X size={21} />
        </button>
        <AccountPanel onDone={() => setOpen(false)} />
      </dialog>
    </>
  );
}

export default function AboutHeader({ initialTenant = null }: { initialTenant?: BranchId | null }) {
  return (
    <AuthProvider scope="customer">
      <CustomerHeader initialTenant={initialTenant} />
    </AuthProvider>
  );
}
