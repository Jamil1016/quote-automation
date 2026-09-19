-- =============================================================================
-- Quote Automation: demo seed data. EVERYTHING HERE IS INVENTED.
-- =============================================================================
-- Apply after schema.sql (SQL Editor, or: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql)
--
-- Company names, carriers ("Carrier A/B/C"), markets, sites, people, prices and
-- email addresses (@example.com) are fictional. No row comes from a real system.
--
-- This file defines demo.load_seed() and then calls it. The function wipes the
-- demo/reference/app tables and reloads them, so running this file twice gives
-- the same result (idempotent). supabase/reset_demo.sql reuses the function.
--
-- What the data exercises (38 tasks):
--   21 plain "ready" tasks              3 tasks with several priced options
--    3 "no_price" (line has no rate)    3 "no_match" (no invoice line at all)
--    3 "needs review" (1 already verified through an override)
--    3 with no directory match          2 with a blank product/service
--    2 hitting a conflicting directory pair (counted within the 21 ready)
-- =============================================================================

create or replace function demo.load_seed()
returns void
language plpgsql
set search_path = ''
as $fn$
declare
  demo_user constant text := 'demo@example.com';
begin
  truncate table
    demo.invoice_lines, demo.quote_tasks,
    reference.ref_quote_directory,
    data_staging.stg_invoicing_form, data_staging.stg_asset_tasks,
    app_quote.overrides, app_quote.generated, app_quote.email_queue,
    app_quote.email_templates, app_quote.gmail_connections,
    app_quote.user_settings, app_quote.send_identities
  restart identity cascade;

  -- "Last refreshed" stamps: early this morning.
  insert into data_staging.stg_invoicing_form (loaded_at) values (date_trunc('day', now()) + interval '6 hours');
  insert into data_staging.stg_asset_tasks   (loaded_at) values (date_trunc('day', now()) + interval '6 hours 10 minutes');

  -- ---------------------------------------------------------------------------
  -- Tasks. kind drives which invoice lines get created further down.
  -- ---------------------------------------------------------------------------
  drop table if exists pg_temp._seed_tasks;
  drop table if exists pg_temp._seed_rates;
  create temporary table _seed_tasks (
    n int, site_code text, site_name text, subcon text, gc text, carrier text,
    market text, project text, mon text, kind text
  ) on commit drop;

  insert into _seed_tasks values
    ( 1, 'NV0142', 'Maple Ridge',        'Cedar Field Crew', 'Northwind Builders',       'Carrier A', 'North Valley',   '5G Upgrade',        'Jun 2026', 'ready'),
    ( 2, 'NV0187', 'Quarry Road',        'Cedar Field Crew', 'Northwind Builders',       'Carrier A', 'North Valley',   '5G Upgrade',        'Jun 2026', 'ready'),
    ( 3, 'NV0203', 'Old Mill Water Tank','BlueLine Tech',    'Northwind Builders',       'Carrier A', 'North Valley',   '5G Upgrade',        'Jul 2026', 'multi'),
    ( 4, 'NV0219', 'Fairview Rooftop',   'BlueLine Tech',    'Northwind Builders',       'Carrier A', 'North Valley',   '5G Upgrade',        'Jul 2026', 'ready'),
    ( 5, 'LS0311', 'Harbor Light',       'Pioneer Rigging',  'Northwind Builders',       'Carrier B', 'Lakeshore',      'New Site Build',    'Jun 2026', 'ready'),
    ( 6, 'LS0324', 'Birch Hollow',       'Pioneer Rigging',  'Northwind Builders',       'Carrier B', 'Lakeshore',      'New Site Build',    'Jul 2026', 'ready'),
    ( 7, 'LS0340', 'Pier Seven',         'Cedar Field Crew', 'Northwind Builders',       'Carrier B', 'Lakeshore',      'New Site Build',    'Aug 2026', 'no_price'),
    ( 8, 'ME0402', 'Union Depot',        'BlueLine Tech',    'Summit Tower Services',    'Carrier A', 'Metro East',     'Antenna Mod',       'Jun 2026', 'ready'),
    ( 9, 'ME0415', 'Garland Avenue',     'BlueLine Tech',    'Summit Tower Services',    'Carrier A', 'Metro East',     'Antenna Mod',       'Jun 2026', 'ready'),
    (10, 'ME0428', 'Foundry Square',     'Pioneer Rigging',  'Summit Tower Services',    'Carrier A', 'Metro East',     'Antenna Mod',       'Jul 2026', 'multi'),
    (11, 'ME0433', 'Kestrel Heights',    'Pioneer Rigging',  'Summit Tower Services',    'Carrier A', 'Metro East',     'Antenna Mod',       'Aug 2026', 'ready'),
    (12, 'CP0507', 'Saltgrass Flats',    'Cedar Field Crew', 'Summit Tower Services',    'Carrier C', 'Coastal Plains', '5G Upgrade',        'Jun 2026', 'ready'),
    (13, 'CP0519', 'Dune Crossing',      'Cedar Field Crew', 'Summit Tower Services',    'Carrier C', 'Coastal Plains', '5G Upgrade',        'Jul 2026', 'ready'),
    (14, 'CP0526', 'Heron Point',        'BlueLine Tech',    'Summit Tower Services',    'Carrier C', 'Coastal Plains', '5G Upgrade',        'Jul 2026', 'no_match'),
    (15, 'NV0611', 'Copper Creek',       'BlueLine Tech',    'Ridgeline Infrastructure', 'Carrier B', 'North Valley',   'Fiber Phase 2',     'Jun 2026', 'ready'),
    (16, 'NV0622', 'Willow Bend',        'Pioneer Rigging',  'Ridgeline Infrastructure', 'Carrier B', 'North Valley',   'Fiber Phase 2',     'Jun 2026', 'ready'),
    (17, 'NV0637', 'Stonebridge',        'Pioneer Rigging',  'Ridgeline Infrastructure', 'Carrier B', 'North Valley',   'Fiber Phase 2',     'Jul 2026', 'blank'),
    (18, 'NV0645', 'Juniper Flats',      'Cedar Field Crew', 'Ridgeline Infrastructure', 'Carrier B', 'North Valley',   'Fiber Phase 2',     'Aug 2026', 'ready'),
    (19, 'ME0708', 'Ironworks Yard',     'Cedar Field Crew', 'Ridgeline Infrastructure', 'Carrier C', 'Metro East',     'Generator Install', 'Jun 2026', 'ready'),
    (20, 'ME0716', 'Canal Street',       'BlueLine Tech',    'Ridgeline Infrastructure', 'Carrier C', 'Metro East',     'Generator Install', 'Jul 2026', 'ready'),
    (21, 'ME0729', 'Telegraph Hill',     'BlueLine Tech',    'Ridgeline Infrastructure', 'Carrier C', 'Metro East',     'Generator Install', 'Jul 2026', 'no_price'),
    (22, 'LS0803', 'Marina Terrace',     'Pioneer Rigging',  'Harbor Point Construction','Carrier A', 'Lakeshore',      'Antenna Mod',       'Jun 2026', 'ready'),
    (23, 'LS0814', 'Lantern Bay',        'Pioneer Rigging',  'Harbor Point Construction','Carrier A', 'Lakeshore',      'Antenna Mod',       'Jul 2026', 'ready'),
    (24, 'LS0827', 'Cobblestone Court',  'Cedar Field Crew', 'Harbor Point Construction','Carrier A', 'Lakeshore',      'Antenna Mod',       'Aug 2026', 'multi'),
    (25, 'CP0905', 'Tidewater Annex',    'Cedar Field Crew', 'Harbor Point Construction','Carrier B', 'Coastal Plains', 'New Site Build',    'Jun 2026', 'ready'),     -- conflicting directory pair
    (26, 'CP0918', 'Pelican Row',        'BlueLine Tech',    'Harbor Point Construction','Carrier B', 'Coastal Plains', 'New Site Build',    'Jul 2026', 'ready'),     -- conflicting directory pair
    (27, 'ME1004', 'Brickyard Lofts',    'BlueLine Tech',    'Northwind Builders',       'Carrier C', 'Metro East',     'Fiber Phase 2',     'Jun 2026', 'ready'),
    (28, 'ME1017', 'Signal Park',        'Pioneer Rigging',  'Northwind Builders',       'Carrier C', 'Metro East',     'Fiber Phase 2',     'Jul 2026', 'ready'),
    (29, 'ME1023', 'Orchard Gate',       'Pioneer Rigging',  'Northwind Builders',       'Carrier C', 'Metro East',     'Fiber Phase 2',     'Aug 2026', 'blank'),
    (30, 'ME1031', 'Whitfield Plaza',    'Cedar Field Crew', 'Northwind Builders',       'Carrier C', 'Metro East',     'Fiber Phase 2',     'Aug 2026', 'no_match'),
    (31, 'LS1102', 'Granite Landing',    'Cedar Field Crew', 'Summit Tower Services',    'Carrier B', 'Lakeshore',      'Generator Install', 'Jun 2026', 'nodir'),
    (32, 'CP1115', 'Sandpiper Ridge',    'BlueLine Tech',    'Ridgeline Infrastructure', 'Carrier A', 'Coastal Plains', 'Antenna Mod',       'Jul 2026', 'nodir'),
    (33, 'NV1128', 'Timberline Pass',    'BlueLine Tech',    'Harbor Point Construction','Carrier C', 'North Valley',   'New Site Build',    'Jul 2026', 'nodir'),
    (34, 'NV1204', 'Ashford Commons',    'Pioneer Rigging',  null,                       'Carrier A', 'North Valley',   '5G Upgrade',        'Jun 2026', 'review'),   -- GC missing from the path
    (35, 'ME1216', 'Bellweather Tower',  null,               'Summit Tower Services',    'Carrier A', null,             'Antenna Mod',       'Jul 2026', 'review'),   -- market missing
    (36, 'ME1229', 'Drover Street',      'Cedar Field Crew', 'Ridgeline Infrastructure', 'Carrier C', 'Metro East',     'Generator Install', 'Aug 2026', 'review'),   -- flagged, verified below
    (37, 'CP1303', 'Gull Harbor',        'Cedar Field Crew', 'Summit Tower Services',    'Carrier C', 'Coastal Plains', '5G Upgrade',        'Aug 2026', 'no_price'),
    (38, 'LS1317', 'Foxglove Meadow',    'BlueLine Tech',    'Northwind Builders',       'Carrier B', 'Lakeshore',      'New Site Build',    'Aug 2026', 'no_match');

  insert into demo.quote_tasks
    (task_did, org_name, project_name, asset_name, asset_id, task_name, task_status,
     subcon, gc, carrier, market, project, fuze_id, needs_review_base)
  select
    'T-' || (1000 + n),
    'Example Co Field Services',
    'FIELD-OPS: ' || upper(replace(market_or_blank, ' ', '-')),
    site_code || ' ' || site_name,
    concat_ws('/', subcon, gc, carrier, market, project, site_code, mon),
    '7. Quote Provided',
    'Quote Provided',
    subcon, gc, carrier, market, project,
    (4100000 + n * 137)::text,
    kind = 'review'
  from (select *, coalesce(market, 'unassigned') as market_or_blank from _seed_tasks) s;

  -- ---------------------------------------------------------------------------
  -- Invoice lines. Base rate per project (invented), nudged per task.
  -- ---------------------------------------------------------------------------
  create temporary table _seed_rates (project text, base numeric, category text, service_type text) on commit drop;
  insert into _seed_rates values
    ('5G Upgrade',        1850, 'Closeout Package - 5G Upgrade',     'Carrier COP'),
    ('New Site Build',    4200, 'Closeout Package - New Site Build', 'Carrier COP'),
    ('Antenna Mod',       1275, 'Closeout Package - Antenna Mod',    'Carrier COP'),
    ('Fiber Phase 2',      950, 'Fiber Closeout - Phase 2',          'Fiber COP'),
    ('Generator Install', 2600, 'Closeout Package - Generator',      'Carrier COP');

  -- One line for every task except 'no_match'. 'no_price' lines carry no rate;
  -- 'blank' lines carry a rate but no category / service type.
  insert into demo.invoice_lines
    (line_key, task_did, form_did, project, site_name, site_id, sow, pricing_type,
     invoice_category, service_type, service_type_others, service_rate,
     ll_cop, landlord, landlord_others, pmi_cop, rf_mitigation_cop, requirement_status)
  select
    'L-' || (1000 + s.n) || '-1',
    'T-' || (1000 + s.n),
    'F-' || (20000 + s.n * 3),
    'FIELD-OPS: ' || upper(replace(coalesce(s.market, 'unassigned'), ' ', '-')),
    s.site_name, s.site_code,
    s.project || ' closeout',
    case when s.kind = 'no_price' then 'Pending' else 'Standard' end,
    case when s.kind = 'blank' then null else r.category end,
    case when s.kind = 'blank' then null else r.service_type end,
    null,
    case when s.kind = 'no_price' then null
         else to_char(r.base + (s.n % 5) * 25, 'FM999,990.00') end,
    case when s.n % 4 = 0 then 'Yes' else 'No' end,
    case when s.n % 4 = 0 then 'Tower Owner One' end,
    null,
    case when s.n % 6 = 0 then 'Yes' else 'No' end,
    'No',
    case when s.kind = 'no_price' then 'in progress' else 'submitted' end
  from _seed_tasks s
  join _seed_rates r using (project)
  where s.kind <> 'no_match';

  -- 'multi' tasks get two more priced options plus one unpriced line.
  insert into demo.invoice_lines
    (line_key, task_did, form_did, project, site_name, site_id, sow, pricing_type,
     invoice_category, service_type, service_rate, ll_cop, pmi_cop, rf_mitigation_cop, requirement_status)
  select
    'L-' || (1000 + s.n) || '-' || x.i,
    'T-' || (1000 + s.n),
    'F-' || (20000 + s.n * 3 + x.i),
    'FIELD-OPS: ' || upper(replace(s.market, ' ', '-')),
    s.site_name, s.site_code, x.sow, x.pricing_type, x.category, x.service_type,
    case when x.mult is null then null else to_char(round(r.base * x.mult, 0), 'FM999,990.00') end,
    'No', 'No', x.rf, x.req
  from _seed_tasks s
  join _seed_rates r using (project)
  cross join (values
    (2, 'Revision after punch walk', 'Standard', 'Closeout Package - Revision',  'Carrier COP',      0.40, 'No',  'submitted'),
    (3, 'RF mitigation add-on',      'Add-on',   'RF Mitigation Closeout',       'RF Mitigation COP', 0.65, 'Yes', 'approved'),
    (4, 'Landlord closeout (open)',  'Pending',  'Landlord Closeout',            'Landlord COP',      null, 'No',  'in progress')
  ) as x(i, sow, pricing_type, category, service_type, mult, rf, req)
  where s.kind = 'multi';

  -- ---------------------------------------------------------------------------
  -- Quote directory: 10 rows, including one conflicting pair (rows 8 and 9).
  -- match_key uses the same normalisation as the app (trim, single spaces, upper).
  -- ---------------------------------------------------------------------------
  insert into reference.ref_quote_directory (gc, carrier, market, project, recipient, cc, textjoin, match_key)
  select d.gc, d.carrier, d.market, d.project, d.recipient, d.cc,
         concat_ws('_', d.gc, d.carrier, d.market, d.project),
         upper(d.gc) || '|' || upper(d.carrier) || '|' || upper(d.market) || '|' || upper(d.project)
  from (values
    ('Northwind Builders',        'Carrier A', 'North Valley',   '5G Upgrade',        'northwind.quotes@example.com',                        'northwind.pm.northvalley@example.com'),
    ('Northwind Builders',        'Carrier B', 'Lakeshore',      'New Site Build',    'northwind.quotes@example.com, northwind.ap@example.com', null),
    ('Summit Tower Services',     'Carrier A', 'Metro East',     'Antenna Mod',       'summit.closeouts@example.com',                           'summit.r.alvarez@example.com'),
    ('Summit Tower Services',     'Carrier C', 'Coastal Plains', '5G Upgrade',        'summit.closeouts@example.com',                           null),
    ('Ridgeline Infrastructure',  'Carrier B', 'North Valley',   'Fiber Phase 2',     'ridgeline.fiber.quotes@example.com',                     'ridgeline.k.osei@example.com'),
    ('Ridgeline Infrastructure',  'Carrier C', 'Metro East',     'Generator Install', 'ridgeline.power.quotes@example.com',                     null),
    ('Harbor Point Construction', 'Carrier A', 'Lakeshore',      'Antenna Mod',       'harborpoint.estimating@example.com',                           'harborpoint.m.lindqvist@example.com'),
    ('Harbor Point Construction', 'Carrier B', 'Coastal Plains', 'New Site Build',    'harborpoint.estimating@example.com',                           null),
    ('Harbor Point Construction', 'Carrier B', 'Coastal Plains', 'New Site Build',    'harborpoint.coastal.pm@example.com',                           null),
    ('Northwind Builders',        'Carrier C', 'Metro East',     'Fiber Phase 2',     'northwind.fiber@example.com',                         'northwind.quotes@example.com')
  ) as d(gc, carrier, market, project, recipient, cc);

  -- ---------------------------------------------------------------------------
  -- App state: templates, a shared send identity, the demo user's fake mailbox
  -- ---------------------------------------------------------------------------
  insert into app_quote.email_templates (name, subject, body_html, updated_by) values
    ('Standard quote',
     'Quote for {{asset_name}} - {{project}}',
     '<p>Hello,</p><p>Please find attached our quote for <strong>{{asset_name}}</strong> ({{carrier}}, {{market}}).</p>'
       || '<p>Service: {{product_service}}<br>Amount: ${{service_rate}}</p>'
       || '<p>Let us know if anything needs to change.</p><p>Thank you,<br>Example Co Accounting</p>',
     demo_user),
    ('Follow-up',
     'Following up: quote for {{asset_name}}',
     '<p>Hello,</p><p>Following up on the quote for <strong>{{asset_name}}</strong> sent on {{send_date}}. '
       || 'The PDF is attached again for convenience.</p><p>Thank you,<br>Example Co Accounting</p>',
     demo_user);

  insert into app_quote.send_identities (name, email, scope, owner_email, created_by) values
    ('Example Co Quotes', 'quotes@example.com', 'shared', null, demo_user);

  -- Not a real token. In demo mode the Gmail layer never decrypts or uses it.
  insert into app_quote.gmail_connections (email, refresh_token_enc, connected_by, status) values
    (demo_user, 'demo-mode-no-token', demo_user, 'active');

  insert into app_quote.user_settings (user_email, active_sender_email, theme) values
    (demo_user, demo_user, 'ledger');

  -- ---------------------------------------------------------------------------
  -- Overrides: one verified review task, one chosen option, one multi-line quote
  -- ---------------------------------------------------------------------------
  insert into app_quote.overrides (task_did, verified, verified_by, verified_at, updated_by, updated_at) values
    ('T-1036', true, demo_user, now() - interval '3 days', demo_user, now() - interval '3 days');
  insert into app_quote.overrides (task_did, chosen_line_key, updated_by, updated_at) values
    ('T-1010', 'L-1010-3', demo_user, now() - interval '3 days');
  insert into app_quote.overrides (task_did, line_items, updated_by, updated_at) values
    ('T-1020',
     '[{"product": "Closeout Package - Generator", "qty": 1, "rate": 2600},
       {"product": "Fuel system inspection report", "qty": 2, "rate": 180}]'::jsonb,
     demo_user, now() - interval '3 days');

  -- ---------------------------------------------------------------------------
  -- Generated quotes + Outbox rows in every status.
  -- Demo PDFs are re-rendered on request by /api/quote-pdf (no Drive, no storage).
  -- Recipients show the test-mode redirect (all mail -> dev@example.com).
  -- ---------------------------------------------------------------------------
  insert into app_quote.generated (task_did, drive_file_id, drive_link, generated_by, generated_at)
  select t, 'demo-' || t, '/api/quote-pdf?task_did=' || t || '&inline=1', demo_user, now() - interval '2 days'
  from unnest(array['T-1001', 'T-1005', 'T-1008', 'T-1012', 'T-1015', 'T-1019', 'T-1022']) as t;

  insert into app_quote.email_queue
    (task_did, sender_email, from_email, gmail_draft_id, scheduled_at, status, subject_resolved,
     to_resolved, cc_resolved, template_name, created_by, created_at, sent_at, gmail_message_id, error)
  values
    ('T-1001', demo_user, 'quotes@example.com', 'demo-draft-1', now() - interval '1 day', 'sent',
     '[TEST] Quote for NV0142 Maple Ridge - 5G Upgrade', 'dev@example.com', null, 'Standard quote',
     demo_user, now() - interval '2 days', now() - interval '1 day', 'demo-msg-1', null),
    ('T-1005', demo_user, 'quotes@example.com', 'demo-draft-2', now() - interval '1 day', 'sent',
     '[TEST] Quote for LS0311 Harbor Light - New Site Build', 'dev@example.com', null, 'Standard quote',
     demo_user, now() - interval '2 days', now() - interval '1 day', 'demo-msg-2', null),
    ('T-1008', demo_user, null, 'demo-draft-3', now() + interval '2 days', 'scheduled',
     '[TEST] Quote for ME0402 Union Depot - Antenna Mod', 'dev@example.com', null, 'Standard quote',
     demo_user, now() - interval '1 day', null, null, null),
    ('T-1012', demo_user, null, 'demo-draft-4', now() - interval '1 day', 'failed',
     '[TEST] Quote for CP0507 Saltgrass Flats - 5G Upgrade', 'dev@example.com', null, 'Standard quote',
     demo_user, now() - interval '2 days', null, null, 'Example failure: mailbox send limit reached'),
    ('T-1015', demo_user, null, 'demo-draft-5', now() + interval '1 day', 'cancelled',
     '[TEST] Quote for NV0611 Copper Creek - Fiber Phase 2', 'dev@example.com', null, 'Follow-up',
     demo_user, now() - interval '1 day', null, null, 'cancelled by demo@example.com');
end;
$fn$;

revoke all on function demo.load_seed() from public, anon, authenticated;

select demo.load_seed();
