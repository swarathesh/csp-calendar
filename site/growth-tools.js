(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.GrowthTools=api;
})(typeof self!=="undefined"?self:this,function(){
 function cashflowPlan(options={}){
  const stopAfter=options.stopAfter??40,withdrawFrom=options.withdrawFrom??1,withdrawal=validAmount(options.withdrawal??0);
  if(!Number.isInteger(stopAfter)||stopAfter<0||stopAfter>40)throw new RangeError("Stop contributions after a whole number of years, from 0 to 40.");
  if(!Number.isInteger(withdrawFrom)||withdrawFrom<1||withdrawFrom>40)throw new RangeError("Start withdrawals in a whole year, from 1 to 40.");
  return {stopAfter,withdrawFrom,withdrawal};
 }
 function simulate(returns,initial,monthly,options={}){
  const plan=cashflowPlan(options);
  monthly=validAmount(monthly);
  let balance=validAmount(initial),totalContributed=balance,totalWithdrawn=0,shortfall=0,firstShortfall=null;
  const points=[{year:null,balance,totalContributed,totalWithdrawn,shortfall}];
  for(const [index,item] of returns.entries()){
   const monthlyRate=Math.pow(1+item.return,1/12)-1;
   for(let month=0;month<12;month++){
    const deposit=index<plan.stopAfter?monthly:0;
    balance=(balance+deposit)*(1+monthlyRate);
    totalContributed+=deposit;
    const requested=index+1>=plan.withdrawFrom?plan.withdrawal:0;
    const paid=Math.min(balance,requested);
    balance-=paid;totalWithdrawn+=paid;
    const missing=requested-paid;
    shortfall+=missing;
    if(missing>1e-7&&firstShortfall===null)firstShortfall={year:index+1,month:month+1};
   }
   points.push({year:item.year,balance,totalContributed,totalWithdrawn,shortfall,return:item.return});
  }
  return {balance,totalContributed,totalWithdrawn,shortfall,firstShortfall,gain:balance+totalWithdrawn-totalContributed,points};
 }
 function randomStart(data,years,random=Math.random){
  const length=Math.max(1,Math.min(Number(years)||1,data.length));
  return Math.floor(random()*(data.length-length+1));
 }
 function sampleYears(data,years,random=Math.random){
  const length=Math.max(1,Math.min(Number(years)||1,data.length));
  const pool=data.slice();
  for(let i=pool.length-1;i>0;i--){
   const j=Math.floor(random()*(i+1));
   [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  return pool.slice(0,length);
 }
 function validAmount(value){
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<0)throw new RangeError("Enter an amount of zero or more.");
  return amount;
 }
 function seededRandom(seed){
  let state=seed>>>0;
  return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
 }
 function percentile(sorted,fraction){
  const position=(sorted.length-1)*fraction,low=Math.floor(position),weight=position-low;
  return sorted[low]+(sorted[Math.min(low+1,sorted.length-1)]-sorted[low])*weight;
 }
 function outcomeSummary(data,years,initial,monthly,mode="consecutive",draws=5000,options={}){
  const plan=cashflowPlan(options);
  initial=validAmount(initial);monthly=validAmount(monthly);
  if(!Number.isInteger(years)||years<1||years>data.length)throw new RangeError("Choose an available number of years.");
  if(!["consecutive","random"].includes(mode))throw new RangeError("Unknown sampling mode.");
  if(!Number.isInteger(draws)||draws<1)throw new RangeError("Choose at least one sample.");
  const random=seededRandom(20260921+years),count=mode==="consecutive"?data.length-years+1:draws;
  const balances=[];let lossCount=0,shortfallCount=0;
  for(let i=0;i<count;i++){
   const period=mode==="consecutive"?data.slice(i,i+years):sampleYears(data,years,random);
   const result=simulate(period,initial,monthly,plan);
   balances.push(result.balance);
   if(result.gain< -1e-7)lossCount++;
   if(result.firstShortfall)shortfallCount++;
  }
  if(!balances.every(Number.isFinite))throw new RangeError("These amounts are too large to calculate.");
  balances.sort((a,b)=>a-b);
  const totalContributed=initial+monthly*12*Math.min(years,plan.stopAfter);
  const cuts=[.1,.25,.75,.9].map(p=>percentile(balances,p));
  const groups=Array.from({length:5},()=>[]);
  for(const balance of balances){const index=cuts.findIndex(cut=>balance<=cut);groups[index<0?4:index].push(balance);}
  const labels=["Lower outcomes","Below the middle","Middle outcomes","Above the middle","Higher outcomes"];
  const bands=groups.flatMap((group,index)=>group.length?[{label:labels[index],min:group[0],max:group.at(-1),count:group.length,probability:group.length/count}]:[]);
  if(bands.length===1)bands[0].label="All examples";
  return {count,totalContributed,median:percentile(balances,.5),low:percentile(balances,.1),high:percentile(balances,.9),
   lossCount,shortfallCount,bands};
 }
 function chartScale(points){return Math.max(1,...points.flatMap(point=>[point.balance,point.totalContributed]));}
 function chartPoint(points,index){
  const point=points[index];
  return {x:12+index/Math.max(1,points.length-1)*876,y:318-point.balance/chartScale(points)*306};
 }
 function pointIndex(fraction,count){return Math.round(Math.max(0,Math.min(1,(fraction*900-12)/876))*Math.max(0,count-1));}
 return {simulate,randomStart,sampleYears,validAmount,outcomeSummary,chartScale,chartPoint,pointIndex};
});
