import test from "node:test";
import assert from "node:assert/strict";
import { formatOrderCreatedAt } from "../lib/tracking-date";

test("order creation time is shown in Indonesian Jakarta time", () => {
  assert.equal(formatOrderCreatedAt("2026-11-19T10:54:00.000Z"), "19 Nov 2026, 17.54 WIB");
  assert.equal(formatOrderCreatedAt("2026-11-19T17:54:00"), "19 Nov 2026, 17.54 WIB");
});

test("older date-only values do not invent a time and invalid values are safe", () => {
  assert.equal(formatOrderCreatedAt("2026-10-06"), "6 Okt 2026");
  for (const value of [undefined, null, "", "123", "not-a-date", "2026-02-30", "2026-02-30T01:00:00Z"]) {
    assert.equal(formatOrderCreatedAt(value), null);
  }
});
