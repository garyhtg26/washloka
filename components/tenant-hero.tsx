"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, WashingMachine } from "lucide-react";
import type { BranchId } from "@/lib/branches";
import type { Store } from "@/lib/types";
import { defaultImages, siteContent, siteImage } from "@/lib/site-content";

const buzzIntro = "Siap punya pakaian bersih, harum, dan fresh setiap hari? Yuk, pesan sekarang biar ";
const buzzTagline = "Sekejap Jadi Fresh Lagi!";
const dfableIntro = "Siap punya pakaian bersih, harum, dan fresh setiap hari? Yuk, pesan sekarang dan ";
const dfableTagline = "nikmati harimu!";

export function tenantHeroSlides(branch: BranchId, store: Store) {
  const content = siteContent(store.content);
  const promo = siteImage(content, "promo");
  const extra = siteImage(content, "people");
  const buzz = branch === "buzzwash";
  const partnerCopy = (value?: string) => value && !/washloka/i.test(value) ? value : "";
  const promoTitle = store.promo.active && partnerCopy(store.promo.title) && store.promo.title !== "BuzzWash"
    ? store.promo.title : "Laundry bersih, hari lebih ringan.";
  const promoDescription = store.promo.active && partnerCopy(store.promo.description) && store.promo.description !== "Layanan laundry BuzzWash"
    ? store.promo.description : "Pilih layanan yang sesuai dan biarkan kami merawat cucianmu.";
  const main = {
    title: buzz ? "Haai BuzzFriend!" : "Hai, Sahabat D’Fable!",
    description: buzz ? `${buzzIntro}${buzzTagline}` : `${dfableIntro}${dfableTagline}`,
    image: buzz ? "/buzzwash-storefront-landscape.webp" : "/dfable-storefront.jpg",
    button: (store.promo.active && partnerCopy(store.promo.button)) || "Pesan laundry",
  };
  return [main, ...(store.promo.active && promo !== defaultImages.promo && promo !== main.image ? [{ ...main, title: promoTitle, description: promoDescription, image: promo }] : []), ...(content.people.active && extra !== defaultImages.people ? [{
    title: partnerCopy(content.people.title) || "Layanan untuk keseharianmu.",
    description: "Temukan layanan yang sesuai untuk kebutuhan cucianmu.",
    image: extra,
    button: content.people.button === "Jadwalkan jemput" ? "Pesan laundry" : partnerCopy(content.people.button) || "Pesan laundry",
  }] : [])];
}

/** A partner's uploaded images come from that partner's own dashboard. */
export default function TenantHero({ branch, store, onOrder, onServices }: {
  branch: BranchId;
  store: Store;
  onOrder: (service?: string) => void;
  onServices: () => void;
}) {
  const [index, setIndex] = useState(0);
  const slides = tenantHeroSlides(branch, store);
  const buzz = branch === "buzzwash";
  const available = !buzz || store.orderingEnabled === true;
  const promo = slides[1]?.image;
  const extra = slides[2]?.image;
  useEffect(() => setIndex(0), [branch, promo, extra]);
  const current = Math.min(index, slides.length - 1);
  const slide = slides[current];
  return <section className="tenant-hero" aria-label={`Banner ${buzz ? "BuzzWash" : "D’Fable"}`} aria-roledescription="carousel">
    <div className="tenant-hero-copy">
      <h2>{slide.title}</h2>
      <p>{current === 0 ? <>{buzz ? buzzIntro : dfableIntro}<strong>{buzz ? buzzTagline : dfableTagline}</strong></> : slide.description}</p>
      <button type="button" onClick={() => available ? onOrder("wash") : onServices()}>
        {available && <WashingMachine size={19} strokeWidth={2} aria-hidden="true" />}
        {available ? slide.button : "Lihat layanan"}
      </button>
      {slides.length > 1 && <div className="tenant-hero-controls" aria-label="Navigasi banner">
        <button type="button" onClick={() => setIndex((current + slides.length - 1) % slides.length)} aria-label="Banner sebelumnya"><ChevronLeft size={16} /></button>
        <span>{current + 1} / {slides.length}</span>
        <button type="button" onClick={() => setIndex((current + 1) % slides.length)} aria-label="Banner berikutnya"><ChevronRight size={16} /></button>
      </div>}
    </div>
    <div className="tenant-hero-image"><Image src={slide.image} alt="" fill sizes="(max-width: 700px) 100vw, 55vw" unoptimized priority={current === 0} /></div>
    <svg className="tenant-hero-wave" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 35C360 70 1080 70 1440 35V100H0Z" />
    </svg>
  </section>;
}
