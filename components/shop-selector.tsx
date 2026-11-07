"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Store } from "lucide-react";
import type { BranchId } from "@/lib/branches";
import "./shop-selector.css";

export default function ShopSelector({
  disabled = false,
}: {
  branch: BranchId;
  onBranchChange: (branch: BranchId) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="shop-picker" ref={root}>
      <button
        ref={trigger}
        className={`shop-picker-trigger${open ? " is-open" : ""}`}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Pilih toko. D’Fable Laundry, toko terpilih"
      >
        <span className="shop-picker-monogram" aria-hidden="true">
          <img src="/favicon.svg" alt="" />
        </span>
        <span className="shop-picker-current">
          <small>Toko pilihan</small>
          <b>D’Fable</b>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <section className="shop-picker-panel" aria-label="Pilih toko laundry">
          <div className="shop-picker-panel-heading">
            <span>Pilih toko</span>
            <span>Partner Eazywash</span>
          </div>
          <button
            className="shop-picker-option"
            type="button"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
            aria-label="D’Fable Laundry, toko terpilih"
          >
            <span className="shop-picker-logo">
              <img src="/dfable-logo.png" alt="D’Fable Laundry" />
            </span>
            <span>
              <b>D’Fable Laundry</b>
              <small>Toko terpilih</small>
            </span>
            <Check size={17} />
          </button>
          <div className="shop-picker-coming">
            <Store size={18} />
            <span>
              <b>Partner lainnya</b>
              <small>Segera hadir di Eazywash</small>
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
