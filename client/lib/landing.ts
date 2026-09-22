export const NAV_LINKS = [
  { href: "#setup", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export type Cell ={ kind: "yes" } | { kind: "no" } | { kind: "text"; text: string };

const Y: Cell = { kind: "yes" };
const N: Cell = { kind: "no" };
const T = (text: string): Cell => ({ kind: "text", text });

export const PRICING_ROWS = [
  "Bots",
  "Messages a month",
  "Knowledge sources",
  "Your colors and hello message",
  "Remove “Powered by hovr”",
  "Inbox and leads history",
  "Export leads to CSV",
];

export const PLANS = [
  { name: "Free", price: "$0", tag: "", cta: "Start free", featured: false, cells: [T("1"), T("100"), T("10"), Y, N, T("7 days"), N] },
  { name: "Pro", price: "$19", tag: "Popular", cta: "Go Pro", featured: true, cells: [T("3"), T("2,000"), T("100"), Y, Y, T("Forever"), N] },
  { name: "Business", price: "$49", tag: "", cta: "Go Business", featured: false, cells: [T("10"), T("10,000"), T("500"), Y, Y, T("Forever"), Y] },
];

export const FAQS = [
  {
    q: "Do I need a developer?",
    a: "No. You copy one line and paste it into your site settings. If you’ve ever added Google Analytics, it’s the same thing.",
  },
  {
    q: "How does it know what to say?",
    a: "It only uses the files and text you gave it, and every answer shows which document it came from, so you can always check.",
  },
  {
    q: "What counts as a message?",
    a: "One visitor question plus the bot’s reply. Chatting with your bot inside the dashboard is free.",
  },
  {
    q: "Which languages does it speak?",
    a: "It replies in whatever language your visitor writes in, even if your documents are only in English.",
  },
  {
    q: "Where does my content go?",
    a: "Your files and text are stored in our database and only used for your bot.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing page and you go back to the free plan when the month ends.",
  },
];

export const SETUP_STEPS = [
  { title: "Make it look like your brand", body: "Pick a color, write a hello message or add a few suggested questions." },
  { title: "Give it your content", body: "Upload PDFs or Word files, or just paste some text." },
  { title: "Put it on your site", body: "Copy one line into your site. Works with Shopify, WordPress, Wix, Webflow and plain HTML." },
];

// Where to paste the embed code, per site builder (also used by the app's Install tab).
export const INSTALL_GUIDES = [
  {
    id: "shopify",
    label: "Shopify",
    steps: ["Online Store → Themes → Edit code.", "Open theme.liquid and paste before </body>.", "Save and preview your store."],
  },
  {
    id: "wordpress",
    label: "WordPress",
    steps: [
      "Install a header and footer code plugin, or open your theme footer.",
      "Paste the code into the footer section.",
      "Save, then open your site.",
    ],
  },
  {
    id: "wix",
    label: "Wix",
    steps: ["Settings → Custom code → Add custom code.", "Paste it, pick All pages and Body – end.", "Apply, then publish."],
  },
  {
    id: "webflow",
    label: "Webflow",
    steps: ["Site settings → Custom code.", "Paste it into Footer code.", "Save and publish your site."],
  },
  {
    id: "html",
    label: "Plain HTML",
    steps: ["Open the HTML file of your site.", "Paste the code right before the closing </body> tag.", "Save, then reload your site."],
  },
];
