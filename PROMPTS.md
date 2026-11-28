# PROMPTS.md - the original request and every prompt used

Use this to go back. Sections A to F are what was given to the **Supabase AI assistant** (in the order they were used). Section G is **new and not yet run** (Slack alerts). Always start a prompt with "Show me the SQL first. Do not run it until I confirm." and read the SQL before confirming.

Approximate dates: P1 ~Nov 16-17 2026, P3 ~Nov 17-19, P4 ~Nov 19-20 (see README, "How dates are given").

---

## A. The original request (your words, first message, P1)

> We require a streamlined interface featuring a notification badge that tracks pending tasks, such as external order entries. Upon clicking a designated link, users should be prompted to log order details, including Order ID, SKU (as a composite primary key), arrival dates, lead times, quantities, and comprehensive unit costs. The system should incorporate a dashboard with line graphs for visualizing order volume and expenditures, supporting granular filtering by SKU and date range. Furthermore, we need an automated notification logic: initial orders will serve as baseline lead time data, while subsequent orders exceeding the lead time plus a two-day threshold will trigger an alert. The overarching objective is to maintain visibility into inventory spend and consumption. The solution must be cross-platform compatible and support site-specific QR code scanning to facilitate real-time inventory management at individual sub-locations.

**What changed from this request, and why (summary):** "initial order = baseline" became a rolling average of the last 3 arrived orders per SKU and supplier (D3); "Order ID + SKU composite key" became an order header table plus order lines keyed on order + SKU (D1, D12); "cross-platform" became a responsive website (no native apps).

**Instructions you gave Claude later (summary, in order):** a separate unit-order table; SKU-level tracking with inventory records per delivery; answers to the open questions (rolling average of 3, suppliers table, USD, individual logins with manager-created users, no offline, Slack or email alerts, no photos, no import, first delivery counts for lead time, usage not tied to deliveries); dashboard wishes (line chart of orders, bar chart of top 5, flag the heaviest usage weeks); a QA plan; HTML files for GitHub plus connection steps; popups on screen; Enter key on every button; delete and edit everywhere; order history; profile menu on the right; one HTML file per tab; receipt scanning (Amazon screenshot, store photo, pasted email or PDF); Slack walkthrough; extremely commented code and these documents.

---

## B. Build brief (P1-P2)

The full plain-English schema written for the Supabase AI is the Claude document **"Supabase Build Brief: Order Tracking and Inventory"**: https://claude.ai/artifact/EoSutgNUe6twkiKNvdVVRf . It was pasted one Part at a time (Part 1 tables, 2 rules, 3 views, 4 functions, 5 users and security, 6 alert tables, 7 indexes) with checks from Part 9. **Outcome:** the AI built tables using capital letters, typos and text/bigint choices that differed from the brief, which led to prompt C.

---

## C. Fix-up prompt (P3) - rename and correct the schema

