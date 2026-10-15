-- Applied to the `digi` Supabase project as migration "insights_enable_rls".
-- The insights schema is private (anon/authenticated have no USAGE), so these
-- tables were never reachable through the API. RLS with no policies makes that
-- explicit and clears the "RLS disabled" advisor error. Only the postgres-owned
-- SECURITY DEFINER functions (admin_dashboard, admin_exclude_device) and views
-- read or write them, and the owner bypasses RLS.
alter table insights.admins enable row level security;
alter table insights.excluded_readers enable row level security;
