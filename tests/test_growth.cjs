const {test}=require('node:test');
const assert=require('node:assert/strict');
const {simulate,randomStart,sampleYears}=require('../site/growth-tools.js');
const {outcomeSummary,chartScale,chartPoint,pointIndex}=require('../site/growth-tools.js');
test('contributions stop after the selected year and withdrawals start in the selected year',()=>{
 const data=Array.from({length:3},(_,year)=>({year,return:0}));
 const result=simulate(data,1000,100,{stopAfter:1,withdrawFrom:2,withdrawal:50});
 assert.equal(result.totalContributed,2200);assert.equal(result.totalWithdrawn,1200);
 assert.equal(result.balance,1000);assert.equal(result.gain,0);assert.equal(result.firstShortfall,null);
 assert.equal(result.points[1].totalWithdrawn,0);assert.equal(result.points[2].totalWithdrawn,600);
});
test('withdrawals stop at zero and report first unpaid month, without counting withdrawals as losses',()=>{
 const result=simulate([{year:1,return:0}],250,100,{stopAfter:0,withdrawFrom:1,withdrawal:100});
 assert.equal(result.balance,0);assert.equal(result.totalWithdrawn,250);assert.equal(result.shortfall,950);
 assert.deepEqual(result.firstShortfall,{year:1,month:3});assert.equal(result.gain,0);
 const summary=outcomeSummary([{year:1,return:0}],1,250,100,'consecutive',5000,{stopAfter:0,withdrawFrom:1,withdrawal:100});
 assert.equal(summary.shortfallCount,1);assert.equal(summary.lossCount,0);assert.equal(summary.totalContributed,250);
});
test('exactly funded withdrawals, overlapping deposits, and future withdrawals',()=>{
 const data=[{year:1,return:0}];
 assert.equal(simulate(data,1200,0,{withdrawal:100}).firstShortfall,null);
 const overlap=simulate(data,0,100,{withdrawal:100});
 assert.equal(overlap.balance,0);assert.equal(overlap.totalWithdrawn,1200);assert.equal(overlap.firstShortfall,null);
 assert.equal(simulate(data,1000,100,{withdrawFrom:2,withdrawal:100}).totalWithdrawn,0);
 for(const plan of [{stopAfter:-1},{stopAfter:1.5},{withdrawFrom:0},{withdrawFrom:NaN},{withdrawal:-1}])assert.throws(()=>simulate(data,1000,100,plan),RangeError);
});
test('month-end withdrawal follows monthly growth and outcomes use the same plan',()=>{
 const data=[{year:1,return:Math.pow(1.01,12)-1}];
 const result=simulate(data,1000,0,{withdrawal:10});
 assert.ok(Math.abs(result.balance-1000)<1e-8);assert.equal(result.totalWithdrawn,120);
 const summary=outcomeSummary(data,1,1000,0,'random',20,{withdrawal:10});
 assert.ok(Math.abs(summary.median-result.balance)<1e-8);assert.equal(summary.shortfallCount,0);
});
test('simulation compounds annual return through equivalent monthly rates',()=>{const result=simulate([{year:2020,return:.21}],1000,0);assert.ok(Math.abs(result.balance-1210)<1e-8);assert.equal(result.totalContributed,1000);});
test('monthly contributions are included and tracked separately',()=>{const result=simulate([{year:2020,return:0}],1000,100);assert.equal(result.balance,2200);assert.equal(result.totalContributed,2200);assert.equal(result.gain,0);});
test('random window always fits the available history',()=>{const data=Array.from({length:98},(_,i)=>i);assert.equal(randomStart(data,20,()=>0),0);assert.equal(randomStart(data,20,()=>.999999),78);assert.equal(randomStart(data,200,()=>.9),0);});
test('random years are unique and limited to the requested count',()=>{const data=[1928,1929,1930,1931,1932];const sampled=sampleYears(data,3,()=>.25);assert.equal(sampled.length,3);assert.equal(new Set(sampled).size,3);assert.ok(sampled.every(year=>data.includes(year)));});
test('random year count cannot exceed available history',()=>{assert.deepEqual(sampleYears([1,2],10,()=>0).sort(),[1,2]);});
test('ranges cover each historical outcome exactly once',()=>{
 const data=[-.5,-.25,0,.25,.5].map((value,i)=>({year:2000+i,return:value}));
 const summary=outcomeSummary(data,1,1000,0);
 assert.equal(summary.count,5);assert.equal(summary.median,1000);
 assert.equal(summary.lossCount,2);
 assert.equal(summary.bands.reduce((n,b)=>n+b.count,0),5);
 assert.ok(Math.abs(summary.bands.reduce((n,b)=>n+b.probability,0)-1)<1e-12);
 assert.ok(Math.abs(summary.bands[0].min-500)<1e-8);
 for(let i=1;i<summary.bands.length;i++)assert.ok(summary.bands[i].min>summary.bands[i-1].max);
});
test('all fitting consecutive periods are evaluated',()=>{
 const data=[{year:1,return:0},{year:2,return:0},{year:3,return:0}];
 const summary=outcomeSummary(data,2,1000,100);
 assert.equal(summary.count,2);assert.equal(summary.totalContributed,3400);
 assert.deepEqual(summary.bands,[{label:'All examples',min:3400,max:3400,count:2,probability:1}]);
});
test('mixed-year results are repeatable and scale with contributions',()=>{
 const data=[-.3,.1,.2,.4].map((value,i)=>({year:i,return:value}));
 const a=outcomeSummary(data,3,1000,100,'random',200);
 assert.deepEqual(a,outcomeSummary(data,3,1000,100,'random',200));
 const b=outcomeSummary(data,3,2000,200,'random',200);
 assert.equal(a.count,200);assert.ok(Math.abs(b.median-2*a.median)<1e-8);
 assert.deepEqual(a.bands.map(x=>x.count),b.bands.map(x=>x.count));
});
test('zero contributions produce one zero outcome and invalid amounts fail',()=>{
 const data=[{year:1,return:.1},{year:2,return:-.1}];
 const summary=outcomeSummary(data,1,0,0);
 assert.equal(summary.bands.length,1);assert.equal(summary.bands[0].probability,1);
 assert.equal(summary.median,0);assert.equal(summary.lossCount,0);
 for(const bad of [-1,Infinity,NaN])assert.throws(()=>outcomeSummary(data,1,bad,0),RangeError);
 assert.throws(()=>outcomeSummary(data,3,1000,100),RangeError);
});
test('chart includes contributions above a losing account on the same scale',()=>{
 const points=[{balance:100,totalContributed:100},{balance:50,totalContributed:200}];
 assert.equal(chartScale(points),200);
 assert.deepEqual(chartPoint(points,1),{x:888,y:241.5});
 assert.equal(pointIndex(12/900,2),0);assert.equal(pointIndex(888/900,2),1);
 assert.equal(pointIndex(-1,21),0);assert.equal(pointIndex(2,21),20);
});
