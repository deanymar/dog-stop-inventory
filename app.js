/*
 * FILE: app.js  (shared code loaded by EVERY page)
 * ---------------------------------------------------------------------------
 * WHAT: everything the pages have in common: the top bar, the Supabase client,
 *   small helpers, plain-English error messages, the delete flow, the on-screen
 *   confirmation window, sign-in, and start(), which boots each page.
 * WHY A SHARED FILE [P4]: you asked for one html file per tab. Copying this code
 *   into eight files would let them drift apart, so it lives here once.
 * LOAD ORDER (matters): supabase-js CDN -> config.js -> app.js -> the page's own
 *   <script>. Pages call start(), Q(), W() etc., so app.js must come first.
 * GLOBALS pages rely on: sb, S, role, $, H, opt, money, today, skuName, I, msg,
 *   Q, W, D, ask, bindDel, refresh, badge, loadData, start, EDIT, TRASH, UNITS,
 *   sitePath. Top-level const/let in one classic script are visible to the next.
 * SECURITY: only the publishable key is used here. Real protection is Row Level
 *   Security in Supabase, not this file. Never put a secret key in any file.
 * DATES: Dates are approximate: P1 planning ~Nov 16-17 2026, P2 first app ~Nov 17, P3 fixes from QA testing ~Nov 17-19, P4 page split, popups, receipt page ~Nov 19-20. See README 'How dates are given'.
 * MORE: README.md (overview and rebuild), CODE_MAP.md (where each thing lives).
 */
/*
 * TOP BAR injected here so all pages share one copy. Order: app name, nav links, Tasks badge,
 * profile button (right side, a classic layout: you asked for this [P3-P4]). It is hidden
 * until sign-in succeeds (start() shows it). SOURCE: MDN insertAdjacentHTML.
 */
document.body.insertAdjacentHTML("afterbegin",'<header><b>Order Tracker</b><nav id="nav"></nav><a id="badge" href="tasks.html" class="noprint" style="color:inherit;text-decoration:none">Tasks<span class="badge" id="n">0</span></a><div class="pwrap noprint" id="pwrap" style="display:none"><button class="pfb" id="pfb" aria-label="Profile menu" aria-haspopup="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></button><div class="pmenu" id="pmenu"></div></div></header>');
/*
 * $ = short for document.querySelector. H = escapes text before it goes into HTML so
 * a name like <b>x</b> cannot inject markup (XSS). [P2]
 * SOURCE: OWASP XSS Prevention Cheat Sheet (escape &, <, >, quote characters).
 */
const $=s=>document.querySelector(s),H=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
/*
 * THE SUPABASE CLIENT. CONFIG comes from config.js (project URL + publishable key).
 * The publishable key is meant to be public ONLY because Row Level Security is on. [P2]
 * SOURCE: your Supabase > API Keys screen (Nov 17): "Publishable keys can be safely shared publicly".
 * supabase-js docs: https://supabase.com/docs/reference/javascript/initializing
 */
const sb=supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_KEY);
/*
 * S = shared state. sites/skus/sup are the dropdown lists loaded by loadData().
 * S.me = the signed-in user ({id,name}). S.lines = order lines being typed on log.html.
 * S.task = a pending task being turned into an order. role = admin, purchaser or site_staff.
 */
const S={sites:[],skus:[],sup:[],task:null,lines:[]};let role="none";
/*
 * today() gives YYYY-MM-DD, the format <input type=date> uses, so dates compare correctly as text.
 * money() formats US dollars (you said all amounts are USD, Nov 17). SOURCE: MDN toLocaleString.
 */
