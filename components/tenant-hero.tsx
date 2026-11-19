"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { BranchId } from "@/lib/branches";
import type { Store } from "@/lib/types";
import { defaultImages, siteContent, siteImage } from "@/lib/site-content";

/** A partner's uploaded images come from that partner's own dashboard. */
export default function TenantHero({ branch, store, onOrder, onServices }: {
  branch: BranchId;
  store: Store;
  onOrder: (service?: string) => void;
  onServices: () => void;
}) {
  const [index, setIndex] = useState(0);
  const content = siteContent(store.content);
  const promo = siteImage(content, "promo");
  const extra = siteImage(content, "people");
  const buzz = branch === "buzzwash";
  const available = !buzz || store.orderingEnabled === true;
  const partnerCopy = (value?: string) => value && !/washloka/i.test(value) ? value : "";
  const slides = [{
    title: store.promo.active && partnerCopy(store.promo.title) && store.promo.title !== "BuzzWash"
      ? store.promo.title : "Laundry bersih, hari lebih ringan.",
    description: store.promo.active && partnerCopy(store.promo.description) && store.promo.description !== "Layanan laundry BuzzWash"
      ? store.promo.description : "Pilih layanan yang sesuai dan biarkan kami merawat cucianmu.",
    image: store.promo.active && promo !== defaultImages.promo ? promo : buzz ? "/unsplash/laundry-web.webp" : "/unsplash/clean-web.webp",
    button: (store.promo.active && partnerCopy(store.promo.button)) || "Pesan laundry",
  }, ...(content.people.active && extra !== defaultImages.people ? [{
    title: partnerCopy(content.people.title) || "Layanan untuk keseharianmu.",
    description: "Temukan layanan yang sesuai untuk kebutuhan cucianmu.",
    image: extra,
    button: content.people.button === "Jadwalkan jemput" ? "Pesan laundry" : partnerCopy(content.people.button) || "Pesan laundry",
  }] : [])];
  useEffect(() => setIndex(0), [branch, promo, extra]);
  const current = Math.min(index, slides.length - 1);
  const slide = slides[current];
  return <section className="tenant-hero" aria-label={`Banner ${buzz ? "BuzzWash" : "D’Fable"}`} aria-roledescription="carousel">
    <div className="tenant-hero-copy">
      <span className="tenant-hero-eyebrow">{buzz ? "BUZZWASH LAUNDRY" : "D’FABLE LAUNDRY"}</span>
      <h2>{slide.title}</h2>
      <p>{slide.description}</p>
      <button type="button" onClick={() => available ? onOrder("wash") : onServices()}>
        {available ? slide.button : "Lihat layanan"} <ArrowRight size={17} />
      </button>
      {slides.length > 1 && <div className="tenant-hero-controls" aria-label="Navigasi banner">
        <button type="button" onClick={() => setIndex((current + slides.length - 1) % slides.length)} aria-label="Banner sebelumnya"><ChevronLeft size={16} /></button>
        <span>{current + 1} / {slides.length}</span>
        <button type="button" onClick={() => setIndex((current + 1) % slides.length)} aria-label="Banner berikutnya"><ChevronRight size={16} /></button>
      </div>}
    </div>
    <div className="tenant-hero-image"><Image src={slide.image} alt="" fill sizes="(max-width: 700px) 100vw, 55vw" unoptimized priority={current === 0} /></div>
  </section>;
}
