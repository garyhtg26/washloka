import test from "node:test";
import assert from "node:assert/strict";
import { requestVerificationEmail } from "../lib/verification-email-client";

test("custom verification sends the current token in the header and does not invoke Firebase", async () => {
  let calls = 0;
  const send: typeof fetch = async (input, init) => {
    assert.equal(input, "/api/auth/verification-email");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    assert.deepEqual(JSON.parse(String(init?.body)), { scope: "admin" });
    return Response.json({ delivery: "custom" });
  };
  await requestVerificationEmail("test-token", "admin", async () => { calls++; }, send);
  assert.equal(calls, 0);
});

test("Firebase fallback runs only if server explicitly reports no custom sender", async () => {
  let calls = 0;
  const fallback = async () => { calls++; };
  await requestVerificationEmail("test-token", "customer", fallback, async () => Response.json({ delivery: "firebase" }));
  assert.equal(calls, 1);
  await assert.rejects(requestVerificationEmail("test-token", "customer", fallback, async () => new Response("error", { status: 503 })));
  await assert.rejects(requestVerificationEmail("test-token", "customer", fallback, async () => Response.json({ delivery: "unexpected" })));
  assert.equal(calls, 1);
});

test("already verified email skips sending and tells the client to refresh", async () => {
  let calls = 0;
  const result = await requestVerificationEmail("test-token", "admin", async () => { calls++; }, async () => Response.json({ delivery: "already-verified" }));
  assert.equal(result, "already-verified");
  assert.equal(calls, 0);
});

test("rate limits and connectivity failures display email-specific errors", async () => {
  const fallback = async () => {};
  await assert.rejects(requestVerificationEmail("test-token", "admin", fallback, async () => new Response("", { status: 429 })), { code: "auth/too-many-requests" });
  await assert.rejects(requestVerificationEmail("test-token", "admin", fallback, async () => { throw Error("offline"); }), { code: "auth/verification-email-failed" });
});
