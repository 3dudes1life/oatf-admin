(() => {
  'use strict';
  const Store = window.OATFStore;
  const Intel = window.OATFIntel;
  const UI = window.OATFUI;
  if (!Store || !Intel || !UI) return;
  const $ = s => document.querySelector(s);
  const SNAPSHOT_KEY = 'oatf-os-production-v007-snapshots';
  if (!localStorage.getItem(SNAPSHOT_KEY)){
    const legacySnapshots = localStorage.getItem('oatf-os-production-v005-snapshots') || localStorage.getItem('oatf-os-production-v006-snapshots');
    if (legacySnapshots) localStorage.setItem(SNAPSHOT_KEY,legacySnapshots);
  }
  const todayISO = () => new Date().toISOString().slice(0,10);
  const addDays = (days) => { const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10); };
  const fair = id => Store.get('fair',id);
  const esc = UI.esc;

  function evaluateRules(fairId=''){
    const s=Store.state;
    const violations=[];
    const push=(ruleId,severity,type,id,title,detail,fairIdValue='')=>violations.push({ruleId,severity,type,id,title,detail,fairId:fairIdValue});
    const fairs=fairId?s.fairs.filter(f=>f.id===fairId):s.fairs;
    fairs.forEach(f=>{
      if(!f.venue||!f.stage) push('fair-core','critical','fair',f.id,`${f.short} is missing venue or stage information`,'Complete the fair production profile.',f.id);
      const slots=Intel.scheduleForFair(f.id);
      if(!slots.length) push('schedule-exists','critical','fair',f.id,`${f.short} has no run of show`,'Add at least one stage block before production planning can be considered active.',f.id);
      Intel.scheduleIssues(f.id).filter(x=>x.severity!=='info').forEach(issue=>push(`schedule-${issue.id}`,issue.severity,'schedule',issue.slotId,issue.title,issue.body,f.id));
      const contacts=s.contacts.filter(c=>c.fairIds?.includes(f.id));
      if(!contacts.some(c=>c.type==='Fair Partner')) push('fair-contact','warning','fair',f.id,`${f.short} has no fair-partner contact`,'Connect a fair-side entertainment or production contact.',f.id);
    });
    s.talent.filter(t=>!fairId||t.fairId===fairId).forEach(t=>{
      const missing=Intel.talentMissing(t);
      if(['Contracted','Ready'].includes(t.status)){
        if(t.agreementStatus!=='Received') push('talent-agreement','critical','talent',t.id,`${t.name} is contracted without a received agreement`,'Move the agreement into Received before production lock.',t.fairId);
        if(t.musicStatus!=='Received') push('talent-music','critical','talent',t.id,`${t.name} is missing final music`,'Final playback material is required for a production-ready record.',t.fairId);
        if(t.bioStatus!=='Received'||t.photoStatus!=='Received') push('talent-public-assets','warning','talent',t.id,`${t.name} is missing public-facing material`,missing.filter(x=>['bio','photo'].includes(x)).join(', ')||'Review bio and photo status.',t.fairId);
        if(!t.arrivalTime) push('talent-arrival','warning','talent',t.id,`${t.name} has no arrival time`,'Set a day-of arrival time.',t.fairId);
      }
      if(!t.contactId) push('talent-contact','warning','talent',t.id,`${t.name} has no linked contact`,'Connect the performer to a contact record.',t.fairId);
      if(t.arrivalTime&&t.performanceTime){
        const arrival=Intel.timeToMinutes(t.arrivalTime);const performance=Intel.timeToMinutes(t.performanceTime.split('/')[0].trim());
        if(Number.isFinite(arrival)&&Number.isFinite(performance)&&performance-arrival<30) push('arrival-window','warning','talent',t.id,`${t.name} has a tight arrival window`,`${performance-arrival} minutes between arrival and first performance.`,t.fairId);
      }
    });
    s.tasks.filter(t=>!fairId||t.fairId===fairId).forEach(t=>{
      if(t.status!=='complete'&&Intel.daysUntil(t.due)<0) push('task-overdue','critical','task',t.id,`${t.title} is overdue`,`${Math.abs(Intel.daysUntil(t.due))} day(s) past due.`,t.fairId);
      if(t.status==='waiting'&&!t.blockedBy) push('waiting-owner','warning','task',t.id,`${t.title} is waiting without a blocker`,'Name what or who Production is waiting on.',t.fairId);
    });
    s.contacts.filter(c=>!fairId||c.fairIds?.includes(fairId)).forEach(c=>{
      if(c.nextFollowUp&&Intel.daysUntil(c.nextFollowUp)<0&&c.status!=='Active') push('followup-overdue','warning','contact',c.id,`${c.name} follow-up is overdue`,`${Math.abs(Intel.daysUntil(c.nextFollowUp))} day(s) overdue.`,c.fairIds?.[0]||'');
    });
    s.issues.filter(i=>(!fairId||i.fairId===fairId)&&i.status!=='Resolved').forEach(i=>{
      if(i.severity==='High') push('open-high-issue','critical','issue',i.id,i.title,'High-severity issue remains unresolved.',i.fairId);
    });
    return violations.sort((a,b)=>({critical:0,warning:1,info:2}[a.severity]-({critical:0,warning:1,info:2}[b.severity])));
  }

  function complianceScore(fairId=''){
    const count=evaluateRules(fairId).reduce((sum,v)=>sum+(v.severity==='critical'?2:1),0);
    return Math.max(0,Math.min(100,Math.round(100-count*5)));
  }
  function violationCount(){return evaluateRules().length;}

  function lenses(){
    const s=Store.state;
    return {
      exceptions:{label:'Exceptions',icon:'!',items:Intel.productionActions().filter(x=>['critical','warning'].includes(x.severity))},
      materials:{label:'Missing materials',icon:'◉',items:s.talent.flatMap(t=>Intel.talentMissing(t).map(m=>({kind:'talent',id:t.id,fairId:t.fairId,title:`${t.name}: ${m}`,detail:`${m} is not received`,severity:['music','agreement'].includes(m)?'critical':'warning'})))},
      overdue:{label:'Overdue',icon:'◷',items:s.tasks.filter(t=>t.status!=='complete'&&Intel.daysUntil(t.due)<0).map(t=>({kind:'task',id:t.id,fairId:t.fairId,title:t.title,detail:`${Math.abs(Intel.daysUntil(t.due))} day(s) overdue`,severity:'critical'}))},
      waiting:{label:'Waiting',icon:'↗',items:s.tasks.filter(t=>t.status==='waiting').map(t=>({kind:'task',id:t.id,fairId:t.fairId,title:t.title,detail:t.blockedBy||'No blocker named',severity:'warning'}))},
      schedule:{label:'Schedule risks',icon:'≡',items:s.fairs.flatMap(f=>Intel.scheduleIssues(f.id).filter(i=>i.severity!=='info').map(i=>({kind:'schedule',id:i.slotId,fairId:f.id,title:i.title,detail:i.body,severity:i.severity})))},
      issues:{label:'Open issues',icon:'⚡',items:s.issues.filter(i=>i.status!=='Resolved').map(i=>({kind:'issue',id:i.id,fairId:i.fairId,title:i.title,detail:`${i.status} · ${i.severity}`,severity:i.severity==='High'?'critical':'warning'}))}
    };
  }

  function activitySinceCheckpoint(){
    const stamp=Store.state.preferences.lastCheckpoint;
    if(!stamp)return Store.state.activity.slice(0,10);
    return Store.state.activity.filter(a=>new Date(a.timestamp)>new Date(stamp));
  }
  function storageBytes(){
    try{return new Blob(Object.values(localStorage)).size;}catch{return 0;}
  }
  function formatBytes(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1048576).toFixed(1)} MB`;}

  function forecast(){
    const map={};
    for(let i=0;i<14;i++){const date=addDays(i);map[date]={date,tasks:[],deadlines:[]};}
    Store.state.tasks.filter(t=>t.status!=='complete'&&map[t.due]).forEach(t=>map[t.due].tasks.push(t));
    Store.state.deadlines.filter(d=>map[d.date]).forEach(d=>map[d.date].deadlines.push(d));
    return Object.values(map);
  }

  function snapshots(){try{return JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'[]');}catch{return [];}}
  function createSnapshot(label='Production checkpoint'){
    const list=snapshots();
    list.unshift({id:`snapshot-${Date.now()}`,label,createdAt:Store.nowISO(),data:JSON.parse(Store.exportData())});
    localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(list.slice(0,6)));
    Store.state.preferences.lastCheckpoint=Store.nowISO();
    Store.save({immediate:true});
    Store.log('Production',`created system checkpoint “${label}”.`,'','','');
    UI.toast('Checkpoint created','A local restore point is ready.');
    renderAll();
  }
  function restoreSnapshot(id){
    const snap=snapshots().find(x=>x.id===id);if(!snap)return;
    if(!confirm(`Restore “${snap.label}”? Current local changes will be replaced.`))return;
    Store.importData(snap.data);UI.toast('Checkpoint restored',snap.label);renderAll();
  }

  function recordButton(item){
    const pair=`${item.kind}:${item.id}`;
    return `<button class="control-record ${item.severity||''}" data-open-record="${esc(pair)}"><span>${UI.icon(item.kind)}</span><span><b>${esc(item.title)}</b><small>${esc(fair(item.fairId)?.short||'Production')} · ${esc(item.detail||'Needs review')}</small></span><em>Open</em></button>`;
  }

  function renderControl(){
    const root=$('#controlContent');if(!root)return;
    const rules=evaluateRules();const critical=rules.filter(x=>x.severity==='critical').length;const score=complianceScore();
    const lensMap=lenses();const selected=Store.state.preferences.selectedLens in lensMap?Store.state.preferences.selectedLens:'exceptions';const active=lensMap[selected];
    const changes=activitySinceCheckpoint();const fc=forecast();const max=Math.max(1,...fc.map(d=>d.tasks.length+d.deadlines.length));const snaps=snapshots();
    root.innerHTML=`
      <section class="os-hero"><div><span class="eyebrow">Production operating system</span><h1>Control Center.</h1><p>The system continuously checks readiness, schedule integrity, missing materials, overdue work, and data safety—without sending anything outside this browser.</p></div><div class="os-health-ring" style="--score:${score}"><strong>${score}%</strong><span>compliance</span></div></section>
      <div class="os-status-strip"><article><span>Critical rules</span><b>${critical}</b><small>${critical?'Requires production attention':'No red-alert violations'}</small></article><article><span>Changes since checkpoint</span><b>${changes.length}</b><small>${Store.state.preferences.lastCheckpoint?Intel.formatTimeAgo(Store.state.preferences.lastCheckpoint):'No checkpoint yet'}</small></article><article><span>Local data footprint</span><b>${formatBytes(storageBytes())}</b><small>Stored only in this browser</small></article><article><span>Offline shell</span><b>${'serviceWorker' in navigator?'Ready':'Browser only'}</b><small>Static local-first application</small></article></div>
      <div class="control-layout"><section class="panel control-focus"><div class="panel-head"><div><span class="eyebrow">Saved operational lenses</span><h3>Focus mode</h3><p>One click reduces the entire system to a production question.</p></div></div><div class="lens-tabs">${Object.entries(lensMap).map(([key,l])=>`<button class="${selected===key?'active':''}" data-os-lens="${key}"><span>${l.icon}</span><b>${esc(l.label)}</b><em>${l.items.length}</em></button>`).join('')}</div><div class="control-records">${active.items.length?active.items.slice(0,14).map(recordButton).join(''):`<div class="empty-state"><div><b>${esc(active.label)} is clear</b><p>No matching production records need attention.</p></div></div>`}</div></section>
      <aside class="control-side"><section class="panel"><div class="panel-head"><div><span class="eyebrow">Rule engine</span><h3>Production compliance</h3></div><button class="text-button" data-os-report="readiness">Create report →</button></div><div class="rule-summary"><div class="meter"><i style="width:${score}%"></i></div><span>${rules.length} active violation${rules.length===1?'':'s'}</span></div><div class="rule-list">${rules.slice(0,7).map(v=>`<div class="rule-row ${v.severity}"><i></i><button data-open-record="${v.type}:${v.id}"><b>${esc(v.title)}</b><small>${esc(v.detail)}</small></button><button title="Create task" data-rule-task="${esc(v.ruleId)}|${esc(v.type)}|${esc(v.id)}">＋</button></div>`).join('')||'<div class="mini-empty">All production rules currently pass.</div>'}</div></section>
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">Data safety</span><h3>Local checkpoints</h3></div><button class="text-button" data-create-snapshot>New checkpoint</button></div><div class="snapshot-list">${snaps.length?snaps.map(s=>`<button data-restore-snapshot="${s.id}"><span>↻</span><span><b>${esc(s.label)}</b><small>${Intel.formatTimeAgo(s.createdAt)}</small></span></button>`).join(''):'<div class="mini-empty">Create a checkpoint before major production changes.</div>'}</div></section></aside></div>
      <div class="control-bottom"><section class="panel"><div class="panel-head"><div><span class="eyebrow">14-day pressure map</span><h3>Production load forecast</h3></div></div><div class="forecast-chart">${fc.map(d=>{const total=d.tasks.length+d.deadlines.length;return `<button title="${total} item(s)" data-os-date="${d.date}"><i style="height:${Math.max(7,total/max*100)}%"></i><span>${new Date(d.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})}</span><small>${new Date(d.date+'T12:00:00').getDate()}</small><em>${total||''}</em></button>`}).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">Session delta</span><h3>Since the last checkpoint</h3></div><button class="text-button" data-create-snapshot>Mark caught up</button></div><div class="delta-list">${changes.length?changes.slice(0,8).map(a=>`<div><i></i><span><b>${esc(a.actor)}</b><small>${esc(a.action)}</small></span><time>${Intel.formatTimeAgo(a.timestamp)}</time></div>`).join(''):'<div class="mini-empty">No changes since the last checkpoint.</div>'}</div></section></div>`;
  }

  function fairOptions(selected){return Store.state.fairs.map(f=>`<option value="${f.id}" ${f.id===selected?'selected':''}>${esc(f.name)}</option>`).join('');}
  function reportCatalog(){return [
    ['production-brief','Production Brief','Executive-style production status without financials.'],
    ['readiness','Fair Readiness Report','Rules, talent, schedule, tasks, contacts, and exceptions.'],
    ['call-sheet','Day-of Call Sheet','Stage schedule, arrivals, contacts, and production notes.'],
    ['followup','Follow-Up Digest','Everyone Production is waiting on or needs to contact.'],
    ['issues','Issue & Risk Report','Open issues, overdue work, and schedule warnings.'],
    ['public-schedule','Public Schedule','Clean audience-facing stage schedule.']
  ];}

  function reportData(type,fairId){
    const f=fair(fairId)||Store.state.fairs[0];const talent=Store.state.talent.filter(t=>t.fairId===f.id);const tasks=Store.state.tasks.filter(t=>t.fairId===f.id);const contacts=Store.state.contacts.filter(c=>c.fairIds?.includes(f.id));const slots=Intel.scheduleForFair(f.id);const rules=evaluateRules(f.id);const issues=Store.state.issues.filter(i=>i.fairId===f.id&&i.status!=='Resolved');
    const head=`<div class="report-brand"><b>OUT AT THE FAIR®</b><span>OATF OS · PRODUCTION</span></div><h1>${esc(f.name)}</h1><p>${esc(f.venue)} · ${esc(Intel.formatDate(f.date))} · ${esc(f.stage)}</p>`;
    const section=(title,body)=>`<section><h2>${esc(title)}</h2>${body}</section>`;
    const rows=(items)=>items.length?`<div class="report-rows">${items.join('')}</div>`:'<p class="report-empty">No records.</p>';
    let title='Production Brief', body='';
    if(type==='production-brief'){
      title=`${f.short} Production Brief`;
      body=head+`<div class="report-score"><strong>${Intel.fairReadiness(f)}%</strong><span>production readiness</span><b>${complianceScore(f.id)}% rules compliance</b></div>`+
      section('Immediate priorities',rows(Intel.productionActions().filter(x=>x.fairId===f.id).slice(0,8).map(x=>`<div><b>${esc(x.title)}</b><span>${esc(x.detail)}</span></div>`)))+
      section('Talent readiness',rows(talent.map(t=>`<div><b>${esc(t.name)}</b><span>${Intel.talentReadiness(t)}% ready · ${esc(Intel.talentMissing(t).join(', ')||'complete')}</span></div>`)))+
      section('Run of show',rows(slots.map(s=>`<div><b>${esc(Intel.formatClock(s.startTime))} · ${esc(s.publicTitle||s.title)}</b><span>${esc(s.kind)} · ${esc(s.status)}</span></div>`)));
    }else if(type==='readiness'){
      title=`${f.short} Readiness Report`;body=head+`<div class="report-score"><strong>${Intel.fairReadiness(f)}%</strong><span>readiness</span><b>${rules.length} rule violation${rules.length===1?'':'s'}</b></div>`+
      section('Rule violations',rows(rules.map(v=>`<div><b>${esc(v.title)}</b><span>${esc(v.detail)}</span></div>`)))+
      section('Open work',rows(tasks.filter(t=>t.status!=='complete').map(t=>`<div><b>${esc(t.title)}</b><span>${esc(t.owner)} · ${esc(Intel.relativeDate(t.due))} · ${esc(t.status)}</span></div>`)))+
      section('Connected contacts',rows(contacts.map(c=>`<div><b>${esc(c.name)}</b><span>${esc(c.role)} · ${esc(c.organization)}</span></div>`)));
    }else if(type==='call-sheet'){
      title=`${f.short} Day-of Call Sheet`;body=head+
      section('Stage schedule',rows(slots.map(s=>`<div><b>${esc(Intel.formatClock(s.startTime))}–${esc(Intel.formatClock(s.endTime))} · ${esc(s.title)}</b><span>${esc(s.internalNotes||s.kind)}</span></div>`)))+
      section('Talent arrivals',rows(talent.sort((a,b)=>Intel.timeToMinutes(a.arrivalTime)-Intel.timeToMinutes(b.arrivalTime)).map(t=>`<div><b>${esc(t.arrivalTime||'TBD')} · ${esc(t.name)}</b><span>${esc(t.performanceTime||'No performance time')} · ${esc(t.stageNeeds||'No stage needs')}</span></div>`)))+
      section('Production contacts',rows(contacts.map(c=>`<div><b>${esc(c.name)} · ${esc(c.role)}</b><span>${esc(c.email||'No email')} ${c.phone?`· ${esc(c.phone)}`:''}</span></div>`)));
    }else if(type==='followup'){
      title=`${f.short} Follow-Up Digest`;const follow=Intel.followUps().filter(x=>x.fairId===f.id);body=head+section('Follow-up queue',rows(follow.map(x=>`<div><b>${esc(x.name)}</b><span>${esc(x.reason)} · ${esc(x.date?Intel.relativeDate(x.date):'Now')}</span></div>`)));
    }else if(type==='issues'){
      title=`${f.short} Issue & Risk Report`;body=head+section('Open issues',rows(issues.map(i=>`<div><b>${esc(i.title)}</b><span>${esc(i.severity)} · ${esc(i.status)} · ${esc(i.owner)}</span></div>`)))+section('Schedule warnings',rows(Intel.scheduleIssues(f.id).map(i=>`<div><b>${esc(i.title)}</b><span>${esc(i.body)}</span></div>`)))+section('Overdue work',rows(tasks.filter(t=>t.status!=='complete'&&Intel.daysUntil(t.due)<0).map(t=>`<div><b>${esc(t.title)}</b><span>${Math.abs(Intel.daysUntil(t.due))} day(s) overdue</span></div>`)));
    }else{
      title=`${f.short} Public Schedule`;body=head+section('Entertainment schedule',rows(slots.filter(s=>s.publicVisible).map(s=>`<div><b>${esc(Intel.formatClock(s.startTime))}</b><span>${esc(s.publicTitle||s.title)}</span></div>`)));
    }
    return {title,html:`<article class="generated-report">${body}<footer>Generated by OATF OS Production · ${new Date().toLocaleString()}</footer></article>`};
  }
  function reportText(type,fairId){
    const wrapper=document.createElement('div');wrapper.innerHTML=reportData(type,fairId).html;
    return wrapper.innerText.replace(/\n{3,}/g,'\n\n').trim();
  }

  function renderBriefing(){
    const root=$('#briefingContent');if(!root)return;
    const selectedFair=Store.state.preferences.reportFairId||Store.state.fairs[0]?.id;const type=Store.state.preferences.reportType||'production-brief';const report=reportData(type,selectedFair);
    root.innerHTML=`<section class="briefing-hero"><div><span class="eyebrow">Production document system</span><h1>Briefing Center.</h1><p>Turn connected production data into clean reports, call sheets, public schedules, and handoff documents—without retyping the work.</p></div><div class="briefing-actions"><button class="button ghost" data-report-copy>Copy</button><button class="button ghost" data-report-download>Download HTML</button><button class="button primary" data-report-print>Print / PDF</button></div></section><div class="briefing-layout"><aside class="report-builder panel"><label><span>Fair workspace</span><select id="reportFairSelect">${fairOptions(selectedFair)}</select></label><div class="report-types">${reportCatalog().map(([key,label,desc])=>`<button class="${key===type?'active':''}" data-report-type="${key}"><span>${UI.icon(key==='call-sheet'?'schedule':key==='followup'?'contact':key==='issues'?'issue':'file')}</span><span><b>${esc(label)}</b><small>${esc(desc)}</small></span><i>›</i></button>`).join('')}</div><div class="report-system-note"><span>System-generated</span><b>Always based on the current local records.</b><small>Update a task, performer, contact, or schedule block and regenerate instantly.</small></div></aside><section class="report-preview panel"><div class="report-preview-head"><div><span class="eyebrow">Live preview</span><h3>${esc(report.title)}</h3></div><small>Generated ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</small></div>${report.html}</section></div>`;
  }

  function printReport(){
    const type=Store.state.preferences.reportType;const fairId=Store.state.preferences.reportFairId;const report=reportData(type,fairId);const win=window.open('','_blank');if(!win)return UI.toast('Pop-up blocked','Allow pop-ups to print this report.');
    win.document.write(`<!doctype html><html><head><title>${esc(report.title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:36px;color:#18151c}article{max-width:850px;margin:auto}.report-brand{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px}.report-brand span{font-size:11px;letter-spacing:.12em}h1{font-size:34px;margin:28px 0 4px}p{color:#5f5964}section{margin-top:28px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #ddd;padding-bottom:8px}.report-rows>div{display:grid;grid-template-columns:minmax(220px,.8fr) 1.2fr;gap:18px;padding:10px 0;border-bottom:1px solid #eee}.report-rows span{color:#5f5964}.report-score{display:flex;align-items:baseline;gap:14px;margin:24px 0;padding:18px;background:#f3eff6;border-radius:14px}.report-score strong{font-size:42px}.report-score span{margin-right:auto}footer{margin-top:34px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#777}@media print{body{padding:0}}</style></head><body>${report.html}</body></html>`);win.document.close();setTimeout(()=>win.print(),250);
  }

  function createTaskFromRule(payload){
    const [ruleId,type,id]=payload.split('|');const v=evaluateRules().find(x=>x.ruleId===ruleId&&x.type===type&&x.id===id);if(!v)return;
    const task=Store.upsert('task',{title:`Resolve: ${v.title}`,fairId:v.fairId||'',talentId:type==='talent'?id:'',contactId:type==='contact'?id:'',owner:'Production',status:'todo',priority:v.severity==='critical'?'High':'Medium',impact:v.severity==='critical'?'High':'Medium',due:addDays(v.severity==='critical'?1:3),blockedBy:'',estimatedHours:1,description:v.detail});
    Store.log('Production',`created a task from the ${v.ruleId} production rule.`,'task',task.id,task.fairId);UI.toast('Task created',task.title);
  }

  function commandResults(query){
    const q=query.trim().toLowerCase();if(!q)return [];
    const cmds=[
      {match:/^(show )?(exceptions|critical|risks?)$/,label:'Show production exceptions',detail:'Open the Control Center exception lens',action:'lens:exceptions'},
      {match:/(missing music|missing materials|materials missing)/,label:'Show missing performer materials',detail:'Open the missing-materials lens',action:'lens:materials'},
      {match:/(overdue|late tasks)/,label:'Show overdue production work',detail:'Open the overdue lens',action:'lens:overdue'},
      {match:/(waiting|blocked)/,label:'Show waiting production work',detail:'Open the waiting lens',action:'lens:waiting'},
      {match:/(schedule risk|schedule conflict|run of show risk)/,label:'Show schedule risks',detail:'Open schedule intelligence',action:'lens:schedule'},
      {match:/(production brief|briefing|create report)/,label:'Create a production brief',detail:'Open the Briefing Center',action:'report:production-brief'},
      {match:/(call sheet)/,label:'Create a day-of call sheet',detail:'Open a generated call sheet',action:'report:call-sheet'},
      {match:/(checkpoint|snapshot|restore point)/,label:'Create a local checkpoint',detail:'Save a restorable copy in this browser',action:'snapshot'},
      {match:/(system health|control center|compliance)/,label:'Open Production Control Center',detail:'Rules, data safety, saved lenses, and forecast',action:'view:control'}
    ];
    return cmds.filter(c=>c.match.test(q));
  }
  function appendCommands(){
    const input=$('#globalSearch'),results=$('#searchResults');if(!input||!results)return;
    const cmds=commandResults(input.value);results.querySelector('.os-command-group')?.remove();if(!cmds.length)return;
    const group=document.createElement('section');group.className='os-command-group';group.innerHTML=`<span class="eyebrow">Production commands</span>${cmds.map(c=>`<button data-os-command="${c.action}"><span>⌘</span><span><b>${esc(c.label)}</b><small>${esc(c.detail)}</small></span><em>Run ↵</em></button>`).join('')}`;results.prepend(group);
  }
  function runCommand(action){
    $('#searchOverlay')?.classList.remove('open');
    if(action.startsWith('lens:')){Store.setPreference('selectedLens',action.split(':')[1]);document.querySelector('[data-view="control"]')?.click();renderControl();return;}
    if(action.startsWith('report:')){Store.setPreference('reportType',action.split(':')[1]);document.querySelector('[data-view="briefing"]')?.click();renderBriefing();return;}
    if(action==='snapshot'){createSnapshot();return;}
    if(action==='view:control'){document.querySelector('[data-view="control"]')?.click();renderControl();}
  }

  function renderAll(){renderControl();renderBriefing();const badge=$('#controlBadge');if(badge)badge.textContent=violationCount()||'';}

  document.addEventListener('input',e=>{if(e.target?.id==='globalSearch')queueMicrotask(appendCommands);});
  document.addEventListener('click',e=>{
    const lens=e.target.closest('[data-os-lens]')?.dataset.osLens;if(lens){Store.setPreference('selectedLens',lens);renderControl();return;}
    if(e.target.closest('[data-create-snapshot]')){createSnapshot();return;}
    const restore=e.target.closest('[data-restore-snapshot]')?.dataset.restoreSnapshot;if(restore){restoreSnapshot(restore);return;}
    const rule=e.target.closest('[data-rule-task]')?.dataset.ruleTask;if(rule){createTaskFromRule(rule);return;}
    const reportType=e.target.closest('[data-report-type]')?.dataset.reportType;if(reportType){Store.setPreference('reportType',reportType);renderBriefing();return;}
    if(e.target.closest('[data-report-copy]')){navigator.clipboard.writeText(reportText(Store.state.preferences.reportType,Store.state.preferences.reportFairId)).then(()=>UI.toast('Report copied','Ready to paste into an email or document.'));return;}
    if(e.target.closest('[data-report-download]')){const report=reportData(Store.state.preferences.reportType,Store.state.preferences.reportFairId);UI.download(`${report.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.html`,`<!doctype html><meta charset="utf-8"><title>${esc(report.title)}</title>${report.html}`,'text/html');UI.toast('Report downloaded',report.title);return;}
    if(e.target.closest('[data-report-print]')){printReport();return;}
    const reportShortcut=e.target.closest('[data-os-report]')?.dataset.osReport;if(reportShortcut){Store.setPreference('reportType',reportShortcut);document.querySelector('[data-view="briefing"]')?.click();renderBriefing();return;}
    const command=e.target.closest('[data-os-command]')?.dataset.osCommand;if(command){runCommand(command);return;}
    if(e.target.closest('[data-os-quick="briefing"]')){document.querySelector('[data-view="briefing"]')?.click();renderBriefing();return;}
    const date=e.target.closest('[data-os-date]')?.dataset.osDate;if(date){Store.setPreference('selectedLens','exceptions');document.querySelector('[data-view="calendar"]')?.click();return;}
    if(e.target.closest('[data-action="export"]')){Store.state.preferences.lastBackup=Store.nowISO();Store.save({immediate:true});}
  });
  document.addEventListener('change',e=>{if(e.target?.id==='reportFairSelect'){Store.setPreference('reportFairId',e.target.value);renderBriefing();}});
  window.addEventListener('oatf:saved',renderAll);
  window.OATFSystem={renderAll,evaluateRules,complianceScore,violationCount,reportData,createSnapshot};
  renderAll();
})();
