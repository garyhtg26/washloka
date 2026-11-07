import type { Metadata } from "next";
import "./globals.css";
import "@/components/customer-mobile-nav.css";
import "@/components/customer-brand.css";
export const metadata: Metadata = {
  title: "Eazywash — Integrated Laundry Ecosystem",
  description:
    "Platform untuk menghubungkan pelanggan dengan layanan laundry pilihan mereka.",
  icons: { icon: "/eazywash-icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
