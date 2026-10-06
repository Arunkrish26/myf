import { sb } from '../core/supabase-client.js';
import { appUrl, setupTheme, setupAppMenu, setupProfileMenu, loadProfileUI, formatCurrency, formatDate, showToast, friendlySupabaseError, escapeHtml } from '../core/app-shared.js';
import { dateKey, addDays, diffDays, emiDueDates, nextEmiDueDate } from '../core/emi-utils.js';

const state={user:null,currency:'INR',emis:[],paid:new Set()};
const loader=document.getElementById('pageLoader');
const showLoader=()=>loader?.classList.remove('hidden'); const hideLoader=()=>loader?.classList.add('hidden');

function reminderKey(emiId,dueDate){return `${state.user.id}:${emiId}:${dueDate}`;}
function daysLabel(days){return days===0?'Due today':days===1?'Due tomorrow':`${days} days left`;}
const EARLY_MARK_PAID_DAYS=10;
let notificationRegistration=null;

async function loadData(){
  showLoader();
  try{
    const [{data:emis,error:emiError},{data:payments,error:paymentError}]=await Promise.all([
      sb.from('loan_emis').select('id,name,loan_type,lender,amount,start_date,end_date,due_day,notes,is_active').eq('user_id',state.user.id).eq('is_active',true).order('start_date'),
      sb.from('emi_payments').select('emi_id,due_date').eq('user_id',state.user.id)
    ]);
    if(emiError) throw emiError; if(paymentError) throw paymentError;
    state.emis=emis||[]; state.paid=new Set((payments||[]).map(p=>`${p.emi_id}:${String(p.due_date).slice(0,10)}`));
    render(); maybeNotify();
  }catch(error){console.error(error);showToast(friendlySupabaseError(error),'error');}
  finally{hideLoader();}
}

function allUpcoming(){
  const today=dateKey(new Date()), end=dateKey(addDays(new Date(),30)), rows=[];
  for(const emi of state.emis){
    for(const dueDate of emiDueDates(emi,today,end)){
      const paid=state.paid.has(`${emi.id}:${dueDate}`); rows.push({emi,dueDate,days:diffDays(today,dueDate),paid});
    }
  }
  return rows.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||Number(a.emi.id)-Number(b.emi.id));
}

function render(){
  const rows=allUpcoming();
  const dueSoon=rows.filter(x=>!x.paid && x.days<=2);
  const upcoming=rows.filter(x=>x.days>2 && !x.paid);
  document.getElementById('reminderCount').textContent=String(dueSoon.length);
  document.getElementById('reminderSubtitle').textContent=dueSoon.length?`${dueSoon.length} payment${dueSoon.length===1?'':'s'} needs attention.`:'No EMI payments need attention in the next 2 days.';
  document.getElementById('dueSoonList').innerHTML=dueSoon.length?dueSoon.map(renderCard).join(''):'<div class="empty-state"><strong>You are all clear</strong>No active EMI/loan payment is due within the next 2 days.</div>';
  document.getElementById('upcomingList').innerHTML=upcoming.length?upcoming.map(renderCard).join(''):'<div class="empty-state"><strong>No upcoming payments</strong>No unpaid EMI/loan payments are scheduled in the next 30 days.</div>';
}

function renderCard(item){
  const {emi,dueDate,days,paid}=item; const kind=emi.loan_type==='loan'?'Loan':'EMI';
  return `<article class="reminder-card ${paid?'paid':days<=2?'urgent':''}">
    <div class="reminder-card-main"><div class="reminder-badge">${kind}</div><h3>${escapeHtml(emi.name)}</h3><p>${escapeHtml(emi.lender||'Payment schedule')} · Monthly · Due ${escapeHtml(formatDate(dueDate))}</p></div>
    <div class="reminder-card-meta"><strong>${escapeHtml(formatCurrency(emi.amount,state.currency))}</strong><span class="reminder-days">${paid?'Paid':daysLabel(days)}</span></div>
    <div class="reminder-actions"><a class="btn btn-secondary btn-sm" href="${appUrl(`transactions.html?type=expense`)}">Add expense</a>${paid?'':`<button class="btn btn-primary btn-sm" type="button" data-paid="${emi.id}" data-due="${dueDate}">Mark as paid</button>`}</div>
  </article>`;
}

