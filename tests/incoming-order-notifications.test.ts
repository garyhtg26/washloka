import test from "node:test";
import assert from "node:assert/strict";
import { findNewIncomingOrders } from "../lib/incoming-order-notifications";

test("only unseen waiting web orders produce notifications", () => {
  const seen = new Set(["existing"]);
  const orders = [
    { id: "existing", source: "web" as const, status: 0 },
    { id: "incoming", source: "web" as const, status: 0 },
    { id: "handled", source: "web" as const, status: 1 },
    { id: "pos", source: "pos" as const, status: 0 },
  ];
  assert.deepEqual(findNewIncomingOrders(orders, seen).map((order) => order.id), ["incoming"]);
  assert.deepEqual(findNewIncomingOrders(orders, seen), []);
  assert.deepEqual(findNewIncomingOrders([{ ...orders[2], status: 0 }], seen), []);
});
