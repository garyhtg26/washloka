import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultStore } from "../lib/defaults";
import { defaultContent } from "../lib/site-content";

const TenantHero = require("../components/tenant-hero").default;
const { tenantHeroSlides } = require("../components/tenant-hero");
const noop = () => {};

test("partner heroes use their own defaults rather than Washloka campaign artwork", () => {
  for (const branch of ["dfablelaundry", "buzzwash"] as const) {
    const html = renderToStaticMarkup(createElement(TenantHero, { branch, store: { ...defaultStore, branchId: branch }, onOrder: noop, onServices: noop }));
    assert.doesNotMatch(html, /BUZZWASH LAUNDRY|D’FABLE LAUNDRY/);
    assert.doesNotMatch(html, /washloka\/hero/);
    assert.match(html, branch === "buzzwash" ? /buzzwash-storefront-landscape\.webp/ : /dfable-storefront\.jpg/);
  }
});

test("BuzzWash greets customers with its requested copy even with a saved promotion", () => {
  const store = { ...defaultStore, promo: { ...defaultStore.promo, active: true, title: "Promo toko", description: "Promo tersimpan" } };
  const html = renderToStaticMarkup(createElement(TenantHero, { branch: "buzzwash", store, onOrder: noop, onServices: noop }));
  assert.match(html, /Haai BuzzFriend!/);
  assert.match(html, /Siap punya pakaian bersih, harum, dan fresh setiap hari\? Yuk, pesan sekarang biar <strong>Sekejap Jadi Fresh Lagi!<\/strong>/);
  assert.doesNotMatch(html, /BUZZWASH LAUNDRY/);
});

test("tenant promo keeps the image uploaded to its dashboard as another slide", () => {
  const promo = "/api/media/banners/promo?v=1234-abcd&branch=buzzwash&theme=washloka";
  const store = { ...defaultStore, branchId: "buzzwash", orderingEnabled: true, content: { ...defaultContent, images: { washlokaPromo: promo } } };
  const slides = tenantHeroSlides("buzzwash", store);
  assert.equal(slides[0].image, "/buzzwash-storefront-landscape.webp");
  assert.equal(slides[1].image, promo);
  const html = renderToStaticMarkup(createElement(TenantHero, { branch: "buzzwash", store, onOrder: noop, onServices: noop }));
  assert.match(html, /aria-label="Banner berikutnya"/);
});

test("a legacy Washloka headline does not appear on a partner storefront", () => {
  const store = { ...defaultStore, promo: { ...defaultStore.promo, title: "Cucian menumpuk? Washloka yang kerjain", description: "Bersih bersama Washloka" } };
  const html = renderToStaticMarkup(createElement(TenantHero, { branch: "dfablelaundry", store, onOrder: noop, onServices: noop }));
  assert.doesNotMatch(html, /Washloka/i);
  assert.match(html, /Hai, Sahabat D’Fable!/);
  assert.match(html, /<strong>nikmati harimu!<\/strong>/);
  assert.match(html, /lucide-washing-machine/);
});
