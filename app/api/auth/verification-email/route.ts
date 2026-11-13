import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, db } from "@/lib/firebase/admin";
import { ApiError, sameOrigin } from "@/lib/firebase/access";
import { phoneFromLoginEmail } from "@/lib/phone-auth";
import { verificationEmail } from "@/lib/email/verification-template";
import { verificationActionLink, verificationDeliveryConfig } from "@/lib/email/verification-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ scope: z.enum(["admin", "customer"]) }).strict();
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

/** Authenticates unverified users directly; never accepts a recipient from the client. */
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const raw = await req.text();
    if (raw.length > 512) throw new ApiError(400, "Permintaan tidak valid.");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new ApiError(400, "Permintaan tidak valid."); }
    const { scope } = bodySchema.parse(parsed);
    const header = req.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) throw new ApiError(401, "Silakan masuk kembali.");
    let uid: string;
    try {
      const token = await adminAuth().verifyIdToken(header.slice(7), true);
      if (token.firebase.sign_in_provider !== "password") throw Error();
      uid = token.uid;
    } catch { throw new ApiError(401, "Silakan masuk kembali."); }
    const user = await adminAuth().getUser(uid);
    if (user.disabled || !user.email || phoneFromLoginEmail(user.email))
      throw new ApiError(400, "Akun ini tidak memerlukan verifikasi email.");
    if (user.emailVerified) return NextResponse.json({ delivery: "already-verified" }, { headers: noStore });

    const sender = verificationDeliveryConfig({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_EMAIL,
      origin: process.env.EMAIL_APP_ORIGIN,
    });
    // Preserve Firebase delivery only when custom delivery is entirely unconfigured.
    if (!sender) return NextResponse.json({ delivery: "firebase" }, { headers: noStore });

    const database = db();
    const rateRef = database.doc(`verificationEmailLimits/${createHash("sha256").update(uid).digest("hex")}`);
    await database.runTransaction(async (tx) => {
      const snapshot = await tx.get(rateRef);
      const now = Date.now();
      const previous = snapshot.get("attempts");
      const attempts = Array.isArray(previous)
        ? previous.filter((value) => Number.isSafeInteger(value) && value > now - 3600000 && value <= now)
        : [];
      if (attempts.length >= 6 || (attempts.length && now - Math.max(...attempts) < 60000))
        throw new ApiError(429, "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.");
      tx.set(rateRef, { attempts: [...attempts, now] });
    });

    const continuation = new URL("/auth/verified", sender.origin);
    continuation.searchParams.set("scope", scope);
    const firebaseLink = await adminAuth().generateEmailVerificationLink(user.email, { url: continuation.toString() });
    const link = verificationActionLink(firebaseLink, sender.origin, scope);
    const message = verificationEmail({ verificationUrl: link, siteUrl: sender.origin, name: user.displayName || undefined });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${sender.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender.from, to: [user.email], ...message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Email delivery failed");
    return NextResponse.json({ delivery: "custom" }, { headers: noStore });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : error instanceof z.ZodError ? 400 : 503;
    return NextResponse.json(
      { error: error instanceof ApiError ? error.message : "Email verifikasi belum bisa dikirim. Coba lagi nanti." },
      { status, headers: noStore },
    );
  }
}
