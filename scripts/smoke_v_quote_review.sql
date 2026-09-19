-- Smoke test for analytics.v_quote_review (the webapp's read model).
-- Run against your Supabase project after supabase/schema.sql + seed.sql.
-- Expect with the demo seed: rows=38, distinct_tasks=38 (one row per task),
--   bad_status=0, bad_fuze=0, ready=32 / no_price=3 / no_match=3.
SELECT
  (SELECT count(*) FROM analytics.v_quote_review) AS rows,
  (SELECT count(DISTINCT task_did) FROM analytics.v_quote_review) AS distinct_tasks,
  (SELECT count(*) FROM analytics.v_quote_review
     WHERE status NOT IN ('ready','no_price','no_match')) AS bad_status,
  (SELECT count(*) FROM analytics.v_quote_review
     WHERE fuze_id IS NOT NULL AND fuze_id !~ '^\d{6,9}$') AS bad_fuze,
  (SELECT count(*) FROM analytics.v_quote_review WHERE status='ready')    AS ready,
  (SELECT count(*) FROM analytics.v_quote_review WHERE status='no_price') AS no_price,
  (SELECT count(*) FROM analytics.v_quote_review WHERE status='no_match') AS no_match;
