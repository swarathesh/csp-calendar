let snapshot;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>v==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(v);
const day=s=>new Date(s+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/New_York"});
const url=s=>/^https:\/\//.test(s)?esc(s):"#";
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
 document.querySelectorAll("[data-tab]").forEach(x=>{x.classList.toggle("active",x===b);x.setAttribute("aria-pressed",x===b)});
 ["calendar","research","method"].forEach(x=>$(x).hidden=x!==b.dataset.tab);
}));
function renderEvents(){
 if(!snapshot)return;
 const search=$("search").value.toLowerCase(),kind=$("kind").value;
 const rows=snapshot.events.filter(e=>(!kind||e.kind===kind)&&[e.title,e.symbol,e.date].join(" ").toLowerCase().includes(search));
 $("events").innerHTML=rows.map(e=>'<tr><td>'+day(e.date)+'<small>'+esc(e.time)+(e.verified_at?' · cached, verified '+esc(e.verified_at):'')+'</small></td><td>'+esc(e.title)+(e.symbol?'<small>'+esc(e.symbol)+'</small>':'')+'</td><td><span class="tag '+(e.kind==="Macro"?'macro':'')+'">'+esc(e.kind)+'</span></td><td><a target="_blank" rel="noopener noreferrer" href="'+url(e.source)+'">Verify ↗</a></td></tr>').join("");
 $("empty").hidden=!!rows.length;
}
$("search").addEventListener("input",renderEvents);$("kind").addEventListener("change",renderEvents);
function spark(values){
 if(!values||values.length<2)return"";
 const lo=Math.min(...values),range=Math.max(...values)-lo||1;
 const points=values.map((v,i)=>(i/(values.length-1)*400).toFixed(2)+","+(50-(v-lo)/range*45).toFixed(2)).join(" ");
 return '<svg class="spark" viewBox="0 0 400 55" role="img" aria-label="Last 60 completed daily closes"><polyline points="'+points+'" fill="none" stroke="#8ce6c6" stroke-width="2"/></svg>';
}
function metric(label,value){return'<div><small>'+esc(label)+'</small><span>'+esc(value)+'</span></div>'}
function card(c){
 return '<article class="card"><div class="card-top"><div><div class="symbol">'+esc(c.symbol)+'</div><small>Daily close · '+esc(c.price_date||"unavailable")+'</small></div><div class="price">'+money(c.price)+'</div></div>'+spark(c.chart)+'<div class="status">'+esc(c.status)+'</div><p>Reassess: <strong>'+esc(c.reassess_date?day(c.reassess_date):"Pending data")+'</strong></p>'+
 (c.blockers?.length?'<p>Near-term catalysts: '+esc(c.blockers.join(" · "))+'</p>':'')+
 (c.missing_sources?.length?'<p>Calendar sources not live: '+esc(c.missing_sources.join(", "))+'. Timing cannot be cleared.</p>':'')+
 (c.detail?'<p>'+esc(c.detail)+'</p>':'')+
 c.candidates.map((r,i)=>'<div class="candidate"><strong>'+day(r.expiry)+'</strong> <small>· '+r.dte+' DTE today</small><div class="metrics">'+metric("Candidate strike",money(r.strike))+metric("Model ceiling",money(r.model_ceiling))+metric("Collateral",money(r.collateral))+'</div><div class="metrics">'+metric("Indicative credit",money(r.premium))+metric("Breakeven",money(r.breakeven))+metric("Return on collateral",r.return_pct==null?"—":r.return_pct+"%")+'</div><p>Historical tail '+r.tail_pct+'% · worst '+r.worst_pct+'% · '+r.samples+' overlapping windows.</p><p>'+esc(r.quote_note)+'</p>'+(r.last_trade?'<small>Option last traded: '+esc(r.last_trade)+' (not bid time)</small>':'')+'<details><summary>Events through expiration ('+r.events.length+')</summary><p>'+esc(r.events.join(" · ")||"None reported in monitored sources")+'</p></details></div>').join("")+
 '<p><a target="_blank" rel="noopener noreferrer" href="'+url(c.source)+'">View options source ↗</a></p></article>';
}
async function load(){
 try{
  const res=await fetch("data/latest.json",{cache:"no-store"});if(!res.ok)throw Error("No published snapshot yet");
  snapshot=await res.json();
  const age=(Date.now()-new Date(snapshot.generated_at).getTime())/3600000;
  const failed=snapshot.sources.filter(s=>s.status!=="ok");
  $("updated").textContent=new Date(snapshot.generated_at).toLocaleString("en-US",{timeZone:"America/New_York"})+" ET";
  $("count").textContent=snapshot.events.length;
  const next=snapshot.events.find(e=>e.kind==="Macro");
  $("next").textContent=next?day(next.date)+" · "+next.title:"No verified upcoming macro data";
  $("coverage").textContent="Reported events through "+day(snapshot.through)+" • provider coverage may be incomplete";
  $("banner").textContent=age>12?"STALE SNAPSHOT — last refresh was over 12 hours ago. Do not use these targets without refreshing.":failed.length?"PARTIAL COVERAGE — "+failed.map(s=>s.name.toUpperCase()).join(", ")+" not live (cached or unavailable). CSP dates and strikes require manual verification.":"Sources refreshed. Quotes are delayed; verify dates, liquidity, and current prices before trading.";
  $("banner").classList.toggle("ok",age<=12&&!failed.length);
  if(age>12)snapshot.watchlist.forEach(c=>c.status="STALE — REFRESH BEFORE USE");
  $("cards").innerHTML=snapshot.watchlist.map(card).join("");
  $("sources").innerHTML=snapshot.sources.map(s=>'<div class="source-row"><strong>'+esc(s.name.toUpperCase())+'</strong><span>'+esc(s.status)+' · '+(s.upcoming_records??s.records??0)+' upcoming records'+(s.message?' · '+esc(s.message):'')+'</span></div>').join("");
  renderEvents();
 }catch(err){$("banner").textContent="No data snapshot available yet. Check the refresh workflow in GitHub Actions. Targets will appear only after data is collected."; $("updated").textContent="Awaiting first successful refresh";$("empty").hidden=false;}
}
load();
