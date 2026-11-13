import test from "node:test";
import assert from "node:assert/strict";
import {
  contentSchema,
  defaultContent,
  siteContent,
  siteImage,
  mediaSlotSchema,
  bannerStoragePath,
  bannerUploadTarget,
  contentImageKey,
  defaultImages,
  mediaSlots,
} from "../lib/site-content";
import { catalogServices } from "../lib/defaults";
import { normalizeServices } from "../lib/catalog";
import { brandCopy } from "../lib/brand-copy";

test("old standalone BuZZ in saved copy becomes Washloka without changing unrelated words", () => {
  assert.equal(
    brandCopy("Cucian menumpuk? BuZZ yang Kerjain"),
    "Cucian menumpuk? Washloka yang Kerjain",
  );
  assert.equal(brandCopy("Buzzer rusak"), "Buzzer rusak");
});

test("previous brand names in saved settings are displayed as Washloka without changing service prices", () => {
  const oldServices = catalogServices.map((service) =>
    service.id === "member"
      ? { ...service, name: "Membership Eazywash", price: 125000 }
      : service,
  );
  const member = normalizeServices(oldServices).find(
    (service) => service.id === "member",
  );
  assert.equal(member?.name, "Membership Washloka");
  assert.equal(member?.price, 125000);
  assert.equal(
    oldServices.find((service) => service.id === "member")?.name,
    "Membership Eazywash",
  );
  for (const oldBrand of ["Eazywash", "Easywash", "BuzzWash", "BUZZWASH"]) {
    const content = siteContent({
      member: { ...defaultContent.member, title: `Paket ${oldBrand} Plus` },
    });
    assert.equal(content.member.title, "Paket Washloka Plus");
  }
});
test("invalid legacy display text falls back to defaults while saved prices remain intact", () => {
  const oldServices = catalogServices.map((service) =>
    service.id === "member"
      ? { ...service, name: 42, description: null, price: 125000 }
      : service,
  );
  const member = normalizeServices(oldServices).find(
    (service) => service.id === "member",
  );
  const fallback = catalogServices.find((service) => service.id === "member");
  assert.equal(member?.name, fallback?.name);
  assert.equal(member?.description, fallback?.description);
  assert.equal(member?.price, 125000);
  const content = siteContent({
    member: { ...defaultContent.member, title: null as unknown as string },
  });
  assert.equal(content.member.title, defaultContent.member.title);
});
test("older settings retain all banner defaults and independent image slots", () => {
  const content = siteContent({
    images: { wash: "/api/media/banners/wash?v=1234-abcd" },
  });
  assert.equal(content.people.active, true);
  assert.equal(content.images?.wash, "/api/media/banners/wash?v=1234-abcd");
  assert.equal(siteImage(content, "wash"), defaultImages.wash);
  assert.equal(siteImage(content, "iron"), "/unsplash/ironing-web.webp");
});
test("content writes cannot inject arbitrary photo URLs or unknown fields", () => {
  assert.equal(contentSchema.safeParse(defaultContent).success, true);
  assert.equal(
    contentSchema.safeParse({
      ...defaultContent,
      images: { promo: "https://untrusted.invalid/image" },
    }).success,
    false,
  );
  assert.equal(
    contentSchema.safeParse({
      ...defaultContent,
      people: { ...defaultContent.people, title: "" },
    }).success,
    false,
  );
  assert.equal(
    mediaSlotSchema.safeParse("../profiles/user/avatar").success,
    false,
  );
  assert.equal(
    siteImage(
      siteContent({ images: { promo: "https://untrusted.invalid/image" } }),
      "promo",
    ),
    "/washloka/hero.webp",
  );
});

import {
  DEFAULT_BRANCH,
  requestBranch,
  branchMediaPath,
  branches,
  branchLocations,
  branchSchema,
  branchLabel,
  isBranchId,
  sameBranch,
  nearestBranch,
  resolveCustomerBranch,
} from "../lib/branches";

test("two shops stay separate while legacy D’Fable links remain valid", () => {
  assert.deepEqual(Object.keys(branches), [DEFAULT_BRANCH, "buzzwash"]);
  assert.deepEqual(Object.keys(branchLocations), [DEFAULT_BRANCH, "buzzwash"]);
  for (const branch of [undefined, DEFAULT_BRANCH, "cinere", "bogor"]) {
    const suffix = branch ? `?branch=${branch}` : "";
    assert.equal(
      requestBranch(`https://example.com/api/store${suffix}`),
      DEFAULT_BRANCH,
    );
    if (branch) {
      assert.equal(branchSchema.parse(branch), DEFAULT_BRANCH);
      assert.equal(branchLabel(branch), "D’Fable");
      assert.equal(sameBranch(branch, DEFAULT_BRANCH), true);
    }
  }
  assert.equal(isBranchId(DEFAULT_BRANCH), true);
  assert.equal(isBranchId("cinere"), false);
  assert.equal(isBranchId("bogor"), false);
  assert.equal(sameBranch("unknown", "unknown"), false);
  assert.equal(sameBranch(DEFAULT_BRANCH, "buzzwash"), false);
  assert.equal(branchLabel("buzzwash"), "BuzzWash");
  assert.equal(
    requestBranch("https://example.com/api/store?branch=buzzwash"),
    "buzzwash",
  );
  assert.throws(() =>
    requestBranch("https://example.com/api/store?branch=../users"),
  );
});

