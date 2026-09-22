// Eases both ends, so scroll-linked motion has no hard start or stop.
export function smoothstep(t: number): number {
  const p = Math.min(Math.max(t, 0), 1);
  return p * p * (3 - 2 * p);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
