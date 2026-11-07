import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AboutHeader from "@/components/about-header";
import StoryPhotoStack from "@/components/story-photo-stack";
import ScrollReveal from "@/components/scroll-reveal";
import { DFABLE_HOME, DFABLE_ABOUT } from "@/lib/dfable-path";
import {
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard,
  MessageCircle,
  Package,
  Shirt,
  Store,
  Truck,
  User,
} from "lucide-react";
import "@/components/about-eazywash.css";

export const metadata: Metadata = {
  title: "Tentang Eazywash",
  description: "Kenali Eazywash dan partner laundry yang melayani pesananmu.",
};

const whatsappUrl =
  "https://wa.me/6285199300110?text=Halo%20D%27Fable%2C%20saya%20ingin%20bertanya%20tentang%20layanan%20laundry.";

function Brand() {
  return (
    <Link
      className="brand eazy-customer-brand"
      href={DFABLE_HOME}
      aria-label="Eazywash beranda"
    >
      <img src="/eazywash-logo.png" alt="Eazywash" />
    </Link>
  );
}

export default function AboutPage() {
  return (
    <div className="about-eazywash">
      <AboutHeader />
      <ScrollReveal />
      <main className="about-ew-content">
        <section className="about-ew-hero">
          <div className="about-ew-hero-copy">
            <span className="about-ew-eyebrow">TENTANG EAZYWASH</span>
            <h1>
              Lebih mudah
              <br />
              mengurus cucian.
            </h1>
            <p>
              Pilih toko dan layanan, jadwalkan penjemputan, lalu pantau
              pesananmu. Semuanya ada di Eazywash.
            </p>
            <Link
              href={`${DFABLE_HOME}?view=services`}
              className="about-ew-primary"
            >
              Lihat layanan <ArrowRight size={17} />
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
              Eazywash menghubungkan kamu dengan toko laundry dan layanan yang
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
                <Store size={14} /> Partner Eazywash
              </span>
            </div>
            <div className="about-ew-partner-copy">
              <span className="about-ew-partner-category">LAUNDRY STUDIO</span>
              <h3>D’Fable Laundry</h3>
              <p>
                Berdiri pada 2026, D’Fable hadir untuk kebutuhan laundry
                sehari-hari sekaligus membuka kesempatan bagi penyandang
                disabilitas untuk berkarya.
              </p>
              <div className="about-ew-partner-actions">
                <Link
                  href={`${DFABLE_HOME}?view=services`}
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
        </section>
      </main>
      <footer>
        <Brand />
        <span>© {new Date().getFullYear()} Eazywash</span>
      </footer>
      <nav className="mobile-nav" aria-label="Navigasi utama">
        <Link href={`${DFABLE_HOME}?view=home`}>
          <LayoutDashboard size={20} />
          Beranda
        </Link>
        <Link href={`${DFABLE_HOME}?view=services`}>
          <Shirt size={20} />
          Layanan
        </Link>
        <Link href={`${DFABLE_HOME}?view=tracking`}>
          <Package size={20} />
          Tracking
        </Link>
        <Link className="active" href={DFABLE_ABOUT}>
          <Store size={20} />
          Tentang
        </Link>
        <Link href={`${DFABLE_HOME}?account=1`}>
          <User size={20} />
          Akun
        </Link>
      </nav>
    </div>
  );
}
