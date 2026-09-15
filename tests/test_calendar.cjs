const {test}=require('node:test');
const assert=require('node:assert/strict');
const {easternToday,filterEvents,eventsCsv}=require('../site/calendar-tools.js');
const events=[{date:'2026-09-18',title:'Earnings',symbol:'ABC',kind:'Earnings'}, {date:'2026-09-16',title:'Fed decision',kind:'Macro'}, {date:'2026-09-15',title:'Inflation',kind:'Macro'}];
test('date boundaries are inclusive and results sorted without changing input',()=>{
 assert.deepEqual(filterEvents(events,{from:'2026-09-15',to:'2026-09-16'}).map(e=>e.date),['2026-09-15','2026-09-16']);
 assert.equal(events[0].date,'2026-09-18');
 assert.deepEqual(filterEvents(events,{from:'2026-09-18',to:'2026-09-16'}),[]);
});
test('search and type compose with date filters',()=>{
 assert.equal(filterEvents(events,{search:' abc ',kind:'Earnings',from:'2026-09-18'}).length,1);
 assert.equal(filterEvents(events,{search:'ABC',kind:'Macro'}).length,0);
});
test('Eastern date handles UTC midnight and daylight saving',()=>{
 assert.equal(easternToday(new Date('2026-09-16T02:00:00Z')),'2026-09-15');
 assert.equal(easternToday(new Date('2026-01-16T04:30:00Z')),'2026-01-15');
 assert.equal(easternToday(new Date('2026-09-16T04:00:00Z')),'2026-09-16');
});
test('CSV preserves source, cached provenance, quotes and line breaks',()=>{
 const csv=eventsCsv([{date:'2026-09-16',title:'A, "B"\nC',source:'https://example.com',verified_at:'2026-09-14'}]);
 assert.ok(csv.includes('"A, ""B""\nC"'));
 assert.ok(csv.includes('"https://example.com","2026-09-14"'));
 assert.ok(csv.endsWith('\r\n'));
});
test('CSV neutralizes spreadsheet formulas',()=>{
 for(const title of ['=1+1',' +SUM(1)','@SUM(1)','-1','\t=1']) assert.ok(eventsCsv([{title}]).includes('"\''+title+'"'));
});
