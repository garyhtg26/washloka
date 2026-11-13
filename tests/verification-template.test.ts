import test from "node:test";
import assert from "node:assert/strict";
import { verificationEmail } from "../lib/email/verification-template";

test("verification email includes an escaped Firebase action link, logo and plain text alternative", () => {
  const link = "https://example.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=abc123";
  const mail = verificationEmail({ verificationUrl: link, siteUrl: "https://washloka.id", name: "Ayu Putri" });
  assert.equal(mail.subject, "Verifikasi email akun Washloka");
  assert.match(mail.html, /Halo, Ayu\./);
  assert.match(mail.html, /mode=verifyEmail&amp;oobCode=abc123/);
  assert.match(mail.html, /https:\/\/washloka\.id\/washloka\/email-wordmark\.png/);
  assert.ok(mail.text.includes(link));
  assert.match(mail.text, /Tim Washloka/);
});

test("untrusted display names are rendered as text, never HTML", () => {
  const mail = verificationEmail({
    verificationUrl: "https://example.firebaseapp.com/action?code=test",
    siteUrl: "https://washloka.id",
    name: '<img src=x onerror=alert(1)>',
  });
  assert.ok(!mail.html.includes('<img src=x'));
  assert.ok(mail.html.includes('&lt;img'));
  assert.match(mail.html, /alt="Washloka"/);
});

test("email links and brand origin must be valid HTTPS without embedded credentials", () => {
  const siteUrl = "https://washloka.id";
  assert.throws(() => verificationEmail({ verificationUrl: 'javascript:alert(1)', siteUrl }));
  assert.throws(() => verificationEmail({ verificationUrl: 'https://user:pass@example.com/action', siteUrl }));
  assert.throws(() => verificationEmail({ verificationUrl: 'https://example.com/action', siteUrl: 'http://example.com' }));
});
