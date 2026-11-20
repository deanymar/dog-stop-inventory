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

**G3 - the sending function:**

> Show me the code first. Do not deploy it until I confirm. Create a Supabase Edge Function called send-alerts. It uses the admin access that Edge Functions already have (do not ask me to paste any key) to read every row of v_lead_time_alerts and every active row of alert_recipients where channel is 'slack'. For each alert and recipient pair that has no row in alert_notifications (same order_id, sku_id, alert_status and recipient_id), post one message with Slack's chat.postMessage, using the secret SLACK_BOT_TOKEN as a Bearer token, to slack_channel_id when it is set and otherwise to the destination. The message names the order_number, sku_code, supplier_name, the days, the baseline_days and the days_over. After a successful post (Slack's response has ok true), insert the row into alert_notifications. If a post fails, continue with the rest and return the failures with Slack's error text. Support a dry-run request parameter that returns what it would send without sending or inserting anything. Read secrets from environment variables only.

**G4 - schedule:**

> Schedule the send-alerts function to run once a day at 8:00 AM Central time, using Supabase's scheduled jobs. Show me how to turn the schedule off.

**G5 - tests (do in order):** add one recipient row (channel slack, destination your test channel name, its channel ID); call the function in **dry-run** (it should list the T-004 and T-005 alerts and send nothing); call it for real (one Slack message per alert and one `alert_notifications` row each); call it again at once (**no new messages**); deactivate the recipient and confirm nothing is sent. If the second real run sends duplicates, stop before scheduling anything.

---

## H. Receipt prompt (P4)

The prompt that `scan.html` gives you to paste into claude.ai lives in the code: constants `SCHEMA` and `rpt` in `scan.html`. Changing the JSON shape there requires changing `review()` in the same file.
