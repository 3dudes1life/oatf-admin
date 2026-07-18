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
    return Math.max(0,Math.min(100,Math.round(taskScore*.45+talentScore*.35+contactScore*.1+fileScore*.1-overduePenalty)));
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
      .filter(t => t.owner === user && t.status !== 'complete')
      .map(t => ({...t,risk:taskRisk(t),days:daysUntil(t.due)}))
      .sort((a,b) => b.risk-a.risk || (a.days ?? 9999)-(b.days ?? 9999));
  }
  function completedThisWeek(user=Store.state.currentUser){
    const weekAgo = Date.now()-7*86400000;
    return Store.state.tasks.filter(t => t.owner === user && t.status === 'complete' && new Date(t.completedAt || t.updatedAt).getTime() >= weekAgo);
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
      deadlines:s.deadlines.filter(d => type === 'fair' ? d.fairId===id : d.relatedType===type && d.relatedId===id),
      notes:s.notes.filter(n => n.relatedType===type && n.relatedId===id || (type==='fair' && n.fairId===id)),
      activity:activityFor(type,id)
    };
  }

  window.OATFIntel = {dateOnly,daysUntil,relativeDate,formatDate,formatTimeAgo,greeting,talentMissing,talentReadiness,taskRisk,fairReadiness,seasonReadiness,nextFair,dueTasks,completedThisWeek,followUps,notifications,fairStatus,search,activityFor,related};
})();
