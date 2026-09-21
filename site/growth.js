const SP_RETURNS=[
[1928,43.81],[1929,-8.30],[1930,-25.12],[1931,-43.84],[1932,-8.64],[1933,49.98],[1934,-1.19],[1935,46.74],[1936,31.94],[1937,-35.34],[1938,29.28],[1939,-1.10],[1940,-10.67],[1941,-12.77],[1942,19.17],[1943,25.06],[1944,19.03],[1945,35.82],[1946,-8.43],[1947,5.20],[1948,5.70],[1949,18.30],[1950,30.81],[1951,23.68],[1952,18.15],[1953,-1.21],[1954,52.56],[1955,32.60],[1956,7.44],[1957,-10.46],[1958,43.72],[1959,12.06],[1960,.34],[1961,26.64],[1962,-8.81],[1963,22.61],[1964,16.42],[1965,12.40],[1966,-9.97],[1967,23.80],[1968,10.81],[1969,-8.24],[1970,3.56],[1971,14.22],[1972,18.76],[1973,-14.31],[1974,-25.90],[1975,37.00],[1976,23.83],[1977,-6.98],[1978,6.51],[1979,18.52],[1980,31.74],[1981,-4.70],[1982,20.42],[1983,22.34],[1984,6.15],[1985,31.24],[1986,18.49],[1987,5.81],[1988,16.54],[1989,31.48],[1990,-3.06],[1991,30.23],[1992,7.49],[1993,9.97],[1994,1.33],[1995,37.20],[1996,22.68],[1997,33.10],[1998,28.34],[1999,20.89],[2000,-9.03],[2001,-11.85],[2002,-21.97],[2003,28.36],[2004,10.74],[2005,4.83],[2006,15.61],[2007,5.48],[2008,-36.55],[2009,25.94],[2010,14.82],[2011,2.10],[2012,15.89],[2013,32.15],[2014,13.52],[2015,1.38],[2016,11.77],[2017,21.61],[2018,-4.23],[2019,31.21],[2020,18.02],[2021,28.47],[2022,-18.04],[2023,26.06],[2024,24.88],[2025,17.72]
].map(([year,value])=>({year,return:value/100}));
const $=id=>document.getElementById(id);
const currency=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);
let startIndex=SP_RETURNS.length-20;
let sampleMode="consecutive",randomPeriod=[];
let chartPoints=[],selectedPoint=null;
const modeStyles=document.createElement("link");modeStyles.rel="stylesheet";modeStyles.href="growth-modes.css";document.head.append(modeStyles);
const modePicker=document.createElement("fieldset");modePicker.className="sample-mode";modePicker.innerHTML='<legend>How should years be chosen?</legend><div class="mode-switch"><button type="button" data-sample-mode="consecutive" aria-pressed="true">Consecutive period</button><button type="button" data-sample-mode="random" aria-pressed="false">Random years</button></div><p class="mode-explanation" id="mode-explanation">Keeps the market’s real chronological order.</p>';
document.querySelector(".growth-controls h2").after(modePicker);
function pathFor(points,valueFor,maxOverride,width=900,height=330){
 const values=points.map(valueFor),max=maxOverride??Math.max(...values,1),pad=12;
 return points.map((point,i)=>{const x=pad+i/(points.length-1||1)*(width-pad*2);const y=height-pad-(valueFor(point)/max)*(height-pad*2);return `${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(" ");
}
function chartPosition(index){
 const width=900,height=330,pad=12,values=chartPoints.map(point=>point.balance),max=Math.max(...values,1);
 return {x:pad+index/(chartPoints.length-1||1)*(width-pad*2),y:height-pad-(chartPoints[index].balance/max)*(height-pad*2)};
}
function showPoint(index){
 if(!chartPoints.length)return;
 selectedPoint=Math.max(0,Math.min(chartPoints.length-1,index));
 const point=chartPoints[selectedPoint],position=chartPosition(selectedPoint);
 $("chart-guide").setAttribute("x1",position.x);$("chart-guide").setAttribute("x2",position.x);$("chart-guide").setAttribute("y1",12);$("chart-guide").setAttribute("y2",318);$("chart-guide").hidden=false;
 $("chart-dot").setAttribute("cx",position.x);$("chart-dot").setAttribute("cy",position.y);$("chart-dot").hidden=false;
 const label=point.year?`${point.year}`:"Start";
 $("chart-readout").innerHTML=`<strong>${label}: ${currency(point.balance)}</strong><span>You have added ${currency(point.totalContributed)} so far.</span>`;
 $("tooltip-time").textContent=label;$("tooltip-balance").textContent=currency(point.balance);$("tooltip-contributed").textContent=`Money added: ${currency(point.totalContributed)}`;
 const tooltip=$("chart-tooltip");tooltip.style.left=`${Math.max(14,Math.min(86,position.x/900*100))}%`;tooltip.style.top=`${Math.max(24,position.y/330*100)}%`;tooltip.hidden=false;
}
function pointFromPointer(event){
 const box=$("growth-chart-svg").getBoundingClientRect();
 const ratio=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width));
 showPoint(Math.round(ratio*(chartPoints.length-1)));
}
function render(){
 const years=Number($("years").value);startIndex=Math.min(startIndex,SP_RETURNS.length-years);
 const period=sampleMode==="random"?randomPeriod:SP_RETURNS.slice(startIndex,startIndex+years);const result=GrowthTools.simulate(period,$("capital").value,$("monthly").value);chartPoints=result.points;const first=period[0],last=period.at(-1);
 $("years-value").textContent=`${years} ${years===1?"year":"years"}`;$("period").textContent=sampleMode==="random"?`${years} random ${years===1?"year":"years"}`:`${first.year}–${last.year}`;$("ending-value").textContent=currency(result.balance);$("contributed").textContent=currency(result.totalContributed);$("market-gain").textContent=currency(result.gain);
 const annualized=result.totalContributed?Math.pow(result.balance/result.totalContributed,1/period.length)-1:null;$("growth-rate").textContent=annualized==null?"—":`${(annualized*100).toFixed(1)}%`;
 const chartMax=Math.max(...result.points.map(point=>point.balance),1),valuePath=pathFor(result.points,point=>point.balance,chartMax);$("growth-line").setAttribute("d",valuePath);$("area-line").setAttribute("d",`${valuePath} L888 318 L12 318 Z`);$("contribution-line").setAttribute("d",pathFor(result.points,point=>point.totalContributed,chartMax));$("chart-start").textContent=sampleMode==="random"?"Draw 1":first.year;$("chart-end").textContent=sampleMode==="random"?`Draw ${years}`:last.year;$("chart-max").textContent=currency(chartMax);
 $("return-rows").innerHTML=period.map((r,i)=>`<tr><td>${sampleMode==="random"?`<span class="sequence-index">${i+1}</span>`:""}${r.year}</td><td class="${r.return<0?'negative':'positive'}">${r.return<0?'':'+'}${(r.return*100).toFixed(2)}%</td><td>${currency(result.points[i+1].balance)}</td></tr>`).join("");
 if(selectedPoint!==null)showPoint(Math.min(selectedPoint,chartPoints.length-1));
}
function randomize(){if(sampleMode==="random")randomPeriod=GrowthTools.sampleYears(SP_RETURNS,$("years").value);else startIndex=GrowthTools.randomStart(SP_RETURNS,$("years").value);render();}
modePicker.addEventListener("click",event=>{const button=event.target.closest("[data-sample-mode]");if(!button)return;sampleMode=button.dataset.sampleMode;modePicker.querySelectorAll("button").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));$("mode-explanation").textContent=sampleMode==="random"?"Draws unique years and applies them in random order. This is a scenario, not a real market period.":"Keeps the market’s real chronological order.";$("random-period").textContent=sampleMode==="random"?"Draw new random years":"Draw another historical period";document.querySelector(".control-note").textContent=sampleMode==="random"?"Every draw uses unique years from 1928–2025. Their drawn order becomes the simulated sequence.":"Each draw selects a contiguous period that fits the chosen length. It does not rearrange good and bad years.";randomize();});
$("years").addEventListener("input",()=>{if(sampleMode==="random")randomPeriod=GrowthTools.sampleYears(SP_RETURNS,$("years").value);render();});$("capital").addEventListener("input",render);$("monthly").addEventListener("input",render);$("random-period").addEventListener("click",randomize);render();
const chart=$("growth-chart-svg");
chart.addEventListener("pointerdown",event=>{chart.setPointerCapture(event.pointerId);pointFromPointer(event);});
chart.addEventListener("pointermove",event=>{pointFromPointer(event);});
chart.addEventListener("pointerup",event=>{if(chart.hasPointerCapture(event.pointerId))chart.releasePointerCapture(event.pointerId);});
chart.addEventListener("pointerleave",()=>{if(selectedPoint===null)$("chart-tooltip").hidden=true;});
chart.addEventListener("keydown",event=>{if(!chartPoints.length)return;const current=selectedPoint??0;if(event.key==="ArrowLeft"||event.key==="ArrowDown"){event.preventDefault();showPoint(current-1);}if(event.key==="ArrowRight"||event.key==="ArrowUp"){event.preventDefault();showPoint(current+1);}if(event.key==="Home"){event.preventDefault();showPoint(0);}if(event.key==="End"){event.preventDefault();showPoint(chartPoints.length-1);}});
