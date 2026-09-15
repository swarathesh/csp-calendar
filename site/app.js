let snapshot;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>v==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(v);
const day=s=>new Date(s+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/New_York"});
const url=s=>/^https:\/\//.test(s)?esc(s):"#";
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
 document.querySelectorAll("[data-tab]").forEach(x=>{x.classList.toggle("active",x===b);x.setAttribute("aria-pressed",x===b)});
 ["calendar","research","method","intelligence"].forEach(x=>$(x).hidden=x!==b.dataset.tab);
}));
function renderEvents(){
 if(!snapshot)return;
 const rows=CalendarTools.filterEvents(snapshot.events,{
  search:$("search").value,kind:$("kind").value,
  from:$("date-from").value,to:$("date-to").value
 });
 const invalid=$("date-from").value && $("date-to").value && $("date-from").value>$("date-to").value;
 $("event-count").textContent=invalid?"Choose an end date on or after the start date.":rows.length+" of "+snapshot.events.length+" reported events";
 $("export-events").disabled=!rows.length;
 $("events").innerHTML=rows.map(e=>'<tr><td>'+day(e.date)+'<small>'+esc(e.time)+(e.verified_at?' · cached, verified '+esc(e.verified_at):'')+'</small></td><td>'+esc(e.title)+(e.symbol?'<small>'+esc(e.symbol)+'</small>':'')+'</td><td><span class="tag '+(e.kind==="Macro"?'macro':'')+'">'+esc(e.kind)+'</span></td><td><a target="_blank" rel="noopener noreferrer" href="'+url(e.source)+'">Verify ↗</a></td></tr>').join("");
 $("empty").hidden=!!rows.length;
}
$("search").addEventListener("input",renderEvents);$("kind").addEventListener("change",renderEvents);
["date-from","date-to"].forEach(id=>$(id).addEventListener("change",renderEvents));
$("reset-events").addEventListener("click",()=>{
 $("search").value="";$("kind").value="";
 $("date-from").value=CalendarTools.easternToday();$("date-to").value="";
 renderEvents();
});
$("export-events").addEventListener("click",()=>{
 if(!snapshot)return;
 const rows=CalendarTools.filterEvents(snapshot.events,{search:$("search").value,kind:$("kind").value,from:$("date-from").value,to:$("date-to").value});
 if(!rows.length)return;
 const link=document.createElement("a");
 const objectUrl=URL.createObjectURL(new Blob(["\ufeff"+CalendarTools.eventsCsv(rows)],{type:"text/csv;charset=utf-8"}));
 link.href=objectUrl;link.download="catalyst-events.csv";document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
});
$("date-from").value=CalendarTools.easternToday();
function spark(values){
 if(!values||values.length<2)return"";
 const lo=Math.min(...values),range=Math.max(...values)-lo||1;
 const points=values.map((v,i)=>(i/(values.length-1)*400).toFixed(2)+","+(50-(v-lo)/range*45).toFixed(2)).join(" ");
 return '<svg class="spark" viewBox="0 0 400 55" role="img" aria-label="Last 60 completed daily closes"><polyline points="'+points+'" fill="none" stroke="#8ce6c6" stroke-width="2"/></svg>';
}
function metric(label,value){return'<div><small>'+esc(label)+'</small><span>'+esc(value)+'</span></div>'}