> Show me the SQL first. Do not run it until I confirm. Rename rather than recreate; keep all existing tables and views. (1) Rename every table and column to lowercase snake_case: SUPPLIERS to suppliers, STORE_SITES to sites, SKU to skus, APP_SETTINGS to app_settings, ORDERS to orders, ORDER_LINES to order_lines, INVENTORY to inventory_records, USAGE_EVENTS to usage_events, PENDING_TASKS to pending_tasks, SKU_BASELNE_OVERRIDES to sku_baseline_overrides. Fix these column names: SUPPLIER_NAME to name, SUPPLIER_NOTES to notes (make it optional), SITE_NANAME to name, SKU_DESCRIPTION to description, ALER_GRACE_DAYS to alert_grace_days, SET_BUY to set_by, ORDER_LINES_ID to order_line_id. (2) Add order_number text not null to orders, unique together with supplier_id. Add sku_code text not null unique to skus. Add site_code text not null unique to sites, allowing only lowercase letters, digits and hyphens. (3) In orders, make supplier_id, site_id and order_date required, and remove the default on order_date. (4) In order_lines, make order_id, quantity_ordered and unit_price required; make the other unit costs required with default 0; add checks that quantity_ordered is above 0 and every cost is 0 or more; add a unique constraint on (order_id, sku_id); add stored generated columns landed_unit_cost (unit_price + unit_freight + unit_duty + unit_other) and line_spend (round((unit_price + unit_freight + unit_duty + unit_other) * quantity_ordered, 2)). (5) In inventory_records, make quantity_received required and above 0, and replace the two separate foreign keys with one composite foreign key on (order_id, sku_id) to order_lines. (6) In usage_events, make site_id, sku_id, event_type and quantity_change required; event_type must be use, waste or adjustment; quantity_change cannot be 0; for use and waste it must be negative. (7) In pending_tasks, make status required with default 'open' and allow only open or done; add completed_order_id as an optional link to orders. (8) Change the defaults of created_by, recorded_by and set_by from gen_random_uuid() to auth.uid(), and link them to auth.users. (9) In app_settings, allow only one row, make alert_grace_days required with default 2 and 0 or more, and make sure the one row exists. (10) Afterwards, check that all five views still work, and tell me which triggers, functions and indexes from the brief already exist.

**Known side effect:** step (5) removed the direct link from `inventory_records` to `orders`. That broke an embedded query in the first site page ("Could not find a relationship between inventory_records and orders") and is why `history.html` and `site.html` fetch deliveries in a separate query.

## D. Stale names in the delivery trigger (P3)

Symptom: saving a delivery failed with `relation "public.Orders" does not exist`.

> Show me the SQL first. Do not run it until I confirm. Some functions and triggers still use old table names, and saving a row in inventory_records fails with: relation "public.Orders" does not exist. (1) List every function, trigger and view in the public schema whose definition mentions an old name such as Orders, ORDERS, INVENTORY, SKU, STORE_SITES, SUPPLIERS, ORDER_LINES, USAGE_EVENTS or PENDING_TASKS, in any capitalization. (2) Rewrite each one to use the current lowercase names (orders, inventory_records, skus, sites, suppliers, order_lines, usage_events, pending_tasks) without changing what it does. (3) The trigger on inventory_records must refuse a delivery when its arrival_date is earlier than the order_date of the order with the same order_id, with the message: Arrival date cannot be earlier than the order date. (4) Then run a test insert into inventory_records inside a rolled-back transaction to prove saving works, and reload the API schema cache.

## E. Rebuild the three alert views (P3)

Symptom: no lead-time alerts. (Cause was partly the data - only 2 arrived orders - and partly old view definitions.)

> Show me the SQL first. Do not run it until I confirm. Before changing anything, show me the current definitions of v_order_line_status, v_sku_baseline and v_lead_time_alerts and the rows each one returns now. Then rebuild all three with security_invoker on, using the current table names. (1) v_order_line_status: one row per order_lines row with order_id, sku_id, supplier_id and site_id from orders, order_date, first_arrival_date (earliest arrival_date in inventory_records with the same order_id and sku_id), quantity_received (sum, 0 if none) and lead_time_days (first_arrival_date minus order_date, empty if nothing arrived). (2) v_sku_baseline: one row per order line with order_id, sku_id, supplier_id and baseline_days. baseline_days is the average lead_time_days of the 3 most recent other order lines for the same sku_id and the same supplier_id that have arrived and whose order_date is earlier than this line's order_date (break ties by order_id). It is empty if fewer than 3 exist. If sku_baseline_overrides has a row for that sku_id and supplier_id, use its baseline_days instead. (3) v_lead_time_alerts: every order line with a baseline_days where either it has arrived and lead_time_days is greater than baseline_days plus alert_grace_days from app_settings (alert_status 'arrived late'), or nothing has arrived and current_date minus order_date is greater than baseline_days plus alert_grace_days (alert_status 'in transit overdue'). Columns: order_id, order_number, sku_id, sku_code, supplier_id, supplier name, days (the lead time, or days waiting so far), baseline_days, days_over, alert_status. Afterwards show me the rows from all three views.

