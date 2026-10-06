import { sb } from "../core/supabase-client.js";
import { appUrl, setupTheme, setupAppMenu, setupProfileMenu, loadProfileUI, formatCurrency, formatDate, localDateInputValue, showToast, friendlySupabaseError, transactionClass, transactionIcon, escapeHtml } from "../core/app-shared.js";
import { emiDueDates, monthlyDueKey, dateFromKey, dateKey } from "../core/emi-utils.js";

const loader=document.getElementById("pageLoader");
const state={user:null,currency:"INR",month:new Date(new Date().getFullYear(),new Date().getMonth(),1),transactions:[],emis:[],paid:new Set(),goals:[],goalContributions:[],selectedDate:null,editingEmiId:null};
const showLoader=()=>loader?.classList.remove("hidden"); const hideLoader=()=>loader?.classList.add("hidden");
function monthStart(){return new Date(state.month.getFullYear(),state.month.getMonth(),1);} function monthEnd(){return new Date(state.month.getFullYear(),state.month.getMonth()+1,0);} function monthBounds(){return {from:localDateInputValue(monthStart()),to:localDateInputValue(monthEnd())};}
function formatMonthTitle(){return new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric"}).format(monthStart());}
function txByDate(){const map=new Map(); for(const row of state.transactions){const key=String(row.transaction_date).slice(0,10); if(!map.has(key)) map.set(key,[]); map.get(key).push(row);} return map;}
function sums(rows=[]){return rows.reduce((acc,row)=>{const amt=Number(row.amount)||0; if(row.transaction_type==="income")acc.income+=amt; else if(row.transaction_type==="savings")acc.savings+=amt; else acc.expense+=amt; return acc;},{income:0,expense:0,savings:0});}
function goalContributionsByDate(){const map=new Map();for(const row of state.goalContributions){const key=String(row.contribution_date).slice(0,10);if(!map.has(key))map.set(key,[]);map.get(key).push(row);}return map;}
function goalContributionTotal(){return state.goalContributions.reduce((sum,row)=>sum+(Number(row.amount)||0),0);} 
function goalName(goalId){const goal=state.goals.find(x=>String(x.id)===String(goalId));return goal?.name||"Goal contribution";}
function emiByDate(from,to){const map=new Map(); for(const emi of state.emis){for(const dueDate of emiDueDates(emi,from,to)){if(!map.has(dueDate))map.set(dueDate,[]); map.get(dueDate).push(emi);}} return map;}
function isCurrentMonth(){const now=new Date(); return state.month.getFullYear()===now.getFullYear()&&state.month.getMonth()===now.getMonth();}
function latestEmiMonth(){
  if(!state.emis.length) return null;
  return state.emis.reduce((latest,emi)=>{
    const key=String(emi.end_date).slice(0,10);
    return !latest || key>latest ? key : latest;
  },null);
}
function canGoNextMonth(){
  const last=latestEmiMonth();
  if(!last) return false;
  const lastDate=dateFromKey(last);
  const current=monthStart();
  return new Date(current.getFullYear(),current.getMonth()+1,1) <= new Date(lastDate.getFullYear(),lastDate.getMonth(),1);
}
function syncNextButton(){const next=document.getElementById("nextMonth");if(next)next.disabled=!canGoNextMonth();}
function monthNet(){const s=sums(state.transactions);return s.income-s.expense-s.savings-goalContributionTotal();}

async function loadMonth(){
  showLoader();
  try{
    const {from,to}=monthBounds();
    const [{data:transactions,error:txError},{data:emis,error:emiError},{data:goalContributions,error:gcError},{data:goals,error:goalsError}]=await Promise.all([
      sb.from("transactions").select("id,transaction_type,amount,category_id,budget_type,vehicle_id,transaction_date,description,notes,categories(name),vehicles(name)").eq("user_id",state.user.id).gte("transaction_date",from).lte("transaction_date",to).order("transaction_date",{ascending:true}).order("id",{ascending:true}),
      sb.from("loan_emis").select("id,name,loan_type,lender,amount,start_date,end_date,due_day,is_active").eq("user_id",state.user.id).eq("is_active",true),
      sb.from("goal_contributions").select("id,goal_id,amount,contribution_date,note").eq("user_id",state.user.id).gte("contribution_date",from).lte("contribution_date",to).order("contribution_date",{ascending:true}).order("id",{ascending:true}),
      sb.from("goals").select("id,name").eq("user_id",state.user.id)
    ]);
    if(txError)throw txError;if(emiError)throw emiError;if(gcError)throw gcError;if(goalsError)throw goalsError; state.transactions=transactions||[]; state.emis=emis||[]; state.goalContributions=goalContributions||[]; state.goals=goals||[]; syncNextButton();
    const monthDue=[...emiByDate(from,to).keys()];
    if(monthDue.length){const {data:payments,error}=await sb.from("emi_payments").select("emi_id,due_date").eq("user_id",state.user.id).in("due_date",monthDue);if(error)throw error;state.paid=new Set((payments||[]).map(p=>`${p.emi_id}:${String(p.due_date).slice(0,10)}`));}else state.paid=new Set();
    document.getElementById("monthTitle").textContent=formatMonthTitle(); document.getElementById("monthSubTitle").textContent=`${state.transactions.length} transaction${state.transactions.length===1?"":"s"}${state.emis.length?` · ${state.emis.length} active EMI/loan${state.emis.length===1?"":"s"}`:""}`;
    renderSummary();renderCalendar();renderEmiList(); const key=state.selectedDate; if(key && state.transactions.some(x=>String(x.transaction_date).slice(0,10)===key)||key&&emiByDate(from,to).has(key))renderSelectedDate(key);else renderSelectedDate(null);
  }catch(error){console.error(error);showToast(friendlySupabaseError(error),"error");}finally{hideLoader();}
}
function renderSummary(){const s=sums(state.transactions);const goalTotal=goalContributionTotal();document.getElementById("monthIncome").textContent=formatCurrency(s.income,state.currency);document.getElementById("monthExpenses").textContent=formatCurrency(s.expense,state.currency);document.getElementById("monthSavings").textContent=formatCurrency(s.savings+goalTotal,state.currency);document.getElementById("monthNet").textContent=formatCurrency(monthNet(),state.currency);}
function calendarCell(date,isOutside,map,emiMap){
  const key=localDateInputValue(date),rows=map.get(key)||[],emis=emiMap.get(key)||[],goalRows=goalContributionsByDate().get(key)||[],totals=sums(rows),today=localDateInputValue(new Date()),selected=state.selectedDate===key,isFuture=key>today;
  const button=document.createElement("button");
  button.type="button";
  button.className=`calendar-day${isOutside?" outside":""}${key===today?" today":""}${selected?" selected":""}${isFuture?" future":""}${emis.length?" has-emi":""}`;
  button.disabled=isFuture;
  button.title=emis.length?`${emis.length} EMI/loan payment${emis.length===1?"":"s"} scheduled for ${formatDate(key)}`:isFuture?'Future dates cannot be selected':formatDate(key);
  button.setAttribute("aria-label",`${formatDate(key)}${isFuture?", future date":rows.length?`, ${rows.length} transaction${rows.length===1?"":"s"}`:""}${emis.length?`, ${emis.length} EMI/loan due`:""}`);
  const top=document.createElement("div"); top.className="day-top";
  const title=document.createElement("span"); title.className="day-number"; title.textContent=String(date.getDate()); top.appendChild(title);
  if(emis.length) top.insertAdjacentHTML("beforeend",`<span class="day-pin emi-pin" aria-hidden="true">📌</span>`);
  button.appendChild(top);
  if(rows.length&&!isFuture){
    const total=document.createElement("span");total.className="day-total";total.textContent=`${rows.length} transaction${rows.length===1?"":"s"}`;button.appendChild(total);
    const metrics=document.createElement("div");metrics.className="day-metrics";
    if(totals.income)metrics.insertAdjacentHTML("beforeend",`<span class="day-metric income">+${escapeHtml(formatCurrency(totals.income,state.currency))}</span>`);
    if(totals.expense)metrics.insertAdjacentHTML("beforeend",`<span class="day-metric expense">−${escapeHtml(formatCurrency(totals.expense,state.currency))}</span>`);
    if(totals.savings)metrics.insertAdjacentHTML("beforeend",`<span class="day-metric savings">↗ ${escapeHtml(formatCurrency(totals.savings,state.currency))}</span>`);
    const goalTotal=goalRows.reduce((sum,row)=>sum+(Number(row.amount)||0),0);
    if(goalTotal)metrics.insertAdjacentHTML("beforeend",`<span class="day-metric goal">G ${escapeHtml(formatCurrency(goalTotal,state.currency))}</span>`);
    if(emis.length)metrics.insertAdjacentHTML("beforeend",`<span class="day-metric emi">${emis.length} EMI</span>`);
    button.appendChild(metrics);
  }else{
    const empty=document.createElement("span");empty.className="day-total";const goalTotal=goalRows.reduce((sum,row)=>sum+(Number(row.amount)||0),0);empty.textContent=isFuture?(emis.length?`EMI · ${emis.length}`:goalTotal?`Goal · ${formatCurrency(goalTotal,state.currency)}`:"Upcoming"):(emis.length?`EMI · ${emis.length}`:goalTotal?`Goal · ${formatCurrency(goalTotal,state.currency)}`:"No activity");button.appendChild(empty);
  }
  if(!isFuture)button.addEventListener("click",()=>{state.selectedDate=key;renderCalendar();renderSelectedDate(key);});
  return button;
}
function renderCalendar(){const grid=document.getElementById("calendarGrid");grid.innerHTML="";const map=txByDate();const {from,to}=monthBounds();const emiMap=emiByDate(from,to);const first=monthStart();const last=monthEnd();const offset=(first.getDay()+6)%7;const cells=Math.ceil((offset+last.getDate())/7)*7;for(let i=0;i<cells;i++){const date=new Date(state.month.getFullYear(),state.month.getMonth(),i-offset+1);grid.appendChild(calendarCell(date,date.getMonth()!==state.month.getMonth(),map,emiMap));}}
function renderSelectedDate(key){const title=document.getElementById("selectedDateTitle"),summary=document.getElementById("selectedDateSummary"),container=document.getElementById("selectedDateTransactions"),net=document.getElementById("selectedDateNet");if(!key){title.textContent="Choose a date";summary.textContent="Tap a date to see the transactions and scheduled EMI payments.";net.textContent=formatCurrency(0,state.currency);container.innerHTML='<div class="calendar-empty">Select a date from the calendar to view its financial activity.</div>';return;}const rows=txByDate().get(key)||[];const {from,to}=monthBounds();const emis=emiByDate(from,to).get(key)||[];const goalRows=goalContributionsByDate().get(key)||[];const s=sums(rows);const goalTotal=goalRows.reduce((sum,row)=>sum+(Number(row.amount)||0),0);title.textContent=formatDate(key);summary.textContent=`${rows.length?`${rows.length} transaction${rows.length===1?"":"s"}`:"No transactions"}${goalRows.length?` · ${goalRows.length} goal contribution${goalRows.length===1?"":"s"}`:""}${emis.length?` · ${emis.length} EMI/loan payment${emis.length===1?"":"s"} scheduled`:""}`;net.textContent=formatCurrency(s.income-s.expense-s.savings-goalTotal,state.currency);const txHtml=rows.map(row=>{const type=transactionClass(row.transaction_type),sign=row.transaction_type==="income"?"+":row.transaction_type==="expense"?"−":"↗",category=escapeHtml(row.categories?.name||"Uncategorized"),description=escapeHtml(row.description||row.notes||"No description"),vehicle=row.vehicles?.name?` · ${escapeHtml(row.vehicles.name)}`:"";return `<div class="calendar-tx"><div class="calendar-tx-icon ${type}">${transactionIcon(row.transaction_type)}</div><div class="calendar-tx-main"><strong>${category}</strong><span>${description}${vehicle}${row.transaction_type==="expense"?` · ${escapeHtml(row.budget_type==="needs"?"Need":"Want")}`:""}</span></div><div class="calendar-tx-amount ${type}">${sign}${escapeHtml(formatCurrency(row.amount,state.currency))}</div></div>`;}).join("");const goalHtml=goalRows.map(row=>`<div class="calendar-tx calendar-goal"><div class="calendar-tx-icon goal">◎</div><div class="calendar-tx-main"><strong>${escapeHtml(goalName(row.goal_id))}</strong><span>Goal contribution${row.note?` · ${escapeHtml(row.note)}`:""}</span></div><div class="calendar-tx-amount goal">−${escapeHtml(formatCurrency(row.amount,state.currency))}</div></div>`).join("");const emiHtml=emis.map(emi=>{const paid=state.paid.has(`${emi.id}:${key}`);return `<div class="calendar-tx calendar-emi"><div class="calendar-tx-icon emi">◉</div><div class="calendar-tx-main"><strong>${escapeHtml(emi.name)}</strong><span>${escapeHtml(emi.lender||"EMI/Loan")} · ${escapeHtml(emi.loan_type.toUpperCase())} · Scheduled only${paid?" · Paid":""}</span></div><div class="calendar-tx-amount emi">${escapeHtml(formatCurrency(emi.amount,state.currency))}</div></div>`;}).join("");container.innerHTML=txHtml+goalHtml+emiHtml||'<div class="calendar-empty">No activity recorded or scheduled for this date.</div>';}

function renderEmiList(){const container=document.getElementById("emiList");if(!container)return;container.innerHTML=state.emis.length?state.emis.map(emi=>{const key=nextEmiDueDateForMonthSafe(emi);return `<article class="emi-list-card"><div class="reminder-badge">${escapeHtml(emi.loan_type)}</div><h3>${escapeHtml(emi.name)}</h3><p>${escapeHtml(emi.lender||"No lender")} · Due day ${emi.due_day}</p><strong>${escapeHtml(formatCurrency(emi.amount,state.currency))} / month</strong><small>Next: ${key?escapeHtml(formatDate(key)):"Completed"}</small><div class="row-actions"><button class="row-action" data-edit-emi="${emi.id}">Edit</button><button class="row-action danger" data-delete-emi="${emi.id}">Delete</button></div></article>`;}).join(""):'<div class="empty-state"><strong>No active EMI/loans</strong>Create one to see its monthly schedule on the calendar and receive 2-day reminders.</div>';}
function nextEmiDueDateForMonthSafe(emi){const today=localDateInputValue(new Date());const {endExclusive}=({});const start=dateFromKey(today);for(let i=0;i<36;i++){const y=start.getFullYear(),m=start.getMonth()+i;const d=new Date(y,m,1);const key=monthlyDueKey(d.getFullYear(),d.getMonth(),emi.due_day);if(key>=today&&key>=String(emi.start_date).slice(0,10)&&key<=String(emi.end_date).slice(0,10))return key;}return null;}
function openEmiModal(emi=null){state.editingEmiId=emi?.id||null;document.getElementById("emiModal")?.classList.remove("hidden");document.getElementById("emiModalTitle").textContent=emi?"Edit EMI / Loan":"Track EMI / Loan";document.getElementById("emiSaveButton").textContent=emi?"Update Schedule":"Save Schedule";document.getElementById("emiName").value=emi?.name||"";document.getElementById("emiType").value=emi?.loan_type||"emi";document.getElementById("emiLender").value=emi?.lender||"";document.getElementById("emiAmount").value=emi?.amount||"";document.getElementById("emiStartDate").value=emi?.start_date||localDateInputValue(new Date());document.getElementById("emiEndDate").value=emi?.end_date||"";document.getElementById("emiDueDay").value=emi?.due_day||new Date().getDate();document.getElementById("emiNotes").value=emi?.notes||"";setMinEmiDates();}
function closeEmiModal(){document.getElementById("emiModal")?.classList.add("hidden");state.editingEmiId=null;document.getElementById("emiForm")?.reset();document.getElementById("emiFormError")?.classList.add("hidden");}
function setMinEmiDates(){const start=document.getElementById("emiStartDate"),end=document.getElementById("emiEndDate"),today=localDateInputValue(new Date());if(start){start.min=state.editingEmiId?String(start.value||today).slice(0,10):today;start.max="9999-12-31";}if(end)end.min=start?.value||today;}
async function saveEmi(event){event.preventDefault();const name=document.getElementById("emiName").value.trim(),type=document.getElementById("emiType").value,lender=document.getElementById("emiLender").value.trim(),amount=Number(document.getElementById("emiAmount").value),start=document.getElementById("emiStartDate").value,end=document.getElementById("emiEndDate").value,dueDay=Number(document.getElementById("emiDueDay").value),notes=document.getElementById("emiNotes").value.trim();const today=localDateInputValue(new Date());const err=document.getElementById("emiFormError");err.classList.add("hidden");if(!name)return showEmiError("Please enter an EMI/loan name.");if(!Number.isFinite(amount)||amount<1)return showEmiError("Amount must be at least 1.");if(!start||!end)return showEmiError("Choose both start and end dates.");if(!state.editingEmiId&&start<today)return showEmiError("Start date cannot be in the past. Please choose today or a future date.");if(end<start)return showEmiError("End date must be on or after start date.");if(dueDay<1||dueDay>31)return showEmiError("Due day must be between 1 and 31.");showLoader();try{const payload={user_id:state.user.id,name,loan_type:type,lender:lender||null,amount,start_date:start,end_date:end,due_day:dueDay,notes:notes||null,is_active:true};const result=state.editingEmiId?await sb.from("loan_emis").update(payload).eq("id",state.editingEmiId).eq("user_id",state.user.id).select("id").maybeSingle():await sb.from("loan_emis").insert(payload).select("id").maybeSingle();if(result.error)throw result.error;closeEmiModal();showToast(state.editingEmiId?"EMI schedule updated.":"EMI/loan schedule created.");await loadMonth();}catch(error){console.error(error);showEmiError(friendlySupabaseError(error));}finally{hideLoader();}}
function showEmiError(message){const err=document.getElementById("emiFormError");err.textContent=message;err.classList.remove("hidden");return false;}
async function deleteEmi(id){const emi=state.emis.find(x=>String(x.id)===String(id));if(!emi)return;if(!confirm(`Delete the schedule for ${emi.name}?`))return;showLoader();try{const {error}=await sb.from("loan_emis").delete().eq("id",id).eq("user_id",state.user.id);if(error)throw error;showToast("EMI/loan schedule deleted.");await loadMonth();}catch(error){console.error(error);showToast(friendlySupabaseError(error),"error");}finally{hideLoader();}}

document.getElementById("prevMonth")?.addEventListener("click",()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()-1,1);state.selectedDate=null;syncNextButton();loadMonth();});
document.getElementById("nextMonth")?.addEventListener("click",()=>{if(!canGoNextMonth())return;state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);state.selectedDate=null;syncNextButton();loadMonth();});
document.getElementById("todayButton")?.addEventListener("click",()=>{const d=new Date();state.month=new Date(d.getFullYear(),d.getMonth(),1);state.selectedDate=localDateInputValue(d);syncNextButton();loadMonth();});
document.getElementById("openEmiButton")?.addEventListener("click",()=>openEmiModal());document.getElementById("emiModalClose")?.addEventListener("click",closeEmiModal);document.getElementById("emiCancelButton")?.addEventListener("click",closeEmiModal);document.getElementById("emiForm")?.addEventListener("submit",saveEmi);document.getElementById("emiStartDate")?.addEventListener("change",setMinEmiDates);
document.getElementById("emiList")?.addEventListener("click",e=>{const edit=e.target.closest("[data-edit-emi]"),del=e.target.closest("[data-delete-emi]");if(edit)openEmiModal(state.emis.find(x=>String(x.id)===String(edit.dataset.editEmi)));if(del)deleteEmi(del.dataset.deleteEmi);});
setupAppMenu();setupTheme();syncNextButton();
sb.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||!session)window.location.replace(appUrl("index.html"));});
(async()=>{try{const profile=await loadProfileUI();state.user=profile.user;state.currency=profile.currency||"INR";setupProfileMenu();await loadMonth();}catch(error){if(String(error?.message)!=="AUTH_REQUIRED"){console.error(error);showToast(friendlySupabaseError(error),"error");}}})();
