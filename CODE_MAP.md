# CODE_MAP.md - where everything is, and what to check when something breaks

Read README.md first for the big picture. Every code file also starts with a comment block explaining its purpose, the decisions behind it, and where the information came from. Search a function name here, then open that file.

Phases and dates are approximate: P1 ~Nov 16-17 2026, P2 ~Nov 17, P3 ~Nov 17-19, P4 ~Nov 19-20.

## 1. Web address -> file

| Address (after `https://deanymar.github.io/dog-stop-inventory/`) | File | Main function |
|---|---|---|
| `index.html` or `/` | `index.html` | `dash()`, `draw()` |
| `log.html` | `log.html` | `logPage()` |
| `scan.html` | `scan.html` | `scanPage()`, `review()` |
| `history.html` | `history.html` | `historyPage()` |
| `tasks.html` | `tasks.html` | `tasksPage()` |
| `sites.html` | `sites.html` | `sitesPage()` |
| `setup.html` | `setup.html` | `setupPage()` |
| `site.html?s=<site_code>` (QR code target) | `site.html` | `sitePage(code)` |
| `account.html` | `account.html` | `accountPage()` |
| `people.html` (admin only) | `people.html` | `peoplePage()`, `fn()` |

Every page file has the same skeleton: `<main id="app">` (the page draws itself here), `<div id="msg">` (green/red bar), then scripts in this order: supabase-js, (qrcodejs on sites only), `config.js`, `app.js`, the page's own script ending in `start("<page>", <function>)`.

## 2. Responsibilities

| Concern | Where |
|---|---|
| Supabase URL and key | `config.js` |
| Top bar, menu links, hamburger (phones), Tasks badge, profile menu | `app.js` (injected HTML at the top; `closeNav`, `#hb` handler; `NAV` list; `start()`) and the `@media(max-width:800px)` block in `style.css` |
| Signed-in check, role gate, loading dropdown lists | `app.js`: `start()`, `loadData()`, `login()` |
| Username sign-in | `app.js`: `toEmail()`, `login()`; domain in `config.js` `AUTH_DOMAIN` |
| Turned-off accounts, role gate, admin-only People | `app.js`: `start()` |
| Last sign-in stamp | database function `record_login()` called from `login()` |
| Receipt matching memory and correction log | `scan.html`: `pick()`, `review()` and the "LEARNING WRITES" block in the Save handler |
| Export to Excel | `history.html`: `exportRows()`, `toCSV()`, `saveBlob()`, the `#hx` handler |
| Stock running low card | `index.html`: `stockCard()` (reads view `v_stock_levels`) |
| Send to Slack buttons | `index.html`: `slack()`; Edge Function `send-alerts` |
| AI usage counting | `app.js`: `logUse()`; called by `scan.html`; shown by `index.html` `usageCard()` |
| Plain-English errors | `app.js`: `nice()` |
| Reads vs plain writes | `app.js`: `Q()` (returns rows) and `W()` (true/false) |
| Update/delete that must change a row | `app.js`: `D()` |
| Every trash button | `app.js`: `bindDel()`, pre-checks in `USE`; deleting a site with data: `cascadeSite()` |
| Confirmation window | `app.js`: `ask()` |
| Enter key rule, Escape, profile menu toggle | `app.js` (listeners near `bindDel`) |
| Chart hover box | `app.js` (`tip`, `tt`); points marked `data-t` in `index.html` `line()` |
| QR address format | `app.js`: `sitePath()`; images made in `sites.html` |
| Colours, layout, print rules | `style.css` (`:root` variables first) |
| Alert logic | **Database view `v_lead_time_alerts`** (not in the browser); displayed by `index.html` `draw()` |
| Stock on hand | `site.html` `sitePage()` (computed in the browser) |
| Cost calculation | Database generated columns on `order_lines` (`landed_unit_cost`, `line_spend`); previews in `log.html` and `scan.html` |

