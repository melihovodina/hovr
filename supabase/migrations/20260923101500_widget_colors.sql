-- Widget colours the owner can pick. Null means automatic: the chat panel follows the
-- visitor's device, visitor messages use the bot's main color, and bot messages use a
-- shade of the panel. Existing bots start at null and keep the look they have.
alter table public.bots
  add column chat_background text check (chat_background ~ '^#[0-9A-Fa-f]{6}$'),
  add column visitor_message_color text check (visitor_message_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column bot_message_color text check (bot_message_color ~ '^#[0-9A-Fa-f]{6}$');

-- The landing page greets with this, so new bots should too.
alter table public.bots alter column greeting set default 'Hey there, how can I help?';

-- Owners who never edited the old default get the new one.
update public.bots set greeting = 'Hey there, how can I help?'
  where greeting = 'Ask me anything about us.';
