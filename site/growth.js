const SP_RETURNS=[
[1928,43.81],[1929,-8.30],[1930,-25.12],[1931,-43.84],[1932,-8.64],[1933,49.98],[1934,-1.19],[1935,46.74],[1936,31.94],[1937,-35.34],[1938,29.28],[1939,-1.10],[1940,-10.67],[1941,-12.77],[1942,19.17],[1943,25.06],[1944,19.03],[1945,35.82],[1946,-8.43],[1947,5.20],[1948,5.70],[1949,18.30],[1950,30.81],[1951,23.68],[1952,18.15],[1953,-1.21],[1954,52.56],[1955,32.60],[1956,7.44],[1957,-10.46],[1958,43.72],[1959,12.06],[1960,.34],[1961,26.64],[1962,-8.81],[1963,22.61],[1964,16.42],[1965,12.40],[1966,-9.97],[1967,23.80],[1968,10.81],[1969,-8.24],[1970,3.56],[1971,14.22],[1972,18.76],[1973,-14.31],[1974,-25.90],[1975,37.00],[1976,23.83],[1977,-6.98],[1978,6.51],[1979,18.52],[1980,31.74],[1981,-4.70],[1982,20.42],[1983,22.34],[1984,6.15],[1985,31.24],[1986,18.49],[1987,5.81],[1988,16.54],[1989,31.48],[1990,-3.06],[1991,30.23],[1992,7.49],[1993,9.97],[1994,1.33],[1995,37.20],[1996,22.68],[1997,33.10],[1998,28.34],[1999,20.89],[2000,-9.03],[2001,-11.85],[2002,-21.97],[2003,28.36],[2004,10.74],[2005,4.83],[2006,15.61],[2007,5.48],[2008,-36.55],[2009,25.94],[2010,14.82],[2011,2.10],[2012,15.89],[2013,32.15],[2014,13.52],[2015,1.38],[2016,11.77],[2017,21.61],[2018,-4.23],[2019,31.21],[2020,18.02],[2021,28.47],[2022,-18.04],[2023,26.06],[2024,24.88],[2025,17.72]
].map(([year,value])=>({year,return:value/100}));
const $=id=>document.getElementById(id);
const currency=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);
const percent=value=>`${(value*100).toFixed(1)}%`;
const chart=$("growth-chart-svg");
let startIndex=SP_RETURNS.length-20,sampleMode="consecutive",randomPeriod=[];
let chartPoints=[],selectedPoint=null,activePointer=null,summaryKey="";

