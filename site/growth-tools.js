(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.GrowthTools=api;
})(typeof self!=="undefined"?self:this,function(){
 function simulate(returns,initial,monthly){
  let balance=Number(initial)||0,totalContributed=balance;
  const points=[{year:null,balance,totalContributed}];
  for(const item of returns){
   const monthlyRate=Math.pow(1+item.return,1/12)-1;
   for(let month=0;month<12;month++){
    balance=(balance+(Number(monthly)||0))*(1+monthlyRate);
    totalContributed+=Number(monthly)||0;
   }
   points.push({year:item.year,balance,totalContributed,return:item.return});
  }
  return {balance,totalContributed,gain:balance-totalContributed,points};
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
 function outcomeSummary(data,years,initial,monthly,mode="consecutive",draws=5000){
  initial=validAmount(initial);monthly=validAmount(monthly);
  if(!Number.isInteger(years)||years<1||years>data.length)throw new RangeError("Choose an available number of years.");
  if(!["consecutive","random"].includes(mode))throw new RangeError("Unknown sampling mode.");
  if(!Number.isInteger(draws)||draws<1)throw new RangeError("Choose at least one sample.");
  const random=seededRandom(20260921+years),count=mode==="consecutive"?data.length-years+1:draws;
  const balances=[];
  for(let i=0;i<count;i++){
   const period=mode==="consecutive"?data.slice(i,i+years):sampleYears(data,years,random);
   balances.push(simulate(period,initial,monthly).balance);
  }
  if(!balances.every(Number.isFinite))throw new RangeError("These amounts are too large to calculate.");
  balances.sort((a,b)=>a-b);
  const totalContributed=initial+monthly*12*years;
  const cuts=[.1,.25,.75,.9].map(p=>percentile(balances,p));
  const groups=Array.from({length:5},()=>[]);
  for(const balance of balances){const index=cuts.findIndex(cut=>balance<=cut);groups[index<0?4:index].push(balance);}
  const labels=["Lower outcomes","Below the middle","Middle outcomes","Above the middle","Higher outcomes"];
  const bands=groups.flatMap((group,index)=>group.length?[{label:labels[index],min:group[0],max:group.at(-1),count:group.length,probability:group.length/count}]:[]);
  if(bands.length===1)bands[0].label="All examples";
  return {count,totalContributed,median:percentile(balances,.5),low:percentile(balances,.1),high:percentile(balances,.9),
   lossCount:balances.filter(balance=>balance<totalContributed).length,bands};
 }
 function chartScale(points){return Math.max(1,...points.flatMap(point=>[point.balance,point.totalContributed]));}
 function chartPoint(points,index){
  const point=points[index];
  return {x:12+index/Math.max(1,points.length-1)*876,y:318-point.balance/chartScale(points)*306};
 }
 function pointIndex(fraction,count){return Math.round(Math.max(0,Math.min(1,(fraction*900-12)/876))*Math.max(0,count-1));}
 return {simulate,randomStart,sampleYears,validAmount,outcomeSummary,chartScale,chartPoint,pointIndex};
});
