import test from "node:test";
import assert from "node:assert/strict";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { Order } from "../../lib/types";
import { prepareRewardReservation, commitRewardReservation } from "../../lib/reward-intent";

function fixture(initialPoints: number, initialMembership: number) {
  const values = new Map<string, Record<string, unknown>>([
    ["loyalty/customer", { balance: initialPoints }],
    ["memberships/customer", { active: true, balance: initialMembership }],
  ]);
  const database = { doc: (path: string) => ({ path }) } as unknown as Firestore;
  const tx = {
    get: async (ref: { path: string }) => ({ data: () => values.get(ref.path) }),
    set: (ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => {
      values.set(ref.path, options?.merge ? { ...values.get(ref.path), ...data } : data);
    },
    create: (ref: { path: string }, data: Record<string, unknown>) => {
      if (values.has(ref.path)) throw Error("duplicate event");
      values.set(ref.path, data);
    },
  } as unknown as Transaction;
  async function apply(order: Order, price: number, shipping: number | null, final: boolean) {
    const plan = await prepareRewardReservation(tx, database, order, price, shipping, final);
    if (!plan) return null;
    return commitRewardReservation(tx, database, order, plan, "2026-11-13T00:00:00Z");
  }
  return { values, apply };
}

function order(branchId = "buzzwash"): Order {
  return { id: "DF-TEST", uid: "customer", branchId, membershipDiscount: true,
    usePoints: true, useMembershipBalance: true, membershipLimit: 100000, pointsLimit: 100000, paid: false, insurance: false } as Order;
}

test("reservation cannot spend more than the amounts the customer saw", async () => {
  const f = fixture(10000, 10000);
  const result = await f.apply({ ...order(), membershipLimit: 3000, pointsLimit: 0 } as Order, 12000, null, false);
  assert.ok(result);
  assert.equal(result.membershipUsed, 3000);
  assert.equal(result.pointsUsed, 0);
  assert.equal(result.total, 9000);
  assert.equal(f.values.get("memberships/customer")?.balance, 7000);
  assert.equal(f.values.get("loyalty/customer")?.balance, 10000);
});

test("BuzzWash reservation immediately spends member balance before points without settling an estimate", async () => {
  const f = fixture(8000, 10000);
  const result = await f.apply(order(), 15000, null, false);
  assert.ok(result);
  assert.equal(result.membershipUsed, 10000);
  assert.equal(result.pointsUsed, 5000);
  assert.equal(result.total, 0);
  assert.equal(result.paid, false);
  assert.equal(f.values.get("loyalty/customer")?.balance, 3000);
  assert.equal(f.values.get("memberships/customer")?.balance, 0);
});

test("lower final price returns points first; higher price does not spend extra", async () => {
  const f = fixture(8000, 10000);
  const initial = await f.apply(order(), 15000, null, false);
  assert.ok(initial);
  const reserved = { ...order(), ...initial } as Order;
  const lower = await f.apply(reserved, 9000, 2000, true);
  assert.ok(lower);
  assert.equal(lower.membershipUsed, 9000);
  assert.equal(lower.pointsUsed, 0);
  assert.equal(lower.total, 2000);
  assert.equal(f.values.get("loyalty/customer")?.balance, 8000);
  assert.equal(f.values.get("memberships/customer")?.balance, 1000);
  const raised = await f.apply({ ...reserved, ...lower } as Order, 18000, 2000, true);
  assert.ok(raised);
  assert.equal(raised.membershipUsed, 9000);
  assert.equal(raised.pointsUsed, 0);
  assert.equal(raised.total, 11000);
  assert.equal(f.values.get("memberships/customer")?.balance, 1000);
});

test("settlement awards points once even if a paid order is updated again", async () => {
  const f = fixture(0, 20000);
  const initial = await f.apply(order(), 10000, null, false);
  assert.ok(initial);
  const paid = await f.apply({ ...order(), ...initial } as Order, 10000, 0, true);
  assert.ok(paid);
  assert.equal(paid.paid, true);
  assert.equal(f.values.get("loyalty/customer")?.balance, 1000);
  assert.equal(await f.apply({ ...order(), ...initial, ...paid } as Order, 10000, 0, true), null);
  assert.equal(f.values.get("loyalty/customer")?.balance, 1000);
});

test("a refund that exceeds the safe balance limit is rejected before any writes", async () => {
  const f = fixture(0, Number.MAX_SAFE_INTEGER);
  await assert.rejects(() => f.apply({ ...order(), rewardsReservedAt: "2026-11-13T00:00:00Z", membershipUsed: 1, pointsUsed: 0 } as Order, 0, null, false));
  assert.equal(f.values.get("memberships/customer")?.balance, Number.MAX_SAFE_INTEGER);
  assert.equal(f.values.get("loyalty/customer")?.balance, 0);
});