**Verified outcome (Nov 19-20 screenshot):** alerts for T-004 (arrived late, 3 over) and T-005 (in transit overdue, about 8.3 over).

## F. Security, login and test-data prompts (P3)

**F1 - users, roles and Row Level Security (Part 5):**

> Show me the SQL first. Do not run it until I confirm. Do not change any existing tables. Create profiles: user_id uuid primary key references auth.users on delete cascade, display_name text, role text not null with a check that it is admin, purchaser or site_staff. Create site_assignments: user_id uuid references auth.users on delete cascade, site_id bigint references sites(site_id), primary key on the pair. Create a helper function app_role() that returns the signed-in user's role from profiles, set to run with elevated rights so the policies do not loop. Add row level security policies for signed-in users only: admin can read, add, change and delete on every table; purchaser can read every table and add, change and delete on suppliers, skus, sites, orders, order_lines, inventory_records and pending_tasks; site_staff can read sites and skus, and read orders, order_lines, inventory_records and usage_events only for sites in their site_assignments, and add usage_events and inventory_records only for those sites. Every signed-in user can read their own row in profiles. Anonymous visitors get nothing. Make sure the five views run with the caller's permissions.

**F2 - let each user read their own profile (needed so the app can load the role):**

> Show me the SQL first. Do not run it until I confirm. Add a row level security policy on profiles that lets every signed-in user read their own row (where user_id equals their own user ID). Do not change any other policies.

**F3 - one-off clean-up of TEST data only (do not reuse on real data):**

> Show me the SQL first. Do not run it until I confirm. Run everything as one transaction, and if any step affects an unexpected number of rows, roll back and tell me. Make these data fixes, using only the order number and order date to identify rows: 1. Delete the order with order_number T-001 and order_date 2026-11-17, along with its order lines and any inventory records. This is a test order for a second supplier. Do not touch the T-001 order dated 2026-01-01. 2. The T-001 order dated 2026-01-01 has two identical inventory_records rows (arrival_date 2026-01-11, quantity_received 100). Keep the one with the lowest inventory_id and delete the other. 3. Insert one inventory_records row for the order T-003 (order_date 2026-03-01), its TEST-1 line, with arrival_date 2026-03-15 and quantity_received 100. 4. Insert one inventory_records row for the order T-004 (order_date 2026-04-01), its TEST-1 line, with arrival_date 2026-04-16 and quantity_received 100. 5. Leave created_by empty on the new rows. Afterwards, show me every inventory_records row with its order_number, then the rows of v_sku_baseline and v_lead_time_alerts.

---

## G. Slack alerts (NOT YET RUN - written Nov 20, P4)

Prerequisites: stages 1-9 pass; a Slack app exists with scopes `chat:write` and `channels:read` (plus `groups:read` for private channels), is installed, and its bot is invited to the channel.

**G1 - Step 7, the secret.** Secrets never go in a prompt, a table, a file or a chat. Add the Slack bot token (starts `xoxb-`) yourself in the Supabase dashboard, under Edge Functions, in the secrets section, with the name `SLACK_BOT_TOKEN`. Then, if you want the assistant to confirm the location, paste exactly this (it asks for nothing secret):

> Do not ask me for any secret values and do not put any token in SQL or in code. I will add an Edge Function secret named SLACK_BOT_TOKEN myself in the Supabase dashboard. Tell me exactly where in the dashboard to add Edge Function secrets, and confirm how an Edge Function reads a secret named SLACK_BOT_TOKEN from its environment.

**G2 - tables:**

