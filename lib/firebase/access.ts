import "server-only";
import type { NextRequest } from "next/server";
import { adminAuth, firebaseReady, db } from "./admin";
import { accessBranches, resolveAccess, type AccessRole } from "../access-policy";
import { isPhoneLogin } from "../phone-auth";
import { normalizeBranchId, type BranchId } from "../branches";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Identity = {
  uid: string;
  email: string;
  name: string;
  admin: boolean;
  manageUsers: boolean;
  role: AccessRole;
  allowedBranches?: BranchId[];
};
export async function identity(
  req: NextRequest,
  required = false,
): Promise<Identity | null> {
  const header = req.headers.get("authorization");
  if (!header) {
    if (required) throw new ApiError(401, "Silakan masuk terlebih dahulu.");
    return null;
  }
  if (!firebaseReady())
    throw new ApiError(503, "Firebase belum dikonfigurasi.");
  try {
    if (!header.startsWith("Bearer ")) throw Error();
    const token = await adminAuth().verifyIdToken(header.slice(7), true);
    const provider = token.firebase.sign_in_provider;
    const adminSurface = req.headers.get("x-dfable-surface") === "admin";
    const phoneLogin =
      !adminSurface &&
      isPhoneLogin(token.email, provider, token.dfable_phone_account);
    if (
      (!token.email_verified && !phoneLogin) ||
      !["google.com", "password"].includes(provider)
    )
      throw Error();
    const email = (token.email || "").toLowerCase();
    const access = await db().doc(`access/${token.uid}`).get();
    if (access.get("disabled")) throw Error();
    const resolved = resolveAccess(
      email,
      !!token.email_verified,
      provider,
      access.get("role"),
      process.env.ADMIN_EMAILS || "",
    );
    const allowedBranches = accessBranches(resolved.role, access.get("branches"));
    return {
      uid: token.uid,
      email: phoneLogin ? "" : email,
      name: token.name || "",
      admin: resolved.dashboard && adminSurface,
      manageUsers: resolved.manageUsers && adminSurface,
      role: resolved.role,
      allowedBranches,
    };
  } catch {
    throw new ApiError(
      401,
      "Sesi tidak valid atau kedaluwarsa. Silakan masuk kembali.",
    );
  }
}
export function canManageStore(user: Identity | null, branch: unknown) {
  const normalized = normalizeBranchId(branch);
  return !!user?.admin && !!normalized && accessBranches(user.role, user.allowedBranches).includes(normalized);
}
export function requireAdmin(user: Identity | null, branch?: unknown) {
  if (!user?.admin || (branch !== undefined && !canManageStore(user, branch)))
    throw new ApiError(403, "Akses khusus admin toko.");
}
export function requireManager(user: Identity | null, branch?: unknown) {
  if (!user?.manageUsers || (branch !== undefined && !canManageStore(user, branch)))
    throw new ApiError(
      403,
      "Akses khusus pemilik atau admin dengan login email–password.",
    );
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    throw new ApiError(403, "Origin tidak diizinkan.");
}
