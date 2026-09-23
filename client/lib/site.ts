// Public base URL for canonical links, Open Graph and the sitemap.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "hovr";

export const SITE_TITLE = "hovr: a chat on your site that actually knows your business";

export const SITE_DESCRIPTION =
  "Give hovr your PDFs, Word files or a bit of text. It answers your visitors in a small chat bubble, day and night, and tells you what it couldn’t answer.";