function candidateEvents(candidate){
 return (candidate.events||[]).flatMap(e=>typeof e==="string"
   ? (snapshot?.events||[]).filter(x=>x.title===e&&x.date<=candidate.expiry)
   : [e]).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
}
function eventTable(events){
 if(!events.length)return '<p>No dated events reported in monitored sources for this expiration.</p>';
 return '<div class="table-wrap"><table class="expiry-event-table"><thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Time / ET</th></tr></thead><tbody>'+
 events.map(e=>'<tr><td><time datetime="'+esc(e.date)+'">'+day(e.date)+'</time></td><td>'+esc(e.title)+
 (e.source?'<small><a href="'+url(e.source)+'" target="_blank" rel="noopener noreferrer">Verify source ↗</a></small>':'')+
 (e.verified_at?'<small>Cached · verified '+esc(e.verified_at)+'</small>':'')+
 '</td><td>'+esc(e.time||"Time not supplied")+'</td></tr>').join("")+'</tbody></table></div>';
}
function eventCalendar(events,expiry){
 const start=events.length?events[0].date:expiry;
 const startDate=new Date(start+"T12:00:00Z"),endDate=new Date(expiry+"T12:00:00Z");
 let html='<p class="calendar-legend"><span>● Event date</span><span>◇ Option expiration</span></p>';
 for(let month=new Date(Date.UTC(startDate.getUTCFullYear(),startDate.getUTCMonth(),1,12));month<=endDate;month.setUTCMonth(month.getUTCMonth()+1)){
  const year=month.getUTCFullYear(),m=month.getUTCMonth();
  const label=month.toLocaleDateString("en-US",{month:"long",year:"numeric",timeZone:"UTC"});
  const count=new Date(Date.UTC(year,m+1,0)).getUTCDate();
  const offset=(month.getUTCDay()+6)%7;
  html+='<div class="expiry-month"><h4>'+label+'</h4><div class="month-scroll"><table class="month-grid"><caption class="sr-only">'+label+' events and option expiration</caption><thead><tr>'+["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>'<th scope="col">'+d+'</th>').join("")+'</tr></thead><tbody>';
  for(let cell=0;cell<Math.ceil((offset+count)/7)*7;cell++){
   if(cell%7===0)html+='<tr>';
   const n=cell-offset+1;
   if(n<1||n>count){html+='<td class="outside-month"></td>';}
   else{
    const iso=year+"-"+String(m+1).padStart(2,"0")+"-"+String(n).padStart(2,"0");
    const daily=events.filter(e=>e.date===iso);
    html+='<td class="'+(daily.length?'has-event ':'')+(iso===expiry?'is-expiry':'')+'"><time datetime="'+iso+'">'+n+'</time>'+
    daily.map(e=>'<div class="calendar-event"><strong>'+esc(e.title)+'</strong><small>'+esc(e.time||"Time not supplied")+'</small>'+(e.verified_at?'<small>Cached date</small>':'')+'</div>').join("")+
    (iso===expiry?'<div class="expiration-label">◇ Expiration</div>':'')+'</td>';
   }
   if(cell%7===6)html+='</tr>';
  }
  html+='</tbody></table></div></div>';
 }
 return html;
}
function expirationEvents(candidate){
 const events=candidateEvents(candidate);
 return '<details class="expiry-events" open><summary>Events through expiration ('+events.length+')</summary>'+
 '<div class="event-switch" role="group" aria-label="Events view"><button type="button" data-event-view="table" aria-pressed="true">Table</button><button type="button" data-event-view="calendar" aria-pressed="false">Calendar</button></div>'+
 '<div data-event-panel="table">'+eventTable(events)+'</div><div data-event-panel="calendar" hidden>'+eventCalendar(events,candidate.expiry)+'</div></details>';
}
document.addEventListener("click",event=>{
 const button=event.target.closest("[data-event-view]");
 if(!button)return;
 const scope=button.closest(".expiry-events");
 scope.querySelectorAll("[data-event-view]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
 scope.querySelectorAll("[data-event-panel]").forEach(p=>p.hidden=p.dataset.eventPanel!==button.dataset.eventView);
});

function signalPanel(c){
 const m=c.ml_signal;
 if(!m)return '<div class="ml-signal"><h3>Experimental ML risk signal</h3><p>Awaiting a refresh with signal data.</p></div>';
 const age=(Date.now()-new Date(snapshot.generated_at).getTime())/3600000;
 const blocked=!(age>=0&&age<=12)||c.status!=="REVIEW QUOTES"||!c.candidates?.some(r=>r.strike!=null);
 const action=blocked?"WAIT — resolve calendar, data, or quote checks":!m.usable?"NO ML CLEARANCE — evidence gate not met":m.status==="ELEVATED DOWNSIDE RISK"?"CAUTION — model flags higher downside risk":"RESEARCH ONLY — lower relative model risk";
 const group=(label,g)=>'<tr><td>'+label+'</td><td>'+g.windows+'</td><td>'+g.events+'</td><td>'+numeric(g.rate_pct,1)+'%</td><td>'+(g.interval_pct?g.interval_pct.map(v=>numeric(v,1)+'%').join(' – '):'—')+'</td></tr>';
 return '<section class="ml-signal" aria-label="Experimental machine learning risk signal"><h3>Experimental ML risk signal</h3><strong>'+esc(action)+'</strong><p>'+esc(m.status)+'</p>'+
 (m.probability_pct==null?'<p>Signal unavailable or insufficient history. No ML clearance is available.</p>':
 '<p>Model estimate (not independently calibrated) of a <strong>'+numeric(m.drop_pct)+'% adjusted closing decline within '+m.horizon_sessions+' trading sessions</strong>: '+numeric(m.probability_pct,1)+'%. Training event rate: '+numeric(m.baseline_pct,1)+'%. As of '+day(m.price_date)+'.</p>'+
 '<details><summary>View historical evidence</summary><p>Walk-forward evaluation: '+day(m.evaluation_from)+' – '+day(m.evaluation_through)+'. Predictions were made using only earlier data. Evaluation outcome windows do not overlap.</p>'+
 dataTable(['Model grouping','Windows','Declines','Observed rate','Approx. 95% interval'],[group('All windows',m.all),group('Below training event rate',m.lower),group('At / above training event rate',m.higher)])+
 '<p>Prediction error (Brier score; lower is better): model '+numeric(m.brier,4)+' vs historical-rate baseline '+numeric(m.baseline_brier,4)+'. Relative improvement: '+numeric(m.brier_skill_pct,1)+'%.</p>'+
 (m.model_comparison?'<p>Current method: '+esc(m.selected_model_label)+'. Selected using up to 40 earlier completed prediction windows.</p>'+dataTable(['Method','Outer test error','Times selected'],m.model_comparison.map(r=>'<tr><td>'+esc(r.label)+'</td><td>'+numeric(r.brier,4)+'</td><td>'+r.selected_windows+'</td></tr>'))+
 '<p>Model-minus-baseline error interval (approx. 95%, five-window block resampling): '+m.error_difference_interval.map(v=>numeric(v,4)).join(' to ')+'. Entirely below zero favors the model-selection process.</p>':'')+
 (m.gate_reasons?.length?'<p>Evidence checks: '+esc(m.gate_reasons.join('; '))+'.</p>':'')+
 '<p>Each historical method choice used earlier completed outcomes; the next outcome tested that choice. First 20 eligible windows are reserved for selection. Methods: historical event rate, regularized logistic, volatility-only logistic, and similar historical conditions. A directional label requires adequate samples, fewer declines in the lower-risk group, and lower prediction error with a block-resampled interval below zero.</p><p>This history was examined in earlier research; these are retrospective results, not an untouched holdout. Market dependence and regime changes remain possible. A positive result needs prospective validation.</p></details>')+
 '<p class="signal-limit">Price-risk experiment, not a profit forecast, assignment probability, or signal for a particular strike or expiry. Lower relative risk can still be high. Historical option premiums, fees and slippage are absent; CSP profitability has not been backtested. Existing catalyst and quote checks take priority.</p></section>';
}

function payoffPanel(r){
 const p=r.payoff_scenarios;
 if(!p)return '';
 if(p.mean_net_pnl==null)return '<p>Expiry payoff analysis: '+esc(p.status)+'.</p>';
 const verdict=p.status==='UNFAVORABLE HISTORICAL SCENARIOS'?'CAUTION — bid does not cover average historical loss and costs':p.status==='UNCERTAIN HISTORICAL SCENARIOS'?'UNCERTAIN — historical payoff interval includes a loss':'Positive scenario average — review the downside stress tests';
 return '<p class="payoff-verdict">'+esc(verdict)+'</p><details class="payoff-panel"><summary>Does this premium cover historical expiry losses?</summary><p><strong>'+esc(p.status)+'</strong></p><p>What if today’s strike and bid faced '+p.windows+' historical '+p.horizon_sessions+'-session price moves? One 100-share contract, marked at expiration.</p>'+
 '<div class="metrics">'+metric('Net credit',money(p.net_credit))+metric('Mean scenario P/L',money(p.mean_net_pnl))+metric('Losing scenarios',numeric(p.loss_rate_pct,1)+'%')+'</div>'+
 '<p>Approximate 95% interval for mean scenario P/L: '+p.mean_interval.map(v=>money(v)).join(' to ')+'. Median: '+money(p.median_net_pnl)+'. Worst 5% average: '+money(p.worst_5pct_mean)+'. Worst observed: '+money(p.worst_net_pnl)+'.</p>'+
 '<p>Bid needed to cover average historical expiry loss and assumed costs: '+money(p.mean_loss_breakeven_bid)+'/share. Current indicative bid: '+money(p.bid)+'/share.</p>'+
 dataTable(['Underlying move by expiry','Net P/L per contract'],p.stress.map(s=>'<tr><td>'+numeric(s.underlying_return_pct)+'%</td><td>'+money(s.net_pnl)+'</td></tr>'))+
 '<p>Assumptions: '+money(p.fee_per_contract)+' total fees/contract and '+money(p.slippage_per_share)+'/share below the displayed bid. Collateral interest, taxes, early assignment, intraday liquidation and changing option prices are excluded. Assignment loss is marked at expiry; it is not assumed to disappear by holding the shares.</p><p>Scenario analysis, not a historical options backtest or expected-profit estimate. Uses adjusted historical terminal returns with today’s quote and strike; past option premiums were unavailable. Non-overlapping price windows and approximate block-resampled intervals do not capture every possible crash. Calendar, quote and data checks still apply.</p></details>';
}

function card(c){
 return '<article class="card"><div class="card-top"><div><div class="symbol">'+esc(c.symbol)+'</div><small>Daily close · '+esc(c.price_date||"unavailable")+'</small></div><div class="price">'+money(c.price)+'</div></div>'+spark(c.chart)+'<div class="status">'+esc(c.status)+'</div><p>Reassess: <strong>'+esc(c.reassess_date?day(c.reassess_date):"Pending data")+'</strong></p>'+
 (c.blockers?.length?'<p>Near-term catalysts: '+esc(c.blockers.join(" · "))+'</p>':'')+
 (c.missing_sources?.length?'<p>Calendar sources not live: '+esc(c.missing_sources.join(", "))+'. Timing cannot be cleared.</p>':'')+
 (c.detail?'<p>'+esc(c.detail)+'</p>':'')+
 signalPanel(c)+c.candidates.map((r,i)=>'<div class="candidate"><strong>'+day(r.expiry)+'</strong> <small>· '+r.dte+' DTE today</small><div class="metrics">'+metric("Candidate strike",money(r.strike))+metric("Model ceiling",money(r.model_ceiling))+metric("Collateral",money(r.collateral))+'</div><div class="metrics">'+metric("Indicative credit",money(r.premium))+metric("Breakeven",money(r.breakeven))+metric("Return on collateral",r.return_pct==null?"—":r.return_pct+"%")+'</div><p>Historical tail '+r.tail_pct+'% · worst '+r.worst_pct+'% · '+r.samples+' overlapping windows.</p><p>'+esc(r.quote_note)+'</p>'+(r.last_trade?'<small>Option last traded: '+esc(r.last_trade)+' (not bid time)</small>':'')+payoffPanel(r)+expirationEvents(r)+'</div>').join("")+
 '<p><a target="_blank" rel="noopener noreferrer" href="'+url(c.source)+'">View options source ↗</a></p></article>';
}

function numeric(v,digits=2){return v==null?"—":Number(v).toLocaleString("en-US",{maximumFractionDigits:digits});}
function dataTable(heads,rows){
 return '<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th scope="col">'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';
}
function fillExpiries(){
 const c=snapshot.watchlist.find(c=>c.symbol===$("chain-symbol").value);
 $("chain-expiry").innerHTML=(c?.option_chains||[]).map(x=>'<option value="'+esc(x.expiry)+'">'+day(x.expiry)+'</option>').join("");
 renderChain();
}
function renderChain(){
 const c=snapshot.watchlist.find(c=>c.symbol===$("chain-symbol").value);
 const chain=(c?.option_chains||[]).find(x=>x.expiry===$("chain-expiry").value);
 if(!chain){$("chain-note").textContent="Option chain unavailable for this instrument."; $("chain-table").innerHTML="";return;}
 const side=$("chain-side").value;
 const candidate=c.candidates.find(x=>x.expiry===chain.expiry);
 $("chain-note").textContent="Collected "+new Date(chain.fetched_at).toLocaleString("en-US",{timeZone:"America/New_York"})+" ET. Delayed/indicative quotes; bid and ask timestamps unavailable. Last trade is not quote time.";
 $("chain-table").innerHTML=dataTable(["Strike","Bid","Ask","Last","IV","Volume","Open interest","Size","Last trade"],chain[side].map(r=>'<tr'+(side==="puts"&&candidate?.strike!=null&&r.strike===candidate.strike?' class="selected-strike"':'')+'>'+
 [money(r.strike),money(r.bid),money(r.ask),money(r.lastPrice),r.impliedVolatility==null?"—":numeric(r.impliedVolatility*100)+"%",numeric(r.volume,0),numeric(r.openInterest,0),r.size,r.last_trade].map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>'));
}
function renderIntelligence(){
 $("chain-symbol").innerHTML=snapshot.watchlist.map(c=>'<option>'+esc(c.symbol)+'</option>').join("");
 fillExpiries();
 const fed=snapshot.fed_projections;
 $("fed-projections").innerHTML=fed?.status==="ok"
  ? '<p>Published '+day(fed.published_at)+' · <a href="'+url(fed.source)+'" target="_blank" rel="noopener noreferrer">Federal Reserve source ↗</a></p>'+
  dataTable(["Projection period","Median federal funds rate"],fed.rows.map(r=>'<tr><td>'+esc(r.period)+'</td><td>'+numeric(r.median_rate)+'%</td></tr>'))
  : '<p>Projection data unavailable. <a href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm">Check the latest Fed projections ↗</a></p>';
 const analysts=snapshot.analyst_targets||[];
 $("analyst-table").innerHTML=analysts.length?dataTable(["Symbol / scope","Provider reference price","Low target","Mean target","Median target","High target"],analysts.map(r=>'<tr><td><a href="'+url(r.source)+'" target="_blank" rel="noopener noreferrer">'+esc(r.symbol)+'</a><small>'+esc(r.scope)+'</small>'+(r.status!=="ok"?'<small>No analyst target available</small>':'')+'</td>'+
 [r.current,r.low,r.mean,r.median,r.high].map(v=>'<td>'+money(v)+'</td>').join("")+'</tr>')):'<p>Analyst data unavailable.</p>';
}
$("chain-symbol").addEventListener("change",fillExpiries);
$("chain-expiry").addEventListener("change",renderChain);
$("chain-side").addEventListener("change",renderChain);

async function load(){
 try{
  const res=await fetch("data/latest.json",{cache:"no-store"});if(!res.ok)throw Error("No published snapshot yet");
  snapshot=await res.json();
  const age=(Date.now()-new Date(snapshot.generated_at).getTime())/3600000;
  const failed=snapshot.sources.filter(s=>s.status!=="ok");
  $("updated").textContent=new Date(snapshot.generated_at).toLocaleString("en-US",{timeZone:"America/New_York"})+" ET";
  const upcoming=CalendarTools.filterEvents(snapshot.events,{from:CalendarTools.easternToday()});
  $("count").textContent=upcoming.length;
  const next=upcoming.find(e=>e.kind==="Macro");
  $("next").textContent=next?day(next.date)+" · "+next.title:"No verified upcoming macro data";
  $("coverage").textContent="Reported events through "+day(snapshot.through)+" • provider coverage may be incomplete";
  $("banner").textContent=age>12?"STALE SNAPSHOT — last refresh was over 12 hours ago. Do not use these targets without refreshing.":failed.length?"PARTIAL COVERAGE — "+failed.map(s=>s.name.toUpperCase()).join(", ")+" not live (cached or unavailable). CSP dates and strikes require manual verification.":"Sources refreshed. Quotes are delayed; verify dates, liquidity, and current prices before trading.";
  $("banner").classList.toggle("ok",age<=12&&!failed.length);
  if(age>12)snapshot.watchlist.forEach(c=>c.status="STALE — REFRESH BEFORE USE");
  $("cards").innerHTML=snapshot.watchlist.map(card).join("");
  $("sources").innerHTML=snapshot.sources.map(s=>'<div class="source-row"><strong>'+esc(s.name.toUpperCase())+'</strong><span>'+esc(s.status)+' · '+(s.upcoming_records??s.records??0)+' upcoming records'+(s.message?' · '+esc(s.message):'')+'</span></div>').join("");
  renderEvents();
  renderIntelligence();
 }catch(err){$("banner").textContent="No data snapshot available yet. Check the refresh workflow in GitHub Actions. Targets will appear only after data is collected."; $("updated").textContent="Awaiting first successful refresh";$("empty").hidden=false;}
}
load();
