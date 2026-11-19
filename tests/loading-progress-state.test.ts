import test from "node:test";
import assert from "node:assert/strict";
import { displayedLoadingProgress, loadingProgressReducer, type LoadingProgressState } from "../lib/loading-progress-state";

test("a dependent load resuming during settling keeps its progress and cannot complete early", () => {
  let state: LoadingProgressState = { phase: "loading", progress: 0 };
  for (let i = 0; i < 15; i++) state = loadingProgressReducer(state, "tick");
  const previous = state.progress;
  state = loadingProgressReducer(state, "ready");
  state = loadingProgressReducer(state, "start");
  assert.equal(state.progress, previous);
  assert.equal(state.phase, "loading");
  assert.deepEqual(loadingProgressReducer(state, "complete"), state);
  state = loadingProgressReducer(state, "tick");
  assert.ok(state.progress > previous);
});

test("a new load during the 100% exit hides the old bar before starting a new cycle", () => {
  const complete: LoadingProgressState = { phase: "complete", progress: 100 };
  assert.equal(displayedLoadingProgress(complete, false), 100);
  assert.equal(displayedLoadingProgress(complete, true), null);
  const fresh = loadingProgressReducer(complete, "start");
  assert.deepEqual(fresh, { phase: "loading", progress: 0 });
  assert.equal(displayedLoadingProgress(fresh, true), 0);
});

test("progress reaches 100 only after settling, then hides for a new cycle", () => {
  let state: LoadingProgressState = { phase: "loading", progress: 0 };
  for (let i = 0; i < 200; i++) state = loadingProgressReducer(state, "tick");
  assert.equal(state.progress, 92);
  state = loadingProgressReducer(state, "ready");
  assert.equal(state.progress, 92);
  state = loadingProgressReducer(state, "complete");
  assert.deepEqual(state, { phase: "complete", progress: 100 });
  state = loadingProgressReducer(state, "hide");
  assert.deepEqual(loadingProgressReducer(state, "start"), { phase: "loading", progress: 0 });
});
