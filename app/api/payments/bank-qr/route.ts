import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/firebase/access";
import { firebaseReady } from "@/lib/firebase/admin";
import { requestBranch } from "@/lib/branches";
import { downloadPhoto } from "@/lib/storage/photos";
import { paymentFailure, paymentHeaders } from "@/lib/payments/http";
import { proofVersionSchema } from "@/lib/payments/manual-policy";
import { bankQrPath } from "@/lib/payments/bank-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!firebaseReady())
      throw new ApiError(503, "QR pembayaran belum tersedia.");
    const branch = requestBranch(req.url);
    const version = proofVersionSchema.parse(req.nextUrl.searchParams.get("v"));
    const bytes = await downloadPhoto(await bankQrPath(branch, version));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...paymentHeaders,
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
