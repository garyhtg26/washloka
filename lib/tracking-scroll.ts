/** Scroll the mobile tracking view without overriding reduced-motion preferences. */
type TrackingScrollTarget = {
  matchMedia: (query: string) => { matches: boolean };
  scrollTo: (options: ScrollToOptions) => void;
};

export function scrollMobileTrackingTop(target: TrackingScrollTarget) {
  if (!target.matchMedia("(max-width: 800px)").matches) return false;
  const reducedMotion = target.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  return true;
}
