import "server-only";
import { ApiError } from "../firebase/access";

/** Only the server-provided origin may appear in links; the request Host is untrusted. */
export function verificationDeliveryConfig(values: {
  apiKey?: string;
  from?: string;
  origin?: string;
}) {
  const key = values.apiKey?.trim() || "";
  const from = values.from?.trim() || "";
  const base = values.origin?.trim() || "";
  if (!key && !from && !base) return null;
  if (!key || !from || !base) throw new ApiError(503, "Pengiriman email belum siap. Coba lagi nanti.");
  let url: URL;
  try { url = new URL(base); } catch { throw new ApiError(503, "Pengiriman email belum siap. Coba lagi nanti."); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new ApiError(503, "Pengiriman email belum siap. Coba lagi nanti.");
  return { key, from, origin: url.origin };
}

/** Firebase generates and verifies the single-use action code; the trusted
 * Washloka page presents it without depending on the console template URL. */
export function verificationActionLink(firebaseLink: string, origin: string, scope: "admin" | "customer") {
  const firebase = new URL(firebaseLink);
  const code = firebase.searchParams.get("oobCode");
  if (firebase.searchParams.get("mode") !== "verifyEmail" || !code)
    throw new Error("Invalid Firebase verification action");
  const link = new URL("/auth/action", origin);
  link.searchParams.set("mode", "verifyEmail");
  link.searchParams.set("oobCode", code);
  link.searchParams.set("scope", scope);
  return link.toString();
}
