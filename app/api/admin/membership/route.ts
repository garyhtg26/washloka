import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  identity,
  requireManager,
  ApiError,
  sameOrigin,
} from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { reviewDeposit } from "@/lib/membership";
import { requestBranch, sameBranch } from "@/lib/branches";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    uid: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[^/]+$/),
    requestId: z.string().uuid(),
    action: z.enum(["confirm", "reject"]),
  })
  .strict();
function fail(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : error instanceof z.ZodError
            ? "Data tidak valid."
            : "Deposit belum bisa diproses.",
    },
    {
      status:
        error instanceof ApiError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
    },
  );
}
export async function GET(req: NextRequest) {
  try {
    const user = await identity(req, true);
    const branch = requestBranch(req.url);
    requireManager(user, branch);
    // Scan pending requests in pages, applying the store filter before the
    // result limit. This avoids hiding a store's requests behind another store's
    // first 100 records without requiring a new Firestore composite index.
    const query = db().collection("membershipDeposits")
      .where("status", "==", "pending").limit(100);
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    const requests: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (;;) {
      const page = await (cursor ? query.startAfter(cursor) : query).get();
      requests.push(...page.docs.filter((x) => sameBranch(x.get("branchId"), branch)));
      if (requests.length >= 100 || page.size < 100) break;
      cursor = page.docs[page.docs.length - 1];
    }
    return NextResponse.json(
      {
        requests: requests.slice(0, 100)
          .map((x) => ({
            uid: x.get("uid"),
            requestId: x.get("requestId"),
            amount: x.get("amount"),
            name: x.get("name"),
            senderName: x.get("senderName"),
            paymentMethod: x.get("paymentMethod") === "qris_static" ? "qris_static" : "bank_transfer",
            ...(x.get("qris") ? { qris: x.get("qris") } : {}),
            branchId: x.get("branchId"),
            createdAt: x.get("createdAt"),
            bank: x.get("bank"),
            hasProof: typeof x.get("proofVersion") === "string",
          })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = await identity(req, true);
    requireManager(user);
    const input = schema.parse(await req.json());
    await reviewDeposit(db(), user, input.uid, input.requestId, input.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
