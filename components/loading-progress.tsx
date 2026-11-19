"use client";

import { useEffect, useReducer } from "react";
import { displayedLoadingProgress, loadingProgressReducer } from "@/lib/loading-progress-state";

/** Show an estimated wait, then finish only once the underlying work is done. */
export function useLoadingProgress(loading: boolean) {
  const [state, dispatch] = useReducer(loadingProgressReducer, {
    phase: loading ? "loading" : "idle",
    progress: 0,
  });

  useEffect(() => {
    if (loading) {
      dispatch("start");
      const timer = window.setInterval(() => {
        dispatch("tick");
      }, 180);
      return () => window.clearInterval(timer);
    }
    // Briefly wait for dependent auth/store updates before declaring completion.
    dispatch("ready");
    const timer = window.setTimeout(() => dispatch("complete"), 200);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (state.phase !== "complete") return;
    const timer = window.setTimeout(() => dispatch("hide"), 240);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  return {
    visible: loading || state.phase !== "idle",
    progress: displayedLoadingProgress(state, loading),
  };
}

export default function LoadingProgress({ progress, label }: { progress: number | null; label: string }) {
  // A new load starting during the completed animation gets a distinct cycle.
  // Hide the old 100% until the new cycle starts, avoiding a visible 100 → 0 jump.
  if (progress === null) return <div className="loading-indicator" role="status" aria-label={`${label}, memulai ulang`} />;
  return <div className="loading-indicator">
    <div className="loading-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}%${progress < 100 ? " perkiraan" : ""}`}>
      <span style={{ width: `${progress}%` }} />
    </div>
    <span className="loading-percentage" aria-hidden="true">{progress}%</span>
  </div>;
}