> Show me the SQL first. Do not run it until I confirm. Do not change any existing tables. Create alert_recipients: recipient_id bigint identity primary key, name text not null, group_name text, channel text not null check in ('slack','email'), destination text not null, slack_channel_id text, is_active boolean not null default true, created_at timestamptz default now(). Create alert_notifications: notification_id bigint identity primary key, order_id bigint not null, sku_id bigint not null, alert_status text not null check in ('arrived late','in transit overdue'), recipient_id bigint not null references alert_recipients, sent_at timestamptz default now(); add a composite foreign key on (order_id, sku_id) referencing order_lines (order_id, sku_id) and a unique constraint on (order_id, sku_id, alert_status, recipient_id). Turn on row level security on both tables and allow only users whose profiles.role is admin to read and write them.

**G2b - the recipient row (Nov 21 2026; channel ID is not a secret):**

> Show me the SQL first. Do not run it until I confirm. Insert one row into alert_recipients with name 'Slack alerts channel', group_name 'back of house', channel 'slack', destination 'C0CKPDZQUJX', slack_channel_id 'C0CKPDZQUJX' and is_active true. Do not change any other rows or tables.

**G3 - the sending function:**

> Show me the code first. Do not deploy it until I confirm. Create a Supabase Edge Function called send-alerts. It uses the admin access that Edge Functions already have (do not ask me to paste any key) to read every row of v_lead_time_alerts and every active row of alert_recipients where channel is 'slack'. For each alert and recipient pair that has no row in alert_notifications (same order_id, sku_id, alert_status and recipient_id), post one message with Slack's chat.postMessage, using the secret SLACK_BOT_TOKEN as a Bearer token, to slack_channel_id when it is set and otherwise to the destination. The message names the order_number, sku_code, supplier_name, the days, the baseline_days and the days_over. After a successful post (Slack's response has ok true), insert the row into alert_notifications. If a post fails, continue with the rest and return the failures with Slack's error text. Support a dry-run request parameter that returns what it would send without sending or inserting anything. Read secrets from environment variables only.

**G4 - schedule:**

> Schedule the send-alerts function to run once a day at 8:00 AM Central time, using Supabase's scheduled jobs. Show me how to turn the schedule off.

**G5 - tests (do in order):** add one recipient row (channel slack, destination your test channel name, its channel ID); call the function in **dry-run** (it should list the T-004 and T-005 alerts and send nothing); call it for real (one Slack message per alert and one `alert_notifications` row each); call it again at once (**no new messages**); deactivate the recipient and confirm nothing is sent. If the second real run sends duplicates, stop before scheduling anything.

---

## I. Accounts and People (P5, ~Nov 21 2026 - written, not yet run)

Order matters: run **I1 before** uploading the new `app.js`/`account.html`/`people.html`, deploy **I2**, then upload the files.

**I1 - database: new profile columns, last-login function, locked-down policies**

> Show me the SQL first. Do not run it until I confirm. Do not change any other tables, views or policies except where stated. (1) Add these columns to profiles: username text, first_name text, last_name text, position text, employment_date date, is_active boolean not null default true, last_login timestamptz. Add a unique index on lower(username) that ignores empty values, and a check that username, when present, is 3 to 20 characters of lowercase letters, digits, dots, dashes or underscores. (2) Create a function record_login() that sets last_login to now() on the profiles row whose user_id equals auth.uid(), runs as security definer with search_path set to public, returns nothing, and can be executed only by signed-in users (revoke execute from public and anon). (3) Show me the current policies on profiles first. Then make sure row level security on profiles works like this: every signed-in user can read their own row; users whose role in profiles is 'admin' can read, insert, update and delete every row; nobody else can update any row, so a user cannot change their own role, is_active or last_login. Use the existing app_role() helper if it exists. Anonymous visitors get no access to profiles. (4) First show me how many profiles rows have role 'admin'. If it is not exactly 1, stop and tell me. If it is 1, set first_name 'Dean', last_name 'Marko' and username 'dean' on that row. (5) Afterwards show me the columns of profiles and the policies on profiles.

