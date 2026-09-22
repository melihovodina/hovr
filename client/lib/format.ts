const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "Just now", "12 min ago", "Yesterday", "Sep 18".
export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (then >= today.getTime()) return "Today";
  if (then >= today.getTime() - DAY) return "Yesterday";
  const date = new Date(then);
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

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

export function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}
