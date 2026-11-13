"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Store } from "lucide-react";
import { activeBranchIds, type BranchId } from "@/lib/branches";
import "./shop-selector.css";

const shopDetails: Record<
  BranchId,
  { short: string; name: string; area: string; logo: string }
> = {
  dfablelaundry: {
    short: "D’Fable",
    name: "D’Fable Laundry",
    area: "Karang Tengah",
    logo: "/dfable-logo-compact.webp",
  },
  buzzwash: {
    short: "BuzzWash",
    name: "BuzzWash",
    area: "Cibubur",
    logo: "/buzzwash-logo.png",
  },
};

export default function ShopSelector({
  branch,
  onBranchChange,
  disabled = false,
  availableBranches = activeBranchIds,
}: {
  branch: BranchId;
  onBranchChange: (branch: BranchId) => void;
  disabled?: boolean;
  availableBranches?: readonly BranchId[];
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
        aria-label={`Pilih toko. ${shopDetails[branch].name}, toko terpilih`}
      >
        <span
          className={`shop-picker-monogram${branch === "dfablelaundry" ? " shop-picker-monogram--dfable" : ""}`}
          aria-hidden="true"
        >
          {branch === "dfablelaundry" ? (
            <span className="shop-picker-monogram-letter">D</span>
          ) : branch === "buzzwash" ? (
            <img src="/buzzwash-icon.png" alt="" />
          ) : (
            <Store size={18} />
          )}
        </span>
        <span className="shop-picker-current">
          <small>Toko pilihan</small>
          <b>{shopDetails[branch].short}</b>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <section className="shop-picker-panel" aria-label="Pilih toko laundry">
          <div className="shop-picker-panel-heading">
            <span>Pilih toko</span>
            <span>Partner Washloka</span>
          </div>
          <div className="shop-picker-options">
            {availableBranches.map((id) => {
              const shop = shopDetails[id];
              const selected = branch === id;
              return (
                <button
                  className={`shop-picker-option${selected ? " is-selected" : ""}`}
                  type="button"
                  key={id}
                  onClick={() => {
                    if (!selected) onBranchChange(id);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                  aria-label={`${shop.name}, ${shop.area}${selected ? ", toko terpilih" : ""}`}
                  aria-pressed={selected}
                >
                  <span className="shop-picker-logo">
                    <img src={shop.logo} alt="" />
                  </span>
                  <span>
                    <b>{shop.name}</b>
                    <small>
                      {shop.area}
                      {selected ? " · Toko terpilih" : ""}
                    </small>
                  </span>
                  {selected && <Check size={17} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