const today=()=>new Date().toISOString().slice(0,10),money=n=>"$"+(+n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
/*
 * opt() builds <option> tags from a list. The third argument can be a column name or a function
 * (used where the label combines two columns, like SKU code + description).
 */
const opt=(a,v,l)=>a.map(x=>`<option value="${x[v]}">${H(typeof l==="function"?l(x):x[l])}</option>`).join("");
/*
 * Looks up a SKU code from its internal id. Used wherever a table shows a SKU instead of a number.
 */
const skuName=id=>{const k=S.skus.find(x=>x.sku_id==id);return k?k.sku_code:id};
/*
 * Page intro line shown under the menu. You asked every page to explain what it is for (Part 14 test). [P3]
 */
const I=t=>`<p class="m" style="margin:0 0 12px">${t}</p>`;
/*
 * CHART TOOLTIP [P3]: you reported hovering a chart point showed no number. The old browser
 * <title> tooltip is slow and the points were tiny, so points now carry data-t text and this floating
 * box follows the pointer (also works by tapping on a phone). SOURCE: MDN mouseover/mousemove events.
 */
const tip=document.createElement("div");tip.id="tip";document.body.appendChild(tip);
const tt=e=>{const el=e.target.closest&&e.target.closest("[data-t]");if(!el){tip.style.display="none";return}tip.textContent=el.dataset.t;tip.style.display="block";tip.style.left=Math.max(4,Math.min(e.clientX+12,innerWidth-tip.offsetWidth-8))+"px";tip.style.top=Math.max(4,e.clientY-36)+"px"};
["mouseover","mousemove","click"].forEach(v=>document.addEventListener(v,tt));
/*
 * D = run a delete or update and CONFIRM something changed. WHY [P3]: with Row Level Security,
 * Supabase reports success even when a policy hides the row and 0 rows change. .select() returns the
 * affected rows, so an empty result means "blocked". Third argument z = message for that case.
 * SOURCE: Supabase docs, "Row Level Security" (silent zero-row updates) and delete()/select().
 */
async function D(q,c,z){const{data,error}=await q.select();if(error){msg(nice(error,c),1);return false}if(!data||!data.length){msg(z||"Nothing was deleted. You may not have permission to delete this.",1);return false}return true}
/*
 * cnt = count rows that point at something, without downloading them (head:true).
 * SOURCE: supabase-js docs, select() count option.
 */
const cnt=async(t,c,v)=>{const{count}=await sb.from(t).select("*",{count:"exact",head:true}).eq(c,v);return count||0};
/*
 * USE = what to check BEFORE deleting a supplier, SKU or site. [P4] Added because test 16.4 was unclear:
 * the app now explains "still used by 6 orders" itself instead of relying on database errors.
 * Orders and tasks are not listed: orders delete together with their lines and deliveries.
 */
const USE={supplier_id:async id=>[["orders",await cnt("orders","supplier_id",id)]],sku_id:async id=>[["order lines",await cnt("order_lines","sku_id",id)],["usage records",await cnt("usage_events","sku_id",id)],["deliveries",await cnt("inventory_records","sku_id",id)]],site_id:async id=>[["orders",await cnt("orders","site_id",id)],["usage records",await cnt("usage_events","site_id",id)],["pending tasks",await cnt("pending_tasks","site_id",id)]]};
/*
 * bindDel() wires every trash button (class xdel). data-k says what it is (order_id, sku_id, ...),
 * data-i the id, data-n the name for the question, data-x extra warning text. [P3, popup P4]
 * FLOW: 1) pre-check usage -> info popup if used. 2) ask() popup. 3) delete. 4) refresh().
 * ORDERS are special: deliveries first, then lines, then the order (the database links them) .
 * SOURCE for FK behaviour: PostgreSQL docs, foreign keys. Error 23503 is translated by nice().
 */
function bindDel(){document.querySelectorAll(".xdel").forEach(b=>b.onclick=async e=>{
  e.stopPropagation();const k=b.dataset.k,id=+b.dataset.i,n=b.dataset.n;
  const u=USE[k];if(u){const used=(await u(id)).filter(x=>x[1]>0);if(used.length){await ask("Can't delete "+n,"It is still used by "+used.map(x=>x[1]+" "+x[0]).join(", ")+". Remove or change those first.",{info:true});return}}
  if(!await ask("Are you sure you want to delete "+n+"?",b.dataset.x||"This cannot be undone."))return;
  const FK={fk:"It can't be deleted because it is used by orders, deliveries or usage. Remove those first."};let ok=false;
  if(k==="order_id"){
    const a=await sb.from("inventory_records").delete().eq("order_id",id);if(a.error){msg(nice(a.error,FK),1);return}
    const c=await sb.from("order_lines").delete().eq("order_id",id);if(c.error){msg(nice(c.error,FK),1);return}
    ok=await D(sb.from("orders").delete().eq("order_id",id),FK)
  }else{const tb={supplier_id:"suppliers",sku_id:"skus",site_id:"sites",task_id:"pending_tasks",inventory_id:"inventory_records",usage_id:"usage_events"}[k];ok=await D(sb.from(tb).delete().eq(k,id),FK)}
  if(ok){msg(n+" deleted.");await refresh()}
})}
/*
 * PROFILE MENU open/close, and the global ENTER KEY rule below. [P3]
 * You asked: "anytime there is a button I want to press Enter". Rule: Enter inside a text/number/date box
 * clicks the nearest [data-enter] target, else the first enabled primary button in the same card or bar.
 * Excludes buttons, radios, checkboxes. Delete/edit icon buttons are never auto-clicked.
 */
$("#pfb").onclick=e=>{e.stopPropagation();$("#pmenu").classList.toggle("open")};
document.addEventListener("click",()=>$("#pmenu").classList.remove("open"));
/*
 * Capture of Escape (closes the menu) and Enter (see rule above). Selects are skipped on purpose: Enter
 * has its own meaning there. Table rows being edited set data-enter so Enter saves the row.
 */
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")$("#pmenu").classList.remove("open");
  if(e.key!=="Enter"||e.isComposing)return;
  const t=e.target;if(!t||t.tagName!=="INPUT"||["button","checkbox","radio","submit"].includes(t.type))return;
  const sc=t.closest("[data-enter],.card,.bar");if(!sc)return;
  const b=sc.dataset.enter?document.querySelector(sc.dataset.enter):(sc.querySelector("button.pri:not(:disabled)")||sc.querySelector("button:not(:disabled):not(.del):not(.xdel):not(.ed):not(.ed2)"));
  if(b&&!b.disabled){e.preventDefault();b.click()}
});
/*
 * msg() shows the green (ok) or red (bad) bar at the top for 5 seconds. [P3]
 * You asked for a green bar "Supplier added"; it moved to the top because the bottom was easy to miss.
 */
