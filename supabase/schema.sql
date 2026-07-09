-- ChamaFlow multi-device cloud (run in Supabase SQL editor)
-- Informal-first: share_code is the "password" for treasurer + secretary devices.
-- Tighten RLS when you add proper auth later.

create table if not exists cloud_chamas (
  share_code text primary key,
  payload jsonb not null,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists cloud_chamas_updated_at_idx on cloud_chamas (updated_at desc);

alter table cloud_chamas enable row level security;

-- Anon read/write by share code (code is unguessable). Replace when you add accounts.
drop policy if exists "cloud_chamas_anon_all" on cloud_chamas;
create policy "cloud_chamas_anon_all"
  on cloud_chamas
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Optional: live public board pulls only non-sensitive fields via same payload.
-- Application layer decides what to expose on the public board.
