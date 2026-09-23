// Readable foreground (dark ink or white) for a hex background.
export function onColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return lum > 0.4 ? "#0D0E11" : "#FFFFFF";
}


// "Just now", "Today", "Sep 19" (with the year when it isn't this one).
export function shortDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (now.getTime() - d.getTime() < 60_000) return "Just now";
  if (d.toDateString() === now.toDateString()) return "Today";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}
