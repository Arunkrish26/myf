import { sb } from "../core/supabase-client.js";
import { appUrl, setupTheme, setupAppMenu, setupProfileMenu, loadProfileUI, formatCurrency, formatDate, localDateInputValue, monthBounds, startOfThisWeek, escapeHtml, showToast, friendlySupabaseError } from "../core/app-shared.js";

const loader = document.getElementById("pageLoader");
const state = { user: null, currency: "INR", range:"this-month", from:null, to:null, rows:[], charts:{} };
const showLoader = () => loader?.classList.remove("hidden");
const hideLoader = () => loader?.classList.add("hidden");

function addDays(date, days){ const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate()+days); return d; }
function rangeDates(key){
  const now = new Date(); now.setHours(0,0,0,0);
  if(key === "today") return {from:localDateInputValue(now),to:localDateInputValue(addDays(now,1)),label:"Today"};
  if(key === "last-7") { const from=addDays(now,-6); return {from:localDateInputValue(from),to:localDateInputValue(addDays(now,1)),label:"Last 7 Days"}; }
  if(key === "last-30") { const from=addDays(now,-29); return {from:localDateInputValue(from),to:localDateInputValue(addDays(now,1)),label:"Last 30 Days"}; }
  if(key === "this-week") return {from:startOfThisWeek(now),to:localDateInputValue(addDays(now,1)),label:"This Week"};
  if(key === "this-month") { const b=monthBounds(now); return {from:b.start,to:b.endExclusive,label:b.label}; }
  if(key === "last-month") { const first=new Date(now.getFullYear(),now.getMonth()-1,1); const next=new Date(now.getFullYear(),now.getMonth(),1); return {from:localDateInputValue(first),to:localDateInputValue(next),label:new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric"}).format(first)}; }
  if(key === "this-year") { const first=new Date(now.getFullYear(),0,1); const next=new Date(now.getFullYear()+1,0,1); return {from:localDateInputValue(first),to:localDateInputValue(next),label:String(now.getFullYear())}; }
  return {from:null,to:null,label:"Custom range"};
}
function sum(rows,type){return rows.filter(r=>r.transaction_type===type).reduce((s,r)=>s+Number(r.amount||0),0);}
function sumBudget(rows,budget){return rows.filter(r=>r.transaction_type==="expense"&&r.budget_type===budget).reduce((s,r)=>s+Number(r.amount||0),0);}
function pct(v,total){return total>0 ? (Number(v)/Number(total))*100 : 0;}
function setPeriod(key){
  state.range=key;
  const d=rangeDates(key); state.from=d.from; state.to=d.to;
  const select=document.getElementById("rangeSelect");
  if(select) select.value=key;
  document.getElementById("customRange")?.classList.toggle("hidden",key!=="custom");
  if(key!=="custom") loadAnalytics();
}

function chartPalette(){
  const dark = document.documentElement.dataset.theme === "dark";
  return dark ? {
    text:"#eef4ff", muted:"#9cadc2", border:"#2a3952",
    yellow:"#f2c36b", orange:"#ffb86b", red:"#ff9d95", green:"#9cddb4", mint:"#98dfc5", blue:"#a9d7ee", purple:"#cdb4f2", pink:"#f4b7d1"
  } : {
    text:"#102027", muted:"#687981", border:"#dce6e5",
    yellow:"#e9c84a", orange:"#f0a35b", red:"#d86a61", green:"#4c9568", mint:"#3c9175", blue:"#4d7fa2", purple:"#9b78d1", pink:"#d7779b"
  };
}
function destroyCharts(){ Object.values(state.charts).forEach(c=>c?.destroy()); state.charts={}; }
function baseChartOptions(palette){
  return { responsive:true, maintainAspectRatio:false, animation:{duration:900,easing:"easeOutQuart"}, plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>`${ctx.label}: ${formatCurrency(ctx.parsed?.y ?? ctx.parsed ?? 0,state.currency)}`}}}, interaction:{intersect:false,mode:"index"} };
}

function renderLegend(targetId, items, colors, total){
  const el=document.getElementById(targetId); if(!el) return;
  el.innerHTML = items.map(([name,val],i)=>`<div class="analytics-legend-item"><span class="analytics-legend-dot" style="background:${colors[i%colors.length]}"></span><strong>${escapeHtml(name)}</strong><span>${pct(val,total).toFixed(1)}%</span></div>`).join("");
}
function renderCenter(id,total,label){const el=document.getElementById(id); if(!el) return; el.innerHTML=`<strong>${escapeHtml(formatCurrency(total,state.currency))}</strong><span>${escapeHtml(label)}</span>`;}

