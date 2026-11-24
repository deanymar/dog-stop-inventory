# Order Tracker (The Dog Stop inventory) - README

Everything you need to understand, rebuild or hand this project to a software engineer.
Companion files: **CODE_MAP.md** (where every piece of logic lives and what to check when something breaks) and **PROMPTS.md** (the original request and every prompt given to the Supabase AI, word for word).

> **How dates are given.** The whole project was built in one conversation with Claude between roughly **Nov 16 and Nov 20, 2026**. Exact timestamps were not recorded, so decisions are tagged with a phase and an approximate date:
> **P1** planning and data model (~Nov 16-17) - **P2** first working app (~Nov 17) - **P3** fixes from your QA testing (~Nov 17-19) - **P4** page split, on-screen popups, receipt page (~Nov 19-20).
> Treat the dates as approximate; the order of events is reliable.

---

## 1. What this is

A small web app for tracking supplier orders and stock at physical locations.

- Log orders (one order = a header plus one line per product) with full unit costs.
- Record deliveries (partial deliveries are supported) and usage at each site.
- A red **Tasks** badge counts orders placed outside the system that still need logging.
- A dashboard shows orders and spend over time, top 5 SKUs, weekly usage (3 heaviest weeks flagged) and **lead-time alerts**.
- Each site has a QR code. Scanning it opens that site's page to record usage and deliveries.
- Order history, editing, deleting, and a **Scan receipt** page (copy-and-paste route using claude.ai) exist.

**Alert rule (the heart of the system).** For each SKU **and supplier**, the baseline lead time is the average lead time of the **3 most recent earlier orders that have arrived**. An order alerts when its lead time (or, if not yet arrived, the days it has been waiting) is **more than baseline + 2 days**. Fewer than 3 arrived orders = no baseline = no alert. The 2 days is `app_settings.alert_grace_days`.

## 2. Accounts and addresses (none of these are secrets)

| Thing | Value |
|---|---|
| GitHub repository | https://github.com/deanymar/dog-stop-inventory (public) |
| Live site (GitHub Pages) | https://deanymar.github.io/dog-stop-inventory/ |
| Supabase project URL | https://mksihwrogjvvldttlovv.supabase.co |
| Planning document | https://claude.ai/artifact/KgK9ej5f57MgpsdF2YSmC8 |
| Supabase build brief | https://claude.ai/artifact/EoSutgNUe6twkiKNvdVVRf |
| QA test plan | https://claude.ai/artifact/1cf8eqHbxdbgPSyNYqsf1L |

**Not stored anywhere in this repository (keep it that way):** the Supabase **secret** key, any Slack bot token, any Anthropic API key. The publishable key in `config.js` is public by design and is protected by Row Level Security.

## 3. Architecture

```
 Phone / laptop browser
   |  loads static files (HTML, CSS, JS) from GitHub Pages   <- no server code of ours
   |  runs the JavaScript in the page
   v
 supabase-js (library, loaded from jsDelivr CDN)
   |  HTTPS + the signed-in user's login token
   v
 Supabase project:  Auth (logins)  +  Postgres database  +  Row Level Security (who may see/change what)

 Planned, not built yet:  Supabase Edge Function (daily check) -> Slack message
```

**Why this shape [P2].** You wanted HTML files you could put on GitHub and connect to Supabase. A static site has nothing to host or patch. All real protection is in Supabase's Row Level Security, because anything in the browser can be read by a visitor.

## 4. Files (put all at the top level of the repo)

| File | Page / role |
|---|---|
| `index.html` | Dashboard (home) |
| `log.html` | Log order |
| `scan.html` | Scan receipt (copy and paste route) |
| `history.html` | Order history, edit and delete orders |
| `tasks.html` | Pending tasks (the badge) |
| `sites.html` | Sites and QR labels |
| `setup.html` | Suppliers and SKUs |
| `site.html` | Site page opened by QR code: stock, usage, deliveries |
| `account.html` | Your details (read-only) and change password |
| `people.html` | People (admin only): add, edit, reset password, turn off |
| `app.js` | Shared code used by every page |
| `style.css` | All styling |
| `config.js` | Supabase URL and publishable key (the only file to edit when moving projects) |
| `README.md`, `CODE_MAP.md`, `PROMPTS.md` | Documentation |
| `tests/qa.js` | Automated smoke tests (see the header of the file) |

No build step, no npm. Open any file in a text editor.

## 5. Rebuild from scratch (disaster recovery)

