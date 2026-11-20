/* Shared code for every page. Order Tracker. */
document.body.insertAdjacentHTML("afterbegin",'<header><b>Order Tracker</b><nav id="nav"></nav><a id="badge" href="tasks.html" class="noprint" style="color:inherit;text-decoration:none">Tasks<span class="badge" id="n">0</span></a><div class="pwrap noprint" id="pwrap" style="display:none"><button class="pfb" id="pfb" aria-label="Profile menu" aria-haspopup="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></button><div class="pmenu" id="pmenu"></div></div></header>');
const $=s=>document.querySelector(s),H=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const sb=supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_KEY);
const S={sites:[],skus:[],sup:[],task:null,lines:[]};let role="none";
const today=()=>new Date().toISOString().slice(0,10),money=n=>"$"+(+n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const opt=(a,v,l)=>a.map(x=>`<option value="${x[v]}">${H(typeof l==="function"?l(x):x[l])}</option>`).join("");
const skuName=id=>{const k=S.skus.find(x=>x.sku_id==id);return k?k.sku_code:id};
const I=t=>`<p class="m" style="margin:0 0 12px">${t}</p>`;
const tip=document.createElement("div");tip.id="tip";document.body.appendChild(tip);
const tt=e=>{const el=e.target.closest&&e.target.closest("[data-t]");if(!el){tip.style.display="none";return}tip.textContent=el.dataset.t;tip.style.display="block";tip.style.left=Math.max(4,Math.min(e.clientX+12,innerWidth-tip.offsetWidth-8))+"px";tip.style.top=Math.max(4,e.clientY-36)+"px"};
["mouseover","mousemove","click"].forEach(v=>document.addEventListener(v,tt));
async function D(q,c,z){const{data,error}=await q.select();if(error){msg(nice(error,c),1);return false}if(!data||!data.length){msg(z||"Nothing was deleted. You may not have permission to delete this.",1);return false}return true}
const cnt=async(t,c,v)=>{const{count}=await sb.from(t).select("*",{count:"exact",head:true}).eq(c,v);return count||0};
const USE={supplier_id:async id=>[["orders",await cnt("orders","supplier_id",id)]],sku_id:async id=>[["order lines",await cnt("order_lines","sku_id",id)],["usage records",await cnt("usage_events","sku_id",id)],["deliveries",await cnt("inventory_records","sku_id",id)]],site_id:async id=>[["orders",await cnt("orders","site_id",id)],["usage records",await cnt("usage_events","site_id",id)],["pending tasks",await cnt("pending_tasks","site_id",id)]]};
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
$("#pfb").onclick=e=>{e.stopPropagation();$("#pmenu").classList.toggle("open")};
document.addEventListener("click",()=>$("#pmenu").classList.remove("open"));
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")$("#pmenu").classList.remove("open");
  if(e.key!=="Enter"||e.isComposing)return;
  const t=e.target;if(!t||t.tagName!=="INPUT"||["button","checkbox","radio","submit"].includes(t.type))return;
  const sc=t.closest("[data-enter],.card,.bar");if(!sc)return;
  const b=sc.dataset.enter?document.querySelector(sc.dataset.enter):(sc.querySelector("button.pri:not(:disabled)")||sc.querySelector("button:not(:disabled):not(.del):not(.xdel):not(.ed):not(.ed2)"));
  if(b&&!b.disabled){e.preventDefault();b.click()}
});
function msg(t,bad){const m=$("#msg");m.textContent=t;m.className=bad?"bad":"ok";setTimeout(()=>m.textContent="",5000)}
function nice(e,c){c=c||{};const m=e.message||"";
  if(e.code==="23505")return c.dup||"That already exists.";
  if(e.code==="23514"){if(!/violates check constraint/.test(m))return m;const r=/constraint "([^"]+)"/.exec(m);return c.chk||("That value is not allowed"+(r?" (rule: "+r[1]+")":"")+". Please check what you typed.")}
  if(e.code==="23503")return c.fk||"That is linked to something that does not exist, or is still in use.";
  if(e.code==="23502")return "A required box was left empty.";
  if(/row-level security|permission denied/i.test(m))return "You do not have permission to do that.";
  return m}
async function Q(p,c){const{data,error}=await p;if(error){msg(nice(error,c),1);return null}return data}
async function W(p,c){const{error}=await p;if(error){msg(nice(error,c),1);return false}return true}

/* ---------- Shared constants ---------- */
const UNITS=["each","pack","box","case","bag","bottle","roll","pounds","ounces","gallons","liters","inches","feet"];
const EDIT='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg>';
const TRASH='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
function sitePath(c){return location.origin+location.pathname.replace(/[^\/]*$/,"")+"site.html?s="+encodeURIComponent(c)}

/* ---------- On-screen confirmation window ---------- */
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
async function loadData(){
  const r=await Promise.all([Q(sb.from("sites").select("*").order("name")),Q(sb.from("skus").select("*").order("sku_code")),Q(sb.from("suppliers").select("*").order("name"))]);
  S.sites=r[0]||[];S.skus=r[1]||[];S.sup=r[2]||[];
}
let PAGE=null;
async function refresh(){await loadData();await PAGE()}
async function badge(){const{count}=await sb.from("pending_tasks").select("*",{count:"exact",head:true}).eq("status","open");$("#n").textContent=count||0}
function login(){
  $("#app").innerHTML=`<div class="card" style="max-width:360px;margin:40px auto"><h2>Sign in</h2><div class="g" style="grid-template-columns:1fr"><label>Email<input id="em" type="email" autocomplete="username"></label><label>Password<input id="pw" type="password" autocomplete="current-password"></label><button class="pri" id="in">Sign in</button></div></div>`;
  $("#in").onclick=async()=>{$("#in").disabled=true;const{error}=await sb.auth.signInWithPassword({email:$("#em").value.trim(),password:$("#pw").value});if(error){msg(error.message,1);$("#in").disabled=false}else location.reload()};
  $("#em").focus();
}
const NAV=[["index","Dashboard"],["log","Log order"],["history","Order history"],["tasks","Pending tasks"],["sites","Sites"],["setup","Setup"]];
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
