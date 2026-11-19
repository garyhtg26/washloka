import test from "node:test";
import assert from "node:assert/strict";
import {
  DFABLE_HOME,
  DFABLE_PROFILE,
  DFABLE_ABOUT,
  dfableTrackingPath,
  customerPath,
  tenantStorePath,
  tenantFromSlug,
} from "../lib/dfable-path";

test("public storefront aliases resolve without changing persisted store IDs", () => {
  assert.equal(tenantStorePath("dfablelaundry"), "/dfabel");
  assert.equal(tenantStorePath("buzzwash"), "/buzzwash");
  assert.equal(tenantFromSlug("dfabel"), "dfablelaundry");
  assert.equal(tenantFromSlug("dfable"), "dfablelaundry");
  assert.equal(tenantFromSlug("BuzzWash"), "buzzwash");
  assert.equal(tenantFromSlug("unknown"), null);
  assert.equal(customerPath("/dfabel", { track: "a&b", account: "1" }), "/dfabel?track=a%26b&account=1");
});

test("Customer links use the unified app and tracking tokens are encoded", () => {
  assert.equal(DFABLE_HOME, "/");
  assert.equal(DFABLE_PROFILE, "/profil");
  assert.equal(DFABLE_ABOUT, "/tentang");
  assert.equal(dfableTrackingPath("x&view=home"), "/?track=x%26view%3Dhome");
});

test("old customer addresses retain tracking and login queries when redirected to the unified app", () => {
  const url = new URL(
    customerPath("/", {
      track: "token&value",
      account: "1",
      branch: "bogor",
      tag: ["a", "b"],
    }),
    "https://example.test",
  );
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("track"), "token&value");
  assert.equal(url.searchParams.get("account"), "1");
  assert.equal(url.searchParams.get("branch"), "bogor");
  assert.deepEqual(url.searchParams.getAll("tag"), ["a", "b"]);
  assert.equal(customerPath("/profil", {}), "/profil");
});
