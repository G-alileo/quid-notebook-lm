create extension if not exists pg_net with schema extensions;

create or replace function public.notify_ingestion()
returns trigger
language plpgsql
security definer set search_path = public, extensions, net
as $$
begin
  perform http_post(
    'https://agents.customcx.com/webhook/quid-w1-ingest',
    jsonb_build_object(
      'type', 'INSERT',
      'table', 'documents',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', null
    )
  );
  return new;
end;
$$;

drop trigger if exists documents_notify_ingestion on public.documents;

create trigger documents_notify_ingestion
after insert on public.documents
for each row
when (new.status = 'pending')
execute function public.notify_ingestion();
