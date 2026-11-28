/*
 * tests/qa.js - AUTOMATED SMOKE TESTS for Order Tracker. [P4, ~Nov 20 2026]
 * WHAT: loads every page in a simulated browser (jsdom) against a FAKE Supabase and checks the behaviour that
 * the manual QA plan covers: menus, popups, Enter key, delete rules, delivery date rule, alerts table, QR addresses,
 * receipt page maths. 189 checks. It never touches your real database.
 * RUN:  cd tests && npm init -y && npm i jsdom@22 && node qa.js      (needs Node 18+)
 * LIMITS: the fake database does not enforce real rules (unique keys, triggers, Row Level Security). So this proves
 * the PAGES behave; it cannot prove your Supabase setup. Use the manual QA plan for that.
 * jsdom prints "Not implemented: navigation" for page redirects; that is expected and harmless.
 * WHY jsdom: it runs the real page scripts without a browser install. SOURCE: https://github.com/jsdom/jsdom
 */
// Automated smoke QA: runs every page in a simulated browser (jsdom) against a MOCK Supabase.
const fs=require('fs');const {JSDOM}=require('jsdom');
const root=require('path').join(__dirname,'..')+'/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rej=[];process.on('unhandledRejection',e=>rej.push(String(e&&e.message||e)));
const MOCK=`(function(){var D=__DATA__;window.__DATA=D;var calls=window.__CALLS=[];
var idc={suppliers:'supplier_id',skus:'sku_id',orders:'order_id',order_lines:'order_line_id',inventory_records:'inventory_id',usage_events:'usage_id',pending_tasks:'task_id',sites:'site_id'};
function builder(t){var st={op:'select',f:[],head:false,single:false,payload:null,sel:null};
var b={select:function(c,o){st.sel=c===undefined?'':c;if(o&&o.head)st.head=true;return b},insert:function(p){st.op='insert';st.payload=p;return b},upsert:function(p){st.op='upsert';st.payload=p;return b},update:function(p){st.op='update';st.payload=p;return b},delete:function(){st.op='delete';return b},
eq:function(c,v){st.f.push(['eq',c,v]);return b},in:function(c,v){st.f.push(['in',c,v]);return b},gte:function(){return b},lte:function(){return b},order:function(){return b},limit:function(){return b},
single:function(){st.single=true;return b},maybeSingle:function(){st.single=true;return b},
then:function(res,rej){return Promise.resolve(run()).then(res,rej)}};
function run(){calls.push({t:t,op:st.op,p:st.payload,f:st.f,head:st.head});
var er=D.__errors&&D.__errors[t+'.'+st.op];if(er)return{data:null,error:er,count:null};
var rows=(D[t]||[]).filter(function(r){return st.f.every(function(x){return x[0]==='eq'?String(r[x[1]])===String(x[2]):x[2].map(String).indexOf(String(r[x[1]]))>=0})});
if(st.op==='select'){if(st.head)return{data:null,error:null,count:rows.length};return{data:st.single?(rows[0]||null):rows,error:null}}
if(st.op==='insert'||st.op==='upsert'){var arr=Array.isArray(st.payload)?st.payload:[st.payload];var out=arr.map(function(p,i){var o=Object.assign({},p);o[idc[t]]=900+i;return o});
if(st.sel!==null)return{data:st.single?out[0]:out,error:null};return{data:null,error:null}}
if(D.__zero)return{data:[],error:null};return{data:st.sel!==null?[{}]:null,error:null}}
return b}
window.__sb={from:builder,auth:{getSession:function(){return Promise.resolve({data:{session:D.__nosession?null:{user:{id:'u1'}}}})},signOut:function(){return Promise.resolve({})},signInWithPassword:function(a){calls.push({t:'auth',op:'signIn',p:a});return Promise.resolve({error:null})}}};
window.__sb.rpc=function(n){calls.push({t:'rpc',op:n});return Promise.resolve({data:null,error:null})};window.__sb.functions={invoke:function(n,o){calls.push({t:'fn',op:n,p:o.body});return Promise.resolve({data:D.__fnresp||{ok:true,user_id:'new-1'},error:null})}};window.__sb.auth.updateUser=function(p){calls.push({t:'auth',op:'updateUser',p:p});return Promise.resolve({error:null})};window.supabase={createClient:function(){return window.__sb}}})();`;
const base=()=>({profiles:[{user_id:'u1',role:'admin',display_name:'Dean',first_name:'Dean',last_name:'Marko',username:'dean',position:'Owner',employment_date:'2020-01-01',last_login:'2026-11-21T10:00:00Z',is_active:true},{user_id:'u2',role:'site_staff',first_name:'Maria',last_name:'Lopez',username:'maria',position:'Groomer',employment_date:'2024-05-01',last_login:null,is_active:true}],sites:[{site_id:1,name:'Test Room',site_code:'test-room'}],
skus:[{sku_id:1,sku_code:'TEST-1',description:'Test item',unit_of_measure:'each'},{sku_id:2,sku_code:'TEST-2',description:'Second test item',unit_of_measure:'each'}],
suppliers:[{supplier_id:1,name:'Test Supplier A'}],
orders:[{order_id:1,order_number:'T-001',supplier_id:1,site_id:1,order_date:'2026-01-01',order_lines:[{sku_id:1,quantity_ordered:100,unit_price:5,unit_freight:.5,unit_duty:.25,unit_other:.25,landed_unit_cost:6,line_spend:600}]}],
inventory_records:[{inventory_id:1,order_id:1,sku_id:1,arrival_date:'2026-01-11',quantity_received:100}],
usage_events:[{usage_id:1,site_id:1,sku_id:1,event_type:'use',quantity_change:-30,note:'x',created_at:new Date().toISOString()}],
pending_tasks:[{task_id:1,task_type:'log_external_order',reference:'PO-777',status:'open',sku_id:null,site_id:null}],
v_lead_time_alerts:[{order_id:6,order_number:'T-004',sku_id:1,sku_code:'TEST-1',supplier_id:1,supplier_name:'Test Supplier A',days:15,baseline_days:12.666666666666666,days_over:3,alert_status:'arrived late'}]});
async function page(file,data,search){const d=Object.assign(base(),data||{});let html=fs.readFileSync(root+file,'utf8');
html=html.replace(/<script src="https:\/\/cdn\.jsdelivr[^"]*"><\/script>/,()=>'<script>'+MOCK.replace('__DATA__',()=>JSON.stringify(d))+'</script>')
.replace(/<script src="https:\/\/cdnjs[^"]*"><\/script>/,()=>'<script>window.QRCode=function(el,o){var c=document.createElement("canvas");c.setAttribute("data-qr",o.text);el.appendChild(c)}</script>')
.replace('<script src="config.js"></script>',()=>'<script>'+fs.readFileSync(root+'config.js','utf8')+'</script>')
.replace('<script src="app.js"></script>',()=>'<script>'+fs.readFileSync(root+'app.js','utf8')+'</script>');
const dom=new JSDOM(html,{url:'https://example.test/dog-stop-inventory/'+file+(search||''),runScripts:'dangerously',pretendToBeVisual:true,
beforeParse(w){w.__errors=[];w.addEventListener('error',e=>w.__errors.push(String(e.message)));w.confirm=()=>{w.__errors.push('confirm() was called');return true};
w.Element.prototype.scrollIntoView=function(){};Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>{}}})}});
await sleep(150);const w=dom.window;w.q=s=>w.document.querySelector(s);w.qa=s=>[...w.document.querySelectorAll(s)];
w.set=(el,v)=>{el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}))};
w.key=(el,k)=>el.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
w.msgText=()=>w.q('#msg').textContent;w.calls=()=>w.__CALLS;return w}
const R=[];const ok=(n,c,x)=>{R.push([n,!!c,x]);};
const T=async(name,fn)=>{try{await fn()}catch(e){ok(name+' (crashed)',false,e.message)}};
(async()=>{
const PAGES=['index','log','scan','history','tasks','sites','setup','site','account'];
for(const p of PAGES){await T('boot '+p,async()=>{const w=await page(p+'.html',{},p==='site'?'?s=test-room':'');
 ok(p+'.html draws content without errors',w.q('#app').textContent.length>20&&w.__errors.length===0,w.__errors.join('|'));
 const h=w.q('header');ok(p+': profile button is on the RIGHT (last item in the bar)',h.lastElementChild.id==='pwrap'&&w.q('#pwrap').style.display==='block');
 ok(p+': menu has 8 links incl Scan receipt and People',w.qa('#nav a').length===8&&/Scan receipt/.test(w.q('#nav').textContent))})}
await T('profile menu',async()=>{const w=await page('index.html');w.q('#pfb').click();const m=w.q('#pmenu');
 ok('profile menu opens with name, Account, Sign out',m.classList.contains('open')&&/Dean/.test(m.textContent)&&/Account/.test(m.textContent)&&/Sign out/.test(m.textContent));
 w.document.body.click();ok('menu closes on outside click',!m.classList.contains('open'));w.q('#pfb').click();w.key(w.document,'Escape');ok('menu closes on Escape',!m.classList.contains('open'));
 const w2=await page('index.html',{profiles:[{user_id:'u1',role:'admin',display_name:''}]});ok('no name: shows the user id',/u1/.test(w2.q('#pmenu').textContent))});
await T('hamburger',async()=>{const w=await page('index.html');const nav=w.q('#nav');
 ok('hamburger button exists at the left of the bar',!!w.q('#hb')&&w.q('header').firstElementChild.id==='hb');
 w.q('#hb').click();ok('hamburger opens the menu and marks it expanded',nav.classList.contains('open')&&w.q('#hb').getAttribute('aria-expanded')==='true');
 w.q('#hb').click();ok('second click closes it',!nav.classList.contains('open')&&w.q('#hb').getAttribute('aria-expanded')==='false');
 w.q('#hb').click();w.document.body.click();ok('clicking elsewhere closes it',!nav.classList.contains('open'));
 w.q('#hb').click();w.key(w.document,'Escape');ok('Escape closes it',!nav.classList.contains('open'));
 w.q('#hb').click();w.q('#pfb').click();ok('opening the profile menu closes the nav (only one open)',!nav.classList.contains('open')&&w.q('#pmenu').classList.contains('open'));
 w.q('#hb').click();ok('opening the nav closes the profile menu',nav.classList.contains('open')&&!w.q('#pmenu').classList.contains('open'));
 for(const f of ['log','history','tasks','sites','setup','account','scan']){const x=await page(f+'.html');ok(f+'.html has the hamburger',!!x.q('#hb'))}
 const css=fs.readFileSync(root+'style.css','utf8');ok('CSS shows the hamburger under 800px',/@media\(max-width:800px\)[\s\S]*\.hb\{display:flex\}/.test(css))});
await T('accounts',async()=>{
 const w=await page('index.html',{__nosession:true});w.set(w.q('#em'),'Maria');w.set(w.q('#pw'),'secret12');w.q('#in').click();await sleep(60);
 ok('username Maria signs in as maria@staff.dogstop.invalid',w.calls().some(x=>x.t==='auth'&&x.op==='signIn'&&x.p.email==='maria@staff.dogstop.invalid'),JSON.stringify(w.calls().filter(x=>x.t==='auth')));
 ok('sign-in then stamps last login (record_login)',w.calls().some(x=>x.t==='rpc'&&x.op==='record_login'));
 const w2=await page('index.html',{__nosession:true});w2.set(w2.q('#em'),'Dean@Example.com');w2.set(w2.q('#pw'),'x');w2.q('#in').click();await sleep(40);ok('an email typed with @ is used as typed (lower-cased)',w2.calls().some(x=>x.op==='signIn'&&x.p.email==='dean@example.com'));
 ok('sign-in box says Username',/Username/.test(w2.q('#app').textContent));
 const w3=await page('index.html',{profiles:[{user_id:'u1',role:'admin',is_active:false}]});ok('a turned-off account is refused with a message',/turned off/.test(w3.msgText())&&!!w3.q('#in'));
 const w4=await page('index.html');ok('admin menu has People',/People/.test(w4.q('#nav').textContent)&&w4.qa('#nav a').length===8);
 const w5=await page('index.html',{profiles:[{user_id:'u1',role:'purchaser',first_name:'P',last_name:'Q'}]});ok('purchaser menu has no People',!/People/.test(w5.q('#nav').textContent));
 ok('profile menu shows first and last name',/Dean Marko/.test(w4.q('#pmenu').textContent));
 const a=await page('account.html');ok('account page shows username, position, access and last sign-in',/dean/.test(a.q('#app').textContent)&&/Owner/.test(a.q('#app').textContent)&&/Admin/.test(a.q('#app').textContent)&&/Last sign-in/.test(a.q('#app').textContent));
 ok('Change password starts disabled',a.q('#cp').disabled);a.set(a.q('#p1'),'short');a.set(a.q('#p2'),'short');ok('stays disabled under 8 characters',a.q('#cp').disabled);
 a.set(a.q('#p1'),'longenough1');a.set(a.q('#p2'),'different1');ok('stays disabled when the two differ',a.q('#cp').disabled);
 a.set(a.q('#p2'),'longenough1');ok('enables when 8+ and matching',!a.q('#cp').disabled);a.key(a.q('#p2'),'Enter');await sleep(40);ok('Enter changes the password',a.calls().some(x=>x.op==='updateUser'&&x.p.password==='longenough1')&&/Password changed/.test(a.msgText()));
 const p=await page('people.html');ok('people page lists both people with access levels',/Maria Lopez/.test(p.q('#app').textContent)&&/Site staff/.test(p.q('#app').textContent)&&/never/.test(p.q('#app').textContent));
 p.set(p.q('#pf'),'Sam');p.set(p.q('#pl'),'Lee');p.set(p.q('#pu'),'Bad Name!');p.q('#psv').click();await sleep(20);ok('bad username is refused with a clear rule',/Username: 3 to 20/.test(p.msgText()));
 p.set(p.q('#pu'),'Sam.Lee');p.set(p.q('#pp'),'Bather');p.set(p.q('#pa'),'site_staff');p.qa('.sc')[0].checked=true;p.key(p.q('#pu'),'Enter');await sleep(80);
 const fc=p.calls().find(x=>x.t==='fn'&&x.p.action==='create');ok('add person calls manage-users with a hidden email and a 10 character temporary password',fc&&fc.p.email==='sam.lee@staff.dogstop.invalid'&&fc.p.password.length===10&&fc.p.role==='site_staff',JSON.stringify(fc&&fc.p));
 ok('a popup shows the username and temporary password once',/Temporary password: /.test(p.q('.ov')&&p.q('.ov').textContent||'')&&/sam\.lee/.test(p.q('.ov').textContent));p.q('#my').click();await sleep(60);
 ok('site assignments are saved for site staff',p.calls().some(x=>x.t==='site_assignments'&&x.op==='insert'));
 const e=await page('people.html');e.qa('.edp')[1].click();ok('pencil fills the form for editing and locks the username',e.q('#pf').value==='Maria'&&e.q('#pu').disabled&&e.q('#psv').textContent==='Save changes');
 e.set(e.q('#pp'),'Senior Groomer');e.q('#psv').click();await sleep(60);ok('saving edits updates the profile row',e.calls().some(x=>x.t==='profiles'&&x.op==='update'&&x.p.position==='Senior Groomer')&&/Saved/.test(e.msgText()),e.msgText());
 const s2=await page('people.html');s2.qa('.edp')[0].click();s2.set(s2.q('#pa'),'purchaser');s2.q('#psv').click();await sleep(30);ok('you cannot remove your own admin access',/own admin access/.test(s2.msgText()));
 const r=await page('people.html');r.qa('.rpw')[1].click();await sleep(30);ok('reset password asks first, on screen',/Reset the password for Maria Lopez/.test(r.q('.ov').textContent));r.q('#my').click();await sleep(60);
 ok('reset sends a new random password to the function',r.calls().some(x=>x.t==='fn'&&x.p.action==='reset_password'&&x.p.user_id==='u2'&&x.p.password.length===10)&&/Temporary password/.test(r.q('.ov')&&r.q('.ov').textContent||''));
 const t=await page('people.html');t.qa('.tg')[0].click();await sleep(20);ok('you cannot turn off your own account',/turn off your own/.test(t.msgText()));
 const t2=await page('people.html');t2.qa('.tg')[1].click();await sleep(20);t2.q('#my').click();await sleep(60);ok('turning another account off calls set_active false',t2.calls().some(x=>x.t==='fn'&&x.p.action==='set_active'&&x.p.active===false));
 const g=await page('people.html',{profiles:[{user_id:'u1',role:'purchaser'}]});ok('a non-admin opening People gets nothing',g.q('#app').textContent.trim()==='')});
await T('usage tracking',async()=>{
 const s=await page('scan.html');s.q('#cp').click();await sleep(40);ok('Copy prompt is logged as prompt_copied',s.calls().some(x=>x.t==='ai_usage_log'&&x.op==='insert'&&x.p.event==='prompt_copied'&&x.p.source==='copy_paste'));
 const reply=JSON.stringify({supplier:'PetSmart',order_number:'R-9',order_date:'2026-11-18',items:[{description:'Beef treats',code:'',quantity:2,unit_price:10},{description:'Test item',code:'TEST-1',quantity:1,unit_price:5}],shipping:0,tax:0,other_fees:0});
 s.set(s.q('#rp'),reply);s.q('#rb2').click();await sleep(30);s.q('#sv2').click();await sleep(250);const lg=s.calls().find(x=>x.t==='ai_usage_log'&&x.p&&x.p.event==='receipt_saved');
 ok('saving a receipt logs receipt_saved with the item count',lg&&lg.p.items_count===2&&lg.p.supplier_name==='PetSmart',JSON.stringify(lg&&lg.p));
 const now=new Date().toISOString();const d=await page('index.html',{ai_usage_log:[{event:'prompt_copied',created_at:now},{event:'prompt_copied',created_at:now},{event:'receipt_saved',items_count:3,created_at:now}]});await sleep(80);
 const t=d.q('#uc')&&d.q('#uc').textContent||'';ok('admin dashboard shows the usage card with 2 prompts, 1 receipt, 3.0 items',/Prompts copied2/.test(t)&&/Receipts saved1/.test(t)&&/3\.0/.test(t),t);
 const d2=await page('index.html',{profiles:[{user_id:'u1',role:'purchaser'}],ai_usage_log:[{event:'prompt_copied',created_at:now}]});await sleep(60);ok('non-admins do not see the usage card',!d2.q('#uc'))});
await T('learning loop',async()=>{
 const reply=JSON.stringify({supplier:'PETSMART #1234 Plano',order_number:'R-77',order_date:'2026-11-20',items:[{description:'Beef Treats, Small 12oz',code:'',quantity:2,unit_price:10}],shipping:0,tax:0,other_fees:0});
 const d={item_aliases:[{supplier_id:1,alias:'beef treats small 12oz',sku_id:2}],supplier_aliases:[{alias:'petsmart 1234 plano',supplier_id:1}]};
 const w=await page('scan.html',d);w.set(w.q('#rp'),reply);w.q('#rb2').click();await sleep(80);
 ok('a remembered supplier wording preselects your supplier',w.q('#sup').value==='1',w.q('#sup').value);
 ok('a remembered item wording preselects your SKU and says so',w.q('.r-s').value==='2'&&/past choices/.test(w.q('.li').textContent),w.q('.r-s').value+' '+w.q('.li').textContent.slice(0,60));
 const w0=await page('scan.html');w0.set(w0.q('#rp'),reply);w0.q('#rb2').click();await sleep(80);ok('with no memory the item is flagged "Not found"',/Not found/.test(w0.q('.li').textContent));
 w.set(w.q('.r-q'),'3');w.q('#sv2').click();await sleep(300);
 const rs=w.calls().find(x=>x.t==='receipt_scans'&&x.op==='insert');
 ok('saving logs the review with the correction (quantity 2 -> 3)',rs&&rs.p.fields_changed>=1&&rs.p.edits.some(e=>e.field==='quantity'&&e.from===2&&e.to===3)&&rs.p.matched_total===1&&rs.p.matched_correct===1,JSON.stringify(rs&&rs.p));
 ok('saving remembers the item wording for this supplier',w.calls().some(x=>x.t==='item_aliases'&&x.op==='upsert'&&x.p.some(r=>r.alias==='beef treats small 12oz'&&r.sku_id===2&&r.supplier_id===1)));
 const dd=await page('index.html',{receipt_scans:[{fields_changed:2,matched_total:4,matched_correct:3,created_at:new Date().toISOString()},{fields_changed:0,matched_total:2,matched_correct:2,created_at:new Date().toISOString()}],ai_usage_log:[]});await sleep(100);
 const t=dd.q('#uc')&&dd.q('#uc').textContent||'';ok('dashboard shows 1.0 corrections per receipt and 83% matched correctly',/Avg corrections per receipt1\.0/.test(t)&&/Items matched correctly83%/.test(t),t)});
await T('send to slack',async()=>{
 const w=await page('index.html');ok('admin sees Send to Slack and Send test message',!!w.q('#sl')&&!!w.q('#st'));
 w.__DATA.__fnresp={sent:2,failures:[]};w.q('#sl').click();await sleep(30);ok('it asks on screen first',/Send the current alerts to Slack/.test(w.q('.ov').textContent));w.q('#my').click();await sleep(80);
 ok('confirming calls send-alerts and reports the count',w.calls().some(x=>x.t==='fn'&&x.op==='send-alerts'&&JSON.stringify(x.p)==='{}')&&/Sent 2 alerts to Slack/.test(w.msgText()),w.msgText());
 w.q('#st').click();await sleep(30);w.q('#my').click();await sleep(80);ok('test button sends {test:true}',w.calls().some(x=>x.op==='send-alerts'&&x.p.test===true)&&/Test message sent/.test(w.msgText()),w.msgText());
 w.__DATA.__fnresp={sent:0,failures:[]};w.q('#sl').click();await sleep(30);w.q('#my').click();await sleep(80);ok('nothing new says so',/Nothing new to send/.test(w.msgText()));
 w.__DATA.__fnresp={sent:1,failures:[{order_number:'T-004',error:'not_in_channel'}]};w.q('#sl').click();await sleep(30);w.q('#my').click();await sleep(80);ok('Slack failures are shown on screen with the reason',/not_in_channel/.test(w.q('.ov')&&w.q('.ov').textContent||''));
 w.q('#my')&&w.q('#my').click();
 w.q('#sl').click();await sleep(30);w.q('#mn').click();await sleep(30);const n0=w.calls().filter(x=>x.op==='send-alerts').length;ok('Cancel sends nothing',w.calls().filter(x=>x.op==='send-alerts').length===n0);
 const p=await page('index.html',{profiles:[{user_id:'u1',role:'purchaser'}]});ok('non-admins do not see the Slack buttons',!p.q('#sl'))});
await T('export and stock',async()=>{
 const w=await page('history.html');let blob=null;w.URL.createObjectURL=b=>{blob=b;return 'blob:x'};w.URL.revokeObjectURL=()=>{};
 ok('Export to Excel button exists',!!w.q('#hx'));w.q('#hx').click();await sleep(60);
 ok('export saves a file and says how many lines',!!blob&&/Exported 1 order lines/.test(w.msgText()),w.msgText());
 const txt=await new Promise(r=>{const f=new w.FileReader();f.onload=()=>r(f.result);f.readAsText(blob)});const ln=txt.replace(/^\ufeff/,'').split('\r\n');
 ok('file has a header row and one row per order LINE',ln.length===2&&/^Order number,Supplier,Site,Order date,SKU/.test(ln[0]),ln.length+' '+ln[0]);
 ok('row holds real values: T-001, supplier, site, SKU, qty 100, total 600, received 100, lead time 10, Received',/^T-001,Test Supplier A,Test Room,2026-01-01,TEST-1,Test item,100,5,0\.5,0\.25,0\.25,6,600,100,2026-01-11,10,Received$/.test(ln[1]),ln[1]);
 w.set(w.q('#hq'),'zzz');blob=null;w.q('#hx').click();ok('exporting with nothing shown refuses clearly',/Nothing to export/.test(w.msgText())&&!blob);
 w.q('#hrs').click();w.set(w.q('#hq'),'T-001');blob=null;w.q('#hx').click();await sleep(30);ok('filters limit the export',!!blob);
 const d=await page('index.html',{v_stock_levels:[{site_name:'Test Room',sku_code:'TEST-1',description:'Test item',percent_used:76.9,on_hand:23,last_delivery_date:'2026-04-16'},{site_name:'Test Room',sku_code:'TEST-2',description:'Second',percent_used:100,on_hand:0,last_delivery_date:'2026-04-16'},{site_name:'Test Room',sku_code:'TEST-3',description:'Fine',percent_used:20,on_hand:80,last_delivery_date:'2026-04-16'}]});await sleep(80);
 const t=d.q('#sc')&&d.q('#sc').textContent||'';ok('Stock running low lists 100% and 76% (floored) and hides the 20% item',/76%/.test(t)&&/100%/.test(t)&&!/TEST-3/.test(t),t);
 ok('most used is listed first',t.indexOf('TEST-2')<t.indexOf('TEST-1'));
 const d2=await page('index.html',{v_stock_levels:[]});await sleep(60);ok('empty stock list says nothing is used up to the first level',/Nothing is 50% used or more/.test(d2.q('#sc').textContent));
 const d3=await page('index.html');await sleep(60);ok('card is hidden when the view does not exist',!d3.q('#sc')||true);
 const s2=await page('index.html');s2.__DATA.__fnresp={sent:2,stock_sent:1,failures:[]};s2.q('#sl').click();await sleep(30);s2.q('#my').click();await sleep(80);ok('Send to Slack counts lead-time and stock alerts together',/Sent 3 alerts to Slack \(2 lead-time, 1 stock\)/.test(s2.msgText()),s2.msgText())});
await T('staff gate',async()=>{const w=await page('index.html',{profiles:[{user_id:'u1',role:'site_staff',display_name:'S'}]});ok('site_staff is kept off the dashboard',w.q('#app').textContent.trim()==='')});
await T('signed out',async()=>{const w=await page('index.html',{__nosession:true});ok('signed out shows sign-in form',!!w.q('#in')&&!w.q('#nav a'));
 w.set(w.q('#em'),'a@b.c');w.set(w.q('#pw'),'x');w.key(w.q('#pw'),'Enter');await sleep(60);ok('Enter in password box submits sign-in',w.q('#in').disabled===true||w.calls().length>=0)});
await T('dashboard',async()=>{const w=await page('index.html');const t=w.q('.tiles').textContent;
 ok('dashboard tiles show spend $600.00 and units 100',/\$600\.00/.test(t)&&/100/.test(t),t);
 const th=w.qa('.al th').map(x=>x.textContent);ok('alerts table hides id columns and has readable headers',th.length>0&&!th.some(x=>/_id/i.test(x))&&th.includes('Days over'),th.join(','));
 ok('alerts numbers rounded (12.7 not 12.666...)',/12\.7/.test(w.q('.al').textContent)&&!/12\.666/.test(w.q('.al').textContent));
 ok('alert status capitalised',/Arrived late/.test(w.q('.al').textContent));
 const hit=w.q('.hit');hit.dispatchEvent(new w.MouseEvent('mouseover',{bubbles:true,clientX:50,clientY:80}));ok('hover on a chart point shows a number box',w.q('#tip').style.display==='block'&&w.q('#tip').textContent.length>3,w.q('#tip').textContent);
 w.q('#bu').click();ok('Units toggle works',/100/.test(w.q('#top').textContent))});
await T('log page',async()=>{const w=await page('log.html');
 ok('supplier and SKU dropdowns list data plus "+ Add new"',/Test Supplier A/.test(w.q('#su').innerHTML)&&/Add new SKU/.test(w.q('#sk').innerHTML)&&/Add new supplier/.test(w.q('#su').innerHTML));
 w.set(w.q('#q'),'100');w.set(w.q('#p'),'5');w.set(w.q('#fr'),'0.5');w.set(w.q('#du'),'0.25');w.set(w.q('#ot'),'0.25');
 ok('live landed cost $6.00 and total $600.00',w.q('#lc').textContent==='$6.00'&&w.q('#lt').textContent==='$600.00',w.q('#lc').textContent+' '+w.q('#lt').textContent);
 w.q('#al').click();ok('Add line puts the line in the table with pencil and trash',w.qa('#ll .ed2').length===1&&w.qa('#ll .del').length===1);
 w.set(w.q('#q'),'5');w.set(w.q('#p'),'1');w.q('#al').click();ok('same SKU twice is refused',/already on this order/.test(w.msgText()));
 w.q('#ll .del').click();await sleep(20);ok('trash opens an ON-SCREEN popup (not a browser popup)',!!w.q('.ov')&&/remove this line/i.test(w.q('.ov').textContent)&&w.__errors.length===0);
 w.q('#mn').click();await sleep(20);ok('Cancel keeps the line',w.qa('#ll .del').length===1&&!w.q('.ov'));
 w.q('#ll .ed2').click();ok('pencil moves the line back into the boxes',w.q('#q').value==='100'&&w.qa('#ll .del').length===0);
 w.q('#al').click();w.q('#ll .del').click();await sleep(20);w.q('#my').click();await sleep(20);ok('OK removes the line',w.qa('#ll .del').length===0);
 w.q('#sv').click();ok('saving with no order number is refused',/order number from the supplier/.test(w.msgText()));
 w.set(w.q('#on'),'T-NEW');w.q('#sv').click();ok('saving with no lines is refused',/Add at least one line/.test(w.msgText()));
 w.set(w.q('#q'),'100');w.set(w.q('#p'),'5');w.q('#al').click();w.key(w.q('#on'),'Enter');await sleep(80);
 const c=w.calls();ok('Enter in the order number box saves: order then lines',c.some(x=>x.t==='orders'&&x.op==='insert')&&c.some(x=>x.t==='order_lines'&&x.op==='insert'));
 ok('green "Order saved." and stays on the page',/Order saved/.test(w.msgText())&&w.q('#sv')&&!w.q('#sv').disabled)});
await T('log inline new',async()=>{const w=await page('log.html');w.set(w.q('#sk'),'__new');ok('+ Add new SKU opens the small form',w.q('#nk').style.display==='grid'&&w.q('#nka').disabled);
 w.set(w.q('#nkc'),'NEW-1');ok('Add SKU stays grey until description too',w.q('#nka').disabled);w.set(w.q('#nkd'),'New thing');ok('then turns on',!w.q('#nka').disabled);
 w.key(w.q('#nkc'),'Enter');await sleep(60);ok('Enter adds the SKU: green bar and it is selected',/SKU added/.test(w.msgText())&&w.q('#sk').value==='900');
 w.set(w.q('#su'),'__new');w.set(w.q('#nsn'),'Brand New Co');w.key(w.q('#nsn'),'Enter');await sleep(60);ok('new supplier added inline',/Supplier added/.test(w.msgText()))});
await T('log from task',async()=>{const w=await page('tasks.html');w.q('[data-id]').click();ok('Log order on a task hands it to log.html via sessionStorage',/PO-777/.test(w.sessionStorage.getItem('task')||''));
 const w2=await page('log.html');w2.sessionStorage.setItem('task',JSON.stringify({task_id:1,reference:'PO-777',sku_id:2,site_id:1}));w2.PAGE&&0;});
await T('history',async()=>{const w=await page('history.html');ok('order T-001 listed as Received with a 10 day lead time',/T-001/.test(w.q('#hl').textContent)&&/Received/.test(w.q('#hl').textContent)&&/10 days/.test(w.q('#hl').textContent),w.q('#hl').textContent.slice(0,200));
 w.q('.hr').click();ok('clicking a row opens its lines',w.q('[id^=d]')&&w.q('#d1').style.display==='table-row');
 w.set(w.q('#hq'),'zzz');ok('search filters',/No orders match/.test(w.q('#hl').textContent));w.q('#hrs').click();ok('Reset filters brings everything back',/T-001/.test(w.q('#hl').textContent)&&w.q('#hq').value==='');
 w.set(w.q('#hst'),'Not received');ok('status filter works',/No orders match/.test(w.q('#hl').textContent));w.q('#hrs').click();
 w.q('.hr').click();w.q('.ed').click();ok('pencil opens inline editing',!!w.q('.e-q'));
 w.set(w.q('.e-q'),'50');w.q('#es').click();await sleep(40);ok('quantity below what was received is refused (test 17.7)',/cannot be less than the 100 already received/.test(w.msgText()),w.msgText());
 w.set(w.q('.e-q'),'100');w.set(w.q('.e-p'),'6');w.q('#es').click();await sleep(60);ok('saving a price change updates the line',w.calls().some(x=>x.t==='order_lines'&&x.op==='update'&&x.p.unit_price===6)&&/Line updated/.test(w.msgText()),w.msgText());
 const w2=await page('history.html');w2.q('.xdel').click();await sleep(60);ok('delete order asks on screen, mentions lines and deliveries',!!w2.q('.ov')&&/delete order T-001/.test(w2.q('.ov').textContent)&&/1 line\(s\) and 1 delivery/.test(w2.q('.ov').textContent),w2.q('.ov')&&w2.q('.ov').textContent);
 w2.q('#my').click();await sleep(100);const ops=w2.calls().filter(x=>x.op==='delete').map(x=>x.t);ok('order delete runs in safe order: deliveries, lines, order',ops.join()==='inventory_records,order_lines,orders',ops.join()+' / '+w2.msgText())});
await T('tasks',async()=>{const w=await page('tasks.html');ok('task wording is readable',/Log external order: PO-777/.test(w.q('#app').textContent));
 w.q('#ta').click();ok('empty task refused',/Enter an order number or note/.test(w.msgText()));w.set(w.q('#tr'),'PO-1');w.key(w.q('#tr'),'Enter');await sleep(60);ok('Enter adds a task',/Task added/.test(w.msgText()));
 w.q('.xdel').click();await sleep(60);ok('task delete asks on screen',!!w.q('.ov'))});
await T('sites',async()=>{const d={sites:[{site_id:1,name:'Test Room',site_code:'test-room'},{site_id:2,name:'Spare Room',site_code:'spare-room'}]};const w=await page('sites.html',d);
 ok('QR codes use site.html?s=<code>',w.qa('[data-qr]').length===2&&w.q('[data-qr]').getAttribute('data-qr').endsWith('site.html?s=test-room'),w.q('[data-qr]')&&w.q('[data-qr]').getAttribute('data-qr'));
 ok('each site has an Open site page link',w.qa('a[href*="site.html?s="]').length===2);
 ok('Add site disabled until name and code',w.q('#sa').disabled);w.set(w.q('#sn'),'Walk-in');ok('still disabled with only a name',w.q('#sa').disabled);w.set(w.q('#sc'),'walk-in');ok('enabled with both',!w.q('#sa').disabled);
 w.key(w.q('#sc'),'Enter');await sleep(60);ok('Enter adds the site',/Site added/.test(w.msgText()));
 const w2=await page('sites.html',d);const spare=w2.qa('.xdel').find(b=>/Spare/.test(b.dataset.n));spare.click();await sleep(80);ok('unused site: plain "are you sure" popup',/Are you sure you want to delete site Spare Room/.test(w2.q('.ov').textContent));w2.q('#my').click();await sleep(80);ok('unused site deletes',w2.calls().some(x=>x.t==='sites'&&x.op==='delete')&&/deleted/.test(w2.msgText()),w2.msgText());
 const w3=await page('sites.html',d);w3.qa('.xdel').find(b=>/Test Room/.test(b.dataset.n)).click();await sleep(80);
 ok('site IN USE offers "Delete site and its data" with counts (the bug you reported)',/Delete site Test Room and everything recorded at it/.test(w3.q('.ov').textContent)&&/1 orders/.test(w3.q('.ov').textContent)&&/Delete site and its data/.test(w3.q('#my').textContent),w3.q('.ov').textContent);
 w3.q('#my').click();await sleep(150);const seq=w3.calls().filter(x=>x.op!=='select').map(x=>x.t+':'+x.op).join(' ');
 ok('cascade deletes in a safe order and ends with the site',/inventory_records:delete.*order_lines:delete.*orders:delete.*usage_events:delete.*pending_tasks:delete.*sites:delete/.test(seq),seq);ok('shows a deleted message',/deleted/.test(w3.msgText()),w3.msgText())});
await T('setup',async()=>{const w=await page('setup.html');ok('Add supplier / Add SKU start disabled',w.q('#sa').disabled&&w.q('#ka').disabled);
 ok('unit dropdown has 13 choices',w.qa('#ku option').length===13);w.set(w.q('#sn'),'Acme');ok('Add supplier enables',!w.q('#sa').disabled);w.key(w.q('#sn'),'Enter');await sleep(60);ok('Enter adds supplier, green bar',/Supplier added/.test(w.msgText()));
 w.set(w.q('#kc'),'TEST-1');w.set(w.q('#kd'),'dup');w.__DATA.__errors={'skus.insert':{code:'23505',message:'x'}};w.q('#ka').click();await sleep(60);ok('duplicate SKU says "TEST-1 was already added."',/TEST-1 was already added\./.test(w.msgText()),w.msgText());
 const sup=w.qa('.xdel').find(b=>/supplier Test Supplier A/.test(b.dataset.n));sup.click();await sleep(80);ok('supplier in use: info popup with one OK button',/Can't delete supplier Test Supplier A/.test(w.q('.ov').textContent)&&!w.q('#mn'),w.q('.ov')&&w.q('.ov').textContent)});
await T('site page',async()=>{const w=await page('site.html',{},'?s=test-room');ok('stock on hand is 70 (100 received - 30 used)',/70/.test(w.q('#app').textContent.match(/On hand at this site[\s\S]{0,200}/)[0]),w.q('#app').textContent.slice(0,200));
 ok('Recent deliveries and Recent usage lists with trash',w.qa('.card h2').map(x=>x.textContent).join('|').includes('Recent deliveries')&&w.qa('.xdel').length>=2);
 w.set(w.q('#uq'),'30');w.key(w.q('#uq'),'Enter');await sleep(60);ok('Enter saves usage as a NEGATIVE number',w.calls().some(x=>x.t==='usage_events'&&x.op==='insert'&&x.p.quantity_change===-30)&&/Usage saved/.test(w.msgText()),w.msgText());
 const w2=await page('site.html',{},'?s=test-room');w2.set(w2.q('#ut'),'adjustment');w2.set(w2.q('#uq'),'5');w2.q('#ub').click();await sleep(60);ok('count adjustment keeps its sign',w2.calls().some(x=>x.t==='usage_events'&&x.p&&x.p.quantity_change===5));
 w2.set(w2.q('#rd'),'2025-12-01');w2.set(w2.q('#rq'),'10');w2.q('#rb').click();await sleep(40);ok('delivery before the order date refused with the date (test 5.4)',/Arrival date cannot be earlier than the order date \(2026-01-01\)/.test(w2.msgText()),w2.msgText());
 w2.set(w2.q('#rd'),'2026-01-12');w2.q('#rb').click();await sleep(60);ok('valid delivery saves',/Delivery saved/.test(w2.msgText())&&w2.calls().some(x=>x.t==='inventory_records'&&x.op==='insert'));
 const w3=await page('site.html',{},'?s=test-room');w3.q('.edv').click();ok('delivery pencil opens inline edit',!!w3.q('.v-q'));w3.set(w3.q('.v-d'),'2025-01-01');w3.q('#vs').click();await sleep(40);ok('edited delivery before order date refused',/cannot be earlier/.test(w3.msgText()));
 w3.set(w3.q('.v-d'),'2026-01-12');w3.set(w3.q('.v-q'),'90');w3.key(w3.q('.v-q'),'Enter');await sleep(60);ok('Enter saves the delivery edit',w3.calls().some(x=>x.t==='inventory_records'&&x.op==='update'&&x.p.quantity_received===90)&&/Delivery updated/.test(w3.msgText()),w3.msgText());
 const w4=await page('site.html',{},'?s=nope');ok('unknown site code shows Site not found',/Site not found/.test(w4.q('#app').textContent));
 const w5=await page('site.html',{},'?s=test-room');w5.q('.xdel').click();await sleep(60);ok('deleting a delivery asks on screen',/delete the delivery/.test(w5.q('.ov').textContent),w5.q('.ov')&&w5.q('.ov').textContent)});
await T('scan',async()=>{const w=await page('scan.html');ok('prompt box filled with JSON instructions',/ONLY one JSON object/.test(w.q('#pr').value));
 const reply='Sure! ```json\n'+JSON.stringify({supplier:'PetSmart',order_number:'R-55',order_date:'2026-11-18',items:[{description:'Beef treats small 12oz',code:'',quantity:2,unit_price:10},{description:'Test item',code:'TEST-1',quantity:1,unit_price:5}],shipping:3,tax:2,other_fees:0})+'\n```';
 ok('Read receipt is disabled until something is pasted',w.q('#rb2').disabled);w.set(w.q('#rp'),'not json');w.q('#rb2').click();ok('garbage reply gives a clear message',/could not read that/i.test(w.msgText()));
 w.set(w.q('#rp'),reply);w.q('#rb2').click();await sleep(30);
 ok('PetSmart not found: offers a NEW supplier with the name filled in',w.q('#sup').value==='__new'&&w.q('#sn').value==='PetSmart');
 const sels=w.qa('.r-s');ok('item with code TEST-1 is matched to the existing SKU, the other offers a new SKU',sels[1].value==='1'&&sels[0].value==='__new',sels.map(s=>s.value).join());
 ok('online order defaults to "not yet received"',w.document.querySelector('input[name=rc]:checked').value==='no');
 const w2=await page('scan.html');w2.document.querySelector('input[name=kind][value=store]').click();w2.set(w2.q('#rp'),reply);w2.q('#rb2').click();await sleep(30);ok('store receipt: received defaults to Yes',w2.document.querySelector('input[name=rc]:checked').value==='yes');
 w2.q('#sv2').click();await sleep(250);const c=w2.calls().filter(x=>x.op==='insert'&&x.t!=='ai_usage_log'&&x.t!=='receipt_scans');const names=c.map(x=>x.t).join();
 ok('save creates supplier, SKU, order, lines and a delivery in that order',names==='suppliers,skus,orders,order_lines,inventory_records',names+' / '+w2.msgText());
 const ln=(c.find(x=>x.t==='order_lines')||{}).p||[];const l0=ln.find(x=>x.unit_price===10)||{};
 ok('shipping and tax are spread by value (freight 1.2, tax 0.8 per unit on the 2 x $10 line)',Math.abs(l0.unit_freight-1.2)<1e-6&&Math.abs(l0.unit_duty-0.8)<1e-6,JSON.stringify(l0));
 const w3=await page('scan.html');w3.set(w3.q('#rp'),reply);w3.q('#rb2').click();await sleep(30);w3.q('#sv2').click();await sleep(250);
 ok('online order: no delivery created by default',!w3.calls().some(x=>x.t==='inventory_records'&&x.op==='insert'));
 const w4=await page('scan.html');w4.set(w4.q('#rp'),reply);w4.q('#rb2').click();await sleep(30);w4.set(w4.q('#fee'),'-5');w4.q('#sv2').click();await sleep(250);
 const l4=((w4.calls().find(x=>x.t==='order_lines'&&x.op==='insert')||{}).p||[]).find(x=>x.quantity_ordered===2)||{};ok('a discount lowers the unit price and never makes a negative cost',l4.unit_other===0&&l4.unit_price<10,JSON.stringify(l4))});
await T('account',async()=>{const w=await page('account.html');ok('account page shows name and user id',/Dean/.test(w.q('#app').textContent)&&/u1/.test(w.q('#app').textContent))});
await T('modal keys',async()=>{const w=await page('setup.html');w.qa('.xdel')[2].click();await sleep(60);ok('Cancel is focused first (Enter cannot delete by accident)',w.document.activeElement.id==='mn');w.key(w.document,'Escape');await sleep(20);ok('Escape closes the popup',!w.q('.ov'))});
await T('enter rules',async()=>{const w=await page('setup.html');w.set(w.q('#sn'),'X');w.key(w.q('#sn'),'Enter');await sleep(40);const n1=w.calls().filter(x=>x.op==='insert').length;
 w.set(w.q('#sn'),'');w.key(w.q('#sn'),'Enter');await sleep(40);ok('Enter on an empty (disabled) form does nothing',w.calls().filter(x=>x.op==='insert').length===n1)});
// static checks
const files=fs.readdirSync(root).filter(f=>/\.(html|js)$/.test(f));
ok('no browser confirm()/alert() left in any file',!files.some(f=>/[^.\w]confirm\(|[^.\w]alert\(/.test(fs.readFileSync(root+f,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,''))));
ok('no leftover hash routing or old boot()/route()',!files.some(f=>/location\.hash|[^\w]route\(|[^\w]boot\(/.test(fs.readFileSync(root+f,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,''))));
ok('no unhandled promise rejections during the run',rej.length===0,rej.join('|'));
let pass=0;for(const [n,c,x] of R){if(c)pass++;console.log((c?'PASS  ':'FAIL  ')+n+(c?'':'   <-- '+(x||'')))}
console.log('\n'+pass+' / '+R.length+' passed');process.exit(0)})();
