import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

// The link preview for the landing page, drawn at build time. It mirrors the hero:
// the headline with its lime highlight, and a small chat that cites its source.

export const alt = "hovr: a chat on your site that actually knows your business";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The static export has no server, so the image is written to a file at build time.
export const dynamic = "force-static";

// Image generation can't read CSS variables, so the light theme's tokens are repeated here.
const PAGE = "#F6F5F1";
const SURFACE = "#FFFFFF";
const INK = "#141417";
const SUBTLE = "#5B5B63";
const LINE = "#E1DFD7";
const LIME = "#C8F547";
const ON_LIME = "#0D0E11";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="52" height="52" viewBox="0 0 28 28">
        <rect x="3" y="4.5" width="22" height="15" rx="7.5" fill={LIME} />
        <circle cx="9.5" cy="12" r="1.7" fill={ON_LIME} />
        <circle cx="14" cy="12" r="1.7" fill={ON_LIME} />
        <circle cx="18.5" cy="12" r="1.7" fill={ON_LIME} />
      </svg>
      <span style={{ fontSize: 40, letterSpacing: -1.5, color: INK }}>{SITE_NAME}</span>
    </div>
  );
}

function Chat() {
  return (
    <div
      style={{
        width: 360,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 26,
        borderRadius: 32,
        background: SURFACE,
        boxShadow: `0 0 0 1px ${LINE}, 0 30px 60px -30px rgba(0,0,0,0.25)`,
      }}
    >
      <div style={{ alignSelf: "flex-end", padding: "12px 18px", borderRadius: "22px 22px 6px 22px", background: INK, color: PAGE, fontSize: 21 }}>
        Do you ship to Canada?
      </div>
      <div style={{ padding: "12px 18px", borderRadius: "22px 22px 22px 6px", background: PAGE, color: INK, fontSize: 21, lineHeight: 1.4 }}>
        Yes, orders to Canada arrive in 5 to 8 business days.
      </div>
      <div style={{ display: "flex", alignSelf: "flex-start", padding: "6px 14px", borderRadius: 999, boxShadow: `0 0 0 1px ${LINE}`, fontSize: 16, color: SUBTLE }}>
        Shipping &amp; delivery.pdf
      </div>
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "64px 72px", background: PAGE, color: INK }}>
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 48, flexGrow: 1, paddingTop: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28, flexGrow: 1, flexShrink: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 64, lineHeight: 1.2, letterSpacing: -2.5 }}>
              <span>A chat on your site</span>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span>that</span>
                <span style={{ padding: "0 14px 6px", borderRadius: 16, background: LIME, color: ON_LIME }}>actually knows</span>
              </div>
              <span>your business</span>
            </div>
            <span style={{ fontSize: 26, lineHeight: 1.45, color: SUBTLE }}>Answers your visitors from your own files, and shows where each answer came from.</span>
          </div>
          <Chat />
        </div>
      </div>
    ),
    size,
  );
}
