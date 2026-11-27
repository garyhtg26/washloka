/** Scroll the mobile tracking view without overriding reduced-motion preferences. */
type TrackingScrollTarget = {
  matchMedia: (query: string) => { matches: boolean };
  scrollTo: (options: ScrollToOptions) => void;
};

function scrollBehavior(target: Pick<TrackingScrollTarget, "matchMedia">): ScrollBehavior {
  return target.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function scrollMobileTrackingTop(target: TrackingScrollTarget) {
  if (!target.matchMedia("(max-width: 800px)").matches) return false;
  target.scrollTo({ top: 0, behavior: scrollBehavior(target) });
  return true;
}

export function revealTrackingResult(
  result: Pick<HTMLElement, "focus" | "scrollIntoView">,
  target: Pick<TrackingScrollTarget, "matchMedia">,
) {
  result.focus({ preventScroll: true });
  result.scrollIntoView({ block: "start", behavior: scrollBehavior(target) });
}
