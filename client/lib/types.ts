// Shapes of the API's JSON (server/docs/api.md). Dates are ISO strings.

export type Plan = "free" | "pro" | "business";

export interface Me {
  id: string;
  email: string;
  plan: Plan;
}

export interface Bot {
  id: string;
  name: string;
  publicKey: string;
  allowedDomains: string[];
  color: string;
  avatarUrl: string | null;
  position: "left" | "right";
  greeting: string;
  suggestedQuestions: string[];
  showBadge: boolean;
  // The chat panel's background and the two kinds of message. A null visitor color means the main
  // color; a null background or bot color means "not picked" (see chatColors for the defaults).
  chatBackground: string | null;
  visitorMessageColor: string | null;
  botMessageColor: string | null;
  lastSeenHost: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SourceType = "file" | "text" | "inbox";
export type SourceStatus = "queued" | "processing" | "ready" | "failed";

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  contentType: string;
  sizeBytes: number;
  pages: number;
  chunks: number;
  status: SourceStatus;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Citation {
  // The [n] marker in the answer text.
  n: number;
  sourceId: string;
  sourceTitle: string;
  score: number;
  excerpt: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  // Assistant messages only; false means the bot said it doesn't know.
  answered: boolean | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  channel: "playground" | "widget";
  title: string;
  visitorEmail: string | null;
  messages: number;
  createdAt: string;
  lastMessageAt: string;
}

export interface InboxItem {
  id: string;
  question: string;
  timesAsked: number;
  status: "open" | "done";
  lastConversationId: string | null;
  visitorEmail: string | null;
  answerSourceId: string | null;
  lastAskedAt: string;
  createdAt: string;
}

export interface Lead {
  conversationId: string;
  email: string;
  question: string;
  missed: boolean;
  createdAt: string;
  lastMessageAt: string;
}

export interface Totals {
  questions: number;
  answered: number;
  missed: number;
  answeredRate: number | null;
  conversations: number;
  leads: number;
}

export interface Stats {
  days: number;
  timezone: string;
  current: Totals;
  previous: Totals;
  daily: { date: string; answered: number; missed: number }[];
  topQuestions: { question: string; count: number }[];
  openQuestions: number;
  needsYou: { id: string; question: string; timesAsked: number; lastAskedAt: string }[];
}

export interface Limits {
  bots: number;
  messagesPerMonth: number;
  sources: number;
  removeBadge: boolean;
  exportLeads: boolean;
  // 0 means forever.
  historyDays: number;
}

export interface Billing {
  plan: Plan;
  planName: string;
  limits: Limits;
  usage: { messages: number; bots: number; sources: number };
  periodEnd: string | null;
  hasSubscription: boolean;
}

// Public widget config (/api/widget/<key>/config).
export interface WidgetConfig {
  name: string;
  color: string;
  avatarUrl: string | null;
  position: "left" | "right";
  greeting: string;
  suggestedQuestions: string[];
  showBadge: boolean;
  chatBackground: string | null;
  visitorMessageColor: string | null;
  botMessageColor: string | null;
}
