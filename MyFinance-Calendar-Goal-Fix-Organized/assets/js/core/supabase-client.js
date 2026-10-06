import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// MyFinance Production
export const SUPABASE_URL =
  "https://dhqznqqmyljjaniyryew.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_z6e1jqBdIFQzFfzLpmRZ7Q_ns-f1-66";

export const sb = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
