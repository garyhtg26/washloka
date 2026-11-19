import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaymentAmount from "../components/payment-amount";

function render(props: Parameters<typeof PaymentAmount>[0]) {
  return renderToStaticMarkup(createElement(PaymentAmount, props));
}

test("the amount beside payment shows the original and final bill after partial or full points", () => {
  const partial = render({ amount: 15000, orderTotal: 15000, pointsUsed: 5000 });
  assert.match(partial, /<s[^>]*>.*Rp\s*20\.000<\/s>/);
  assert.match(partial, /<b[^>]*>Rp\s*15\.000<\/b>/);
  const full = render({ amount: 0, orderTotal: 0, pointsUsed: 20000 });
  assert.match(full, /<s[^>]*>.*Rp\s*20\.000<\/s>/);
  assert.match(full, /<b[^>]*>Rp\s*0<\/b>/);
});

test("the previous bill includes both rewards and retains shipping in the total", () => {
  // Rp20.000 service + Rp3.000 shipping - Rp5.000 points - Rp8.000 balance.
  const html = render({ amount: 10000, orderTotal: 10000, pointsUsed: 5000, membershipUsed: 8000 });
  assert.match(html, /<s[^>]*>.*Rp\s*23\.000<\/s>/);
  assert.match(html, /<b[^>]*>Rp\s*10\.000<\/b>/);
});

test("a stale or invalid reward snapshot never produces a misleading crossed-out price", () => {
  for (const props of [
    { amount: 20000, orderTotal: 15000, pointsUsed: 5000 },
    { amount: 15000, orderTotal: 15000, pointsUsed: -5000 },
    { amount: 15000, orderTotal: 15000, pointsUsed: 0 },
    { amount: 15000, pointsUsed: 5000 },
  ]) assert.doesNotMatch(render(props), /<s\b/);
});
