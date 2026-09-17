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
 return {simulate,randomStart,sampleYears};
});
