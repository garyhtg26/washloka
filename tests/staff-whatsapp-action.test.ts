import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const previousCssLoader = require.extensions[".css"];
require.extensions[".css"] = () => {};
const { StaffWhatsAppAction } = require("../components/staff-order-detail");
if (previousCssLoader) require.extensions[".css"] = previousCssLoader;
else delete require.extensions[".css"];

const draft = { message: "Halo, cucianmu sedang dicuci.\nhttps://washloka.vercel.app/dfabel?view=tracking", url: "https://wa.me/628123456789?text=pesan", trackingUrl: "https://washloka.vercel.app/dfabel?view=tracking", hasTrackingToken: false };

test("the saved status has a reviewable WhatsApp draft", () => {
  const html = renderToStaticMarkup(createElement(StaffWhatsAppAction, { status: 4, statusNotSaved: false, draft, originReady: true }));
  assert.match(html, /Sedang dicuci/);
  assert.match(html, /href="https:\/\/wa\.me\//);
  assert.match(html, /Lihat isi pesan/);
  assert.match(html, /Halo, cucianmu sedang dicuci/);
});

test("an unsaved status cannot open a draft based on the wrong status", () => {
  const html = renderToStaticMarkup(createElement(StaffWhatsAppAction, { status: 4, statusNotSaved: true, draft, originReady: true }));
  assert.match(html, /Simpan perubahan status/);
  assert.match(html, /disabled/);
  assert.doesNotMatch(html, /href="https:\/\/wa\.me\//);
});

test("a missing draft explains that customer details need checking", () => {
  const html = renderToStaticMarkup(createElement(StaffWhatsAppAction, { status: 0, statusNotSaved: false, draft: null, originReady: true }));
  assert.match(html, /Nomor WhatsApp atau tautan pelacakan belum tersedia/);
  assert.match(html, /disabled/);
});
