import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultStore } from "../lib/defaults";
import {
  contentImageKey,
  defaultContent,
  mediaSlots,
} from "../lib/site-content";

// CSS is handled by Next.js in the app; it is irrelevant to server rendering here.
const previousCssLoader = require.extensions[".css"];
require.extensions[".css"] = () => {};
const CustomerHome = require("../components/customer-home").default;
if (previousCssLoader) require.extensions[".css"] = previousCssLoader;
else delete require.extensions[".css"];

test("uploaded dashboard images render directly with their version and store parameters", () => {
  const images = Object.fromEntries(
    mediaSlots.map((slot) => [
      contentImageKey(slot),
      `/api/media/banners/${slot}?v=1234-abcd&branch=dfablelaundry&theme=washloka`,
    ]),
  );
  const noop = () => {};
  const html = renderToStaticMarkup(
    createElement(CustomerHome, {
      store: { ...defaultStore, content: { ...defaultContent, images } },
      name: "",
      onOrder: noop,
      onMember: noop,
      onTrack: noop,
      onAccount: noop,
      onServices: noop,
    }),
  );
  const imageTags = html.match(/<img\b[^>]*>/g) || [];
  assert.ok(
    !html.includes("/washloka/hero-washer-wide.webp") &&
      !html.includes("/washloka/hero-washer-mobile.webp"),
    "A custom promo must not be replaced on desktop",
  );
  assert.ok(
    !html.includes("/washloka/home-care-wide.webp") &&
      !html.includes("/washloka/home-care-mobile.webp"),
    "A custom second banner must not be replaced by the defaults",
  );
  for (const slot of mediaSlots) {
    assert.ok(
      imageTags.some((tag) =>
        tag.includes(
          `src="/api/media/banners/${slot}?v=1234-abcd&amp;branch=dfablelaundry&amp;theme=washloka"`,
        ),
      ),
      `Expected the ${slot} image to load directly with its versioned URL`,
    );
  }
});

test("the home cleaning banner announces the upcoming service without an order button", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(
    createElement(CustomerHome, {
      store: { ...defaultStore, content: defaultContent },
      name: "",
      onOrder: noop,
      onMember: noop,
      onTrack: noop,
      onAccount: noop,
      onServices: noop,
    }),
  );
  assert.match(html, /Coming soon/);
  assert.match(html, /House cleaning<br\s*\/?\s*>datang ke rumah/);
  assert.match(html, /srcSet="\/washloka\/home-care-wide\.webp"/);
  assert.match(html, /src="\/washloka\/home-care-mobile\.webp"/);
  assert.doesNotMatch(html, /Jadwalkan jemput laundry/);
  assert.doesNotMatch(html, /class="campaign-image-action"/);
});

test("the default promo uses artwork composed for desktop and mobile", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(
    createElement(CustomerHome, {
      store: { ...defaultStore, content: defaultContent },
      name: "",
      onOrder: noop,
      onMember: noop,
      onTrack: noop,
      onAccount: noop,
      onServices: noop,
    }),
  );
  assert.match(
    html,
    /<source\b[^>]*media="\(min-width: 961px\)"[^>]*srcSet="\/washloka\/hero-washer-wide\.webp"/,
  );
  assert.match(html, /<img\b[^>]*src="\/washloka\/hero-washer-mobile\.webp"/);
  assert.match(
    html,
    /<button\b[^>]*class="campaign-order"[^>]*>Pesan sekarang/,
  );
});

test("banner shows the Washloka tagline while preserving saved promo codes", () => {
  const noop = () => {};
  for (const code of [
    "HELLO BuZZ",
    "HELLOBUZZ",
    "HELLODFABLE",
    "EAZYWASH",
    "BUZZWASH",
    "WASHLOKA10",
    "BUZZARD10",
  ]) {
    const store = { ...defaultStore, promo: { ...defaultStore.promo, code } };
    const html = renderToStaticMarkup(
      createElement(CustomerHome, {
        store,
        name: "",
        onOrder: noop,
        onMember: noop,
        onTrack: noop,
        onAccount: noop,
        onServices: noop,
      }),
    );
    assert.equal(store.promo.code, code);
    assert.match(html, /Clean at Your/);
    assert.doesNotMatch(html, /class="campaign-code"/);
    assert.ok(!html.includes(code));
  }
});

test("carousel respects both dashboard banner visibility settings", () => {
  const noop = () => {};
  for (const promoActive of [false, true]) {
    for (const peopleActive of [false, true]) {
      const store = {
        ...defaultStore,
        promo: { ...defaultStore.promo, active: promoActive },
        content: {
          ...defaultContent,
          people: { ...defaultContent.people, active: peopleActive },
        },
      };
      const html = renderToStaticMarkup(
        createElement(CustomerHome, {
          store,
          name: "",
          onOrder: noop,
          onMember: noop,
          onTrack: noop,
          onAccount: noop,
          onServices: noop,
        }),
      );
      assert.equal(html.includes('class="campaign-order"'), promoActive);
      assert.equal(
        html.includes('class="campaign-message campaign-coming-soon"'),
        peopleActive,
      );
      assert.equal(
        html.includes('aria-label="Banner berikutnya"'),
        promoActive && peopleActive,
      );
      assert.ok(html.includes('aria-label="Cari layanan"'));
    }
  }
});
