-- Day 5: optional standard vehicle-expense categories.
-- Run in Supabase Dashboard > SQL Editor if you want these categories available by default.
insert into public.categories (user_id, name, category_type, icon, is_active) values
  (null, 'Maintenance', 'expense', '🔧', true),
  (null, 'Insurance', 'expense', '🛡️', true),
  (null, 'Accessories', 'expense', '🧰', true),
  (null, 'Service', 'expense', '🛠️', true),
  (null, 'Repairs', 'expense', '🔩', true)
on conflict (user_id, category_type, name) do nothing;
