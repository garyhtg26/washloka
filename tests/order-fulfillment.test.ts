import test from "node:test";
import assert from "node:assert/strict";
import { canSelectOrderStatus, orderStatusSteps } from "../lib/order-fulfillment";
import { publicTracking } from "../lib/tracking-data";
import type { Order } from "../lib/types";
import { dfableTrackingPath } from "../lib/dfable-path";

test("drop-off hides courier stages; delivery and legacy orders retain them", () => {
  assert.deepEqual(orderStatusSteps({ source: "web", fulfillment: "dropoff", status: 0 }, 8), [0, 3, 4, 5, 7]);
  assert.deepEqual(orderStatusSteps({ source: "web", fulfillment: "delivery", status: 0 }, 8), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(orderStatusSteps({ source: "pos", status: 3 }, 8), [3, 4, 5, 6, 7]);
  assert.equal(canSelectOrderStatus({ fulfillment: "dropoff", status: 0 }, 1), false);
  assert.equal(canSelectOrderStatus({ fulfillment: "dropoff", status: 0 }, 3), true);
  assert.equal(canSelectOrderStatus({ fulfillment: "dropoff", status: 4 }, 3), false);
});

test("shared tracking links preserve the store and normalize historical aliases", () => {
  assert.equal(dfableTrackingPath("abc", "buzzwash"), "/buzzwash?track=abc");
  assert.equal(dfableTrackingPath("abc", "cinere"), "/dfabel?track=abc");
  assert.equal(dfableTrackingPath("abc"), "/?track=abc");
});

test("public tracking exposes pending quantity and delivery mode but not contact data", () => {
  const order = { id: "DF-TEST", source: "web", uid: null, name: "Private", phone: "081234", address: "Private", fulfillment: "dropoff", quantityPending: true, kg: 3, actualKg: null, status: 0, paid: false, branchId: "buzzwash", total: 0, shippingFee: 0, history: [], createdAt: "2026-11-17T00:00:00.000Z" } as unknown as Order;
  const result = publicTracking(order);
  assert.equal(result.guest, true);
  assert.equal(result.fulfillment, "dropoff");
  assert.equal(result.quantityPending, true);
  assert.equal("name" in result, false);
  assert.equal("phone" in result, false);
  assert.equal("address" in result, false);
});
