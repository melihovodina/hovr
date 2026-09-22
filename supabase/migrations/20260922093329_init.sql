-- hovr initial schema. Only the Go server uses these tables (owner role, ownership in queries);
-- RLS is on with no policies, so the public Data API can't read or write anything.

create extension if not exists vector with schema extensions;

create type public.plan as enum ('free', 'pro', 'business');
create type public.source_type as enum ('file', 'text', 'inbox');
create type public.source_status as enum ('queued', 'processing', 'ready', 'failed');
create type public.conversation_channel as enum ('playground', 'widget');
create type public.message_role as enum ('user', 'assistant');
create type public.inbox_status as enum ('open', 'done');

create or replace function public.set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One account per auth user (no teams in the MVP).
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  plan public.plan not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

create table public.bots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  public_key text not null unique,
  allowed_domains text[] not null default '{}',
  color text not null default '#C8F547' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url text,
  position text not null default 'right' check (position in ('left', 'right')),
  greeting text not null default 'Ask me anything about us.' check (char_length(greeting) <= 280),
  suggested_questions text[] not null default '{}',
  show_badge boolean not null default true,
  last_seen_host text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bots_account_id_idx on public.bots (account_id);
create trigger bots_updated_at before update on public.bots
  for each row execute function public.set_updated_at();

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots (id) on delete cascade,
  type public.source_type not null,
  title text not null,
  storage_path text,
  content_type text,
  size_bytes bigint,
  pages integer not null default 0,
  status public.source_status not null default 'queued',
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sources_bot_id_idx on public.sources (bot_id);
-- The ingestion worker polls for pending work.
create index sources_pending_idx on public.sources (created_at)
  where status in ('queued', 'processing');
create trigger sources_updated_at before update on public.sources
  for each row execute function public.set_updated_at();

-- 768 dims: gemini-embedding with outputDimensionality = 768.
create table public.chunks (
  id bigint generated always as identity primary key,
  source_id uuid not null references public.sources (id) on delete cascade,
  bot_id uuid not null references public.bots (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now()
);

create index chunks_bot_id_idx on public.chunks (bot_id);
create index chunks_source_id_idx on public.chunks (source_id);
create index chunks_embedding_idx on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots (id) on delete cascade,
  channel public.conversation_channel not null,
  -- Anonymous id the widget keeps in the visitor's browser; null for playground chats.
  visitor_id text,
  visitor_email text,
  title text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index conversations_bot_id_idx on public.conversations (bot_id, last_message_at desc);
create index conversations_leads_idx on public.conversations (bot_id, created_at desc)
  where visitor_email is not null;

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  -- [{ "sourceId": "...", "title": "...", "score": 0.86 }]
  citations jsonb not null default '[]',
  -- Only set on assistant messages: did the bot find a confident answer?
  answered boolean,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id, id);

-- Questions the bot could not answer, grouped by normalized text.
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots (id) on delete cascade,
  question text not null,
  normalized text not null,
  times_asked integer not null default 1,
  status public.inbox_status not null default 'open',
  last_conversation_id uuid references public.conversations (id) on delete set null,
  answer_source_id uuid references public.sources (id) on delete set null,
  last_asked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (bot_id, normalized)
);

create index inbox_items_open_idx on public.inbox_items (bot_id, last_asked_at desc)
  where status = 'open';

-- Monthly message metering per account ("YYYY-MM", UTC).
create table public.usage_counters (
  account_id uuid not null references public.accounts (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  messages integer not null default 0,
  primary key (account_id, period)
);

alter table public.accounts enable row level security;
alter table public.bots enable row level security;
alter table public.sources enable row level security;
alter table public.chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.inbox_items enable row level security;
alter table public.usage_counters enable row level security;

-- Create the account row as soon as someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Private bucket for uploaded knowledge files (10 MB cap, same as the API).
insert into storage.buckets (id, name, public, file_size_limit)
values ('sources', 'sources', false, 10485760)
on conflict (id) do nothing;

-- Public bucket for bot logos in the widget; only the server writes to it.
-- No SVG: it can carry scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
