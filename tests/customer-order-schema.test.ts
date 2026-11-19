import test from "node:test";
import assert from "node:assert/strict";
import { customerOrderSchema, updateSchema } from "../lib/order-validation";
import { finalAmount } from "../lib/payments/policy";
import type { Order } from "../lib/types";

const basic = { source: "web", requestId: "d9428888-122b-4d69-ae6e-91de79995892",
  name: "Pelanggan", phone: "081234567890", service: "wash", speed: "regular", notes: "" };

test("dropoff checkout needs no location, weight, photo, date, or account", () => {
  const result = customerOrderSchema.parse({ ...basic, fulfillment: "dropoff" });
  assert.equal(result.phone, "+6281234567890");
  assert.equal(result.fulfillment, "dropoff");
});

test("delivery requires an address and both map coordinates", () => {
  assert.equal(customerOrderSchema.safeParse({ ...basic, fulfillment: "delivery" }).success, false);
  assert.equal(customerOrderSchema.safeParse({ ...basic, fulfillment: "delivery", address: "Jalan Mawar nomor 2", lat: -6.3, lng: 106.8 }).success, true);
});

test("checkout rejects unapproved fields and requires reward limits for selected rewards", () => {
  assert.equal(customerOrderSchema.safeParse({ ...basic, fulfillment: "dropoff", uid: "another-user" }).success, false);
  assert.equal(customerOrderSchema.safeParse({ ...basic, fulfillment: "dropoff", useMembershipBalance: true }).success, false);
  assert.equal(customerOrderSchema.safeParse({ ...basic, fulfillment: "dropoff", useMembershipBalance: true, membershipLimit: 50000 }).success, true);
});

test("an unweighed order cannot be treated as payable and its status may still be updated", () => {
  const pending = { actualKg: null, quantityPending: true, shippingFee: 0, total: 0 } as Order;
  assert.equal(finalAmount(pending), null);
  assert.equal(updateSchema.safeParse({ id: "DF-123456789ABC", status: 1, actualKg: null, paid: false, shippingFee: null }).success, true);
});
