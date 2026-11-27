import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestBranch } from "@/lib/branches";
import { ApiError, identity, requireAdmin, sameOrigin } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { paymentHeaders } from "@/lib/payments/http";
import { findPosMember, openPosMembership, posMemberView } from "@/lib/pos-membership";
import { normalizePhone } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const phone = z.string().max(30).transform(normalizePhone).pipe(z.string().regex(/^\+628\d{7,12}$/));
const enrollment = z.object({
  phone,
  name: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(128).optional(),
}).strict();

function fail(error: unknown) {
  const invalid = error instanceof z.ZodError || error instanceof SyntaxError;
  return NextResponse.json({ error: error instanceof ApiError ? error.message : invalid
    ? "Periksa nomor WhatsApp, nama, dan password pelanggan."
    : "Membership kasir belum bisa diproses. Coba lagi." }, {
    status: error instanceof ApiError ? error.status : invalid ? 400 : 500,
    headers: paymentHeaders,
  });
}

export async function GET(req: NextRequest) {
  try {
    requireAdmin(await identity(req, true), requestBranch(req.url));
    const number = phone.parse(req.nextUrl.searchParams.get("phone"));
    const member = await findPosMember(db(), number);
    return NextResponse.json(posMemberView(member), { headers: paymentHeaders });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    requireAdmin(await identity(req, true), requestBranch(req.url));
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 2048) throw new ApiError(413, "Data terlalu besar.");
    const result = await openPosMembership(db(), enrollment.parse(JSON.parse(raw)));
    return NextResponse.json(result, { headers: paymentHeaders });
  } catch (error) {
    return fail(error);
  }
}