function msg(t,bad){const m=$("#msg");m.textContent=t;m.className=bad?"bad":"ok";setTimeout(()=>m.textContent="",5000)}
/*
 * nice() turns database errors into plain English. [P3]
 * Codes are PostgreSQL SQLSTATE: 23505 duplicate, 23514 check rule, 23503 linked record, 23502 required.
 * c = optional custom wording per call, e.g. {dup:"TEST-1 was already added."}.
 * A custom message raised by a database trigger (no "violates check constraint" text) is shown as-is,
 * because that is how the arrival-date rule explains itself. [P3, test 5.4]
 * SOURCE: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
function nice(e,c){c=c||{};const m=e.message||"";
  if(e.code==="23505")return c.dup||"That already exists.";
  if(e.code==="23514"){if(!/violates check constraint/.test(m))return m;const r=/constraint "([^"]+)"/.exec(m);return c.chk||("That value is not allowed"+(r?" (rule: "+r[1]+")":"")+". Please check what you typed.")}
  if(e.code==="23503")return c.fk||"That is linked to something that does not exist, or is still in use.";
  if(e.code==="23502")return "A required box was left empty.";
  if(/row-level security|permission denied/i.test(m))return "You do not have permission to do that.";
  return m}
/*
 * Q = run a read or a write that returns rows. Returns the data, or null after showing a red bar.
 * TRAP found in testing [P3]: an insert WITHOUT .select() returns data=null on success, which Q reads as
 * failure. Use W for plain inserts, or add .select() before Q.
 */
async function Q(p,c){const{data,error}=await p;if(error){msg(nice(error,c),1);return null}return data}
/*
 * W = write where success means "no error". Returns true/false. Created [P3] after the green
 * "Supplier added" bar never appeared (Q treated the empty success result as an error).
 */
async function W(p,c){const{error}=await p;if(error){msg(nice(error,c),1);return false}return true}

/* ---------- Shared constants ---------- */
/*
 * Unit-of-measure choices for new SKUs: you asked for options like gallons, pounds, inches. [P3]
 * To add a unit, add it here AND in setup.html (it has its own copy of the <select>).
 */
const UNITS=["each","pack","box","case","bag","bottle","roll","pounds","ounces","gallons","liters","inches","feet"];
/*
 * Pencil and trash icons (inline SVG, no image files or icon libraries needed).
 * Drawn as simple strokes; SOURCE: hand-written SVG paths, no library.
 */
const EDIT='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg>';
const TRASH='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
/*
 * URL printed in a QR code: https://<you>.github.io/<repo>/site.html?s=<site_code>.
 * CHANGED [P4] from #site-<code> when pages were split. Labels printed before Nov 20 point at the old
 * address and will not work. Query strings work on GitHub Pages. SOURCE: MDN URLSearchParams.
 */
function sitePath(c){return location.origin+location.pathname.replace(/[^\/]*$/,"")+"site.html?s="+encodeURIComponent(c)}

/* ---------- On-screen confirmation window ---------- */
/*
 * ON-SCREEN CONFIRMATION [P4]: replaces the browser confirm() box (you asked for an on-screen popup).
 * ask(title, body, {info:true}) = single OK button; otherwise Cancel + red Delete. Returns a Promise<boolean>.
 * Cancel is focused first so pressing Enter by accident does not delete. Escape and clicking outside cancel.
 */
