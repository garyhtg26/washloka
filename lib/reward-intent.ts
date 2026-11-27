import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { ApiError } from "./firebase/access";
import { isRewardsStore } from "./rewards-store";
import type { Order } from "./types";
import { isOrderReadyForBilling } from "./order-billing";

function balance(value: unknown): number {
  const amount = value ?? 0;
  if (!Number.isSafeInteger(amount) || (amount as number) < 0)
    throw new ApiError(500, "Saldo belum tersedia. Coba lagi nanti.");
  return amount as number;
}

/** Read both wallets before any writes so finalization is atomic and retry-safe. */
export async function prepareRewardIntent(
  tx: Transaction, database: Firestore, order: Order, serviceTotal: number, shippingFee: number,
) {
  if (!order.uid || !isRewardsStore(order.branchId) || order.rewardsAppliedAt ||
      (!order.usePoints && !order.useMembershipBalance)) return null;
  if (order.source === "web" && order.fulfillment && !isOrderReadyForBilling(order)) return null;
  const pointsRef = database.doc(`loyalty/${order.uid}`);
  const memberRef = database.doc(`memberships/${order.uid}`);
  const [pointsSnapshot, memberSnapshot] = await Promise.all([tx.get(pointsRef), tx.get(memberRef)]);
  const pointsWallet = pointsSnapshot.data();
  const memberWallet = memberSnapshot.data();
  const pointsBalance = balance(pointsWallet?.balance);
  const memberBalance = balance(memberWallet?.balance);
  const membershipUsed = order.useMembershipBalance && order.membershipDiscount &&
    memberWallet?.active === true && !memberWallet?.reconciliationRequired
    ? Math.min(memberBalance, serviceTotal, order.membershipLimit ?? Infinity) : 0;
  const pointsUsed = order.usePoints && !pointsWallet?.reconciliationRequired
    ? Math.min(pointsBalance, serviceTotal - membershipUsed, order.pointsLimit ?? Infinity) : 0;
  const total = serviceTotal - pointsUsed - membershipUsed + shippingFee + (order.insurance ? 1000 : 0);
  const paid = total === 0;
  const earned = paid ? Math.floor((serviceTotal - pointsUsed) / 10) : 0;
  return { pointsRef, memberRef, pointsBalance, memberBalance, pointsUsed, membershipUsed, total, paid, earned };
}

/**
 * Reserve only the estimated service amount explicitly selected by the customer.
 * An unknown shipping fee means the order is not settled even if the estimate is zero.
 * On later price adjustments, never debit beyond the original reservation; return
 * any excess points first and then membership balance.
 */
export async function prepareRewardReservation(
  tx: Transaction,
  database: Firestore,
  order: Order,
  serviceTotal: number,
  shippingFee: number | null,
  finalPrice: boolean,
) {
  if (!order.uid || order.paid || !isRewardsStore(order.branchId) ||
      (!order.rewardsReservedAt && !order.usePoints && !order.useMembershipBalance))
    return null;
  const pointsRef = database.doc(`loyalty/${order.uid}`);
  const memberRef = database.doc(`memberships/${order.uid}`);
  const [pointsSnapshot, memberSnapshot] = await Promise.all([
    tx.get(pointsRef),
    tx.get(memberRef),
  ]);
  const pointsWallet = pointsSnapshot.data();
  const memberWallet = memberSnapshot.data();
  const pointsBalance = balance(pointsWallet?.balance);
  const memberBalance = balance(memberWallet?.balance);
  const previousPoints = balance(order.pointsUsed);
  const previousMembership = balance(order.membershipUsed);
  let pointsUsed: number;
  let membershipUsed: number;
  if (order.rewardsReservedAt) {
    membershipUsed = Math.min(previousMembership, serviceTotal);
    pointsUsed = Math.min(previousPoints, Math.max(0, serviceTotal - membershipUsed));
  } else {
    membershipUsed = order.useMembershipBalance && order.membershipDiscount &&
      memberWallet?.active === true && !memberWallet?.reconciliationRequired
      ? Math.min(memberBalance, serviceTotal, order.membershipLimit ?? 0) : 0;
    pointsUsed = order.usePoints && !pointsWallet?.reconciliationRequired
      ? Math.min(pointsBalance, serviceTotal - membershipUsed, order.pointsLimit ?? 0) : 0;
  }
  const total = serviceTotal - pointsUsed - membershipUsed +
    (shippingFee ?? 0) + (order.insurance ? 1000 : 0);
  const paid = !order.paid && order.pointsEarned === undefined &&
    finalPrice && shippingFee !== null && total === 0;
  const earned = paid ? Math.floor((serviceTotal - pointsUsed) / 10) : 0;
  return { pointsRef, memberRef, pointsBalance, memberBalance, previousPoints,
    previousMembership, pointsUsed, membershipUsed, total, paid, earned };
}