1. **Supabase:** create a project. Run the prompts in `PROMPTS.md` in order (sections A to F) in the Supabase SQL assistant, always asking it to *show the SQL first*. Check each result against section 6 below.
2. **Auth:** Authentication > Users > Add user (email + password, auto-confirm). Insert a row in `profiles` with that user's id and role `admin`.
3. **Config:** put the new Project URL and publishable key in `config.js`.
4. **GitHub:** create a public repo, upload every file in section 4 at the top level.
5. **Pages:** repo Settings > Pages > Deploy from a branch > `main` / root. Wait about two minutes.
6. **Supabase URL settings:** Authentication > URL Configuration: set Site URL to your Pages address.
7. **Data:** sign in, then Setup (suppliers, SKUs) and Sites. Print QR labels from the Sites page **after** the address is final (the QR code contains the address).
8. **Test:** run the QA plan.

If only the website broke: re-upload the files (GitHub keeps full history under Commits; use "Revert" or open an old commit to copy a file back).

## 6. Database as intended

> The Supabase AI built these tables and then a fix-up prompt renamed and corrected them. **Verify names in the Table Editor** - the schema you shared on Nov 19 differed from the brief in places (capital letters, typos, missing constraints). The app expects exactly the names below.

| Table | Columns (key points) |
|---|---|
| `suppliers` | `supplier_id` (auto), `name` (unique), `notes`, `is_active`, `created_at` |
| `sites` | `site_id` (auto), `name`, `site_code` (unique, lowercase letters/digits/hyphens), `notes`, `is_active`, `created_at` |
| `skus` | `sku_id` (auto), `sku_code` (unique), `description`, `unit_of_measure`, `is_active`, `created_at` |
| `app_settings` | one row; `alert_grace_days` default 2 |
| `orders` | `order_id` (auto), `order_number` (from the supplier), `supplier_id`, `site_id`, `order_date`, `created_by`, `created_at`; **unique (`order_number`, `supplier_id`)** |
| `order_lines` | `order_line_id`, `order_id`, `sku_id`, `quantity_ordered`, `unit_price`, `unit_freight`, `unit_duty`, `unit_other`, **generated** `landed_unit_cost` (sum of the four unit costs) and `line_spend` (landed x quantity, 2 decimals); **unique (`order_id`, `sku_id`)** |
| `inventory_records` | `inventory_id`, `order_id`, `sku_id`, `arrival_date`, `quantity_received`; composite foreign key (`order_id`, `sku_id`) to `order_lines` |
| `usage_events` | `usage_id`, `site_id`, `sku_id`, `event_type` (use, waste, adjustment), `quantity_change` (negative = used), `note`, `recorded_by`, `created_at` |
| `pending_tasks` | `task_id`, `task_type`, `reference`, `sku_id`, `site_id`, `status` (open/done), `completed_order_id`, `created_at`, `completed_at` |
| `sku_baseline_overrides` | `sku_id`, `supplier_id`, `baseline_days` (manual baseline, optional) |
| `profiles` | `user_id` (= Supabase user), `display_name`, `role` (admin, purchaser, site_staff); added in P5: `username`, `first_name`, `last_name`, `position`, `employment_date`, `is_active`, `last_login` |
| `receipt_scans`, `item_aliases`, `supplier_aliases` | P5 learning loop (see D28): review log with corrections; remembered item wording per supplier -> SKU; remembered supplier wording -> supplier |
| `ai_usage_log` | P5: `event` (prompt_copied, receipt_saved), `source` (copy_paste, api), counts and optional tokens/cost, `created_by`, `created_at` |
| `site_assignments` | `user_id`, `site_id` (which sites a site_staff user may use) |

**Views** (saved queries): `v_order_line_status`, `v_sku_baseline`, `v_lead_time_alerts`, `v_stock_on_hand`, `v_order_metrics`. The app reads only **`v_lead_time_alerts`**. Stock on hand is computed in `site.html` (decision D11).

**Database rules:** arrival date cannot be earlier than the order date (trigger on `inventory_records`); quantities > 0; costs >= 0; use/waste quantities negative; stock below zero is allowed (flagged on screen).

**Security (Row Level Security):** on for every table; signed-out visitors get nothing. Roles: `admin` everything; `purchaser` reads everything and edits suppliers, orders, lines, deliveries, tasks; `site_staff` only their assigned sites. Every signed-in user can read their own `profiles` row (needed so the app can learn the role). If dropdowns are empty or deletes say "Nothing was deleted", suspect a missing policy first.

## 7. Business rules

1. Order ID from the supplier is unique **per supplier**.
2. One SKU appears once per order.
3. Landed unit cost = price + freight + duty/tax + other. Line spend = landed cost x quantity ordered.
4. Lead time = first delivery date - order date (partial deliveries: the first counts).
5. Stock on hand at a site = deliveries received at that site - usage there. Usage is never tied to a specific delivery.
6. Alerts as in section 1. In-transit orders alert once overdue.
7. Spend is counted by **order date** using quantity ordered.

## 8. Decision log

