import { z } from "zod";
import type { Order } from "../types";
import { normalizeBranchId } from "../branches";
import type {
  ManualPaymentSummary,
  BankDetails,
  BankAccount,
  BankSnapshot,
  StoredBankSettings,
} from "./manual-types";
export const STATIC_QRIS_ID = "buzzwash-cibubur-v1" as const;
export const STATIC_QRIS_URL = "/buzzwash-qris-static.png";

/** Only pair the supplied QR with the account explicitly approved for it. */
export function isStaticQrisAccount(value: Partial<BankAccount> | undefined) {
  return typeof value?.bankName === "string" &&
    value.bankName.trim().toUpperCase() === "BCA" &&
    typeof value.accountNumber === "string" &&
    value.accountNumber.replace(/\s/g, "") === "6560655132" &&
    typeof value.accountHolder === "string" &&
    value.accountHolder.trim().replace(/\s+/g, " ").toUpperCase() === "NOVEL RUSPANDI";
}

export function isStaticQrisAvailable(
  branch: unknown,
  account: Partial<BankAccount> | undefined,
) {
  return normalizeBranchId(branch) === "buzzwash" && isStaticQrisAccount(account);
}

export const proofVersionSchema = z.string().uuid();
export const bankSettingsSchema = z
  .object({
    bankName: z.string().trim().min(2).max(60),
    accountNumber: z
      .string()
      .transform((value) => value.replace(/\s/g, ""))
      .pipe(
        z
          .string()
          .regex(/^\d{6,30}$/, "Nomor rekening harus berisi 6-30 angka."),
      ),
    accountHolder: z.string().trim().min(2).max(100),
  })
  .strict();
export function manualLocked(manual?: ManualPaymentSummary) {
  return !!manual && ["awaiting_review", "paid"].includes(manual.status);
}
export function safeManualSummary(
  value: ManualPaymentSummary,
): ManualPaymentSummary {
  return {
    method: "bank_transfer",
    status: value.status,
    amount: value.amount,
    hasProof: value.hasProof,
    ...(value.proofVersion ? { proofVersion: value.proofVersion } : {}),
    ...(value.submittedAt ? { submittedAt: value.submittedAt } : {}),
    ...(value.confirmedAt ? { confirmedAt: value.confirmedAt } : {}),
    ...(value.rejectionReason
      ? { rejectionReason: value.rejectionReason }
      : {}),
    ...(value.bank
      ? {
          bank: {
            bankName: value.bank.bankName,
            accountNumber: value.bank.accountNumber,
            accountHolder: value.bank.accountHolder,
            ...(value.bank.version ? { version: value.bank.version } : {}),
            ...(value.bank.qrVersion
              ? { qrVersion: value.bank.qrVersion }
              : {}),
            ...(value.bank.staticQrId === STATIC_QRIS_ID
              ? { staticQrId: STATIC_QRIS_ID }
              : {}),
          },
        }
      : {}),
  };
}
export function bankDetails(
  value: Partial<StoredBankSettings & Pick<BankSnapshot, "staticQrId">> | undefined,
  branch: string,
): BankDetails {
  const bank = {
    bankName: typeof value?.bankName === "string" ? value.bankName : "BCA",
    accountNumber:
      typeof value?.accountNumber === "string" ? value.accountNumber : "",
    accountHolder:
      typeof value?.accountHolder === "string" ? value.accountHolder : "",
  };
  const qrVersion = proofVersionSchema.safeParse(value?.qrVersion);
  const store = normalizeBranchId(branch);
  return {
    ...bank,
    configured: bankSettingsSchema.safeParse(bank).success,
    ...(value?.version ? { version: value.version } : {}),
    ...(value?.staticQrId === STATIC_QRIS_ID && isStaticQrisAvailable(store, bank)
      ? { qrUrl: STATIC_QRIS_URL }
      : qrVersion.success && store === "buzzwash"
      ? {
          qrUrl: `/api/payments/bank-qr?branch=${encodeURIComponent(store)}&v=${qrVersion.data}`,
        }
      : {}),
  };
}
export function manualGatewayConflict(order: Order) {
  return (
    !!(
      order.payment &&
      ["creating", "pending", "paid"].includes(order.payment.status)
    ) || !!order.paymentReconciliationRequired
  );
}
