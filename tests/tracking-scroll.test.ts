import test from "node:test";
import assert from "node:assert/strict";
import { revealTrackingResult, scrollMobileTrackingTop } from "../lib/tracking-scroll";

function windowStub(mobile: boolean, reducedMotion: boolean) {
  const calls: ScrollToOptions[] = [];
  const target = {
    matchMedia: (query: string) => ({ matches: query.includes("max-width") ? mobile : reducedMotion }),
    scrollTo: (options: ScrollToOptions) => { calls.push(options); },
  };
  return { calls, target };
}

test("mobile tracking scrolls smoothly to the top", () => {
  const { calls, target } = windowStub(true, false);
  assert.equal(scrollMobileTrackingTop(target), true);
  assert.deepEqual(calls, [{ top: 0, behavior: "smooth" }]);
});

test("tracking respects reduced motion and does not override desktop scrolling", () => {
  const reduced = windowStub(true, true);
  assert.equal(scrollMobileTrackingTop(reduced.target), true);
  assert.deepEqual(reduced.calls, [{ top: 0, behavior: "auto" }]);
  const desktop = windowStub(false, false);
  assert.equal(scrollMobileTrackingTop(desktop.target), false);
  assert.deepEqual(desktop.calls, []);
});

test("history clicks focus and reveal the result on desktop and respect reduced motion", () => {
  const calls: Array<FocusOptions | ScrollIntoViewOptions | undefined> = [];
  const result = {
    focus: (options?: FocusOptions) => { calls.push(options); },
    scrollIntoView: (options?: ScrollIntoViewOptions) => { calls.push(options); },
  };
  revealTrackingResult(result, windowStub(false, false).target);
  revealTrackingResult(result, windowStub(false, true).target);
  assert.deepEqual(calls, [
    { preventScroll: true }, { block: "start", behavior: "smooth" },
    { preventScroll: true }, { block: "start", behavior: "auto" },
  ]);
});
