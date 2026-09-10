create extension if not exists vector;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  type text not null,
  size text,
  status text not null default 'pending',
  storage_path text,
  source_url text,
  chunk_count int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null,
  content text not null,
  embedding vector(1024),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_document_idx on chunks (document_id);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null,
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

create table podcasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  style text not null,
  length text not null,
  script jsonb,
  status text not null default 'pending',
  audio_path text,
  error text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table documents enable row level security;
alter table chunks enable row level security;
alter table chat_messages enable row level security;
alter table podcasts enable row level security;

create policy profiles_own on profiles for all using (id = auth.uid());
create policy documents_own on documents for all using (user_id = auth.uid());
create policy chunks_own on chunks for all using (user_id = auth.uid());
create policy chat_own on chat_messages for all using (user_id = auth.uid());
create policy podcasts_own on podcasts for all using (user_id = auth.uid());

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, username, full_name)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

create function match_chunks(query_embedding vector(1024), match_count int default 6)
returns table (id uuid, document_id uuid, content text, meta jsonb, similarity float)
language sql stable
as $$
  select c.id, c.document_id, c.content, c.meta,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('podcasts', 'podcasts', false)
on conflict (id) do nothing;

create policy uploads_own on storage.objects for all
using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy podcasts_storage_own on storage.objects for all
using (bucket_id = 'podcasts' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'podcasts' and (storage.foldername(name))[1] = auth.uid()::text);
