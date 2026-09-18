-- V2 (beta): cache of premium-voice audio, one MP3 per spoken line. Additive only; served through the app, never public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', false, 2097152, array['audio/mpeg'])
on conflict (id) do nothing;
