import test from "node:test";
import assert from "node:assert/strict";
import {
  contentSchema,
  defaultContent,
  siteContent,
  siteImage,
  mediaSlotSchema,
} from "../lib/site-content";
test("older settings retain all banner defaults and independent image slots", () => {
  const content = siteContent({
    images: { wash: "/api/media/banners/wash?v=1234-abcd" },
  });
  assert.equal(content.people.active, true);
  assert.equal(
    siteImage(content, "wash"),
    "/api/media/banners/wash?v=1234-abcd",
  );
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
    "/eazywash-promo-v1.webp",
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

test("only D’Fable is active while legacy links resolve to the same store", () => {
  assert.deepEqual(Object.keys(branches), [DEFAULT_BRANCH]);
  assert.deepEqual(Object.keys(branchLocations), [DEFAULT_BRANCH]);
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
  assert.equal(branchLabel("buzzwash"), "Toko tidak tersedia");
  assert.throws(() =>
    requestBranch("https://example.com/api/store?branch=../users"),
  );
  assert.throws(() =>
    requestBranch("https://example.com/api/store?branch=buzzwash"),
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
    assert.equal(
      siteImage(siteContent({ images: { promo: image } }), "promo"),
      image,
    );
  }
  assert.throws(() => branchMediaPath("buzzwash", "promo"));
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
