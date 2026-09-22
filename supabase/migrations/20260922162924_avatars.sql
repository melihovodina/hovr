-- Public bucket for bot logos in the widget; only the server writes to it.
-- No SVG: it can carry scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
