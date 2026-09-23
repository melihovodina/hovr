-- Only the visitor colour still means "automatic" when it is null, where it falls back
-- to the bot's main color. The panel and the bot bubbles have real defaults, so store
-- those instead of leaving every reader to invent them.
update public.bots set chat_background = '#FFFFFF' where chat_background is null;
update public.bots set bot_message_color = '#F0F0EE' where bot_message_color is null;

alter table public.bots
  alter column chat_background set default '#FFFFFF',
  alter column chat_background set not null,
  alter column bot_message_color set default '#F0F0EE',
  alter column bot_message_color set not null;
