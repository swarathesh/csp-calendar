/* Shared by the browser and dependency-free Node tests. */
(function(root){
 function easternToday(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const get=type=>parts.find(p=>p.type===type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
 }
 function filterEvents(events,{search="",kind="",from="",to=""}={}){
  const query=search.trim().toLowerCase();
  return events.filter(e=>(!kind||e.kind===kind)&&(!from||e.date>=from)&&(!to||e.date<=to)&&
   [e.title,e.symbol,e.date].join(" ").toLowerCase().includes(query))
   .sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
 }
 function eventsCsv(events){
  const cell=value=>{
   let text=String(value??"");
   if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
   return '"'+text.replace(/"/g,'""')+'"';
  };
  return [["Date (ET)","Time (ET)","Event","Symbol","Type","Source","Cached verification date"],
   ...events.map(e=>[e.date,e.time,e.title,e.symbol,e.kind,e.source,e.verified_at])]
   .map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n";
 }
 const api={easternToday,filterEvents,eventsCsv};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 else root.CalendarTools=api;
})(globalThis);
