create table highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  anchor_kind text not null default 'text',
  start_offset int,
  end_offset int,
  page_number int,
  rects jsonb,
  text text not null,
  color text not null default '#fde68a',
  annotation text,
  created_at timestamptz not null default now()
);

alter table highlights enable row level security;

create policy highlights_own on highlights for all using (user_id = auth.uid());

create index highlights_document_idx on highlights (document_id, start_offset);
