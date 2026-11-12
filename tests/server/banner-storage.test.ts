import test from "node:test";
import assert from "node:assert/strict";
import { downloadPhoto, uploadPhoto } from "../../lib/storage/photos";
import { mediaSlots } from "../../lib/site-content";

test("all Washloka uploads preserve their separate legacy storage objects", async () => {
  const keys = [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_STORAGE_BUCKET",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  process.env.SUPABASE_URL = "https://storage.example.invalid";
  process.env.SUPABASE_SECRET_KEY = "test-key";
  process.env.SUPABASE_STORAGE_BUCKET = "test-bucket";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    if (url.pathname.includes("/bucket/"))
      return Response.json({ public: false });
    requests.push(url.pathname);
    return new Response(new Uint8Array([1, 2, 3]));
  }) as typeof fetch;
  try {
    for (const slot of mediaSlots) {
      await uploadPhoto(
        `banners/washloka/${slot}/image.jpg`,
        new Uint8Array([1]),
      );
      await downloadPhoto(`banners/${slot}/image.jpg`);
    }
    assert.deepEqual(
      requests,
      mediaSlots.flatMap((slot) => [
        `/storage/v1/object/test-bucket/banners/washloka/${slot}/image.jpg`,
        `/storage/v1/object/authenticated/test-bucket/banners/${slot}/image.jpg`,
      ]),
    );
    await assert.rejects(
      uploadPhoto("banners/washloka/logo/image.jpg", new Uint8Array([1])),
      /INVALID_PHOTO_PATH/,
    );
    await assert.rejects(
      downloadPhoto("banners/washloka/../promo/image.jpg"),
      /INVALID_PHOTO_PATH/,
    );
    assert.equal(requests.length, mediaSlots.length * 2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