| ID | When | Decision | Why |
|---|---|---|---|
| D1 | P1 | Order header table + order line table | You asked for it, and it handles multi-product orders |
| D2 | P1 | Stock tracked per SKU with a delivery record per receipt; no per-item or per-batch matching | You cannot tell which delivery an item came from; per-item tracking would never be kept up |
| D3 | P1 | Baseline = rolling average of last 3 arrived orders, per SKU **and supplier**; alert > baseline + 2 days | Your original "first order = baseline" is fragile (one odd order poisons everything); you chose a rolling average and said you buy the same SKU from different suppliers |
| D4 | P1 | Lead time measured to the first delivery | Your answer to the partial-delivery question |
| D5 | P1 | USD only, no currency column | Your answer |
| D6 | P1 | No photo attachments, no data import, no offline scanning | Your answers (offline: "not really relevant"); offline adds heavy complexity |
| D7 | P1 | Alerts by Slack/email first; the manager chooses the channel; recipients stored in a table | Your answers; push notifications are hardest (iPhone needs home-screen install) |
| D8 | P2 | Static site on GitHub Pages + Supabase, no server of our own | You wanted HTML files for GitHub |
| D9 | P2 | Publishable key in `config.js` | Designed to be public; protected by Row Level Security |
| D10 | P2 | Hand-drawn SVG charts, no chart library | Fewer files and third parties to trust |
| D11 | P2-P3 | Dashboard totals and site stock are computed in the browser, not by database views/functions | The AI-built views were renamed and unreliable; browser code is easier to inspect. Revisit past ~10,000 orders |
| D12 | P3 | Keep auto-number ids; add separate `order_number`, `sku_code`, `site_code` text columns | Supplier order numbers can repeat across suppliers; ids are safer keys. Recommended by Claude, accepted when you ran the fix-up |
| D13 | P3 | `W` for plain writes, `Q` for reads; green/red bar moved to the top | Success was being read as failure after inserts; the bottom bar was missed |
| D14 | P3 | Deleting something that is in use is blocked with an explanation; deleting an order removes its lines and deliveries (after a popup) | Protects history while still allowing clean-up |
| D15 | P3 | Enter key clicks the section's main button | Your request |
| D16 | P3 | Stock below zero is allowed but shown in red | Your choice: flag, do not block |
| D17 | P3 | Weekly usage flags the 3 heaviest weeks in the range | Starting assumption; alternative is "well above average" |
| D18 | P4 | One HTML file per tab; shared `app.js` and `style.css`; the Tasks hand-off uses sessionStorage; QR links now `site.html?s=<code>` | Your request. Old printed QR labels stop working |
| D19 | P4 | On-screen confirmation window instead of the browser popup | Your request |
| D20 | P4 | Receipt scanning by copy and paste through claude.ai | Free Claude plans have no API access (checked in Anthropic support docs, Nov 20) |
| D21 | P4 | Profile menu on the right side | Your correction ("a classic layout") |
| D22 | P4 | Deleting a SITE that is in use offers "Delete site and its data" (orders, lines, deliveries, usage, tasks) after a popup listing the counts. Suppliers and SKUs in use stay blocked | You deleted a site's deliveries from its QR page but the site would not go, because orders still pointed at it. Sites are the only item where cascading is offered since history is not rewritten for other items |
| D23 | P4 | The menu collapses into a hamburger on screens under 800px wide, on every page (shared bar in `app.js`, rules in `style.css`); wide screens keep the full bar | Your phone screenshot showed the links wrapping into a tall block. A shared bar means one change covers all pages. To make it a hamburger on desktop too, remove the `@media(max-width:800px)` wrapper around the `.hb`, `nav` rules in `style.css` |
| D24 | P5 | People sign in with a USERNAME. The app turns it into a hidden address `<username>@<AUTH_DOMAIN>` (config.js); anything typed with `@` is used as an email | Supabase has no native username login (checked online Nov 21). A database lookup by username would let strangers test which usernames exist |
| D25 | P5 | Account details live as new columns on the existing `profiles` table (username, first/last name, position, employment date, is_active, last_login), not a second table | One row per login cannot drift out of step with a second table |
| D26 | P5 | Creating logins, resetting passwords and turning accounts off go through the Edge Function `manage-users` (admin check first). Admins never type a password: the page makes a temporary one and shows it once | The admin key must never be in a browser file; no password field to mistype. Accounts are turned off, not deleted, so order history keeps its author |
| D27 | P5 | Prompt/usage tracking: `ai_usage_log` counts prompts copied and receipts saved; tokens and cost columns exist but fill only if scanning ever uses the Claude API | The copy-and-paste route runs on your claude.ai plan, which the app cannot see. Shown to admins as a card on the dashboard |
| D28 | P5 | Receipt learning loop: the app remembers which SKU and supplier you chose for the wording on a receipt (`item_aliases`, `supplier_aliases`) and logs every review with its corrections (`receipt_scans`); the dashboard shows corrections per receipt and % matched correctly | You asked whether corrections could make it better over time. The Claude model itself does not learn from them, so the learning lives in your data: matching improves, reading accuracy does not. The logged edits are the evidence for improving the prompt by hand |
| D29 | P5 | Dashboard buttons Send to Slack and Send test message (admins only) call the Edge Function `send-alerts`; the answer shape is fixed in PROMPTS.md L | You asked for a button. The Slack token stays a server secret; `alert_notifications` stops double posts |

