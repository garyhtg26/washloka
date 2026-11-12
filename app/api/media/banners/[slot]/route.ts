import {
  DEFAULT_BRANCH,
  requestBranch,
  branchSettingsId,
} from "@/lib/branches";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  identity,
  requireManager,
  sameOrigin,
  ApiError,
} from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { uploadPhoto, downloadPhoto } from "@/lib/storage/photos";
import {
  bannerStoragePath,
  bannerUploadTarget,
  mediaSlotSchema,
} from "@/lib/site-content";
import { readJpeg } from "@/lib/media-validation";
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slot: string }> };
export async function GET(req: NextRequest, context: Context) {
  try {
    const slot = mediaSlotSchema.safeParse((await context.params).slot);
    if (!slot.success) throw new ApiError(404, "Gambar tidak ditemukan.");
    const params = req.nextUrl.searchParams;
    if (params.getAll("branch").length > 1 || params.getAll("theme").length > 1)
      throw new ApiError(404, "Gambar tidak ditemukan.");
    let path: string;
    try {
      path = bannerStoragePath(
        params.get("branch") ?? DEFAULT_BRANCH,
        slot.data,
        params.get("theme"),
      );
    } catch {
      throw new ApiError(404, "Gambar tidak ditemukan.");
    }
    const bytes = await downloadPhoto(path);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest, context: Context) {
  try {
    sameOrigin(req);
    const user = await identity(req, true);
    requireManager(user);
    const slot = mediaSlotSchema.safeParse((await context.params).slot);
    if (!slot.success) throw new ApiError(400, "Slot gambar tidak valid.");
    if (
      req.nextUrl.searchParams.has("theme") ||
      req.nextUrl.searchParams.getAll("branch").length > 1
    )
      throw new ApiError(400, "Pengaturan gambar tidak valid.");
    let branch: ReturnType<typeof requestBranch>;
    try {
      branch = requestBranch(req.url);
    } catch {
      throw new ApiError(400, "Toko tidak valid.");
    }
    const bytes = await readJpeg(req);
    const target = bannerUploadTarget(branch, slot.data, randomUUID());
    await uploadPhoto(target.path, bytes);
    await db()
      .doc(`settings/${branchSettingsId(branch)}`)
      .set(
        {
          content: { images: { [target.key]: target.url } },
          updatedBy: user!.uid,
        },
        { merge: true },
      );
    return NextResponse.json({ url: target.url });
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  return NextResponse.json(
    { error: e instanceof ApiError ? e.message : "Gambar belum tersedia." },
    { status: e instanceof ApiError ? e.status : 500 },
  );
}
