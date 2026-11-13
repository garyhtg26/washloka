import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  identity,
  requireManager,
  sameOrigin,
} from "@/lib/firebase/access";
import { requestBranch } from "@/lib/branches";
import { bankSettingsSchema } from "@/lib/payments/manual-policy";
import { readBankDetails, saveBankDetails } from "@/lib/payments/bank-service";
import { paymentFailure, paymentHeaders } from "@/lib/payments/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const branch = requestBranch(req.url);
    requireManager(await identity(req, true), branch);
    return NextResponse.json(await readBankDetails(branch), {
      headers: paymentHeaders,
    });
  } catch (error) {
    return paymentFailure(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = await identity(req, true);
    const branch = requestBranch(req.url);
    requireManager(user, branch);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 2048)
      throw new ApiError(413, "Data terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Data rekening tidak valid.");
    }
    const account = bankSettingsSchema.parse(body);
    return NextResponse.json(
      await saveBankDetails(branch, account, user),
      { headers: paymentHeaders },
    );
  } catch (error) {
    return paymentFailure(error);
  }
}
