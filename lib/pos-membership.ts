import "server-only";
import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { ApiError } from "./firebase/access";
import { adminAuth } from "./firebase/admin";
import { eligibleMemberDiscount } from "./membership-eligibility";
import { memberBalance } from "./membership";
import { phoneLoginEmail } from "./phone-auth";

export async function findPosMember(database: Firestore, phone: string, tx?: Transaction) {
  const variants = [phone, phone.slice(1), `0${phone.slice(3)}`];
  const query = database.collection("users").where("phone", "in", variants).limit(2);
  const profiles = tx ? await tx.get(query) : await query.get();
  if (profiles.size > 1)
    throw new ApiError(409, "Nomor ini terdaftar di lebih dari satu akun. Periksa dengan pengelola sebelum memakai saldo.");
  const profile = profiles.docs[0];
  if (!profile) return null;
  const walletRef = database.doc(`memberships/${profile.id}`);
  const accessRef = database.doc(`access/${profile.id}`);
  const [wallet, access] = await (tx
    ? Promise.all([tx.get(walletRef), tx.get(accessRef)])
    : Promise.all([walletRef.get(), accessRef.get()]));
  if (access.get("disabled"))
    throw new ApiError(409, "Akun pelanggan sedang nonaktif. Hubungi pengelola.");
  return {
    uid: profile.id,
    reference: createHash("sha256").update(`pos-membership:${profile.id}`).digest("hex"),
    name: typeof profile.get("name") === "string" ? profile.get("name") as string : "",
    active: wallet.get("active") === true,
    balance: memberBalance(wallet.get("balance")),
    discountEligible: eligibleMemberDiscount(wallet.data()),
  };
}

export function posMemberView(member: Awaited<ReturnType<typeof findPosMember>>) {
  return {
    accountExists: member !== null,
    member: member?.active ? {
      name: member.name,
      reference: member.reference,
      active: true,
      balance: member.balance,
      discountEligible: member.discountEligible,
    } : null,
  };
}

export async function openPosMembership(
  database: Firestore,
  input: { name: string; phone: string; password?: string },
) {
  const existing = await findPosMember(database, input.phone);
  if (!existing && !input.password)
    throw new ApiError(400, "Minta pelanggan membuat password minimal 8 karakter.");
  const auth = adminAuth();
  const account = existing ? await auth.getUser(existing.uid) : null;
  if (account?.disabled)
    throw new ApiError(409, "Akun pelanggan sedang nonaktif. Hubungi pengelola.");

  let createdUid: string | undefined;
  try {
    if (!existing) {
      const email = phoneLoginEmail(input.phone);
      if (!email) throw new ApiError(400, "Nomor WhatsApp tidak valid.");
      const created = await auth.createUser({ email, displayName: input.name, password: input.password });
      createdUid = created.uid;
      await auth.setCustomUserClaims(created.uid, { dfable_phone_account: true });
    }
    await database.runTransaction(async (tx) => {
      const current = await findPosMember(database, input.phone, tx);
      if (existing ? current?.uid !== existing.uid : !!current)
        throw new ApiError(409, "Akun untuk nomor ini berubah. Cek ulang sebelum melanjutkan.");
      const uid = existing?.uid ?? createdUid!;
      if (current?.active) return;
      const now = new Date().toISOString();
      if (createdUid) tx.create(database.doc(`users/${uid}`), {
        name: input.name, phone: input.phone, phoneVerified: false, updatedAt: now,
      });
      tx.set(database.doc(`memberships/${uid}`), {
        active: true, balance: current?.balance ?? 0, updatedAt: now,
      }, { merge: true });
    });
  } catch (error) {
    if (createdUid) {
      const profile = await database.doc(`users/${createdUid}`).get().catch(() => null);
      if (profile && !profile.exists) await auth.deleteUser(createdUid).catch(() => {});
    }
    if ((error as { code?: string }).code === "auth/email-already-exists")
      throw new ApiError(409, "Nomor ini sudah punya akun. Minta pelanggan masuk dan periksa nomor di profilnya.");
    throw error;
  }
  return posMemberView(await findPosMember(database, input.phone));
}

export function posMembershipPayment(
  serviceAmount: number,
  insurance: boolean,
  eligibleBalance: number,
  useBalance: boolean,
) {
  const membershipUsed = useBalance ? Math.min(serviceAmount, eligibleBalance) : 0;
  return { membershipUsed, total: serviceAmount - membershipUsed + (insurance ? 1000 : 0) };
}
