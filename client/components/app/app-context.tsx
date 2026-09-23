"use client";

import { createContext, useContext } from "react";
import type { Billing, Bot, Me } from "@/lib/types";

export interface AppState {
  me: Me;
  bots: Bot[];
  // The bot every screen works on, picked in the sidebar and kept in ?bot=.
  bot: Bot;
  billing: Billing | null;
  // Open inbox questions of the selected bot, for the sidebar badge.
  inboxOpen: number;
  // Link to an app screen for the selected bot.
  href: (path: string) => string;
  // After a change (a new bot, a renamed one, a plan change).
  reload: () => void;
  updateBot: (bot: Bot) => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error("useApp outside the app shell");
  return state;
}