**I2 - Edge Function `manage-users`** (Edge Functions > Deploy a new function > Via AI Assistant; read the code before deploying)

> Create a Supabase Edge Function called manage-users. Show me the code before deploying. It receives a JSON POST with an 'action'. Answer OPTIONS requests and add CORS headers so a browser can call it (allow the Authorization, apikey, x-client-info and content-type headers). Security: first read the caller's Authorization header, use it to create a client that acts as the caller, and read the caller's own row in profiles; refuse with HTTP 403 and {error:'Admins only'} unless role is 'admin' and is_active is true. Only after that use the admin access that Edge Functions already have (do not ask me to paste any key). Actions: (a) create, with inputs email, username, password, first_name, last_name, position, employment_date and role. Validate: username 3 to 20 lowercase letters, digits, dots, dashes or underscores; password at least 8 characters; role one of admin, purchaser, site_staff; first and last name not empty. Create the auth user with email_confirm true. Then insert a profiles row with user_id, username, first_name, last_name, display_name (first name, a space, last name), position, employment_date, role and is_active true. If the profile insert fails, delete the new auth user again and return the error. Return {ok:true, user_id}. (b) reset_password, with inputs user_id and password (at least 8 characters): set that user's password. (c) set_active, with inputs user_id and active (true or false): set profiles.is_active, and ban the auth user for 876000 hours when active is false or remove the ban when true; refuse to turn off the caller's own account. For every failure return a JSON body {error:'plain English message'} with a suitable status code; for a duplicate username say 'That username is already taken'. Never log or return passwords.

**I3 - checks after both:** create a person called testuser1 (site staff) on the People page; sign in as `testuser1` with the temporary password; confirm Last sign-in fills in; turn the account off and confirm sign-in is refused; reset the password and confirm the new one works. If creating fails with an error about the email address, change `AUTH_DOMAIN` in `config.js` (see the comment there).

---

## J. AI usage log table (P5, ~Nov 21 2026 - written, not yet run)

Run before expecting the "Receipt scanner usage" card on the dashboard. The pages work without it (they simply log nothing and hide the card).

> Show me the SQL first. Do not run it until I confirm. Do not change any existing tables. Create ai_usage_log: id bigint identity primary key, created_at timestamptz not null default now(), created_by uuid default auth.uid() references auth.users on delete set null, event text not null check in ('prompt_copied','receipt_saved'), source text not null default 'copy_paste' check in ('copy_paste','api'), receipt_type text, supplier_name text, items_count integer, order_id bigint references orders on delete set null, input_tokens integer, output_tokens integer, cost_usd numeric(10,4). Add an index on created_at. Turn on row level security. Policies: any signed-in user may insert a row only when created_by equals their own user id; users whose role in profiles is 'admin' can read, update and delete every row; nobody else can read anything; anonymous visitors get nothing.

**Why `on delete set null` on order_id:** deleting an order in the app must never be blocked by a usage-log row.

---

## K. Receipt learning tables (P5, ~Nov 21 2026 - written, not yet run)

Run before expecting the app to remember your item and supplier choices. Without it the scan page works as before and just learns nothing.

> Show me the SQL first. Do not run it until I confirm. Do not change any existing tables. Create three tables. receipt_scans: id bigint identity primary key, created_at timestamptz not null default now(), created_by uuid default auth.uid() references auth.users on delete set null, receipt_type text, supplier_raw text, supplier_id bigint references suppliers on delete set null, order_id bigint references orders on delete set null, items_count integer, original jsonb, edits jsonb, fields_changed integer, matched_total integer, matched_correct integer. item_aliases: id bigint identity primary key, supplier_id bigint not null references suppliers on delete cascade, alias text not null, sku_id bigint not null references skus on delete cascade, updated_at timestamptz not null default now(), with a unique constraint on (supplier_id, alias); also make updated_at refresh to now() on every update. supplier_aliases: id bigint identity primary key, alias text not null unique, supplier_id bigint not null references suppliers on delete cascade, created_at timestamptz not null default now(). Turn on row level security on all three. Policies: users whose role in profiles is 'admin' or 'purchaser' can read, insert and update item_aliases and supplier_aliases; only 'admin' can delete from them; for receipt_scans, admin can read all rows and purchasers can read only rows where created_by equals their own user id, and both can insert rows only where created_by equals their own user id; only admin can update or delete receipt_scans. Site staff and anonymous visitors get no access to any of the three.