async function markPaid(id,dueDate){
  const days=diffDays(dateKey(new Date()),dueDate);
  if(days<0){showToast('This EMI date has already passed. Record the actual expense and review the reminder.','warning');return;}
  if(days>EARLY_MARK_PAID_DAYS){showToast(`You can mark an EMI as paid up to ${EARLY_MARK_PAID_DAYS} days early.`,'info');return;}
  showLoader();
  try{
    const emiId=Number(id);
    const {data:existing,error:findError}=await sb.from('emi_payments')
      .select('id')
      .eq('user_id',state.user.id)
      .eq('emi_id',emiId)
      .eq('due_date',dueDate)
      .maybeSingle();
    if(findError) throw findError;
    if(!existing){
      const {error:insertError}=await sb.from('emi_payments').insert({
        user_id:state.user.id,
        emi_id:emiId,
        due_date:dueDate
      });
      if(insertError && insertError.code!=='23505') throw insertError;
    }
    state.paid.add(`${emiId}:${dueDate}`);
    render();
    showToast(days>0?`EMI marked as paid ${days} day${days===1?'':'s'} early.`:'EMI marked as paid.');
  }catch(error){console.error(error);showToast(friendlySupabaseError(error),'error');}
  finally{hideLoader();}
}

async function getNotificationRegistration(){
  if(!('serviceWorker' in navigator)) return null;
  try{
    if(!notificationRegistration){
      notificationRegistration=await navigator.serviceWorker.register(appUrl('sw.js'));
      await navigator.serviceWorker.ready;
    }
    return notificationRegistration;
  }catch(error){
    console.error('Service worker registration failed:',error);
    return null;
  }
}

async function showBrowserNotification(title,body){
  if(!('Notification' in window) || Notification.permission!=='granted') return false;
  const registration=await getNotificationRegistration();
  if(registration?.showNotification){
    await registration.showNotification(title,{body,icon:appUrl('assets/icon-192.png'),badge:appUrl('assets/icon-192.png'),tag:`myfinance-emi-${Date.now()}`});
    return true;
  }
  new Notification(title,{body});
  return true;
}

async function maybeNotify(){
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  const today=dateKey(new Date());
  const twoDays=dateKey(addDays(new Date(),2));
  for(const row of allUpcoming().filter(x=>!x.paid && (x.dueDate===twoDays || x.dueDate===today))){
    const key=`myfinance-reminder:${reminderKey(row.emi.id,row.dueDate)}`;
    if(localStorage.getItem(key)==='1') continue;
    const title=`MyFinance: ${row.dueDate===today?'EMI due today':'EMI due in 2 days'}`;
    const body=`${row.emi.name} · ${formatCurrency(row.emi.amount,state.currency)} · Due ${formatDate(row.dueDate)}`;
    const shown=await showBrowserNotification(title,body);
    if(shown) localStorage.setItem(key,'1');
  }
}

document.getElementById('enableNotifications')?.addEventListener('click',async()=>{
  if(!('Notification' in window)){showToast('Browser notifications are not supported here.','warning');return;}
  if(!window.isSecureContext && !['localhost','127.0.0.1'].includes(location.hostname)){
    showToast('Browser alerts require an HTTPS site.','warning');
    return;
  }
  try{
    const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
    if(permission!=='granted'){showToast('Notifications are blocked. Allow notifications for MyFinance in your browser site settings.','warning');return;}
    await getNotificationRegistration();
    await showBrowserNotification('MyFinance alerts are enabled','Test alert: EMI reminders are ready.');
    showToast('Browser reminders enabled.');
    await maybeNotify();
  }catch(error){
    console.error(error);
    showToast('Unable to enable browser alerts. Check your browser permission and HTTPS connection.','error');
  }
});

document.getElementById('reminderList')?.addEventListener('click',e=>{const btn=e.target.closest('[data-paid]'); if(btn) markPaid(btn.dataset.paid,btn.dataset.due);});

(async()=>{try{setupAppMenu();setupTheme();const profile=await loadProfileUI();state.user=profile.user;state.currency=profile.currency||'INR';setupProfileMenu();await loadData();}catch(error){if(String(error?.message)!=='AUTH_REQUIRED'){console.error(error);showToast(friendlySupabaseError(error),'error');}}})();
