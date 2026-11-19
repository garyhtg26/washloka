/** State for one visible loading cycle. Progress is an estimate until complete. */
export type LoadingProgressState = {
  phase: "idle" | "loading" | "settling" | "complete";
  progress: number;
};

export type LoadingProgressEvent = "start" | "tick" | "ready" | "complete" | "hide";

/** null separates an already completed cycle from a new load starting during its exit. */
export function displayedLoadingProgress(state: LoadingProgressState, loading: boolean): number | null {
  if (loading && state.phase === "complete") return null;
  if (loading && state.phase === "idle") return 0;
  return state.progress;
}

export function loadingProgressReducer(state: LoadingProgressState, event: LoadingProgressEvent): LoadingProgressState {
  switch (event) {
    case "start":
      // A temporary ready state can be interrupted without restarting the bar.
      return { phase: "loading", progress: state.phase === "idle" || state.phase === "complete" ? 0 : state.progress };
    case "tick":
      if (state.phase !== "loading") return state;
      return { ...state, progress: Math.min(92, state.progress + (state.progress < 60 ? 4 : state.progress < 80 ? 2 : 1)) };
    case "ready":
      return state.phase === "loading" ? { ...state, phase: "settling" } : state;
    case "complete":
      return state.phase === "settling" ? { phase: "complete", progress: 100 } : state;
    case "hide":
      return state.phase === "complete" ? { ...state, phase: "idle" } : state;
  }
}