function pointLabel(index){
 if(index===0)return "Starting balance";
 const year=chartPoints[index].year;
 return `Year ${index} · ${sampleMode==="random"?"using":"end of"} ${year}`;
}
function setHeadline(index,exploring){
 const point=chartPoints[index],gain=point.balance+point.totalWithdrawn-point.totalContributed;
 $("balance-label").textContent=exploring?pointLabel(index):"Ending value";
 $("ending-value").textContent=currency(point.balance);
 $("value-context").textContent=`${gain<0?"−":"+"}${currency(Math.abs(gain))} market growth · ${currency(point.totalContributed)} added · ${currency(point.totalWithdrawn)} taken out`;
 $("value-context").classList.toggle("negative",gain<0);
 chart.setAttribute("aria-valuenow",index);
 chart.setAttribute("aria-valuetext",`${pointLabel(index)}: ${currency(point.balance)}; ${currency(point.totalContributed)} added; ${currency(point.totalWithdrawn)} taken out`);
}
function hideMarker(){
 ["chart-guide","chart-dot","chart-tooltip"].forEach(id=>$(id).setAttribute("hidden",""));
}
function clearSelection(){
 selectedPoint=null;hideMarker();
 if(chartPoints.length)setHeadline(chartPoints.length-1,false);
}
function placeTooltip(position){
 const box=chart.getBoundingClientRect(),tip=$("chart-tooltip");
 const width=tip.offsetWidth,height=tip.offsetHeight;
 const x=position.x/900*box.width,y=position.y/330*box.height;
 tip.style.left=`${Math.max(4,Math.min(box.width-width-4,x-width/2))}px`;
 tip.style.top=`${Math.max(4,Math.min(box.height-height-4,y-height-18))}px`;
}
function showPoint(index){
 if(!chartPoints.length)return;
 selectedPoint=Math.max(0,Math.min(chartPoints.length-1,index));
 const point=chartPoints[selectedPoint],position=GrowthTools.chartPoint(chartPoints,selectedPoint);
 $("chart-guide").setAttribute("x1",position.x);$("chart-guide").setAttribute("x2",position.x);
 $("chart-dot").setAttribute("cx",position.x);$("chart-dot").setAttribute("cy",position.y);
 ["chart-guide","chart-dot","chart-tooltip"].forEach(id=>$(id).removeAttribute("hidden"));
 $("tooltip-time").textContent=pointLabel(selectedPoint);
 $("tooltip-balance").textContent=currency(point.balance);
 $("tooltip-contributed").textContent=`Added: ${currency(point.totalContributed)} · Taken out: ${currency(point.totalWithdrawn)}`;
 setHeadline(selectedPoint,true);placeTooltip(position);
}
function pointFromPointer(event){
 const box=chart.getBoundingClientRect();
 if(box.width)showPoint(GrowthTools.pointIndex((event.clientX-box.left)/box.width,chartPoints.length));
}
function pathFor(key){
 const scale=GrowthTools.chartScale(chartPoints);
 return chartPoints.map((point,index)=>`${index?"L":"M"}${(12+index/(chartPoints.length-1)*876).toFixed(2)} ${(318-point[key]/scale*306).toFixed(2)}`).join(" ");
}
function renderSummary(years,initial,monthly,plan){
 const key=[years,initial,monthly,sampleMode,plan.stopAfter,plan.withdrawFrom,plan.withdrawal,plan.inflation].join("|");
 if(key===summaryKey)return;
 const summary=GrowthTools.outcomeSummary(SP_RETURNS,years,initial,monthly,sampleMode,5000,plan);
 summaryKey=key;
 $("outcomes-context").textContent=`Money left after ${years} ${years===1?"year":"years"}, starting with ${currency(initial)}, using your contribution and withdrawal plan. ${summary.count.toLocaleString()} ${sampleMode==="random"?"mixed-year examples":"real historical periods"}.`;
 $("outcomes-median").textContent=currency(summary.median);
 $("outcome-rows").innerHTML=summary.bands.map(band=>`<tr${band.label==="Middle outcomes"?' class="middle-outcome"':""}><th scope="row">${band.label}</th><td>${band.min===band.max?currency(band.min):`${currency(band.min)} – ${currency(band.max)}`}</td><td><div class="frequency"><strong>${percent(band.probability)}</strong><span>${band.count.toLocaleString()} of ${summary.count.toLocaleString()}</span><i style="--share:${band.probability*100}%" aria-hidden="true"></i></div></td></tr>`).join("");
 $("outcomes-footnote").textContent=`Total money added: ${currency(summary.totalContributed)}. ${percent(summary.lossCount/summary.count)} of examples returned less than you put in, counting both money left and money taken out. Ranges are rounded; future results can be outside them.`;
 $("withdrawal-outcomes").textContent=plan.withdrawal>0&&plan.withdrawFrom<=years?`${percent((summary.count-summary.shortfallCount)/summary.count)} of examples paid every planned withdrawal. ${summary.shortfallCount} of ${summary.count} examples could not pay the full amount at least once. These are historical examples, not guaranteed future odds.`:"No withdrawals during this plan. Set a monthly amount and a start year within the simulation to compare them.";
}
function showInputError(message){
 $("input-error").textContent=message;$("input-error").hidden=false;
 summaryKey="";chartPoints=[];selectedPoint=null;hideMarker();
 ["ending-value","contributed","market-gain","withdrawn","outcomes-median","chart-max"].forEach(id=>$(id).textContent="—");
 ["plan-summary","withdrawal-status","withdrawal-outcomes"].forEach(id=>$(id).textContent="");
 ["growth-line","contribution-line"].forEach(id=>$(id).setAttribute("d",""));
 ["outcome-rows","return-rows","swp-rows","inflation-rows"].forEach(id=>$(id).innerHTML="");
 $("swp-context").textContent="Enter valid amounts to see your withdrawal schedule.";
 $("outcomes-context").textContent="Enter valid amounts to see the ranges.";
 $("outcomes-footnote").textContent="";$("value-context").textContent="Check the amounts on the left.";
 chart.setAttribute("aria-disabled","true");
}
function render(){
 const years=Number($("years").value);
 try{
  const initial=GrowthTools.validAmount($("capital").value),monthly=GrowthTools.validAmount($("monthly").value);
  const plan={stopAfter:$("stop-after").valueAsNumber,withdrawFrom:$("withdraw-from").valueAsNumber,withdrawal:GrowthTools.validAmount($("withdrawal").value),inflation:$("inflation").valueAsNumber/100};
  startIndex=Math.min(startIndex,SP_RETURNS.length-years);
  if(sampleMode==="random"&&randomPeriod.length!==years)randomPeriod=GrowthTools.sampleYears(SP_RETURNS,years);
  const period=sampleMode==="random"?randomPeriod:SP_RETURNS.slice(startIndex,startIndex+years);
  const result=GrowthTools.simulate(period,initial,monthly,plan);
  if(!Number.isFinite(result.balance))throw new RangeError("These amounts are too large to calculate.");
  renderSummary(years,initial,monthly,plan);
  $("input-error").hidden=true;chart.removeAttribute("aria-disabled");
  chartPoints=result.points;
  $("years-value").textContent=`${years} ${years===1?"year":"years"}`;
  document.querySelectorAll("[data-years]").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.years)===years)));
  $("period").textContent=sampleMode==="random"?`${years} mixed years`:`${period[0].year}–${period.at(-1).year}`;
  $("contributed").textContent=currency(result.totalContributed);$("market-gain").textContent=currency(result.gain);
  $("withdrawn").textContent=currency(result.totalWithdrawn);
  $("plan-summary").textContent=`Add ${currency(monthly)} a month for ${Math.min(years,plan.stopAfter)} years. ${plan.withdrawal>0?`Take out ${currency(plan.withdrawal)} a month in today’s dollars from year ${plan.withdrawFrom}${plan.withdrawFrom>years?" (beyond this simulation)":""}, rising with ${percent(plan.inflation)} yearly inflation.`:"No monthly withdrawals. Enter an SWP amount to see money taken out."}`;
  $("swp-context").textContent=`One chart example. Withdrawals rise by ${percent(plan.inflation)} each plan year; money left is shown both in future dollars and today’s buying power.`;
  $("swp-rows").innerHTML=result.points.slice(1).map((point,i)=>`<tr><th scope="row">Year ${i+1}</th><td>${currency(point.added)}</td><td>${currency(point.monthlyWithdrawal)}</td><td>${currency(point.withdrawn)}</td><td>${currency(point.unpaid)}</td><td>${currency(point.balance)}</td><td>${currency(point.realBalance)}</td></tr>`).join("");
  const fixed=GrowthTools.simulate(period,initial,monthly,{...plan,inflation:0});
  $("inflation-rows").innerHTML=[["Fixed dollar withdrawals",fixed],[`Withdrawals rising ${percent(plan.inflation)} a year`,result]].map(([label,example])=>`<tr><th scope="row">${label}</th><td>${currency(example.totalWithdrawn)}</td><td>${currency(example.shortfall)}</td><td>${currency(example.balance)}</td><td>${currency(example.balance/Math.pow(1+plan.inflation,years))}</td></tr>`).join("");
  $("withdrawal-status").textContent=result.firstShortfall?`This example first could not pay the full withdrawal in year ${result.firstShortfall.year}, month ${result.firstShortfall.month}. Total unpaid: ${currency(result.shortfall)}.`:plan.withdrawal>0&&plan.withdrawFrom<=years?"This example paid every planned withdrawal.":"";
  $("withdrawal-status").classList.toggle("negative",Boolean(result.firstShortfall));
  $("growth-line").setAttribute("d",pathFor("balance"));$("contribution-line").setAttribute("d",pathFor("totalContributed"));
  $("chart-start").textContent=sampleMode==="random"?"Start":`Start of ${period[0].year}`;
  $("chart-end").textContent=sampleMode==="random"?`Year ${years}`:`End of ${period.at(-1).year}`;
  $("chart-max").textContent=currency(GrowthTools.chartScale(chartPoints));
  chart.setAttribute("aria-valuemax",years);
  $("return-rows").innerHTML=period.map((r,i)=>`<tr><td>Year ${i+1} · ${r.year}</td><td class="${r.return<0?"negative":"positive"}">${r.return<0?"":"+"}${(r.return*100).toFixed(2)}%</td><td>${currency(result.points[i+1].balance)}</td><td>${currency(result.points[i+1].totalWithdrawn)}</td></tr>`).join("");
  clearSelection();
 }catch(error){showInputError(error.message);}
}
function randomize(){
 const years=Number($("years").value);
 if(sampleMode==="random")randomPeriod=GrowthTools.sampleYears(SP_RETURNS,years);
 else startIndex=GrowthTools.randomStart(SP_RETURNS,years);
 render();
}
document.querySelector(".sample-mode").addEventListener("click",event=>{
 const button=event.target.closest("[data-sample-mode]");if(!button)return;
 sampleMode=button.dataset.sampleMode;
 document.querySelectorAll("[data-sample-mode]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
 $("mode-explanation").textContent=sampleMode==="random"?"Mixes unique past years in a new order. This is an invented sequence.":"Keeps the market’s actual order of good and bad years.";
 document.querySelector(".example-badge").textContent=sampleMode==="random"?"One mixed-year example":"One historical example";
 randomize();
});
document.querySelector(".horizon-bar").addEventListener("click",event=>{
 const button=event.target.closest("[data-years]");if(!button)return;
 $("years").value=button.dataset.years;render();
});
["years","capital","monthly","stop-after","withdrawal","withdraw-from","inflation"].forEach(id=>$(id).addEventListener("input",render));
$("random-period").addEventListener("click",randomize);
$("show-contributions").addEventListener("change",()=>$("contribution-line").toggleAttribute("hidden",!$("show-contributions").checked));
chart.addEventListener("pointerdown",event=>{
 if(!event.isPrimary||event.button!==0)return;
 activePointer=event.pointerId;chart.setPointerCapture(event.pointerId);pointFromPointer(event);
});
chart.addEventListener("pointermove",event=>{if(event.pointerType==="mouse"||event.pointerId===activePointer)pointFromPointer(event);});
chart.addEventListener("pointerup",event=>{
 if(event.pointerId!==activePointer)return;
 pointFromPointer(event);activePointer=null;
 if(chart.hasPointerCapture(event.pointerId))chart.releasePointerCapture(event.pointerId);
 if(event.pointerType==="mouse"&&!chart.matches(":hover"))clearSelection();
});
chart.addEventListener("pointercancel",()=>{activePointer=null;clearSelection();});
chart.addEventListener("lostpointercapture",()=>{activePointer=null;});
chart.addEventListener("pointerleave",event=>{if(activePointer===null&&event.pointerType==="mouse")clearSelection();});
chart.addEventListener("keydown",event=>{
 if(!chartPoints.length)return;
 const current=selectedPoint??chartPoints.length-1;
 const targets={ArrowLeft:current-1,ArrowDown:current-1,ArrowRight:current+1,ArrowUp:current+1,Home:0,End:chartPoints.length-1};
 if(event.key in targets){event.preventDefault();showPoint(targets[event.key]);}
 if(event.key==="Escape"){event.preventDefault();clearSelection();}
});
chart.addEventListener("blur",clearSelection);
new ResizeObserver(()=>{if(selectedPoint!==null)placeTooltip(GrowthTools.chartPoint(chartPoints,selectedPoint));}).observe(chart);
render();
