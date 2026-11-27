import test from "node:test";
import assert from "node:assert/strict";
import { acceptOrderSnapshot, preferOwnerTracking } from "../lib/tracking-freshness";
import { acceptStoreSnapshot } from "../lib/branch-loading";
import { publicTracking } from "../lib/tracking-data";
import type { Order, Store, TrackingOrder } from "../lib/types";

const base: Order = {
  id: "DF-ABCDEF123456", branchId: "buzzwash", source: "web", uid: "customer",
  token: "token", name: "Customer", phone: "+628123456789", address: "Address",
  lat: 0, lng: 0, date: "2026-11-19", slot: "", notes: "", photo: "", unitPrice: 8000, washPrice: 8000,
  service: "complete", kg: 3, actualKg: 3, express: false, status: 3,
  total: 20000, shippingFee: 0, paid: false, history: [], createdAt: "2026-11-19T00:00:00.000Z",
};

test("owner's confirmed points update wins over an older public response", () => {
  const oldPublic = publicTracking({ ...base, paymentRevision: 2 });
  const updatedOwner = { ...base, paymentRevision: 3, total: 12000, pointsUsed: 8000 };
  const selected = preferOwnerTracking(oldPublic, publicTracking(updatedOwner));
  assert.equal(selected?.total, 12000);
  assert.equal(selected?.pointsUsed, 8000);
  assert.equal((selected?.total ?? 0) + (selected?.pointsUsed ?? 0), 20000);
  assert.equal("uid" in selected!, false);
  assert.equal("token" in selected!, false);
});

test("newer public tracking status wins over an older owner snapshot", () => {
  const latestPublic = publicTracking({ ...base, paymentRevision: 5, status: 5 });
  const olderOwner = { ...base, paymentRevision: 4, status: 3 };
  assert.equal(preferOwnerTracking(latestPublic, olderOwner)?.status, 5);
});

test("late tracking responses cannot replace a newer accepted revision", () => {
  const older = publicTracking({ ...base, paymentRevision: 2 });
  const newer = publicTracking({ ...base, paymentRevision: 3, total: 15000, pointsUsed: 5000 });
  assert.equal(acceptOrderSnapshot(newer, older), newer);
  assert.equal(acceptOrderSnapshot(older, newer), newer);
  assert.equal(acceptOrderSnapshot(newer, { ...older, id: "DF-OTHER" }).id, "DF-OTHER");
});

test("a dashboard refresh that began before saving cannot restore the old order status", () => {
  const older = { ...base, status: 3, paymentRevision: 2 };
  const saved = { ...base, status: 4, paymentRevision: 3 };
  const nextUpdate = { ...base, status: 5, paymentRevision: 4 };
  const newOrder = { ...base, id: "DF-ABCDEF123457", status: 0 };
  const store: Store = {
    branchId: "buzzwash", isAdmin: true, orders: [older], services: [],
    promo: { active: false, title: "", description: "", code: "" },
  };

  const afterSave = acceptStoreSnapshot(store, { ...store, orders: [saved] });
  assert.deepEqual(afterSave.orders, [saved]);
  const afterLateRefresh = acceptStoreSnapshot(afterSave, { ...store, orders: [newOrder, older] });
  assert.deepEqual(afterLateRefresh.orders, [newOrder, saved]);
  assert.deepEqual(acceptStoreSnapshot(afterLateRefresh, { ...store, orders: [newOrder, nextUpdate] }).orders, [newOrder, nextUpdate]);
  assert.deepEqual(acceptStoreSnapshot(afterLateRefresh, { ...store, orders: [newOrder] }).orders, [newOrder]);
  const customerSnapshot = { ...store, isAdmin: false };
  assert.equal(acceptStoreSnapshot(afterSave, customerSnapshot), customerSnapshot);
});

test("legacy snapshots without revisions still work and never mix orders", () => {
  const legacy = publicTracking(base);
  assert.equal("paymentRevision" in legacy, false);
  const another = { ...legacy, id: "DF-OTHER", paymentRevision: 99 } as TrackingOrder;
  assert.equal(preferOwnerTracking(legacy, another), legacy);
  assert.equal(preferOwnerTracking(null, legacy), legacy);
  assert.equal(preferOwnerTracking(legacy, { ...legacy, status: 5 })?.status, legacy.status);
});