function ask(title,body,o){o=o||{};return new Promise(res=>{
  const d=document.createElement("div");d.className="ov";
  d.innerHTML=`<div class="mod" role="dialog" aria-modal="true"><h3>${H(title)}</h3>${body?`<p>${H(body)}</p>`:""}<div class="mb">${o.info?"":'<button id="mn">Cancel</button>'}<button id="my" class="${o.info?"pri":"dng"}">${H(o.ok||(o.info?"OK":"Delete"))}</button></div></div>`;
  document.body.appendChild(d);
  const kd=e=>{if(e.key==="Escape"){e.stopPropagation();done(false)}};
  const done=v=>{d.remove();document.removeEventListener("keydown",kd,true);res(v)};
  document.addEventListener("keydown",kd,true);
  d.querySelector("#my").onclick=()=>done(true);const n=d.querySelector("#mn");if(n)n.onclick=()=>done(false);
  d.onclick=e=>{if(e.target===d)done(false)};(n||d.querySelector("#my")).focus();
})}

/* ---------- Sign in, data loading, page start ---------- */
/*
 * Loads the three dropdown lists every page needs. Called by start() and refresh().
 */
async function loadData(){
  const r=await Promise.all([Q(sb.from("sites").select("*").order("name")),Q(sb.from("skus").select("*").order("sku_code")),Q(sb.from("suppliers").select("*").order("name"))]);
  S.sites=r[0]||[];S.skus=r[1]||[];S.sup=r[2]||[];
}
/*
 * PAGE = the current page function, so refresh() can redraw it after a save or delete.
 */
let PAGE=null;
/*
 * refresh() = reload dropdown data and redraw the page. Replaces the old single-page boot() [P4].
 */
async function refresh(){await loadData();await PAGE()}
/*
 * Counts open pending tasks for the red Tasks badge. head:true = count only, no rows downloaded.
 */
async function badge(){const{count}=await sb.from("pending_tasks").select("*",{count:"exact",head:true}).eq("status","open");$("#n").textContent=count||0}
/*
 * Sign-in form [P2]. Enter key works through the global rule. After success the page reloads
 * so start() runs again with a session. SOURCE: supabase-js auth.signInWithPassword.
 */
function login(){
  $("#app").innerHTML=`<div class="card" style="max-width:360px;margin:40px auto"><h2>Sign in</h2><div class="g" style="grid-template-columns:1fr"><label>Email<input id="em" type="email" autocomplete="username"></label><label>Password<input id="pw" type="password" autocomplete="current-password"></label><button class="pri" id="in">Sign in</button></div></div>`;
  $("#in").onclick=async()=>{$("#in").disabled=true;const{error}=await sb.auth.signInWithPassword({email:$("#em").value.trim(),password:$("#pw").value});if(error){msg(error.message,1);$("#in").disabled=false}else location.reload()};
  $("#em").focus();
}
/*
 * Menu order. Each entry is [file name without .html, label]. To add a page: create <name>.html,
 * add it here, and (if staff may use it) to the allowed list in start().
 */
const NAV=[["index","Dashboard"],["log","Log order"],["scan","Scan receipt"],["history","Order history"],["tasks","Pending tasks"],["sites","Sites"],["setup","Setup"]];
/*
 * start(page, fn) runs on every page: session check -> profile -> role gate -> menu -> data -> fn().
 * site_staff users are sent to sites.html if they open any other page (the database enforces the real limits).
 * S.me.name falls back to the user id in the profile menu (your instruction, Nov 19).
 */
async function start(page,fn){
  PAGE=fn;
  const{data:{session}}=await sb.auth.getSession();
  if(!session)return login();
  const p=await Q(sb.from("profiles").select("role,display_name").eq("user_id",session.user.id).maybeSingle());
  role=p?p.role:"none";S.me={id:session.user.id,name:p&&p.display_name?p.display_name.trim():""};
  const staff=role==="site_staff";
  if(staff&&!["sites","site","account"].includes(page))return location.replace("sites.html");
  $("#nav").innerHTML=(staff?[["sites","Sites"]]:NAV).map(x=>`<a href="${x[0]}.html" class="${page===x[0]||(page==="site"&&x[0]==="sites")?"on":""}">${x[1]}</a>`).join("");
  $("#badge").style.display=staff?"none":"";
  $("#pmenu").innerHTML=`<div class="pn">${H(S.me.name||S.me.id)}</div><a href="account.html">Account</a><a href="#" id="out">Sign out</a>`;
  $("#pwrap").style.display="block";
  $("#out").onclick=async e=>{e.preventDefault();await sb.auth.signOut();location.href="index.html"};
  await loadData();badge();fn();
}
