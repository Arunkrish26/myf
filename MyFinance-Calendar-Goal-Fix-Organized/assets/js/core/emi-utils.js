export function dateFromKey(key){
  const [y,m,d]=String(key).slice(0,10).split('-').map(Number);
  return new Date(y,m-1,d);
}
export function dateKey(date){
  const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
export function addDays(date,days){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate()); d.setDate(d.getDate()+days); return d;
}
export function diffDays(from,to){return Math.round((dateFromKey(to)-dateFromKey(from))/86400000);}
export function daysInMonth(year,monthIndex){return new Date(year,monthIndex+1,0).getDate();}
export function monthlyDueKey(year,monthIndex,dueDay){
  const day=Math.min(Number(dueDay),daysInMonth(year,monthIndex));
  return dateKey(new Date(year,monthIndex,day));
}
export function emiDueDates(emi,fromKey,toKey){
  const startKey=String(emi.start_date).slice(0,10), endKey=String(emi.end_date).slice(0,10);
  const from=dateFromKey(fromKey), to=dateFromKey(toKey);
  const first=new Date(from.getFullYear(),from.getMonth(),1);
  const results=[];
  for(let cursor=new Date(first); cursor<=new Date(to.getFullYear(),to.getMonth(),1); cursor.setMonth(cursor.getMonth()+1)){
    const key=monthlyDueKey(cursor.getFullYear(),cursor.getMonth(),emi.due_day);
    if(key>=startKey && key<=endKey && key>=fromKey && key<=toKey) results.push(key);
  }
  return results;
}
export function nextEmiDueDate(emi,fromKey=dateKey(new Date())){
  const endKey=String(emi.end_date).slice(0,10); if(endKey<fromKey) return null;
  const start=dateFromKey(fromKey); let cursor=new Date(start.getFullYear(),start.getMonth(),1);
  for(let i=0;i<36;i++){
    const key=monthlyDueKey(cursor.getFullYear(),cursor.getMonth(),emi.due_day);
    if(key>=fromKey && key>=String(emi.start_date).slice(0,10) && key<=endKey) return key;
    cursor.setMonth(cursor.getMonth()+1);
  }
  return null;
}
export function isFutureKey(key){return key>dateKey(new Date());}
