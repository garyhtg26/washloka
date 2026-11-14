import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Order } from "../lib/types";

const previousCssLoader = require.extensions[".css"];
require.extensions[".css"] = () => {};
const { StaffReceipt } = require("../components/staff-order-detail");
if (previousCssLoader) require.extensions[".css"] = previousCssLoader;
else delete require.extensions[".css"];

const order = {
  id: "DF-123", token: "example", branchId: "buzzwash", name: "Pelanggan",
  phone: "08123456789", service: "wash", kg: 3, actualKg: 3, unit: "kg",
  speed: "regular", unitPrice: 8000, washPrice: 8000, pricingVersion: 2,
  express: false, shippingFee: 0, total: 24000, paid: false,
  createdAt: "2026-11-14T00:00:00.000Z",
} as Order;

test("printed receipt identifies the order's store in its heading and closing", () => {
  for (const [branchId, name] of [["buzzwash", "BuzzWash"], ["dfablelaundry", "D’Fable"], ["cinere", "D’Fable"], ["bogor", "D’Fable"]]) {
    const html = renderToStaticMarkup(createElement(StaffReceipt, { order: { ...order, branchId }, services: [] }));
    assert.ok(html.includes(`<h1>${name}</h1>`));
    assert.ok(html.includes(`Terima kasih telah memilih ${name}.`));
    assert.ok(html.includes("DF-123"));
  }
});
