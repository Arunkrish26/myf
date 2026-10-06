-- MyFinance migration 001: optional previous balance / carry-forward amount.
-- Safe: it adds one nullable-free column with a default, so existing rows and functionality remain intact.

alter table public.monthly_budgets
  add column if not exists previous_balance numeric(14,2) not null default 0;

alter table public.monthly_budgets
  drop constraint if exists monthly_budgets_previous_balance_check;

alter table public.monthly_budgets
  add constraint monthly_budgets_previous_balance_check
  check (previous_balance >= 0);

-- Existing monthly_budgets RLS/grants already protect this row by user_id.
-- The frontend stores the current month's carry-forward with an upsert on (user_id, month).