## L. Make send-alerts answer in a fixed shape and admins-only (P5 - written, not yet run)

The dashboard's Send to Slack buttons call `send-alerts`. Paste this into the Edge Function's AI assistant to update it (read the code before deploying).

> Update the Edge Function send-alerts. Show me the code before deploying. (1) Before doing anything, check the caller like the manage-users function does: read the Authorization header, act as the caller, read the caller's own profiles row, and refuse with HTTP 403 and {error:'Admins only'} unless role is 'admin' and is_active is true. (2) Always answer with JSON in exactly this shape: {mode:'test' or 'dry_run' or 'live', sent: a number of messages posted, already_sent: a number of alert and recipient pairs skipped because they were already in alert_notifications, failures: a list of {order_number, error} where error is Slack's error text}. For failures with no order (test mode) leave order_number empty. (3) Keep everything else the same, including test and dry_run, the SLACK_BOT_TOKEN secret and inserting into alert_notifications only after Slack says ok. Never log or return the token.

## M. How to test the learning loop (checks, P5)

Use the made-up receipt in the README testing notes or any real one. Scan the same supplier twice: the first time items show "Not found" or "Best guess"; after saving, the second scan must show "Matched from your past choices" and preselect the SKU and supplier. Check the tables `receipt_scans`, `item_aliases`, `supplier_aliases` in the Table Editor for new rows.

---

## N. Stock-level alerts: database (P5, ~Nov 21 2026 - written, not yet run)

Defines "percent used" and the alert levels. Run this BEFORE section O.

**Definition used:** percent used = what has been used since the LAST DELIVERY at that site, as a share of the stock you had right after that delivery. 100% = used up (on hand 0 or less). When new stock arrives the count starts again by itself, and the alerts can fire again. Levels default to **50, 75 and 100** and live in `app_settings` (stock_alert_1..3) so they can be changed without code.

> Show me the SQL first. Do not run it until I confirm. Do not change any existing tables except where stated. (1) Add three integer columns to app_settings: stock_alert_1 default 50, stock_alert_2 default 75 and stock_alert_3 default 100, each required and between 1 and 100, and set them on the existing row. (2) Create a view v_stock_levels with security_invoker on, one row per site and SKU that has at least one delivery in inventory_records. Take the site from the order of each delivery. Columns: site_id, site_name, sku_id, sku_code, description, last_delivery_id (the highest inventory_id for that site and SKU), last_delivery_date (the latest arrival_date), received_total (sum of quantity_received), on_hand (received_total plus the sum of usage_events.quantity_change for that site and SKU, counting 0 if none), used_since_delivery (the sum of the negated quantity_change of usage_events of type 'use' or 'waste' for that site and SKU whose created_at date is on or after last_delivery_date, 0 if none), reference_stock (on_hand plus used_since_delivery), and percent_used: 100 when on_hand is 0 or less, otherwise 100 times used_since_delivery divided by reference_stock, never below 0 and never above 100. (3) Create a table stock_alerts_sent: id bigint identity primary key, site_id bigint not null references sites on delete cascade, sku_id bigint not null references skus on delete cascade, threshold integer not null, cycle_key bigint not null, recipient_id bigint not null references alert_recipients on delete cascade, sent_at timestamptz not null default now(), silent boolean not null default false, with a unique constraint on (site_id, sku_id, threshold, cycle_key, recipient_id). Turn on row level security on it and allow only users whose role in profiles is 'admin' to read and write. (4) Create a view v_stock_alerts_due with security_invoker on: for each row of v_stock_levels, the highest threshold among app_settings stock_alert_1, stock_alert_2 and stock_alert_3 that percent_used has reached or passed, as column threshold, plus site_id, site_name, sku_id, sku_code, description, percent_used, on_hand, reference_stock, last_delivery_date and cycle_key (equal to last_delivery_id). Only include rows where at least one threshold has been reached. (5) Afterwards show me all rows of v_stock_levels and v_stock_alerts_due.

