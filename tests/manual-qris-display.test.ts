import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ManualQris from "../components/manual-qris";
import ManualPaymentMethod from "../components/manual-payment-method";
import { STATIC_QRIS_ID } from "../lib/payments/manual-policy";

test("manual QRIS shows the actual recipient and preserves the complete image", () => {
  const html = renderToStaticMarkup(createElement(ManualQris, { id: "qris", initiallyHidden: false }));
  assert.match(html, /BUZZWASH CIBUBUR/);
  assert.match(html, /src="\/buzzwash-qris-static\.png"/);
  assert.match(html, /width="1135" height="1600"/);
  assert.match(html, /Masukkan nominal sesuai tagihan/);
  assert.doesNotMatch(html, /payment-qr-placeholder/);
});

test("staff can distinguish the QRIS recipient from a bank transfer after submission", () => {
  const bank = { bankName: "BCA", accountNumber: "6560655132", accountHolder: "NOVEL RUSPANDI" };
  const manual = { method: "bank_transfer" as const, status: "awaiting_review" as const, amount: 10000, hasProof: true };
  const qrHtml = renderToStaticMarkup(createElement(ManualPaymentMethod, { manual: { ...manual, bank: { ...bank, staticQrId: STATIC_QRIS_ID } } }));
  assert.match(qrHtml, /QRIS manual/);
  assert.match(qrHtml, /BUZZWASH CIBUBUR/);
  assert.doesNotMatch(qrHtml, /Transfer bank/);
  const bankHtml = renderToStaticMarkup(createElement(ManualPaymentMethod, { manual: { ...manual, bank } }));
  assert.match(bankHtml, /Transfer bank/);
  assert.match(bankHtml, /NOVEL RUSPANDI/);
  assert.doesNotMatch(bankHtml, /QRIS manual/);
});

test("manual QRIS can remain hidden until the customer opens it", () => {
  const html = renderToStaticMarkup(createElement(ManualQris, { id: "qris" }));
  assert.match(html, /Tampilkan QRIS/);
  assert.doesNotMatch(html, /<img/);
});
