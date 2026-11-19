import { branchLabel, normalizeBranchId } from "./branches";
import { dfableTrackingPath, tenantStorePath } from "./dfable-path";
import { normalizePhone } from "./pricing";
import type { Order } from "./types";

type MessageOrder = Pick<Order, "id" | "name" | "phone" | "branchId" | "status" | "source" | "fulfillment"> & { token?: string | null };

// Local development runs on the developer's computer and is unreachable from
// a customer's phone. The known public deployment is the default until a
// custom public URL is configured.
const DEFAULT_PUBLIC_ORIGIN = "https://washloka.vercel.app";
const trackingToken = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
    hostname === "::1" || hostname === "[::1]" || hostname === "0.0.0.0" || hostname.startsWith("127.") || hostname.startsWith("10.") || hostname.startsWith("169.254.") ||
    hostname.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

export function isValidOrderWhatsAppPhone(phone: string) {
  return /^\+628\d{7,12}$/.test(normalizePhone(phone || ""));
}

function publicOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || isLocalHost(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

/** Prefer the configured public site so preview deployments never leak into customer messages. */
export function whatsappPublicOrigin(currentOrigin: string, configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  try {
    const current = new URL(currentOrigin);
    if (configuredOrigin) return publicOrigin(configuredOrigin);
    if (isLocalHost(current.hostname) || (current.hostname.endsWith(".vercel.app") && current.hostname !== "washloka.vercel.app"))
      return DEFAULT_PUBLIC_ORIGIN;
    return publicOrigin(currentOrigin);
  } catch { return null; }
}

function statusCopy(status: number, selfService: boolean) {
  switch (status) {
    case 0: return "Pesanan laundry kamu sudah kami terima. Tim kami akan segera menghubungi kamu untuk konfirmasi.";
    case 1: return selfService ? "Pesanan laundry kamu sudah dikonfirmasi oleh toko." : "Penjemputan cucianmu sudah dijadwalkan. Tim kami akan menghubungi kamu untuk detailnya.";
    case 2: return selfService ? "Pesanan laundry kamu sedang kami siapkan di toko." : "Tim kami sedang dalam perjalanan untuk menjemput cucianmu.";
    case 3: return "Cucianmu sudah kami terima di toko dan sedang disiapkan untuk diproses.";
    case 4: return "Cucianmu sedang dalam proses pencucian. Kami akan mengabari kamu lagi setelah prosesnya berlanjut.";
    case 5: return "Cucianmu sedang dalam tahap akhir dan pemeriksaan. Kami akan segera mengabari kamu lagi.";
    case 6: return selfService ? "Pesanan laundry kamu sudah melewati tahap akhir dan sedang kami siapkan." : "Cucianmu sedang dalam perjalanan untuk diantar.";
    case 7: return "Pesanan laundry kamu sudah selesai. Terima kasih sudah mempercayakan cucianmu kepada kami.";
    default: return null;
  }
}

/** Construct a draft for staff to review in WhatsApp; never sends a message. */
export function orderWhatsAppDraft(order: MessageOrder, origin: string, status = order.status) {
  const normalized = normalizePhone(order.phone || "");
  if (!isValidOrderWhatsAppPhone(order.phone)) return null;
  const base = whatsappPublicOrigin(origin);
  const copy = statusCopy(status, order.source === "pos" || order.fulfillment === "dropoff");
  if (!base || !copy) return null;
  const name = (order.name || "").replace(/\s+/g, " ").trim();
  const id = (order.id || "").replace(/\s+/g, " ").trim();
  const branch = normalizeBranchId(order.branchId);
  const hasToken = typeof order.token === "string" && trackingToken.test(order.token);
  const path = hasToken
    ? dfableTrackingPath(order.token!, branch)
    : `${branch ? tenantStorePath(branch) : "/"}?view=tracking`;
  const trackingUrl = `${base}${path}`;
  const trackingText = hasToken
    ? `Kamu bisa cek perkembangannya di sini:\n${trackingUrl}`
    : `Untuk mengecek status, buka tautan berikut dan cari nomor pesananmu:\n${trackingUrl}\nJika belum punya akun, balas pesan ini agar kami bantu.`;
  const message = `Halo${name ? ` ${name}` : ""},\n\n${copy}\n\nNomor pesanan: ${id}\n${trackingText}\n\nTerima kasih,\n${branchLabel(order.branchId)}`;
  return { message, trackingUrl, hasTrackingToken: hasToken, url: `https://wa.me/${normalized.slice(1)}?text=${encodeURIComponent(message)}` };
}