function renderCharts(rows){
  if(typeof Chart === "undefined"){ showToast("Analytics chart library could not be loaded. Check your internet connection.","error"); return; }
  destroyCharts();
  const palette=chartPalette();
  const colors=[palette.yellow,palette.orange,palette.red,palette.green,palette.mint,palette.blue,palette.purple,palette.pink];
  const expenseMap={}; const incomeMap={};
  rows.filter(r=>r.transaction_type==="expense").forEach(r=>{const k=r.categories?.name||"Uncategorized"; expenseMap[k]=(expenseMap[k]||0)+Number(r.amount||0);});
  rows.filter(r=>r.transaction_type==="income").forEach(r=>{const k=r.categories?.name||"Uncategorized"; incomeMap[k]=(incomeMap[k]||0)+Number(r.amount||0);});
  const expenseItems=Object.entries(expenseMap).sort((a,b)=>b[1]-a[1]).slice(0,8); const incomeItems=Object.entries(incomeMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const expenseTotal=expenseItems.reduce((s,x)=>s+x[1],0); const incomeTotal=incomeItems.reduce((s,x)=>s+x[1],0);
  renderCenter("expenseChartCenter",expenseTotal,"Expenses"); renderCenter("incomeChartCenter",incomeTotal,"Income");
  renderLegend("expenseLegend",expenseItems,colors,expenseTotal); renderLegend("incomeLegend",incomeItems,colors.slice().reverse(),incomeTotal);

  const doughnutOptions={...baseChartOptions(palette),cutout:"68%",plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>`${ctx.label}: ${formatCurrency(ctx.raw,state.currency)} (${pct(ctx.raw,ctx.dataset.data.reduce((a,b)=>a+b,0)).toFixed(1)}%)`}}},animation:{duration:1050,easing:"easeOutCubic",animateRotate:true,animateScale:true}};
  state.charts.expense=new Chart(document.getElementById("expenseChart"),{type:"doughnut",data:{labels:expenseItems.map(x=>x[0]),datasets:[{data:expenseItems.map(x=>x[1]),backgroundColor:colors,borderColor:palette.border,borderWidth:2,hoverOffset:7}]},options:doughnutOptions});
  state.charts.income=new Chart(document.getElementById("incomeChart"),{type:"doughnut",data:{labels:incomeItems.map(x=>x[0]),datasets:[{data:incomeItems.map(x=>x[1]),backgroundColor:colors.slice().reverse(),borderColor:palette.border,borderWidth:2,hoverOffset:7}]},options:doughnutOptions});

  const needs=sumBudget(rows,"needs"), wants=sumBudget(rows,"wants"), savings=sum(rows,"savings");
  const budgetCtx=document.getElementById("budgetChart");
  state.charts.budget=new Chart(budgetCtx,{type:"bar",data:{labels:["Needs","Wants","Savings"],datasets:[{label:"Amount",data:[needs,wants,savings],backgroundColor:[palette.yellow,palette.red,palette.orange],borderRadius:12,borderSkipped:false,maxBarThickness:54}]},options:{...baseChartOptions(palette),plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>formatCurrency(ctx.raw,state.currency)}}},scales:{x:{grid:{display:false},ticks:{color:palette.text,font:{family:"Poppins",weight:"700"}}},y:{beginAtZero:true,grid:{color:palette.border},ticks:{color:palette.muted,font:{family:"Poppins",size:10},callback:(v)=>formatCurrency(v,state.currency)}}}}});

  const grouped={}; rows.forEach(r=>{const key=String(r.transaction_date).slice(0,7); if(!grouped[key]) grouped[key]={income:0,expense:0,savings:0}; grouped[key][r.transaction_type]+=Number(r.amount||0);});
  const keys=Object.keys(grouped).sort();
  const labels=keys.map(k=>{const [y,m]=k.split("-").map(Number);return new Intl.DateTimeFormat("en-IN",{month:"short",year:"2-digit"}).format(new Date(y,m-1,1));});
  const trendCtx=document.getElementById("trendChart");
  state.charts.trend=new Chart(trendCtx,{type:"bar",data:{labels:labels.length?labels:[rangeDates(state.range).label],datasets:[
    {label:"Income",data:keys.length?keys.map(k=>grouped[k].income):[0],backgroundColor:palette.green,borderRadius:8,maxBarThickness:28},
    {label:"Expenses",data:keys.length?keys.map(k=>grouped[k].expense):[0],backgroundColor:palette.red,borderRadius:8,maxBarThickness:28},
    {label:"Savings",data:keys.length?keys.map(k=>grouped[k].savings):[0],backgroundColor:palette.orange,borderRadius:8,maxBarThickness:28}
  ]},options:{...baseChartOptions(palette),plugins:{legend:{display:true,position:"top",align:"end",labels:{color:palette.text,boxWidth:10,boxHeight:10,font:{family:"Poppins",size:10,weight:"700"}}},tooltip:{callbacks:{label:(ctx)=>`${ctx.dataset.label}: ${formatCurrency(ctx.raw,state.currency)}`}}},scales:{x:{stacked:false,grid:{display:false},ticks:{color:palette.muted,font:{family:"Poppins",size:10,weight:"600"}}},y:{beginAtZero:true,grid:{color:palette.border},ticks:{color:palette.muted,font:{family:"Poppins",size:10},callback:(v)=>formatCurrency(v,state.currency)}}}}});
}

