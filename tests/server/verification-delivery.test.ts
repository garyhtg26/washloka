import test from "node:test";
import assert from "node:assert/strict";
import { verificationActionLink, verificationDeliveryConfig } from "../../lib/email/verification-delivery";

test("custom email configuration fails closed if incomplete or its origin is unsafe", () => {
  assert.equal(verificationDeliveryConfig({}), null);
  assert.throws(() => verificationDeliveryConfig({ apiKey: "test" }));
  for (const origin of ["http://example.org", "https://bad.example/path", "https://bad.example/?next=x", "https://user:pass@example.org/"])
    assert.throws(() => verificationDeliveryConfig({ apiKey: "test", from: "Washloka <mail@example.org>", origin }));
  assert.equal(verificationDeliveryConfig({ apiKey: "test", from: "mail@example.org", origin: "https://washloka.example/" })?.origin, "https://washloka.example");
});

test("verification link sends only the Firebase action code to the trusted Washloka page", () => {
  const action = verificationActionLink("https://firebase.example/__/auth/action?mode=verifyEmail&oobCode=dummy%26code&apiKey=ignored&continueUrl=https%3A%2F%2Fevil.example", "https://washloka.example", "admin");
  const url = new URL(action);
  assert.equal(url.origin, "https://washloka.example");
  assert.equal(url.pathname, "/auth/action");
  assert.equal(url.searchParams.get("scope"), "admin");
  assert.equal(url.searchParams.get("oobCode"), "dummy&code");
  assert.equal(url.searchParams.has("continueUrl"), false);
  assert.throws(() => verificationActionLink("https://firebase.example/?mode=resetPassword&oobCode=abc", "https://washloka.example", "admin"));
});
