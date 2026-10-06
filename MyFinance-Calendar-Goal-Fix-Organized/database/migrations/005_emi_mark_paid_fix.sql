-- Day 8 fix: ensure each scheduled EMI occurrence can only be marked paid once.
-- Run in Supabase Dashboard -> SQL Editor.

create unique index if not exists emi_payments_emi_due_unique_idx
  on public.emi_payments (emi_id, due_date);
