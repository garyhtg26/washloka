import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CustomerSecondaryNav from "../components/customer-secondary-nav";

test("platform mobile navigation contains only Beranda and Tentang", () => {
  const html = renderToStaticMarkup(createElement(CustomerSecondaryNav, { branch: null, active: "about" }));
  assert.match(html, /Beranda/);
  assert.match(html, /Tentang/);
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /Layanan|Lacak pesanan|Akun/);
});

test("store mobile navigation keeps shop context and a way back to Washloka", () => {
  for (const [branch, slug] of [["dfablelaundry", "dfabel"], ["buzzwash", "buzzwash"]] as const) {
    const html = renderToStaticMarkup(createElement(CustomerSecondaryNav, { branch, active: "profile" }));
    assert.match(html, /href="\/"/);
    assert.match(html, new RegExp(`href="/${slug}"`));
    assert.match(html, new RegExp(`href="/${slug}\\?view=services"`));
    assert.match(html, new RegExp(`href="/${slug}\\?view=tracking"`));
    assert.match(html, /Washloka/);
    assert.match(html, /Beranda/);
    assert.doesNotMatch(html, /Tentang|Akun/);
  }
});
