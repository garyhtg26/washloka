"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import AccountPanel from "./account-panel";
import { AuthProvider } from "./auth-provider";
import CustomerAccount from "./customer-account";
import ShopSelector from "./shop-selector";
import { DFABLE_HOME, DFABLE_ABOUT } from "@/lib/dfable-path";
import { resolveCustomerBranch, type BranchId } from "@/lib/branches";

export function CustomerHeader({
  active = "about",
}: {
  active?: "about" | "profile";
}) {
  const [branch, setBranch] = useState<BranchId>("dfablelaundry");
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("branch");
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
    if (requested && requested !== selectedStore) {
      const url = new URL(window.location.href);
      url.searchParams.set("branch", selectedStore);
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

  const page = (view: string) => `${DFABLE_HOME}?view=${view}&branch=${branch}`;
  return (
    <>
      <header className="customer-header">
        <Link
          className="brand eazy-customer-brand washloka-lockup"
          href={page("home")}
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
        <nav>
          <Link href={page("home")}>Beranda</Link>
          <Link href={page("services")}>Layanan & harga</Link>
          <Link href={page("tracking")}>Lacak pesanan</Link>
          <Link
            className={active === "about" ? "active" : ""}
            href={DFABLE_ABOUT}
          >
            Tentang
          </Link>
        </nav>
        <div className="header-right">
          <ShopSelector
            branch={branch}
            onBranchChange={(next) => {
              setBranch(next);
              try {
                localStorage.setItem("eazywash-selected-store", next);
              } catch {}
              const url = new URL(window.location.href);
              url.searchParams.set("branch", next);
              window.history.replaceState(window.history.state, "", url);
            }}
          />
          <CustomerAccount onLogin={() => setOpen(true)} />
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

export default function AboutHeader() {
  return (
    <AuthProvider scope="customer">
      <CustomerHeader />
    </AuthProvider>
  );
}
