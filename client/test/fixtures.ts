import type { AppState } from "@/components/app/app-context";
import type { Billing, Bot, Source } from "@/lib/types";

export function bot(over: Partial<Bot> = {}): Bot {
  return {
    id: "b1",
    name: "Northwind Coffee",
    publicKey: "pub_test",
    allowedDomains: [],
    color: "#2F6B4F",
    avatarUrl: null,
    position: "right",
    greeting: "Ask me anything about us.",
    suggestedQuestions: [],
    showBadge: true,
    chatBackground: null,
    visitorMessageColor: null,
    botMessageColor: null,
    lastSeenHost: null,
    lastSeenAt: null,
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
    ...over,
  };
}

export function source(over: Partial<Source> = {}): Source {
  return {
    id: "s1",
    type: "file",
    title: "FAQ.pdf",
    contentType: "application/pdf",
    sizeBytes: 1024,
    pages: 2,
    chunks: 3,
    status: "ready",
    error: null,
    createdAt: "2026-09-20T10:00:00Z",
    processedAt: "2026-09-20T10:00:05Z",
    ...over,
  };
}

export function billing(over: Partial<Billing> = {}): Billing {
  return {
    plan: "free",
    planName: "Free",
    limits: { bots: 1, messagesPerMonth: 100, sources: 10, removeBadge: false, exportLeads: false, historyDays: 7 },
    usage: { messages: 62, bots: 1, sources: 4 },
    periodEnd: null,
    hasSubscription: false,
    ...over,
  };
}

export function appState(over: Partial<AppState> = {}): AppState {
  const b = over.bot ?? bot();
  return {
    me: { id: "u1", email: "anna@northwind.example", plan: "free" },
    bots: [b],
    bot: b,
    billing: billing(),
    inboxOpen: 0,
    href: (path) => `${path}?bot=${b.id}`,
    reload: () => {},
    updateBot: () => {},
    ...over,
  };
}
