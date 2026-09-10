create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  folder_id uuid references folders(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

alter table chat_messages
  add column conversation_id uuid references conversations(id) on delete cascade;

alter table conversations enable row level security;

create policy conversations_own on conversations for all using (user_id = auth.uid());

create index conversations_folder_idx on conversations (folder_id);
create index conversations_user_created_idx on conversations (user_id, created_at desc);
create index chat_messages_conversation_idx on chat_messages (conversation_id, created_at);

drop function if exists match_chunks(vector(1024), int);

create function match_chunks(
  query_embedding vector(1024),
  match_count int default 6,
  document_ids uuid[] default null
)
returns table (id uuid, document_id uuid, content text, meta jsonb, similarity float)
language sql stable
as $$
  select c.id, c.document_id, c.content, c.meta,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where document_ids is null or c.document_id = any (document_ids)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
