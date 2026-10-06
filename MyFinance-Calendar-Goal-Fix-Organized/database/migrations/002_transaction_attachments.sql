-- MyFinance: Transaction attachment support
-- Run once in Supabase Dashboard -> SQL Editor -> New Query.

alter table public.transactions
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_size bigint,
  add column if not exists attachment_type text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('transaction-attachments', 'transaction-attachments', false, 10485760)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Users can read own transaction attachments'
  ) then
    create policy "Users can read own transaction attachments"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'transaction-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Users can upload own transaction attachments'
  ) then
    create policy "Users can upload own transaction attachments"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'transaction-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Users can delete own transaction attachments'
  ) then
    create policy "Users can delete own transaction attachments"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'transaction-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

grant usage on schema storage to authenticated;
