import test from "node:test";
import assert from "node:assert/strict";
import { isValidOrderWhatsAppPhone, orderWhatsAppDraft, whatsappPublicOrigin } from "../lib/whatsapp-order";
import type { Order } from "../lib/types";

const order = {
  id: "DF-ABCDEF123456", name: "Ayu", phone: "0812 3456 7890", branchId: "dfablelaundry",
  token: "01234567-89ab-4cde-8fab-0123456789ab", status: 0, source: "web", fulfillment: "delivery",
} as Order;

test("draft targets the customer's valid WhatsApp number with a store-specific tracking link", () => {
  const draft = orderWhatsAppDraft(order, "https://washloka.example", 4);
  assert.ok(draft);
  assert.equal(draft.trackingUrl, `https://washloka.example/dfabel?track=${order.token}`);
  assert.equal(draft.hasTrackingToken, true);
  const wa = new URL(draft.url);
  assert.equal(wa.origin, "https://wa.me");
  assert.equal(wa.pathname, "/6281234567890");
  assert.equal(wa.searchParams.get("text"), draft.message);
  assert.match(draft.message, /Halo Ayu/);
  assert.match(draft.message, /sedang dalam proses pencucian/);
  assert.doesNotMatch(draft.message, /[—–]/);
});

test("dropoff and POS messages do not promise a pickup or delivery", () => {
  for (const item of [{ ...order, fulfillment: "dropoff" as const }, { ...order, source: "pos" as const }]) {
    for (const status of [1, 2, 6, 7]) {
      const draft = orderWhatsAppDraft(item, "https://washloka.example", status);
      assert.ok(draft);
      assert.doesNotMatch(draft.message, /kurir|penjemputan|menjemput|perjalanan untuk diantar/i);
      if (status === 7) assert.doesNotMatch(draft.message, /siap diambil/i);
    }
  }
});

test("guest BuzzWash orders use their own public tracking URL", () => {
  const guestOrder = { ...order, uid: null, branchId: "buzzwash" };
  const draft = orderWhatsAppDraft(guestOrder, "https://washloka.example", 3);
  assert.ok(draft);
  assert.equal(draft.trackingUrl, `https://washloka.example/buzzwash?track=${order.token}`);
  assert.match(draft.message, /BuzzWash/);
});

test("missing or malformed tracking tokens give an honest sign-in link without leaking the value", () => {
  for (const token of [undefined, "undefined", "bad&track=secret"]) {
    const draft = orderWhatsAppDraft({ ...order, token }, "https://washloka.example");
    assert.ok(draft);
    assert.equal(draft.hasTrackingToken, false);
    assert.equal(draft.trackingUrl, "https://washloka.example/dfabel?view=tracking");
    assert.match(draft.message, /Jika belum punya akun, balas pesan ini agar kami bantu/);
    assert.doesNotMatch(draft.message, /secret|undefined/);
  }
});

test("invalid numbers, statuses or public origins cannot create a WhatsApp draft", () => {
  assert.equal(isValidOrderWhatsAppPhone("+6281234567890"), true);
  for (const phone of ["", "123", "0812xxx", "01234567890", "+15551234567"])
    assert.equal(orderWhatsAppDraft({ ...order, phone }, "https://washloka.example"), null);
  assert.equal(orderWhatsAppDraft(order, "https://washloka.example", 8), null);
  assert.equal(orderWhatsAppDraft(order, "http://washloka.example"), null);
  assert.equal(whatsappPublicOrigin("http://localhost:3000", "http://localhost:3001"), null);
  assert.equal(whatsappPublicOrigin("http://127.0.0.1:3000", "https://example.com"), "https://example.com");
  assert.equal(whatsappPublicOrigin("http://127.0.0.1:3000", ""), "https://washloka.vercel.app");
  assert.equal(whatsappPublicOrigin("https://preview.vercel.app", ""), "https://washloka.vercel.app");
  assert.equal(whatsappPublicOrigin("https://preview.vercel.app", "https://example.com"), "https://example.com");
  assert.equal(whatsappPublicOrigin("https://washloka.example", "https://user:pass@example.com"), null);
});
