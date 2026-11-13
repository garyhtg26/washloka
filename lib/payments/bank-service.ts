import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { db } from "../firebase/admin";
import {
  branchAliases,
  branchSchema,
  branchSettingsId,
  sameBranch,
} from "../branches";
import { readBranchSettings, readStoreBankSettings } from "../branch-settings";
import { ApiError, requireManager, type Identity } from "../firebase/access";
import { uploadPhoto } from "../storage/photos";
import {
  bankDetails,
  bankSettingsSchema,
  proofVersionSchema,
} from "./manual-policy";
import { signalPaymentChange } from "./service";
import type { BankAccount, StoredBankSettings } from "./manual-types";

export async function readBankDetails(
  branch: string,
  database: Firestore = db(),
) {
  const store = branchSchema.parse(branch);
  return bankDetails(await readStoreBankSettings(database, store), store);
}

export async function saveBankDetails(
  branch: string,
  input: BankAccount,
  user: Identity | null,
  database: Firestore = db(),
) {
  const store = branchSchema.parse(branch);
  requireManager(user, store);
  const account = bankSettingsSchema.parse(input);
  await database.runTransaction(async (tx) => {
    const prior = await readBranchSettings(database, store, tx);
    const ref = prior.ref;
    const existing = prior.get("manualPayment") as
      StoredBankSettings | undefined;
    const identityChanged =
      existing?.bankName !== account.bankName ||
      existing?.accountNumber !== account.accountNumber ||
      existing?.accountHolder !== account.accountHolder;
    tx.set(
      ref,
      {
        manualPayment: {
          ...existing,
          ...account,
          ...(identityChanged ? { qrVersion: "" } : {}),
          version: randomUUID(),
        },
        updatedBy: user!.uid,
      },
      { merge: true },
    );
    signalPaymentChange(tx, database, branch);
  });
  return readBankDetails(branch, database);
}

export async function setBankQr(
  branch: string,
  bytes: Uint8Array | null,
  user: Identity | null,
  database: Firestore = db(),
  upload: typeof uploadPhoto = uploadPhoto,
  expectedVersion?: string,
) {
  const store = branchSchema.parse(branch);
  requireManager(user, store);
  const storageBranch = branchSettingsId(store);
  const initial = await readBranchSettings(database, store);
  if (bytes && !bankDetails(initial.get("manualPayment"), branch).configured)
    throw new ApiError(
      409,
      "Simpan rekening yang lengkap sebelum mengunggah QR pembayaran.",
    );
  const capturedVersion =
    initial.get("manualPayment")?.version || "unconfigured";
  if (expectedVersion !== undefined && expectedVersion !== capturedVersion)
    throw new ApiError(
      409,
      "Rekening telah berubah. Muat ulang sebelum mengunggah QR.",
    );
  const qrVersion = bytes ? randomUUID() : "";
  if (bytes)
    await upload(`payments/bank-qr/${storageBranch}/${qrVersion}.jpg`, bytes);
  await database.runTransaction(async (tx) => {
    const prior = await readBranchSettings(database, store, tx);
    const ref = prior.ref;
    const existing = prior.get("manualPayment") as
      StoredBankSettings | undefined;
    if ((existing?.version || "unconfigured") !== capturedVersion)
      throw new ApiError(
        409,
        "Rekening berubah saat QR diunggah. Periksa rekening dan unggah ulang QR yang sesuai.",
      );
    tx.set(
      ref,
      {
        manualPayment: {
          bankName: existing?.bankName || "BCA",
          accountNumber: existing?.accountNumber || "",
          accountHolder: existing?.accountHolder || "",
          ...existing,
          qrVersion,
          version: randomUUID(),
        },
        updatedBy: user!.uid,
      },
      { merge: true },
    );
    if (qrVersion)
      tx.set(database.doc(`bankQrVersions/${storageBranch}-${qrVersion}`), {
        branchId: storageBranch,
        qrVersion,
      });
    signalPaymentChange(tx, database, branch);
  });
  return readBankDetails(branch, database);
}

// A QR version is immutable. Search only D’Fable's explicit aliases and return
// its original storage path instead of moving or regenerating the image.
export async function bankQrPath(
  branch: string,
  version: string,
  database: Firestore = db(),
) {
  proofVersionSchema.parse(version);
  const aliases = [...branchAliases(branch)];
  aliases.sort(
    (first, second) => Number(second === branch) - Number(first === branch),
  );
  const snapshots = await Promise.all(
    aliases.map((id) => database.doc(`bankQrVersions/${id}-${version}`).get()),
  );
  const index = snapshots.findIndex(
    (record, position) =>
      record.exists &&
      record.get("branchId") === aliases[position] &&
      sameBranch(record.get("branchId"), branch) &&
      record.get("qrVersion") === version,
  );
  if (index < 0) throw new ApiError(404, "QR pembayaran tidak ditemukan.");
  return `payments/bank-qr/${aliases[index]}/${version}.jpg`;
}
