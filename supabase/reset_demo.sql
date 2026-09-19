-- =============================================================================
-- Quote Automation: reset the public demo to its seeded state
-- =============================================================================
-- Requires schema.sql and seed.sql to have been applied first (seed.sql defines
-- demo.load_seed()).
--
-- On demand:   run this file (SQL Editor or psql), or just:  select demo.reset_demo();
--
-- Nightly (Supabase): enable the pg_cron extension (Dashboard -> Database ->
-- Extensions -> pg_cron), then run ONCE:
--
--   select cron.schedule('reset-quote-demo', '0 19 * * *', $$select demo.reset_demo();$$);
--
-- To stop it:  select cron.unschedule('reset-quote-demo');
--
-- What it does: truncates every table a demo visitor can write to (overrides,
-- generated, email_queue, email_templates, gmail_connections, user_settings,
-- send_identities, the quote directory) plus the demo source tables, then
-- reloads the seed. Demo PDFs are rendered on request and never stored, so
-- there are no files to clean up. Safe to run any number of times.
-- =============================================================================

create or replace function demo.reset_demo()
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  -- load_seed() truncates every demo/reference/app_quote table before inserting,
  -- so a reset is exactly "reload the seed".
  perform demo.load_seed();
end;
$fn$;

revoke all on function demo.reset_demo() from public, anon, authenticated;

select demo.reset_demo();