export function commitRewardReservation(
  tx: Transaction,
  database: Firestore,
  order: Order,
  plan: NonNullable<Awaited<ReturnType<typeof prepareRewardReservation>>>,
  now: string,
) {
  const pointsDelta = plan.previousPoints - plan.pointsUsed;
  const memberDelta = plan.previousMembership - plan.membershipUsed;
  const nextPointsBalance = balance(plan.pointsBalance + pointsDelta + plan.earned);
  const nextMemberBalance = balance(plan.memberBalance + memberDelta);
  if (pointsDelta || plan.earned) {
    tx.set(plan.pointsRef, { balance: nextPointsBalance, updatedAt: now }, { merge: true });
    if (pointsDelta) tx.create(database.doc(`loyalty/${order.uid}/events/${randomUUID()}`), {
      type: pointsDelta > 0 ? "returned" : "redeemed", points: Math.abs(pointsDelta), orderId: order.id, branchId: order.branchId, createdAt: now,
    });
    if (plan.earned) tx.set(database.doc(`loyalty/${order.uid}/events/earned-${order.id}`), {
      type: "earned", points: plan.earned, orderId: order.id, branchId: order.branchId, createdAt: now,
    });
  }
  if (memberDelta) {
    tx.set(plan.memberRef, { balance: nextMemberBalance, updatedAt: now }, { merge: true });
    tx.create(database.doc(`memberships/${order.uid}/events/${randomUUID()}`), {
      type: memberDelta > 0 ? "returned" : "redeemed", amount: Math.abs(memberDelta), balanceAfter: nextMemberBalance, orderId: order.id, branchId: order.branchId, createdAt: now,
    });
  }
  return {
    pointsUsed: plan.pointsUsed, membershipUsed: plan.membershipUsed,
    rewardsReservedAt: order.rewardsReservedAt || now,
    total: plan.total, paid: plan.paid,
    ...(plan.paid ? { paidAt: now, paymentMethod: plan.membershipUsed ? "membership" as const : "points" as const, pointsEarned: plan.earned } : {}),
  };
}

/** Called once, in the same transaction as the final price update. */
export function commitRewardIntent(
  tx: Transaction, database: Firestore, order: Order,
  plan: NonNullable<Awaited<ReturnType<typeof prepareRewardIntent>>>, now: string,
) {
  const nextPointsBalance = balance(plan.pointsBalance - plan.pointsUsed + plan.earned);
  const nextMemberBalance = balance(plan.memberBalance - plan.membershipUsed);
  if (plan.pointsUsed || plan.earned) {
    tx.set(plan.pointsRef, { balance: nextPointsBalance, updatedAt: now }, { merge: true });
    if (plan.pointsUsed) tx.create(database.doc(`loyalty/${order.uid}/events/${randomUUID()}`), {
      type: "redeemed", points: plan.pointsUsed, orderId: order.id, createdAt: now,
    });
    if (plan.earned) tx.set(database.doc(`loyalty/${order.uid}/events/earned-${order.id}`), {
      type: "earned", points: plan.earned, orderId: order.id, createdAt: now,
    });
  }
  if (plan.membershipUsed) {
    tx.set(plan.memberRef, { balance: nextMemberBalance, updatedAt: now }, { merge: true });
    tx.create(database.doc(`memberships/${order.uid}/events/${randomUUID()}`), {
      type: "redeemed", amount: plan.membershipUsed, balanceAfter: nextMemberBalance, orderId: order.id, branchId: order.branchId, createdAt: now,
    });
  }
  return {
    pointsUsed: plan.pointsUsed, membershipUsed: plan.membershipUsed,
    rewardsAppliedAt: now, total: plan.total, paid: plan.paid,
    ...(plan.paid ? { paidAt: now, paymentMethod: plan.membershipUsed ? "membership" as const : "points" as const, pointsEarned: plan.earned } : {}),
  };
}
