import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogForBranch } from "../lib/catalog";
import { money } from "../lib/types";

const oldCss = require.extensions[".css"];
require.extensions[".css"] = () => {};
const { default: CustomerOrderForm } = require("../components/customer-order-form");
if (oldCss) require.extensions[".css"] = oldCss;
else delete require.extensions[".css"];

test("a guest can start a customer order with contact details and no quantity or photo", () => {
  for (const branchId of ["dfablelaundry", "buzzwash"]) {
    const services = catalogForBranch(branchId);
    const html = renderToStaticMarkup(createElement(CustomerOrderForm, {
      branchId, branchName: branchId, initialLocation: { latitude: 0, longitude: 0 },
      services, initialService: services[0].id, profile: { name: "", phone: "" },
      busy: false, submit: async () => {},
    }));
    assert.match(html, /Nama lengkap/);
    assert.match(html, /Nomor WhatsApp/);
    assert.match(html, /Catatan/);
    assert.doesNotMatch(html, /type="file"|type="number"|Tanggal jemput|Masuk untuk/);
  }
});

test("price and point estimates use the published package unit and explain quantity limits", () => {
  const cases = [
    { branchId: "dfablelaundry", service: "wash", price: 35000, unit: "10 kg", limit: "Minimum 10 kg", points: "3.500" },
    { branchId: "buzzwash", service: "wash", price: 35000, unit: "paket", limit: "Maksimal 10 kg per paket", points: "3.500" },
    { branchId: "dfablelaundry", service: "complete", price: 8000, unit: "kg", limit: "Minimum 3 kg", points: "800" },
  ];
  for (const example of cases) {
    const services = catalogForBranch(example.branchId).map((service) =>
      example.branchId === "dfablelaundry" && service.id === "wash"
        ? { ...service, rates: { ...service.rates, regular: example.price } }
        : service,
    );
    const html = renderToStaticMarkup(createElement(CustomerOrderForm, {
      branchId: example.branchId, branchName: example.branchId,
      initialLocation: { latitude: 0, longitude: 0 }, services, initialService: example.service,
      profile: { name: "", phone: "" }, busy: false, submit: async () => {},
    }));
    const summary = html.match(/<section class="customer-order-estimate".*?<\/section>/)?.[0];
    assert.ok(summary);
    assert.ok(summary.includes(money(example.price)), summary);
    assert.ok(summary.includes(`/ ${example.unit}`), summary);
    assert.ok(summary.includes(example.limit), summary);
    assert.ok(summary.includes(`${example.points} poin / ${example.unit}`), summary);
  }
});
