import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AboutHeader from "@/components/about-header";
import CustomerSecondaryNav from "@/components/customer-secondary-nav";
import StoryPhotoStack from "@/components/story-photo-stack";
import ScrollReveal from "@/components/scroll-reveal";
import { DFABLE_HOME, tenantStorePath, type CustomerQuery } from "@/lib/dfable-path";
import { normalizeBranchId, type BranchId } from "@/lib/branches";
import { customerContextPaths } from "@/lib/customer-context";
import TenantBrand from "@/components/tenant-brand";
import "@/components/tenant-brand.css";
import {
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Package,
  Shirt,
  Store,
  Truck,
} from "lucide-react";
import "@/components/about-eazywash.css";
import "@/components/customer-tenant-context.css";

export const metadata: Metadata = {
  title: "Tentang Washloka",
  description: "Kenali Washloka dan partner laundry yang melayani pesananmu.",
};

const whatsappUrl =
  "https://wa.me/6285199300110?text=Halo%20D%27Fable%2C%20saya%20ingin%20bertanya%20tentang%20layanan%20laundry.";

function Brand({ branch }: { branch: BranchId | null }) {
  if (branch) return <TenantBrand branch={branch} />;
  return (
    <Link
      className="brand eazy-customer-brand washloka-lockup washloka-lockup-light"
      href={DFABLE_HOME}
      aria-label="Washloka beranda"
    >
      <img
        className="washloka-mark"
        src="/washloka/app-icon-burgundy.svg"
        alt=""
      />
      <img
        className="washloka-wordmark"
        src="/washloka/wordmark-burgundy.svg"
        alt="Washloka"
      />
    </Link>
  );
}

export default async function AboutPage({ searchParams }: { searchParams: Promise<CustomerQuery> }) {
  const query = await searchParams;
  const branch = normalizeBranchId(Array.isArray(query.branch) ? query.branch[0] : query.branch);
  const paths = customerContextPaths(branch);
  return (
    <div className={`about-eazywash${branch ? ` tenant-${branch === "dfablelaundry" ? "dfable" : "buzzwash"}` : ""}`}>
      <AboutHeader initialTenant={branch} />
      <ScrollReveal />
      <main className="about-ew-content">
        <section className="about-ew-hero">
          <div className="about-ew-hero-copy">
            <span className="about-ew-eyebrow">TENTANG WASHLOKA</span>
            <h1>
              Lebih mudah
              <br />
              mengurus cucian.
            </h1>
            <p>
              Pilih toko dan layanan, jadwalkan penjemputan, lalu pantau
              pesananmu. Semuanya ada di Washloka.
            </p>
            <Link
              href={branch ? paths.view("services") : "/#laundry-pilihan"}
              className="about-ew-primary"
            >
              {branch ? "Lihat layanan" : "Pilih laundry"} <ArrowRight size={17} />
            </Link>
          </div>
          <div className="about-ew-hero-photo">
            <Image
              src="/unsplash/folding-web.webp"
              alt="Pakaian yang sedang dilipat dengan rapi"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 55vw"
            />
            <span>Untuk cucian yang kamu percayakan.</span>
          </div>
        </section>

        <section className="about-ew-story" data-scroll-reveal>
          <StoryPhotoStack />
          <div className="about-ew-story-copy">
            <span className="about-ew-section-label">
              DEKAT DENGAN KESEHARIANMU
            </span>
            <h2>
              Urus cucian.
              <br />
              Lanjutkan harimu.
            </h2>
            <p>
              Washloka menghubungkan kamu dengan toko laundry dan layanan yang
              kamu butuhkan. Dari kiloan hingga perawatan satuan, kamu bisa
              memilih langsung dari aplikasi.
            </p>
            <div className="about-ew-points">
              <div>
                <span>
                  <Shirt size={20} />
                </span>
                <p>
                  <b>Pilihan layanan jelas</b>
                  <small>
                    Lihat harga dan waktu pengerjaan sebelum memesan.
                  </small>
                </p>
              </div>
              <div>
                <span>
                  <Truck size={20} />
                </span>
                <p>
                  <b>Jemput dan antar</b>
                  <small>
                    Atur lokasi serta jadwal bersama toko pilihanmu.
                  </small>
                </p>
              </div>
              <div>
                <span>
                  <Package size={20} />
                </span>
                <p>
                  <b>Pantau perkembangannya</b>
                  <small>
                    Ikuti status cucian dari diterima sampai selesai.
                  </small>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="about-ew-partners"
          data-scroll-reveal
          aria-labelledby="about-ew-partners-title"
        >
          <div className="about-ew-section-heading">
            <div>
              <span className="about-ew-section-label">PARTNER KAMI</span>
              <h2 id="about-ew-partners-title">
                Kenali toko di balik
                <br />
                cucian bersihmu.
              </h2>
            </div>
            <p>
              Setiap toko membawa layanan dan ceritanya sendiri. Temukan partner
              laundry yang melayani pesananmu.
            </p>
          </div>
          <article className="about-ew-partner">
            <div className="about-ew-partner-brand">
              <Image
                src="/dfable-logo.png"
                alt="D’Fable Laundry Studio"
                width={1600}
                height={483}
              />
              <span>
                <Store size={14} /> Partner Washloka
              </span>
            </div>
            <div className="about-ew-partner-copy">
              <span className="about-ew-partner-category">
                KARANG TENGAH · LAUNDRY STUDIO
              </span>
              <h3>D’Fable Laundry</h3>
              <p>
                Berdiri pada 2026, D’Fable hadir untuk kebutuhan laundry
                sehari-hari sekaligus membuka kesempatan bagi penyandang
                disabilitas untuk berkarya.
              </p>
              <div className="about-ew-partner-actions">
                <Link
                  href={`${tenantStorePath("dfablelaundry")}?view=services`}
                  className="about-ew-partner-link"
                >
                  Lihat layanan toko <ArrowUpRight size={17} />
                </Link>
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> Hubungi D’Fable
                </a>
              </div>
            </div>
          </article>
          <article className="about-ew-partner">
            <div className="about-ew-partner-brand">
              <Image
                src="/buzzwash-logo.png"
                alt="BuzzWash"
                width={1394}
                height={471}
              />
              <span>
                <Store size={14} /> Partner Washloka
              </span>
            </div>
            <div className="about-ew-partner-copy">
              <span className="about-ew-partner-category">
                CIBUBUR · LAUNDRY
              </span>
              <h3>BuzzWash</h3>
              <p>
                Pilih layanan kiloan, satuan, atau perawatan khusus dari
                BuzzWash di Cibubur.
              </p>
              <div className="about-ew-partner-actions">
                <Link
                  href={`${tenantStorePath("buzzwash")}?view=services`}
                  className="about-ew-partner-link"
                >
                  Lihat layanan toko <ArrowUpRight size={17} />
                </Link>
              </div>
            </div>
          </article>
        </section>
      </main>
      <footer>
        <Brand branch={branch} />
        <span>© {new Date().getFullYear()} Washloka. All rights reserved.</span>
      </footer>
      <CustomerSecondaryNav branch={branch} active="about" />
    </div>
  );
}