function renderStats(rows){
  const income=sum(rows,"income"), expense=sum(rows,"expense"), savings=sum(rows,"savings"), net=income-expense-savings;
  document.getElementById("statIncome").textContent=formatCurrency(income,state.currency);
  document.getElementById("statExpense").textContent=formatCurrency(expense,state.currency);
  document.getElementById("statSavings").textContent=formatCurrency(savings,state.currency);
  document.getElementById("statNet").textContent=formatCurrency(net,state.currency);
  const needs=sumBudget(rows,"needs"), wants=sumBudget(rows,"wants");
  const needsPct=pct(needs,income), wantsPct=pct(wants,income), savingsPct=pct(savings,income);
  document.getElementById("insightNeeds").textContent=`${needsPct.toFixed(1)}%`; document.getElementById("insightWants").textContent=`${wantsPct.toFixed(1)}%`; document.getElementById("insightSavings").textContent=`${savingsPct.toFixed(1)}%`;
  let text="Analytics are a guide to help you spot patterns; previous balance is not included in these percentages.";
  if(income===0) text="No income is recorded in this period, so percentage comparisons are not available yet.";
  else if(savingsPct>=20) text="Your savings allocation is at or above the 20% guide for this selected period.";
  else if(wantsPct>30) text="Wants are above the 30% guide in this selected period. You can review the largest categories for possible savings.";
  else if(needsPct>50) text="Needs are above the 50% guide in this selected period. Review fixed costs before cutting essentials.";
  document.getElementById("insightText").textContent=text;
}

async function fetchRows(){
  const {data,error}=await sb.from("transactions").select("id,transaction_type,amount,budget_type,transaction_date,categories(name),vehicles(name)").eq("user_id",state.user.id).gte("transaction_date",state.from).lt("transaction_date",state.to).order("transaction_date",{ascending:true}).order("id",{ascending:true});
  if(error) throw error; return data||[];
}
async function loadAnalytics(){
  showLoader();
  try{
    state.rows=await fetchRows();
    document.getElementById("periodLabel").textContent=state.range==="custom"?`Custom: ${state.from} to ${state.to}`:rangeDates(state.range).label;
    renderStats(state.rows); renderCharts(state.rows);
  }catch(error){
    if(String(error?.message)==="AUTH_REQUIRED") return;
    console.error(error); showToast(friendlySupabaseError(error),"error");
  }finally{ hideLoader(); }
}

setupAppMenu(); setupTheme();
setupProfileMenu();
document.getElementById("rangeSelect")?.addEventListener("change",(e)=>setPeriod(e.target.value));
document.getElementById("applyCustomRange")?.addEventListener("click",()=>{
  const from=document.getElementById("fromDate").value, to=document.getElementById("toDate").value;
  if(!from||!to||from>to){showToast("Please select a valid custom date range.","warning");return;}
  state.range="custom"; state.from=from; const d=new Date(Number(to.slice(0,4)),Number(to.slice(5,7))-1,Number(to.slice(8,10))+1); state.to=localDateInputValue(d);
  const rangeSelect=document.getElementById("rangeSelect"); if(rangeSelect) rangeSelect.value="custom";
  document.getElementById("customRange")?.classList.remove("hidden"); loadAnalytics();
});

const observer=new MutationObserver(()=>{if(state.rows.length) renderCharts(state.rows);}); observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
sb.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||!session) window.location.replace(appUrl("index.html"));});

(async () => { try { const p = await loadProfileUI(); state.user = p.user; state.currency = p.currency; const d = rangeDates("this-month"); state.from=d.from; state.to=d.to; document.getElementById("rangeSelect").value="this-month"; document.getElementById("fromDate").value=d.from; document.getElementById("toDate").value=d.from; await loadAnalytics();}catch(error){if(String(error?.message)!=="AUTH_REQUIRED"){console.error(error);showToast(friendlySupabaseError(error),"error");}}})();
