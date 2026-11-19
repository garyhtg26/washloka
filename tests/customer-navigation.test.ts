import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CustomerNavigation from "../components/customer-navigation";

for (const mobile of [false, true]) {
  const label = mobile ? "mobile" : "desktop";
  test(`navigasi ${label} Washloka hanya memuat Beranda dan Tentang`, () => {
    const html = renderToStaticMarkup(createElement(CustomerNavigation, { tenant: false, view: "home", mobile, onView: () => {} }));
    assert.match(html, /Beranda/);
    assert.match(html, /Tentang/);
    assert.doesNotMatch(html, /Layanan &amp; harga|Lacak pesanan|Kembali ke Washloka/);
    assert.match(html, /aria-current="page"/);
  });
  test(`navigasi ${label} toko menyediakan beranda, layanan, lacak, dan kembali ke Washloka`, () => {
    const html = renderToStaticMarkup(createElement(CustomerNavigation, { tenant: true, view: "tracking", mobile, onView: () => {} }));
    assert.match(html, /Layanan &amp; harga/);
    assert.match(html, /Lacak pesanan/);
    assert.match(html, /aria-label="Kembali ke Washloka"/);
    assert.match(html, /href="\/"/);
    assert.match(html, /Beranda/);
    assert.doesNotMatch(html, /Tentang/);
    assert.match(html, /aria-current="page"/);
  });
  test(`navigasi ${label} toko menandai Beranda sebagai halaman aktif`, () => {
    const html = renderToStaticMarkup(createElement(CustomerNavigation, { tenant: true, view: "home", mobile, onView: () => {} }));
    assert.match(html, /class="active" aria-current="page">(?:<svg.*?<\/svg>)?\s*Beranda<\/button>/);
  });
}
