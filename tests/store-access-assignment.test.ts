import test from "node:test";
import assert from "node:assert/strict";
import { canAssignStoreAccess } from "../lib/access-policy";

test("owner can create and edit access for either store from either workspace", () => {
  const stores = ["dfablelaundry", "buzzwash"];
  assert.equal(canAssignStoreAccess("owner", stores, "dfablelaundry", ["buzzwash"]), true);
  assert.equal(canAssignStoreAccess("owner", stores, "buzzwash", ["dfablelaundry"]), true);
  assert.equal(canAssignStoreAccess("owner", stores, "dfablelaundry", stores), true);
  assert.equal(canAssignStoreAccess("owner", stores, "dfablelaundry", []), false);
  assert.equal(canAssignStoreAccess("owner", stores, "dfablelaundry", ["unknown"]), false);
});

test("store admins cannot grant unassigned stores or omit current workspace", () => {
  const stores = ["dfablelaundry"];
  assert.equal(canAssignStoreAccess("admin", stores, "dfablelaundry", stores), true);
  assert.equal(canAssignStoreAccess("admin", stores, "dfablelaundry", ["buzzwash"]), false);
  assert.equal(canAssignStoreAccess("admin", ["dfablelaundry", "buzzwash"], "dfablelaundry", ["buzzwash"]), false);
  assert.equal(canAssignStoreAccess("admin", stores, "dfablelaundry", []), false);
  assert.equal(canAssignStoreAccess("staff", stores, "dfablelaundry", stores), false);
  assert.equal(canAssignStoreAccess("customer", stores, "dfablelaundry", stores), false);
});
