import test from "node:test";
import assert from "node:assert/strict";
import { trackingBranch } from "../lib/branches";
import { dfableTrackingPath } from "../lib/dfable-path";

test("a legacy tracking link selects the order's store without repeated switching", () => {
  assert.equal(trackingBranch("dfablelaundry", "buzzwash", false), "buzzwash");
  assert.equal(trackingBranch("buzzwash", "buzzwash", false), null);
  assert.equal(trackingBranch("buzzwash", "cinere", false), "dfablelaundry");
  assert.equal(trackingBranch("dfablelaundry", "missing", false), null);
  assert.equal(trackingBranch("dfablelaundry", "buzzwash", true), null);
});

test("shared tracking links include the canonical store and preserve the token", () => {
  assert.equal(dfableTrackingPath("token", "buzzwash"), "/buzzwash?track=token");
  assert.equal(dfableTrackingPath("token", "cinere"), "/dfabel?track=token");
});