test("old banner storage and URLs stay readable without becoming extra store choices", () => {
  assert.equal(
    branchMediaPath(DEFAULT_BRANCH, "promo"),
    branchMediaPath("cinere", "promo"),
  );
  assert.notEqual(
    branchMediaPath("cinere", "promo"),
    branchMediaPath("bogor", "promo"),
  );
  for (const branch of [DEFAULT_BRANCH, "cinere", "bogor"]) {
    const image = `/api/media/banners/promo?v=abcd&branch=${branch}`;
    const content = siteContent({ images: { promo: image } });
    assert.equal(content.images?.promo, image);
    assert.equal(siteImage(content, "promo"), "/washloka/hero.webp");
    assert.equal(
      bannerStoragePath(branch, "promo"),
      branchMediaPath(branch, "promo"),
    );
  }
  assert.notEqual(
    branchMediaPath("buzzwash", "promo"),
    branchMediaPath(DEFAULT_BRANCH, "promo"),
  );
});

test("new Washloka uploads replace defaults while preserving every legacy image", () => {
  for (const slot of mediaSlots) {
    const old = `/api/media/banners/${slot}?v=abcd&branch=cinere`;
    const upload = bannerUploadTarget(
      "bogor",
      slot,
      "12345678-1234-4234-8234-123456789abc",
    );
    const legacyContent = siteContent({ images: { [slot]: old } });
    assert.equal(legacyContent.images?.[slot], old);
    assert.equal(siteImage(legacyContent, slot), defaultImages[slot]);
    const content = siteContent({
      images: { [slot]: old, [upload.key]: upload.url },
    });
    assert.equal(content.images?.[slot], old);
    assert.equal(upload.key, contentImageKey(slot));
    assert.equal(upload.path, `banners/washloka/${slot}/image.jpg`);
    assert.equal(
      upload.url,
      `/api/media/banners/${slot}?v=12345678-1234-4234-8234-123456789abc&branch=dfablelaundry&theme=washloka`,
    );
    assert.equal(siteImage(content, slot), upload.url);
    assert.notEqual(
      bannerStoragePath(DEFAULT_BRANCH, slot, "washloka"),
      bannerStoragePath(DEFAULT_BRANCH, slot),
    );
  }
});

test("the Washloka namespace rejects invalid stores, slots and image URLs", () => {
  assert.notEqual(
    bannerStoragePath("buzzwash", "promo", "washloka"),
    bannerStoragePath(DEFAULT_BRANCH, "promo", "washloka"),
  );
  assert.throws(() =>
    bannerStoragePath(DEFAULT_BRANCH, "../promo", "washloka"),
  );
  assert.throws(() => bannerStoragePath(DEFAULT_BRANCH, "promo", "unknown"));
  assert.throws(() => bannerUploadTarget(DEFAULT_BRANCH, "promo", "invalid"));
  for (const image of [
    "/api/media/banners/wash?v=abcd&branch=dfablelaundry&theme=washloka",
    "/api/media/banners/promo?v=abcd&branch=dfablelaundry",
    "/api/media/banners/promo?v=abcd&branch=dfablelaundry&theme=unknown",
    "https://untrusted.invalid/api/media/banners/promo?v=abcd&theme=washloka",
  ]) {
    assert.equal(
      siteImage(siteContent({ images: { washlokaPromo: image } }), "promo"),
      "/washloka/hero.webp",
    );
  }
  assert.equal(contentImageKey("wash"), "washlokaWash");
  const wash = "/api/media/banners/wash?v=abcd&branch=bogor";
  assert.equal(
    siteImage(siteContent({ images: { wash } }), "wash"),
    defaultImages.wash,
  );
  const washUpload = bannerUploadTarget(
    "cinere",
    "wash",
    "12345678-1234-4234-8234-123456789abc",
  );
  assert.equal(washUpload.key, "washlokaWash");
  assert.equal(washUpload.path, "banners/washloka/wash/image.jpg");
  assert.equal(
    siteImage(
      siteContent({ images: { washlokaWash: washUpload.url } }),
      "wash",
    ),
    washUpload.url,
  );
});

test("coordinates and saved geographic aliases cannot switch the selected store", () => {
  for (const point of [
    { latitude: -6.3286, longitude: 106.7844 },
    { latitude: -6.35694, longitude: 106.88194 },
  ]) {
    assert.equal(
      nearestBranch(point.latitude, point.longitude),
      DEFAULT_BRANCH,
    );
    assert.equal(
      resolveCustomerBranch({
        detected: point,
        requested: "cinere",
        saved: "bogor",
      }),
      DEFAULT_BRANCH,
    );
  }
  assert.equal(resolveCustomerBranch({ saved: "bogor" }), DEFAULT_BRANCH);
  assert.equal(resolveCustomerBranch({ saved: "unknown" }), DEFAULT_BRANCH);
});
