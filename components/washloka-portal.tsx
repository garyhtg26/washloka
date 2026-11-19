"use client";

import { useState } from "react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import type { BranchId } from "@/lib/branches";
import "./washloka-portal.css";

const partners: { id: BranchId; name: string; area: string; logo: string; description: string }[] = [
  { id: "dfablelaundry", name: "D’Fable Laundry", area: "Karang Tengah", logo: "/dfable-logo-compact.webp", description: "Laundry untuk kebutuhan sehari-hari." },
  { id: "buzzwash", name: "BuzzWash", area: "Cibubur", logo: "/buzzwash-logo-compact.webp", description: "Layanan laundry kiloan dan satuan." },
];

export default function WashlokaPortal({ onSelectShop, onTrack }: {
  onSelectShop: (id: BranchId) => void;
  onTrack: (code: string) => void;
}) {
  const [trackingCode, setTrackingCode] = useState("");
  return <div className="wash-portal">
    <section className="wash-portal-hero" aria-labelledby="wash-portal-title">
      <picture>
        <source media="(max-width: 600px)" srcSet="/washloka/hero-washer-mobile.webp" />
        <img src="/washloka/hero-washer-wide.webp" alt="" fetchPriority="high" />
      </picture>
      <div className="wash-portal-hero-content">
        <h1 id="wash-portal-title">Clean at Your<br />Fingertips.</h1>
        <p className="wash-portal-hero-description">Dapatkan poin dan temukan laundry pilihanmu, semua dalam satu aplikasi.</p>
        <a href="#laundry-pilihan" className="wash-portal-hero-link">Lihat pilihan laundry</a>
      </div>
      <svg className="wash-portal-hero-wave" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 35C360 70 1080 70 1440 35V100H0Z" />
      </svg>
    </section>

    <section className="wash-portal-partners" id="laundry-pilihan" aria-labelledby="wash-portal-partners-title">
      <div className="wash-portal-section-heading"><div><span>PARTNER WASHLOKA</span><h2 id="wash-portal-partners-title">Pilih laundry kamu</h2><p>Setiap laundry punya layanan dan harga masing-masing.</p></div></div>
      <div className="wash-portal-partner-grid">
        {partners.map((partner, index) => <button type="button" className="wash-portal-partner" key={partner.id} onClick={() => onSelectShop(partner.id)} aria-label={`Buka ${partner.name}`}>
          <span className={`wash-portal-partner-image wash-portal-partner-image-${partner.id}`}>
            <span className="wash-portal-partner-index">0{index + 1} / LAUNDRY PARTNER</span>
            <span className="wash-portal-logo"><img src={partner.logo} alt="" /></span>
          </span>
          <span className="wash-portal-partner-info"><span><strong>{partner.name}</strong><small><MapPin size={14} aria-hidden="true" /> {partner.area}</small></span><span className="wash-portal-partner-cta">Lihat toko</span></span>
          <span className="wash-portal-partner-description">{partner.description}</span>
        </button>)}
      </div>
    </section>

    <section className="wash-portal-track" aria-labelledby="wash-portal-track-title">
      <div><span className="wash-portal-track-label">SUDAH PUNYA PESANAN?</span><h2 id="wash-portal-track-title">Pantau cucianmu</h2><p>Masukkan nomor pesanan untuk melihat status terbaru.</p></div>
      <form onSubmit={(event) => { event.preventDefault(); if (trackingCode.trim()) onTrack(trackingCode.trim()); }}>
        <label><Search size={19} aria-hidden="true" /><input required aria-label="Nomor pesanan" placeholder="Nomor pesanan" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} /></label>
        <button type="submit">Lacak <ArrowRight size={17} aria-hidden="true" /></button>
      </form>
    </section>
  </div>;
}
