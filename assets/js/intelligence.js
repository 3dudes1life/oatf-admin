(() => {
  'use strict';
  const Store = window.OATFStore;

  function dateOnly(value){
    if (!value) return null;
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function daysUntil(value){
    const d = typeof value === 'string' ? dateOnly(value) : value;
    if (!d) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const target = new Date(d.getFullYear(),d.getMonth(),d.getDate());
    return Math.round((target-today)/86400000);
  }
  function relativeDate(value){
    if (!value) return 'No date';
    const diff = daysUntil(value);
    if (diff === null) return value;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < 0) return `${Math.abs(diff)} days overdue`;
    if (diff <= 14) return `In ${diff} days`;
    return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:new Date(value).getFullYear() !== new Date().getFullYear() ? 'numeric':undefined}).format(dateOnly(value));
  }
  function formatDate(value,options={month:'short',day:'numeric',year:'numeric'}){
    const d = value?.includes?.('T') ? new Date(value) : dateOnly(value);
    if (!d || Number.isNaN(d.getTime())) return 'Not set';
    return new Intl.DateTimeFormat('en-US',options).format(d);
  }
  function formatTimeAgo(value){
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value || '';
    const seconds = Math.round((Date.now()-d.getTime())/1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds/60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds/3600)} hr ago`;
    if (seconds < 172800) return 'Yesterday';
    if (seconds < 604800) return `${Math.floor(seconds/86400)} days ago`;
    return formatDate(value,{month:'short',day:'numeric'});
  }
  function greeting(){
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  function talentMissing(item){
    const missing = [];
    if (!['Received','Complete','Approved'].includes(item.agreementStatus)) missing.push('Agreement');
    if (item.musicStatus !== 'Received') missing.push('Music');
    if (item.bioStatus !== 'Received') missing.push('Bio');
    if (item.photoStatus !== 'Received') missing.push('Photo');
    if (!['Received','Confirmed','Not needed'].includes(item.parkingStatus)) missing.push('Parking');
    if (!item.arrivalTime) missing.push('Arrival');
    if (!item.performanceTime) missing.push('Stage time');
    return missing;
  }
  function talentReadiness(item){
    const checks = [
      ['Received','Complete','Approved'].includes(item.agreementStatus),
      item.musicStatus === 'Received',
      item.bioStatus === 'Received',
      item.photoStatus === 'Received',
      ['Received','Confirmed','Not needed'].includes(item.parkingStatus),
      Boolean(item.arrivalTime),
      Boolean(item.performanceTime),
      ['Contracted','Ready'].includes(item.status)
    ];
    return Math.round(checks.filter(Boolean).length/checks.length*100);
  }

  function timeToMinutes(value){
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]), minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours*60+minutes;
  }
  function minutesToTime(value){
    const minutes = Math.max(0,Number(value || 0));
    return `${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  }
  function formatClock(value){
    const mins=timeToMinutes(value); if(mins===null)return value || 'TBD';
    const d=new Date(2020,0,1,Math.floor(mins/60),mins%60);
    return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(d);
  }
  function scheduleForFair(fairId){
    return Store.state.schedules.filter(slot=>slot.fairId===fairId).sort((a,b)=>(Number(a.order||0)-Number(b.order||0)) || ((timeToMinutes(a.startTime)??9999)-(timeToMinutes(b.startTime)??9999)));
  }
  function scheduleIssues(fairId){
    const slots=scheduleForFair(fairId); const issues=[];
    slots.forEach((slot,index)=>{
      const start=timeToMinutes(slot.startTime), end=timeToMinutes(slot.endTime);
      const talent=slot.talentId ? Store.get('talent',slot.talentId) : null;
      if(start===null||end===null||end<=start) issues.push({id:`slot-time:${slot.id}`,slotId:slot.id,severity:'critical',title:`${slot.title}: invalid time block`,body:'Start and end times must create a valid stage block.'});
      if(slot.publicVisible && !String(slot.publicTitle||'').trim()) issues.push({id:`slot-public:${slot.id}`,slotId:slot.id,severity:'warning',title:`${slot.title}: public title missing`,body:'Public schedule cannot be generated cleanly.'});
      if(talent){
        const readiness=talentReadiness(talent);
        if(readiness<55) issues.push({id:`slot-ready:${slot.id}`,slotId:slot.id,severity:'critical',title:`${slot.title}: talent is only ${readiness}% ready`,body:`Missing ${talentMissing(talent).join(', ') || 'production details'}.`});
        else if(readiness<80) issues.push({id:`slot-ready:${slot.id}`,slotId:slot.id,severity:'warning',title:`${slot.title}: talent readiness needs review`,body:`${readiness}% production-ready.`});
        if(['Performance','Glam Show','Story Time'].includes(slot.kind) && talent.musicStatus!=='Received' && slot.kind!=='Story Time') issues.push({id:`slot-music:${slot.id}`,slotId:slot.id,severity:'warning',title:`${slot.title}: music is not received`,body:'Playback-dependent stage block is not locked.'});
        const arrival=timeToMinutes(convertLooseTime(talent.arrivalTime));
        if(arrival!==null&&start!==null&&arrival>start-20) issues.push({id:`slot-arrival:${slot.id}`,slotId:slot.id,severity:'warning',title:`${slot.title}: arrival window is too tight`,body:`Arrival is ${formatClock(convertLooseTime(talent.arrivalTime))} for a ${formatClock(slot.startTime)} stage time.`});
      }
      if(index>0){
        const prev=slots[index-1]; const prevEnd=timeToMinutes(prev.endTime); const required=Number(prev.bufferAfter||0);
        if(start!==null&&prevEnd!==null){
          const gap=start-prevEnd;
          if(gap<0) issues.push({id:`slot-overlap:${prev.id}:${slot.id}`,slotId:slot.id,severity:'critical',title:`${prev.title} overlaps ${slot.title}`,body:`The blocks overlap by ${Math.abs(gap)} minutes.`});
          else if(gap<required) issues.push({id:`slot-buffer:${prev.id}:${slot.id}`,slotId:slot.id,severity:'warning',title:`Transition after ${prev.title} is too short`,body:`Needs ${required} minutes; only ${gap} scheduled.`});
          else if(gap>60) issues.push({id:`slot-gap:${prev.id}:${slot.id}`,slotId:slot.id,severity:'info',title:`${gap}-minute public schedule gap`,body:`Review whether this gap is intentional or needs programming.`});
        }
      }
    });
    return issues;
  }
  function convertLooseTime(value){
    const text=String(value||'').trim();
    const direct=text.match(/^(\d{1,2}):(\d{2})$/); if(direct)return `${String(Number(direct[1])).padStart(2,'0')}:${direct[2]}`;
    const match=text.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i); if(!match)return '';
    let hour=Number(match[1]); const minute=Number(match[2]||0); const period=match[3].toUpperCase();
    if(period==='PM'&&hour!==12)hour+=12; if(period==='AM'&&hour===12)hour=0;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
  function scheduleReadiness(fairId){
    const slots=scheduleForFair(fairId); if(!slots.length)return 0;
    const issues=scheduleIssues(fairId);
    const penalty=issues.reduce((sum,item)=>sum+({critical:24,warning:10,info:3}[item.severity]||5),0);
    const locked=slots.filter(slot=>['Locked','Ready'].includes(slot.status)).length/slots.length*20;
    return Math.max(0,Math.min(100,Math.round(80+locked-penalty)));
  }
  function productionActions(){
    const actions=[];
    Store.state.tasks.filter(t=>t.status!=='complete').forEach(task=>actions.push({kind:'task',id:task.id,fairId:task.fairId,title:task.title,detail:task.blockedBy||task.description||'Production task',severity:taskRisk(task)>=80?'critical':taskRisk(task)>=55?'warning':'normal',score:taskRisk(task),due:daysUntil(task.due)}));
    followUps().forEach(item=>actions.push({kind:item.kind,id:item.id,fairId:item.fairId,title:`Follow up with ${item.name}`,detail:item.reason,severity:item.due!==null&&item.due<0?'critical':'warning',score:item.due!==null&&item.due<0?85:55,due:item.due}));
    Store.state.fairs.forEach(fair=>scheduleIssues(fair.id).forEach(issue=>actions.push({kind:'schedule',id:issue.slotId,fairId:fair.id,title:issue.title,detail:issue.body,severity:issue.severity,score:issue.severity==='critical'?92:issue.severity==='warning'?65:35,due:null})));
    return actions.sort((a,b)=>b.score-a.score || (a.due??9999)-(b.due??9999));
  }

  function taskRisk(task){
    if (task.status === 'complete') return 0;
    let score = 0;
    const due = daysUntil(task.due);
    if (task.priority === 'High') score += 25;
    else if (task.priority === 'Medium') score += 12;
    if (task.impact === 'High') score += 22;
    else if (task.impact === 'Medium') score += 10;
    if (task.status === 'waiting') score += 25;
    if (task.blockedBy) score += 13;
    if (due !== null && due < 0) score += 45;
    else if (due !== null && due <= 1) score += 30;
    else if (due !== null && due <= 7) score += 15;
    return Math.min(100,score);
  }
  function fairReadiness(fair){
    const s = Store.state;
    const tasks = s.tasks.filter(t => t.fairId === fair.id);
    const talent = s.talent.filter(t => t.fairId === fair.id);
    const contacts = s.contacts.filter(c => c.fairIds?.includes(fair.id));
    const files = s.files.filter(f => f.fairId === fair.id);

    const taskScore = tasks.length ? tasks.reduce((sum,t) => sum + ({complete:100,inprogress:62,waiting:30,todo:18}[t.status] || 15),0)/tasks.length : 25;
    const talentScore = talent.length ? talent.reduce((sum,t) => sum+talentReadiness(t),0)/talent.length : 20;
    const contactScore = Math.min(100,contacts.length*24);
    const fileScore = Math.min(100,files.length*25);
    const overduePenalty = tasks.filter(t => t.status !== 'complete' && daysUntil(t.due) < 0).length*8;
    const scheduleScore = scheduleReadiness(fair.id);
    return Math.max(0,Math.min(100,Math.round(taskScore*.38+talentScore*.30+scheduleScore*.18+contactScore*.07+fileScore*.07-overduePenalty)));
  }
  function seasonReadiness(){
    const fairs = Store.state.fairs;
    return fairs.length ? Math.round(fairs.reduce((sum,f) => sum+fairReadiness(f),0)/fairs.length) : 0;
  }
  function nextFair(){
    const today = new Date();
    return Store.state.fairs
      .map(f => ({...f,days:daysUntil(f.date)}))
      .filter(f => f.days === null || f.days >= 0)
      .sort((a,b) => (a.days ?? 9999)-(b.days ?? 9999))[0] || Store.state.fairs[0] || null;
  }
  function dueTasks(user=Store.state.currentUser){
    return Store.state.tasks
      .filter(t => (user === 'Production' || t.owner === user) && t.status !== 'complete')
      .map(t => ({...t,risk:taskRisk(t),days:daysUntil(t.due)}))
      .sort((a,b) => b.risk-a.risk || (a.days ?? 9999)-(b.days ?? 9999));
  }
  function completedThisWeek(user=Store.state.currentUser){
    const weekAgo = Date.now()-7*86400000;
    return Store.state.tasks.filter(t => (user === 'Production' || t.owner === user) && t.status === 'complete' && new Date(t.completedAt || t.updatedAt).getTime() >= weekAgo);
  }
  function followUps(){
    const s = Store.state;
    const contacts = s.contacts.map(contact => ({
      kind:'contact',id:contact.id,name:contact.name,subtitle:`${contact.role} · ${contact.organization}`,fairId:contact.fairIds?.[0] || '',date:contact.nextFollowUp,lastContact:contact.lastContact,status:contact.status,reason:contact.status === 'Waiting' ? 'Waiting on response' : contact.status === 'Needs follow-up' ? 'Follow-up requested' : 'Scheduled follow-up'
    })).filter(x => x.date || ['Waiting','Needs follow-up'].includes(x.status));
    const talent = s.talent.map(item => {
      const missing = talentMissing(item);
      const contact = s.contacts.find(c => c.id === item.contactId);
      const stale = contact?.lastContact ? Math.max(0,-daysUntil(contact.lastContact)) : 999;
      return {kind:'talent',id:item.id,name:item.name,subtitle:`${item.type} · ${missing.length} missing item${missing.length===1?'':'s'}`,fairId:item.fairId,date:contact?.nextFollowUp || '',lastContact:contact?.lastContact || '',status:item.status,reason:missing.length ? `Missing ${missing.join(', ')}` : stale > 7 ? `${stale} days since contact` : ''};
    }).filter(x => x.reason);
    return [...contacts,...talent].map(x => ({...x,due:daysUntil(x.date)})).sort((a,b) => {
      const av = a.due ?? (a.status === 'Needs follow-up' ? -1 : 99);
      const bv = b.due ?? (b.status === 'Needs follow-up' ? -1 : 99);
      return av-bv;
    });
  }
  function notifications(){
    const dismissed = new Set(Store.state.preferences.dismissedNotifications || []);
    const items = [];
    Store.state.tasks.forEach(task => {
      if (task.status === 'complete') return;
      const days = daysUntil(task.due);
      const risk = taskRisk(task);
      if (risk >= 65){
        items.push({id:`task:${task.id}`,type:'task',entityId:task.id,severity:risk>=85?'critical':'warning',title:task.title,body:days < 0 ? `${Math.abs(days)} days overdue` : task.status === 'waiting' ? `Waiting on ${task.blockedBy || 'another person'}` : `${relativeDate(task.due)} · ${task.owner}`});
      }
    });
    Store.state.talent.forEach(item => {
      const missing = talentMissing(item);
      if (missing.length >= 3 && ['Offered','Contracted','Ready'].includes(item.status)) items.push({id:`talent:${item.id}`,type:'talent',entityId:item.id,severity:missing.length>=5?'critical':'warning',title:`${item.name} is not production-ready`,body:`Missing ${missing.slice(0,4).join(', ')}${missing.length>4?'…':''}`});
    });
    followUps().filter(x => x.due !== null && x.due <= 0).forEach(item => items.push({id:`follow:${item.kind}:${item.id}`,type:item.kind,entityId:item.id,severity:item.due < 0?'critical':'warning',title:`Follow up with ${item.name}`,body:item.reason}));
    Store.state.fairs.forEach(fair => scheduleIssues(fair.id).filter(issue=>issue.severity!=='info').forEach(issue=>items.push({id:`schedule:${issue.id}`,type:'schedule',entityId:issue.slotId,severity:issue.severity,title:issue.title,body:`${fair.short} · ${issue.body}`})));
    return items.filter(item => !dismissed.has(item.id)).slice(0,25);
  }
  function fairStatus(fair){
    const score = fairReadiness(fair);
    if (score >= 75) return {label:'On track',className:''};
    if (score >= 50) return {label:'Needs review',className:'waiting'};
    return {label:'At risk',className:'risk'};
  }
  function search(query){
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const s = Store.state;
    const results = [];
    const add = (type,item,title,subtitle,haystack) => {
      const text = `${title} ${subtitle} ${haystack || ''}`.toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      if (!tokens.every(token => text.includes(token))) return;
      let score = title.toLowerCase().startsWith(q) ? 100 : title.toLowerCase().includes(q) ? 70 : 40;
      tokens.forEach(token => { if (text.includes(token)) score += 5; });
      results.push({type,id:item.id,title,subtitle,score});
    };
    s.fairs.forEach(f => add('fair',f,f.name,`${f.date} · ${f.location}`,`${f.short} ${f.code} ${f.stage} ${f.venue} ${f.status}`));
    s.talent.forEach(t => add('talent',t,t.name,`${t.type} · ${s.fairs.find(f=>f.id===t.fairId)?.short || ''}`,`${t.status} ${t.owner} ${talentMissing(t).join(' ')}`));
    s.tasks.forEach(t => add('task',t,t.title,`${t.owner} · ${relativeDate(t.due)}`,`${t.status} ${t.priority} ${t.description} ${t.blockedBy} ${s.fairs.find(f=>f.id===t.fairId)?.name || ''}`));
    s.contacts.forEach(c => add('contact',c,c.name,`${c.role} · ${c.organization}`,`${c.type} ${c.email} ${c.status} ${c.notes}`));
    s.files.forEach(f => add('file',f,f.name,`${f.type} · ${f.folder}`,`${f.owner} ${f.notes} ${s.fairs.find(x=>x.id===f.fairId)?.name || ''}`));
    s.schedules.forEach(slot => add('schedule',slot,slot.title,`${formatClock(slot.startTime)} · ${s.fairs.find(f=>f.id===slot.fairId)?.short || ''}`,`${slot.kind} ${slot.publicTitle} ${slot.status} ${slot.internalNotes} ${scheduleIssues(slot.fairId).filter(x=>x.slotId===slot.id).map(x=>x.title).join(' ')}`));
    s.deadlines.forEach(d => add('deadline',d,d.title,`${relativeDate(d.date)} · ${d.owner}`,`${d.kind} ${s.fairs.find(f=>f.id===d.fairId)?.name || ''}`));
    s.notes.forEach(n => add('note',n,n.body.slice(0,60),`${n.author} · ${formatTimeAgo(n.createdAt)}`,n.body));
    return results.sort((a,b) => b.score-a.score).slice(0,40);
  }
  function activityFor(type,id){
    const item = Store.get(type,id);
    const fairId = type === 'fair' ? id : item?.fairId || '';
    return Store.state.activity.filter(activity => activity.entityType === type && activity.entityId === id || (type === 'fair' && activity.fairId === fairId)).sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp));
  }
  function related(type,id){
    const s = Store.state;
    const item = Store.get(type,id);
    const fairId = type === 'fair' ? id : item?.fairId || '';
    const talentId = type === 'talent' ? id : item?.talentId || '';
    const contactId = type === 'contact' ? id : item?.contactId || '';
    return {
      tasks:s.tasks.filter(t => type === 'fair' ? t.fairId===id : type === 'talent' ? t.talentId===id : type === 'contact' ? t.contactId===id : (fairId && t.fairId===fairId)),
      talent:s.talent.filter(t => type === 'fair' ? t.fairId===id : type === 'contact' ? t.contactId===id : talentId ? t.id===talentId : false),
      contacts:s.contacts.filter(c => type === 'fair' ? c.fairIds?.includes(id) : contactId ? c.id===contactId : false),
      files:s.files.filter(f => type === 'fair' ? f.fairId===id : type === 'talent' ? f.talentId===id : fairId ? f.fairId===fairId : false),
      schedules:s.schedules.filter(slot => type === 'fair' ? slot.fairId===id : type === 'talent' ? slot.talentId===id : type === 'schedule' ? slot.id===id : fairId ? slot.fairId===fairId : false),
      deadlines:s.deadlines.filter(d => type === 'fair' ? d.fairId===id : d.relatedType===type && d.relatedId===id),
      notes:s.notes.filter(n => n.relatedType===type && n.relatedId===id || (type==='fair' && n.fairId===id)),
      activity:activityFor(type,id)
    };
  }

  window.OATFIntel = {timeToMinutes,minutesToTime,formatClock,scheduleForFair,scheduleIssues,scheduleReadiness,productionActions,dateOnly,daysUntil,relativeDate,formatDate,formatTimeAgo,greeting,talentMissing,talentReadiness,taskRisk,fairReadiness,seasonReadiness,nextFair,dueTasks,completedThisWeek,followUps,notifications,fairStatus,search,activityFor,related};
})();
