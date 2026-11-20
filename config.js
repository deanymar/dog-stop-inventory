/*
 * FILE: config.js - the ONLY file you edit to point the site at a different Supabase project.
 * Loaded before app.js on every page. [P2, ~Nov 17 2026]
 *
 * SUPABASE_URL  = Project URL. Supabase dashboard > Project Settings > API (or the Connect button).
 * SUPABASE_KEY  = the PUBLISHABLE key (starts sb_publishable_). It is safe in a public GitHub repo ONLY
 *                 because Row Level Security is switched on for every table.
 *                 SOURCE: your Supabase API Keys page: "Publishable keys can be safely shared publicly".
 *
 * NEVER put the SECRET key (sb_secret_...) or a Slack/Anthropic token here or in any file in this repo.
 * Those belong in Supabase Edge Function secrets only (see README, Slack section).
 */
window.CONFIG = {
  SUPABASE_URL: "https://mksihwrogjvvldttlovv.supabase.co",
  SUPABASE_KEY: "sb_publishable_bXQ_cGcUh37nobeForSGxg_26WTgJsG"
};
