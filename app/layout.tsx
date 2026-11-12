import type { Metadata } from "next";
import "./globals.css";
import "@/components/customer-mobile-nav.css";
import "@/components/customer-brand.css";
import "@/components/customer-inputs.css";
export const metadata: Metadata = {
  title: "Washloka — Clean at Your Fingertips",
  description:
    "Platform untuk menghubungkan pelanggan dengan layanan laundry pilihan mereka.",
  icons: { icon: "/washloka/app-icon-burgundy.svg" },
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
