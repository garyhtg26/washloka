"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Store } from "lucide-react";
import type { BranchId } from "@/lib/branches";
import "./shop-selector.css";

export default function ShopSelector({
  branch,
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
        <span
          className={`shop-picker-monogram${branch === "dfablelaundry" ? " shop-picker-monogram--dfable" : ""}`}
          aria-hidden="true"
        >
          {branch === "dfablelaundry" ? (
            <>
              <img src="/dfable-icon.png" alt="" />
              <span className="shop-picker-monogram-letter">D</span>
            </>
          ) : (
            <Store size={18} />
          )}
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
            <span>Partner Washloka</span>
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
              <img src="/dfable-logo-compact.webp" alt="" />
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
              <small>Segera hadir di Washloka</small>
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