## 3. Which page touches which table

| Page | Reads | Writes or deletes |
|---|---|---|
| `app.js` (all pages) | `profiles` (role, name), `sites`, `skus`, `suppliers`, `pending_tasks` (badge count); row counts for delete pre-checks | deletes through `bindDel` |
| `index.html` | `orders` (+ `order_lines`), `usage_events`, view `v_lead_time_alerts`, `ai_usage_log` (admins) | none |
| `log.html` | lists from app.js | `orders`, `order_lines`; inline add to `suppliers`, `skus`; `pending_tasks` (mark done) |
| `scan.html` | lists from app.js | `suppliers`, `skus`, `orders`, `order_lines`, `inventory_records`, `ai_usage_log` (counts) |
| `history.html` | `orders` (+ `order_lines`), `inventory_records`; export builds a file in the browser | `order_lines` (edit); deletes order, its lines and deliveries |
| `tasks.html` | `pending_tasks` | `pending_tasks` (add, delete) |
| `sites.html` | `sites` | `sites` (add, delete) |
| `setup.html` | lists | `suppliers`, `skus` (add, delete) |
| `site.html` | `orders` (+ `order_lines`), `inventory_records`, `usage_events` | `usage_events` (add, delete), `inventory_records` (add, edit, delete) |
| `account.html` | `S.me` (profile loaded by app.js) | your password only (Supabase Auth) |
| `people.html` | `profiles`, `site_assignments` | `profiles` (edit), `site_assignments`; Edge Function `manage-users` (create, reset_password, set_active) |

## 4. Data flows (follow these when debugging)

**Sign in and start.** Page loads -> `config.js` -> `app.js` injects the top bar and creates `sb` -> page script calls `start(name, fn)` -> `getSession()` (no session: `login()`) -> read `profiles` (role) -> if `site_staff` and not an allowed page: redirect to `sites.html` -> build menu -> `loadData()` -> `badge()` -> `fn()` draws the page.

**Save an order (`log.html`).** Validate -> disable Save -> insert `orders` (`order_number`, `supplier_id`, `site_id`, `order_date`) -> insert `order_lines` (if this fails, delete the order) -> if it came from a task: update `pending_tasks` to done, clear `sessionStorage "task"` -> stay on page (or go to `tasks.html` if started from a task).

**Task -> order.** `tasks.html` stores the task JSON in `sessionStorage.task` and opens `log.html`; `logPage()` reads it back. (Pages cannot share JavaScript variables.)

**Delete anything.** Trash button (`class xdel`, data-k/i/n/x) -> `bindDel()` -> `USE[k]` counts what uses it -> in use: info popup and stop (SITES instead offer "Delete site and its data", which runs `cascadeSite()`) -> otherwise `ask()` -> delete (orders: deliveries, lines, then order) -> `D()` checks a row really went -> green bar -> `refresh()`.

**QR scan.** Camera opens `.../site.html?s=<site_code>` -> sign in (if needed) -> `sitePage(code)`: find the site in `S.sites`, load that site's orders, then deliveries by order ids, then usage -> stock = deliveries - usage.

**Receive a delivery.** Choose an order line, date, quantity -> browser checks date >= order date -> insert `inventory_records` -> database trigger repeats the check as a backstop.

**Receipt (`scan.html`).** Copy prompt -> paste into claude.ai with the receipt -> paste the JSON reply -> `JSON.parse` of the text between the first `{` and last `}` -> `review()` shows editable matches -> Save: supplier, new SKUs, merged lines, spread shipping/tax/fees, order, lines, deliveries.

## 5. Plain-English error dictionary (`nice()` in app.js)

