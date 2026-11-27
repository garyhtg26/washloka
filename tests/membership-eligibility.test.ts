import test from "node:test";
import assert from "node:assert/strict";
import { eligibleMemberDiscount } from "../lib/membership-eligibility";
test("discount eligibility requires an active, available positive balance", () => {
  assert.equal(eligibleMemberDiscount({ active: true, balance: 1 }), true);
  assert.equal(eligibleMemberDiscount({ active: true, balance: 0 }), false);
  assert.equal(eligibleMemberDiscount({ active: true, balance: -1 }), false);
  assert.equal(eligibleMemberDiscount({ active: true, balance: 0.5 }), false);
  assert.equal(
    eligibleMemberDiscount({ active: true, balance: "100000" }),
    false,
  );
  assert.equal(
    eligibleMemberDiscount({ active: false, balance: 100000 }),
    false,
  );
  assert.equal(
    eligibleMemberDiscount({
      active: true,
      balance: 100000,
      reconciliationRequired: true,
    }),
    false,
  );
  assert.equal(eligibleMemberDiscount(undefined), false);
});
