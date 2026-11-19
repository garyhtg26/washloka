import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultStore } from "../lib/defaults";
import { defaultContent } from "../lib/site-content";

const TenantHero = require("../components/tenant-hero").default;
const noop = () => {};

test("partner heroes use their own defaults rather than Washloka campaign artwork", () => {
  for (const branch of ["dfablelaundry", "buzzwash"] as const) {
    const html = renderToStaticMarkup(createElement(TenantHero, { branch, store: { ...defaultStore, branchId: branch }, onOrder: noop, onServices: noop }));
    assert.match(html, branch === "buzzwash" ? /BUZZWASH LAUNDRY/ : /D’FABLE LAUNDRY/);
    assert.doesNotMatch(html, /washloka\/hero/);
    assert.match(html, /unsplash\//);
  }
});

test("tenant promo uses the image uploaded to its dashboard", () => {
  const promo = "/api/media/banners/promo?v=1234-abcd&branch=buzzwash&theme=washloka";
  const html = renderToStaticMarkup(createElement(TenantHero, { branch: "buzzwash", store: { ...defaultStore, branchId: "buzzwash", orderingEnabled: true, content: { ...defaultContent, images: { washlokaPromo: promo } } }, onOrder: noop, onServices: noop }));
  assert.match(html, /src="\/api\/media\/banners\/promo\?v=1234-abcd&amp;branch=buzzwash&amp;theme=washloka"/);
});

test("a legacy Washloka headline does not appear on a partner storefront", () => {
  const store = { ...defaultStore, promo: { ...defaultStore.promo, title: "Cucian menumpuk? Washloka yang kerjain", description: "Bersih bersama Washloka" } };
  const html = renderToStaticMarkup(createElement(TenantHero, { branch: "dfablelaundry", store, onOrder: noop, onServices: noop }));
  assert.doesNotMatch(html, /Washloka/i);
  assert.match(html, /Laundry bersih, hari lebih ringan/);
});