| Database code | Meaning | Message shown |
|---|---|---|
| 23505 | duplicate (unique rule) | the call's `dup` text, e.g. "TEST-1 was already added." |
| 23514 | check rule failed | the call's `chk` text, or "That value is not allowed (rule: name)". A custom message raised by a trigger is shown as written |
| 23503 | linked record | the call's `fk` text, or a generic "linked to something" message |
| 23502 | required field empty | "A required box was left empty." |
| permission / row-level security text | blocked by security | "You do not have permission to do that." |
| anything else | - | the database's own message |
| 0 rows changed by `D()` | silently blocked | "Nothing was deleted/changed. You may not have permission..." |

## 6. If something breaks, look here

| Symptom | Most likely cause | Where to look |
|---|---|---|
| Blank page or "supabase is not defined" | CDN script blocked or `config.js` wrong or missing | page `<script>` tags, `config.js` |
| Sign-in works but menu is wrong or dropdowns are empty | Missing Row Level Security read policy, or no `profiles` row for the user | Supabase policies; `start()` in app.js |
| Red bar "column ... does not exist" | The app asks for a column name the database does not have (it happened with `recorded_at`; the column is `created_at`) | the query named in the page; Table Editor |
| "Could not find a relationship between X and Y" | Embedded query needs a direct foreign key that was removed (composite key change) | fetch separately like `history.html`/`site.html` do |
| `relation "public.Orders" does not exist` when saving a delivery | A trigger/function still uses an old table name | PROMPTS.md section D |
| Green bar never appears after an add | An insert was run with `Q` without `.select()` | use `W()` (see comments on `Q`/`W`) |
| "Nothing was deleted" | Delete policy missing for your role | Supabase policies |
| No alerts when you expect them | Fewer than 3 arrived orders for that SKU **and supplier**; views old or wrong | Order history (check lead times); `v_lead_time_alerts`; PROMPTS.md section E |
| Alerts table shows odd columns | It prints whatever the view returns | `draw()` in `index.html` (hides names ending `_id`, rounds numbers) |
| Site will not delete | It is used by orders/usage/tasks; the popup lists them; "Delete site and its data" runs `cascadeSite()`. If it still fails, a delete policy is missing | `bindDel()`, `cascadeSite()` in app.js |
| Duplicate deliveries | Double click before the Save button disabled; or two saves | site.html "Recent deliveries" (edit/delete) |
| QR code opens a 404 | Repo or file names changed; label printed from the old version | `sitePath()` in app.js, Pages settings |
| Dashboard shows $0 | Date range excludes the orders (default last 90 days) | the From/To boxes |
| Date error on delivery | Arrival before order date (browser and trigger both check) | `sitePage()` and the trigger |
| Everything fine locally, old version live | GitHub Pages cache | wait 1-2 minutes, hard reload (Cmd+Shift+R) |
| Cannot sign in with a new username | Hidden address rejected by Supabase, or wrong `AUTH_DOMAIN`, or the account is turned off | `config.js`, People page |
| People shows nothing / create fails | `manage-users` not deployed, or the database prompts (PROMPTS.md I) not run | Edge Functions page; `fn()` in people.html |
| Scan page does not remember choices | `item_aliases` / `supplier_aliases` tables not created (PROMPTS.md K), or the supplier on the receipt changed | `pick()` in scan.html |
| Send to Slack says failed | `send-alerts` not deployed, token secret missing, bot not in channel; the red bar or popup shows Slack's reason | `slack()` in index.html; PROMPTS.md G and L |
| Stock card missing or empty | view `v_stock_levels` not created (PROMPTS.md N), or nothing is at the first level yet | `stockCard()` in index.html |
| Export button does nothing | pop-up/download blocked by the browser; if no .xlsx the library did not load and a .csv is saved instead | `#hx` handler in history.html |
| Usage card missing | `ai_usage_log` table not created (PROMPTS.md J), or you are not an admin | `usageCard()` in index.html |
| Supabase says paused | Free plan pauses after a week idle | Supabase dashboard > Restore |

## 7. Element ids and classes you will meet (selected)

