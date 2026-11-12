"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  WashingMachine,
  Shirt,
  Wind,
  Layers,
  Plus,
  Package,
  Truck,
  Clock,
  Search,
  MapPin,
  ArrowRight,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { money, type Store } from "@/lib/types";
import { branches, DEFAULT_BRANCH } from "@/lib/branches";
import { defaultImages, siteContent, siteImage } from "@/lib/site-content";
import "./customer-home.css";

type Props = {
  store: Store;
  name: string;
  onOrder: (service?: string) => void;
  onMember: () => void;
  onTrack: (code?: string) => void;
  onAccount: () => void;
  onServices: () => void;
};

const categories = [
  { id: "wash", label: "Cuci & lipat", icon: WashingMachine },
  { id: "complete", label: "Cuci & setrika", icon: Shirt },
  { id: "iron", label: "Setrika", icon: Wind },
  { id: "member", label: "Membership", icon: Layers },
];

type ImageSlot = "wash" | "iron" | "complete";
function serviceImageSlot(id: string): ImageSlot {
  return id === "wash" || id === "iron" || id === "complete" ? id : "complete";
}

export default function CustomerHome({
  store,
  name,
  onOrder,
  onMember,
  onTrack,
  onServices,
}: Props) {
  const content = siteContent(store.content);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const carousel = useRef<HTMLDivElement>(null);
  const term = query.trim().toLocaleLowerCase("id-ID");
  const services = store.services
    .filter((service) => service.category !== "member")
    .filter((service) => term || service.category === "daily")
    .filter((service) => category === "all" || service.id === category)
    .filter(
      (service) =>
        !term ||
        `${service.name} ${service.description}`
          .toLocaleLowerCase("id-ID")
          .includes(term),
    )
    .sort((a, b) => {
      const order = ["wash", "complete", "iron"];
      const first = order.indexOf(a.id);
      const second = order.indexOf(b.id);
      return (first < 0 ? 100 : first) - (second < 0 ? 100 : second);
    });
  const showMembership =
    content.member.active &&
    (category === "member" ||
      (category === "all" &&
        !!term &&
        `${content.member.title} membership deposit`
          .toLocaleLowerCase("id-ID")
          .includes(term)));
  const promoImage = siteImage(content, "promo");
  const peopleImage = siteImage(content, "people");
  const memberImage = siteImage(content, "member");
  const slides = [
    ...(store.promo.active
      ? [
          {
            id: "promo",
            image: promoImage,
          },
        ]
      : []),
    ...(content.people.active
      ? [
          {
            id: "people",
            image: peopleImage,
          },
        ]
      : []),
  ];
  const currentSlide = Math.min(slideIndex, Math.max(0, slides.length - 1));

  useEffect(() => {
    setSlideIndex(0);
    carousel.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [store.promo.active, content.people.active]);

  function showSlide(index: number) {
    const viewport = carousel.current;
    if (!viewport || slides.length < 2) return;
    const next = (index + slides.length) % slides.length;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    viewport.scrollTo({
      left: viewport.clientWidth * next,
      behavior: reducedMotion ? "auto" : "smooth",
    });
    setSlideIndex(next);
  }

  return (
    <div className="customer-experience">
      <h1 className="home-heading">{name ? `Halo, ${name}` : "Washloka"}</h1>

      {slides.length > 0 && (
        <section
          className="campaign-slider"
          aria-label="Banner Washloka"
          aria-roledescription="carousel"
          onKeyDown={(event) => {
            if (slides.length < 2) return;
            if (event.key === "ArrowRight") {
              event.preventDefault();
              const next = (currentSlide + 1) % slides.length;
              event.currentTarget
                .querySelectorAll<HTMLButtonElement>(".campaign-dots button")
                [next]?.focus();
              showSlide(next);
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              const previous =
                (currentSlide - 1 + slides.length) % slides.length;
              event.currentTarget
                .querySelectorAll<HTMLButtonElement>(".campaign-dots button")
                [previous]?.focus();
              showSlide(previous);
            }
          }}
        >
          <div
            className="campaign-viewport"
            ref={carousel}
            onScroll={(event) => {
              const viewport = event.currentTarget;
              if (viewport.clientWidth) {
                setSlideIndex(
                  Math.max(
                    0,
                    Math.min(
                      slides.length - 1,
                      Math.round(viewport.scrollLeft / viewport.clientWidth),
                    ),
                  ),
                );
              }
            }}
          >
            {slides.map((slide, index) => (
              <div
                className="campaign-slide-frame"
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} dari ${slides.length}`}
                aria-hidden={index !== currentSlide}
                inert={index !== currentSlide}
                key={slide.id}
              >
                <div className={`campaign-slide campaign-slide-${slide.id}`}>
                  {slide.id === "promo" && (
                    <div className="campaign-message">
                      <span className="campaign-headline">
                        Clean at Your
                        <br />
                        Fingertips.
                      </span>
                      <button
                        type="button"
                        className="campaign-order"
                        onClick={() => onOrder("wash")}
                        tabIndex={index === currentSlide ? 0 : -1}
                      >
                        Pesan sekarang{" "}
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  {slide.id === "people" && (
                    <div className="campaign-message campaign-coming-soon">
                      <span className="campaign-headline">
                        House cleaning
                        <br />
                        datang ke rumah
                      </span>
                      <span className="campaign-coming-label">Coming soon</span>
                    </div>
                  )}
                  <picture>
                    {slide.id === "promo" &&
                      slide.image === defaultImages.promo && (
                        <source
                          media="(min-width: 961px)"
                          srcSet="/washloka/hero-washer-wide.webp"
                          type="image/webp"
                        />
                      )}
                    {slide.id === "people" &&
                      slide.image === defaultImages.people && (
                        <source
                          media="(min-width: 961px)"
                          srcSet="/washloka/home-care-wide.webp"
                          type="image/webp"
                        />
                      )}
                    <Image
                      width={1536}
                      height={1024}
                      sizes="(max-width: 1440px) 100vw, 1296px"
                      src={
                        slide.id === "promo" &&
                        slide.image === defaultImages.promo
                          ? "/washloka/hero-washer-mobile.webp"
                          : slide.id === "people" &&
                              slide.image === defaultImages.people
                            ? "/washloka/home-care-mobile.webp"
                            : slide.image
                      }
                      unoptimized
                      fetchPriority={index === 0 ? "high" : "auto"}
                      loading={index === 0 ? "eager" : "lazy"}
                      alt=""
                      className="campaign-photo"
                    />
                  </picture>
                </div>
              </div>
            ))}
          </div>
          {slides.length > 1 && (
            <div
              className={`campaign-controls campaign-controls-${slides[currentSlide].id}`}
              aria-label="Navigasi banner"
            >
              <button
                type="button"
                onClick={() => showSlide(currentSlide - 1)}
                aria-label="Banner sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="campaign-dots">
                {slides.map((slide, index) => (
                  <button
                    type="button"
                    key={slide.id}
                    className={currentSlide === index ? "active" : ""}
                    aria-label={`Lihat banner ${index + 1}`}
                    aria-current={currentSlide === index ? "true" : undefined}
                    onClick={() => showSlide(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => showSlide(currentSlide + 1)}
                aria-label="Banner berikutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
          <svg
            className="campaign-wave"
            viewBox="0 0 1440 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M0 35C360 70 1080 70 1440 35V100H0Z" />
          </svg>
        </section>
      )}

      <section
        className={`browse-laundry${slides.length === 0 ? " no-campaign" : ""}`}
        aria-label="Pilih layanan"
      >
        <div className="home-discovery" data-scroll-reveal>
          <div className="home-discovery-store">
            <MapPin size={17} aria-hidden="true" />
            <span>{branches[store.branchId || DEFAULT_BRANCH]}</span>
          </div>
          <label className="home-discovery-search">
            <Search size={19} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCategory("all");
              }}
              placeholder="Cari layanan"
              aria-label="Cari layanan"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Hapus pencarian"
              >
                <X size={16} />
              </button>
            )}
          </label>
        </div>
        <div
          className="category-row"
          role="group"
          aria-label="Filter layanan"
          data-scroll-reveal
        >
          {categories
            .filter((item) => item.id !== "member" || content.member.active)
            .map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                aria-pressed={category === id}
                key={id}
                className={category === id ? "selected" : ""}
                onClick={() => {
                  setQuery("");
                  setCategory((current) => (current === id ? "all" : id));
                }}
              >
                <span>
                  <Icon size={27} strokeWidth={1.65} />
                </span>
                <b>{label}</b>
              </button>
            ))}
        </div>
        <div className="browse-heading" data-scroll-reveal>
          <div>
            <p>PERAWATAN SEHARI-HARI</p>
            <h2>{term ? "Hasil pencarian" : "Layanan favorit"}</h2>
          </div>
          <button type="button" onClick={onServices}>
            Lihat semua <ArrowRight size={16} />
          </button>
        </div>
        <div className="photo-service-grid" aria-live="polite">
          {services.map((service) => (
            <button
              type="button"
              key={service.id}
              className={`photo-service service-${service.id}`}
              data-scroll-reveal
              onClick={() => onOrder(service.id)}
            >
              <div className="photo-service-image">
                <Image
                  width={1536}
                  height={1024}
                  sizes="(max-width: 520px) 50vw, (max-width: 900px) 33vw, 450px"
                  src={siteImage(content, serviceImageSlot(service.id))}
                  unoptimized
                  alt=""
                />
              </div>
              <div className="photo-service-info">
                <div className="photo-service-description">
                  <h3>{service.name}</h3>
                  <p>
                    {money(service.price)}
                    <small>
                      {" "}
                      /{" "}
                      {service.packageSize
                        ? `${service.packageSize} kg`
                        : service.unit}
                    </small>
                  </p>
                </div>
                <span className="photo-service-add" aria-hidden="true">
                  <Plus size={19} />
                </span>
              </div>
            </button>
          ))}
          {showMembership && (
            <button
              type="button"
              className="photo-service membership-feature"
              data-scroll-reveal
              onClick={onMember}
            >
              <div className="photo-service-image">
                <Image
                  width={1536}
                  height={1024}
                  sizes="(max-width: 520px) 50vw, 450px"
                  unoptimized
                  src={memberImage}
                  alt=""
                />
              </div>
              <div className="photo-service-info">
                <div className="photo-service-description">
                  <h3>{content.member.title}</h3>
                  <p>
                    Mulai {money(100000)} <small>deposit</small>
                  </p>
                </div>
                <span className="photo-service-add" aria-hidden="true">
                  <Plus size={19} />
                </span>
              </div>
            </button>
          )}
        </div>
        {services.length === 0 && !showMembership && (
          <div className="home-search-empty">
            <p>Layanan belum ditemukan.</p>
            <button type="button" onClick={onServices}>
              Lihat semua layanan <ArrowRight size={15} />
            </button>
          </div>
        )}
        <p className="compact-terms">
          Kiloan minimal 3 kg, cuci kering lipat minimal 10 kg. Ongkir
          dikonfirmasi toko.
        </p>
      </section>

      <div className="customer-bottom-grid" data-scroll-reveal>
        {content.tracking.active && (
          <section className="tracking-ribbon">
            <span className="ribbon-icon">
              <Package size={23} />
            </span>
            <div className="tracking-ribbon-heading">
              <span>PANTAU CUCIANMU</span>
              <h2>{content.tracking.title}</h2>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onTrack(code);
              }}
            >
              <label>
                <Search size={17} />
                <input
                  required
                  aria-label="Nomor pesanan"
                  placeholder="Nomor pesanan"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <button type="submit">
                Lacak <ArrowRight size={15} />
              </button>
            </form>
          </section>
        )}
        {content.member.active && (
          <button type="button" className="monthly-strip" onClick={onMember}>
            <Image
              width={120}
              height={120}
              sizes="80px"
              unoptimized
              className="monthly-thumb"
              src={memberImage}
              alt=""
            />
            <div className="monthly-copy">
              <span className="monthly-kicker">LEBIH HEMAT DENGAN MEMBER</span>
              <h3>{content.member.title}</h3>
              <span className="monthly-caption">
                <Clock size={14} /> Diskon layanan saat saldo tersedia
              </span>
            </div>
            <span className="monthly-action" aria-label={content.member.button}>
              <ArrowRight size={19} />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
