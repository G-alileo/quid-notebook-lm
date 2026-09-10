create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table documents add column folder_id uuid references folders(id) on delete set null;
alter table documents add column category_id uuid references categories(id) on delete set null;
alter table documents add column content text;

create table flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  question text not null,
  answer text not null,
  mastered boolean not null default false,
  created_at timestamptz not null default now()
);

alter table folders enable row level security;
alter table categories enable row level security;
alter table flashcards enable row level security;

create policy folders_own on folders for all using (user_id = auth.uid());
create policy categories_own on categories for all using (user_id = auth.uid());
create policy flashcards_own on flashcards for all using (user_id = auth.uid());

create index flashcards_document_idx on flashcards (document_id);