`#app` page content - `#msg` message bar - `#nav` menu - `#badge`/`#n` Tasks badge - `#hb` hamburger button (phones) - `#pfb`/`#pmenu` profile button and menu - `.xdel` any delete button - `.del` remove a not-yet-saved line - `.ed` / `.ed2` / `.edv` edit buttons (history line / new line / delivery) - `[data-enter]` which button Enter should click - `[data-t]` hover tooltip text - `#sv` Save order (log) - `#sv2` Save order (scan) - `#al` Add line - `#nsa`/`#nka` inline add supplier/SKU - `#hq #hs #hst #hrs` history search, supplier, status, reset.

## 8. Function index (generated Nov 21 2026; line numbers move when code changes)

| File | Line | Name | Kind |
|---|---|---|---|
| `app.js` | 37 | `sb` | value/arrow function |
| `app.js` | 43 | `S` | value/arrow function |
| `app.js` | 48 | `today` | value/arrow function |
| `app.js` | 53 | `opt` | value/arrow function |
| `app.js` | 57 | `skuName` | value/arrow function |
| `app.js` | 61 | `I` | value/arrow function |
| `app.js` | 67 | `tip` | value/arrow function |
| `app.js` | 68 | `tt` | value/arrow function |
| `app.js` | 76 | `D()` | function |
| `app.js` | 81 | `cnt` | value/arrow function |
| `app.js` | 87 | `USE` | value/arrow function |
| `app.js` | 95 | `bindDel()` | function |
| `app.js` | 119 | `logUse()` | function |
| `app.js` | 131 | `cascadeSite()` | function |
| `app.js` | 157 | `closeNav` | value/arrow function |
| `app.js` | 177 | `msg()` | function |
| `app.js` | 186 | `nice()` | function |
| `app.js` | 198 | `Q()` | function |
| `app.js` | 203 | `W()` | function |
| `app.js` | 210 | `UNITS` | value/arrow function |
| `app.js` | 215 | `EDIT` | value/arrow function |
| `app.js` | 216 | `TRASH` | value/arrow function |
| `app.js` | 222 | `sitePath()` | function |
| `app.js` | 230 | `ask()` | function |
| `app.js` | 245 | `loadData()` | function |
| `app.js` | 252 | `PAGE` | value/arrow function |
| `app.js` | 256 | `refresh()` | function |
| `app.js` | 260 | `badge()` | function |
| `app.js` | 272 | `toEmail()` | function |
| `app.js` | 273 | `login()` | function |
| `app.js` | 287 | `NAV` | value/arrow function |
| `app.js` | 293 | `start()` | function |
| `index.html` | 28 | `dash()` | function |
| `index.html` | 38 | `line()` | function |
| `index.html` | 49 | `draw()` | function |
| `index.html` | 94 | `stockCard()` | function |
| `index.html` | 110 | `slack()` | function |
| `index.html` | 129 | `usageCard()` | function |
| `log.html` | 31 | `logPage()` | function |
| `scan.html` | 28 | `SCHEMA` | value/arrow function |
| `scan.html` | 34 | `rpt` | value/arrow function |
| `scan.html` | 40 | `scanPage()` | function |
| `scan.html` | 73 | `review()` | function |
| `history.html` | 29 | `historyPage()` | function |
| `tasks.html` | 29 | `tasksPage()` | function |
| `sites.html` | 31 | `sitesPage()` | function |
| `setup.html` | 30 | `setupPage()` | function |
| `site.html` | 30 | `sitePage()` | function |
| `account.html` | 29 | `accountPage()` | function |
| `people.html` | 34 | `ACC` | value/arrow function |
| `people.html` | 35 | `KEY` | value/arrow function |
| `people.html` | 36 | `EDITING` | value/arrow function |
| `people.html` | 37 | `tempPw` | value/arrow function |
| `people.html` | 39 | `fn()` | function |
| `people.html` | 45 | `peoplePage()` | function |

(Regenerate by searching each file for lines starting with `function`, `async function`, `const` or `let`.)