## 9. Testing

**Automated:** `tests/qa.js` (178 checks, simulated browser and fake database) passed on Nov 21 2026 (178 checks: pages, hamburger, accounts, People, usage tracking, learning loop, Send to Slack). It cannot test your real Supabase rules.

**Manual:** use the QA plan (link in section 2). Parts that matter most: Part 7 (alerts) and Part 6 (building the lead-time history). The alert logic was **verified working** on test data: T-004 arrived late (15 days vs baseline 12, 3 over) and T-005 in transit overdue, while Supplier B and a different SKU correctly produced no alert.

Note: QA parts written before Nov 20 assume the old single-page app (`#site-test-room` addresses). Site pages are now `site.html?s=test-room`.

## 10. Operations

- **Change the app:** edit files, upload to GitHub (Add file > Upload files, same names overwrite), wait ~1 minute, hard reload (Cmd+Shift+R).
- **Add a user:** Supabase > Authentication > Users > Add user, then a `profiles` row (role, display name). Site staff also need `site_assignments` rows.
- **Change the alert grace days:** edit the one row in `app_settings`.
- **Free Supabase plan:** projects pause after one week of inactivity (shown on the pricing page you saw). Move to a paid plan before real data goes in and confirm backups.
- **Rotate a key:** Supabase > API Keys. Create a new one, update `config.js` (publishable) or the function secret (secret), delete the old one.

## 11. Known issues and not built

- Order header (number, supplier, site, date) cannot be edited; delete and re-enter.
- Slack/email alert sending is designed but **not built** (see PROMPTS.md section G).
- No in-app user creation (invite from the Supabase dashboard).
- Accounts, People and the usage log are **written but need their database prompts run first** (PROMPTS.md sections I and J) and the `manage-users` Edge Function deployed.
- No self-service password reset by email (accounts use hidden addresses); a manager resets passwords on People.
- Usage tracking counts prompts and receipts only; tokens and cost need the API route (not built).
- Live updates (Supabase Realtime) are not wired; the badge refreshes on page load.
- Receipt scanning is manual copy and paste; an automatic version needs a paid Anthropic API account and an Edge Function.
- QR labels printed before the page split are invalid.
- The dashboard default range is the last 90 days.
- Browser downloads all rows for the dashboard; fine for small volumes only.

## 12. Roadmap

1. Slack alerts (PROMPTS.md G), then an Alerts settings page for the manager.
2. Account page (name, password).
3. Order header editing.
4. Optional: API-based receipt scanning, with an "AI usage" card fed by a log table.

## 13. Sources (where information came from)

Honest note: most technical choices come from Claude's general knowledge of these official documents, not from copying a tutorial. Items marked "verified" were checked online during this project (Nov 20).

- Supabase JavaScript client: https://supabase.com/docs/reference/javascript (select, insert, update, delete, `count`, auth).
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security (including that blocked updates return zero rows without an error).
- Supabase Edge Functions and secrets: https://supabase.com/docs/guides/functions
- PostgreSQL error codes (23505, 23514, 23503, 23502): https://www.postgresql.org/docs/current/errcodes-appendix.html
- PostgREST resource embedding (why embedding needs a direct foreign key): PostgREST docs, "Resource Embedding".
- GitHub Pages: https://docs.github.com/en/pages
- Slack: `chat.postMessage`, bot scopes `chat:write`, `channels:read`, `groups:read`, `chat:write.public`: https://api.slack.com/methods/chat.postMessage and https://api.slack.com/scopes
- supabase-js 2.45.4 via jsDelivr (pinned): https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js
- qrcodejs 1.0.0 via cdnjs (pinned): https://cdnjs.com/libraries/qrcodejs
- XSS escaping: OWASP XSS Prevention Cheat Sheet.
- Browser features: MDN (URLSearchParams, sessionStorage, navigator.clipboard, prefers-color-scheme, input type=date).
- **Verified Nov 20:** Anthropic Console Usage and Cost pages and the separation of API billing from claude.ai plans: Anthropic support articles "Cost and usage reporting in the Claude Console" and "Why is Claude API usage billed separately from my paid Claude plan".
- **From your screens:** the "publishable keys can be safely shared publicly" note and the free-plan limits (Supabase), GitHub Pages settings, and every test result and error message quoted in the decision log.
