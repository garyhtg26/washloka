import "server-only";
import { randomUUID } from "node:crypto";
import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import { ApiError } from "./firebase/access";
import { calculateOrderPrice } from "./pricing";
import { safeManualSummary } from "./payments/manual-policy";
import { signalPaymentChange } from "./payments/signals";
import type { Order } from "./types";

/** Return a previously reserved reward before the store has finalized pricing.
 * The caller has already read the order and wallet and checked ownership and
 * payment locks inside the same transaction. */
export function releaseReservedReward(
  tx: Transaction, database: Firestore, order: Order, walletRef: DocumentReference,
  walletBalance: number, kind: "points" | "membership",
) {
  const current = kind === "points" ? order.pointsUsed || 0 : order.membershipUsed || 0;
  if (!order.rewardsReservedAt || !order.uid || !Number.isSafeInteger(current) || current < 0)
    throw new ApiError(409, "Reservasi belum bisa dibatalkan.");
  if (!Number.isSafeInteger(walletBalance) || walletBalance < 0 || !Number.isSafeInteger(walletBalance + current))
    throw new ApiError(500, "Saldo belum tersedia. Coba lagi nanti.");
  if (!current) return { balance: walletBalance, total: order.total, paid: order.paid };
  const now = new Date().toISOString();
  const pointsUsed = kind === "points" ? 0 : order.pointsUsed || 0;
  const membershipUsed = kind === "membership" ? 0 : order.membershipUsed || 0;
  const total = calculateOrderPrice(order, order.actualKg ?? order.kg) - pointsUsed - membershipUsed +
    (order.shippingFee ?? 0) + (order.insurance ? 1000 : 0);
  if (!Number.isSafeInteger(total) || total < 0)
    throw new ApiError(409, "Tagihan perlu diperiksa toko sebelum saldo dikembalikan.");
  const balance = walletBalance + current;
  tx.set(walletRef, { balance, updatedAt: now }, { merge: true });
  tx.create(database.doc(`${kind === "points" ? "loyalty" : "memberships"}/${order.uid}/events/${randomUUID()}`), {
    type: "returned", ...(kind === "points" ? { points: current } : { amount: current, balanceAfter: balance }),
    orderId: order.id, branchId: order.branchId, createdAt: now,
  });
  tx.update(database.doc(`orders/${order.id}`), {
    ...(kind === "points"
      ? { pointsUsed: 0, usePoints: false, pointsLimit: 0 }
      : { membershipUsed: 0, useMembershipBalance: false, membershipLimit: 0 }),
    total, paymentRevision: (order.paymentRevision || 0) + 1,
    ...(order.manualPayment?.hasProof ? { manualPayment: safeManualSummary({
      method: "bank_transfer", status: "unpaid", amount: null, hasProof: false,
      ...(order.manualPayment.bank ? { bank: order.manualPayment.bank } : {}),
    }) } : {}),
    updatedAt: now,
  });
  signalPaymentChange(tx, database, order.branchId);
  return { balance, total, paid: order.paid };
}
