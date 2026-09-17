const {test}=require('node:test');
const assert=require('node:assert/strict');
const {simulate,randomStart,sampleYears}=require('../site/growth-tools.js');
test('simulation compounds annual return through equivalent monthly rates',()=>{const result=simulate([{year:2020,return:.21}],1000,0);assert.ok(Math.abs(result.balance-1210)<1e-8);assert.equal(result.totalContributed,1000);});
test('monthly contributions are included and tracked separately',()=>{const result=simulate([{year:2020,return:0}],1000,100);assert.equal(result.balance,2200);assert.equal(result.totalContributed,2200);assert.equal(result.gain,0);});
test('random window always fits the available history',()=>{const data=Array.from({length:98},(_,i)=>i);assert.equal(randomStart(data,20,()=>0),0);assert.equal(randomStart(data,20,()=>.999999),78);assert.equal(randomStart(data,200,()=>.9),0);});
test('random years are unique and limited to the requested count',()=>{const data=[1928,1929,1930,1931,1932];const sampled=sampleYears(data,3,()=>.25);assert.equal(sampled.length,3);assert.equal(new Set(sampled).size,3);assert.ok(sampled.every(year=>data.includes(year)));});
test('random year count cannot exceed available history',()=>{assert.deepEqual(sampleYears([1,2],10,()=>0).sort(),[1,2]);});
