import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Order } from "../lib/types";

const oldCss = require.extensions[".css"];
require.extensions[".css"] = () => {};
const { default: IncomingOrders } = require("../components/incoming-orders");
if (oldCss) require.extensions[".css"] = oldCss;
else delete require.extensions[".css"];

test("incoming queue prioritizes oldest unhandled orders and excludes processed orders", () => {
  const orders = [
    { id: "DF-NEW", name: "Baru", status: 0, source: "web", fulfillment: "delivery", service: "wash", createdAt: "2026-11-18T10:00:00Z" },
    { id: "DF-DONE", name: "Sudah", status: 3, source: "pos", service: "wash", createdAt: "2026-11-18T08:00:00Z" },
    { id: "DF-OLD", name: "Tunggu lama", status: 0, source: "web", fulfillment: "dropoff", service: "wash", createdAt: "2026-11-18T09:00:00Z" },
  ] as Order[];
  const html = renderToStaticMarkup(createElement(IncomingOrders, {
    orders, services: [{ id: "wash", name: "Cuci lipat" }], hasMore: true,
    onOpen: () => {}, onViewAll: () => {},
  }));
  assert.ok(html.indexOf("Tunggu lama") < html.indexOf("Baru"));
  assert.doesNotMatch(html, /Sudah/);
  assert.match(html, /Antar sendiri/);
  assert.match(html, /Antar jemput/);
  assert.match(html, /2 pesanan menunggu/);
  assert.match(html, /500 pesanan terbaru/);
  assert.equal(orders[0].id, "DF-NEW", "the caller's list must not be reordered");
});

test("empty queue has a clear state without a misleading count of all history", () => {
  const html = renderToStaticMarkup(createElement(IncomingOrders, {
    orders: [], services: [], hasMore: true, onOpen: () => {}, onViewAll: () => {},
  }));
  assert.match(html, /Tidak ada pesanan menunggu/);
  assert.match(html, /500 pesanan terbaru/);
  assert.doesNotMatch(html, /Lihat semua/);
});