## O. send-alerts: whole-number messages and stock alerts (P5 - written, not yet run)

Replaces the earlier section L. Run after N. Read the code before deploying.

> Update the Edge Function send-alerts. Show me the code before deploying. (1) Number format: in every message show days, baseline and days over as whole numbers rounded DOWN (Math.floor), for example: 'Order T-005: TEST-1 from Test Supplier A; 23 days, baseline 13 days, 9 days over.' Keep the rest of that message as it is today. (2) Stock alerts: after the lead-time alerts, read every row of v_stock_alerts_due and use the same active slack recipients. For each row and recipient, skip it if stock_alerts_sent already has a row with the same site_id, sku_id, threshold, cycle_key and recipient_id. Otherwise post one message and then insert that row into stock_alerts_sent. For every lower threshold (among the three in app_settings, below this row's threshold) that has no row yet for this recipient and cycle, also insert a row with silent true and post nothing, so lower alerts never fire later in the same cycle. Message wording by threshold: the first level 'Heads up: SKU CODE (description) at SITE is N% used, X left since the delivery on DATE.'; the second level 'Running low: ...' with the same details; the third level (100) 'USED UP: SKU CODE (description) at SITE is out of stock.' Show N and X as whole numbers rounded down. (3) test and dry_run keep working for both kinds of alert; dry_run lists what both kinds would send. (4) Always answer with JSON {mode:'test' or 'dry_run' or 'live', sent: number of lead-time messages posted, already_sent: number of lead-time pairs skipped, stock_sent: number of stock messages posted, stock_already_sent: number of stock pairs skipped, failures: a list of {order_number, error}} where order_number may hold a SKU code for stock failures. (5) Keep the admin-only check, the SLACK_BOT_TOKEN secret handling and posting before inserting. Never log or return the token.

**Why whole numbers can look 1 off:** flooring each number separately gives "23 days, baseline 13 days, 9 days over" (23 - 13 = 10). That is what was asked for. If you prefer numbers that add up, say "round to the nearest whole number" instead of Math.floor: 23 days, baseline 14 days, 9 days over.

## P. Make the Slack messages AUTOMATIC (P5 - written, not yet run)

Purpose: the app posts to Slack by itself every day, so nobody has to open the dashboard. The Send to Slack button stays as a manual backup. A schedule has no signed-in user, so the function must also accept a secret header from the scheduler. Add a secret named `CRON_SECRET` in Edge Functions > Secrets yourself (any long random text); never paste its value into a prompt.

> Update the Edge Function send-alerts so that, besides an admin caller, it also accepts a request that carries the header x-cron-secret equal to the Edge Function secret CRON_SECRET (I will add that secret in the dashboard myself; do not ask me for its value). Everything else stays the same. Show me the code before deploying. Then schedule it: create a scheduled job that runs once a day at 8:00 AM Central time and calls send-alerts in live mode (no test, no dry_run) with the x-cron-secret header. Show me exactly how the job gets the secret (use Supabase Vault if it is available, and ask me before adding anything), and show me how to see the job's recent runs and how to turn the schedule off.

---

## H. Receipt prompt (P4)

The prompt that `scan.html` gives you to paste into claude.ai lives in the code: constants `SCHEMA` and `rpt` in `scan.html`. Changing the JSON shape there requires changing `review()` in the same file.
