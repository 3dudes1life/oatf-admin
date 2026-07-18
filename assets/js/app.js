(() => {
  'use strict';
  const Store = window.OATFStore;
  const Intel = window.OATFIntel;
  const UI = window.OATFUI;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const todayISO = () => new Date().toISOString().slice(0,10);

  let selectedLoginUser = Store.state.currentUser || 'Spencer';
  let currentView = Store.state.preferences.lastView || 'today';
  let currentDrawer = null;
  let currentDrawerTab = 'overview';
  let calendarMonth = (() => {
    const first = Store.state.deadlines.map(d => d.date).filter(Boolean).sort()[0];
    const d = first ? new Date(`${first}T12:00:00`) : new Date();
    return new Date(d.getFullYear(),d.getMonth(),1);
  })();
  let talentFilter = 'All';
  let contactFilter = 'All';
  let taskOwnerFilter = 'All';
  let taskFairFilter = 'All';
  let fileFairFilter = 'All';
  let searchSelection = 0;
  let keyboardChord = '';
  let keyboardChordTimer = null;
  let renderQueued = false;

  function queueRender(){
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued=false; renderAll(); });
  }

  function recordFromPair(pair){
    const [type,id] = String(pair || '').split(':');
    return {type,id};
  }
  function fair(id){ return Store.get('fair',id); }
  function entityName(type,id){ const item=Store.get(type,id); return item ? UI.recordTitle(type,item) : ''; }

  function enterBoard(){
    Store.setCurrentUser(selectedLoginUser);
    $('#loginScreen').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    sessionStorage.setItem(Store.SESSION_KEY,'1');
    currentView = Store.state.preferences.lastView || 'today';
    showView(currentView,{remember:false});
    renderAll();
    const last = Store.state.preferences.lastRecord;
    if (last && Store.get(last.type,last.id) && sessionStorage.getItem('oatf-os-restore-record') === '1') openDrawer(last.type,last.id);
  }

  function showView(view,{remember=true}={}){
    if (!document.getElementById(`view-${view}`)) view='today';
    currentView=view;
    $$('.view').forEach(el => el.classList.toggle('active',el.id===`view-${view}`));
    $$('[data-view]').forEach(el => el.classList.toggle('active',el.dataset.view===view));
    const active=$(`#view-${view}`);
    $('#pageTitle').textContent=active?.dataset.title || 'OATF OS';
    $('#pageEyebrow').textContent=active?.dataset.eyebrow || 'Production Board';
    $('#sidebar').classList.remove('open');
    closePopovers();
    if (remember){ Store.state.preferences.lastView=view; Store.save(); }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderAll(){
    renderUser();
    renderSidebar();
    renderToday();
    renderMyWork();
    renderFairs();
    renderTalent();
    renderContacts();
    renderFollowUps();
    renderTasks();
    renderCalendar();
    renderFiles();
    renderActivity();
    renderDayOf();
    renderNotifications();
    renderBadges();
    if (currentDrawer && Store.get(currentDrawer.type,currentDrawer.id)) renderDrawer();
  }

  function renderUser(){
    const user=Store.state.currentUser;
    $('#sidebarUserName').textContent=user;
    $('#sidebarAvatar').textContent=user[0];
    $('#sidebarAvatar').classList.toggle('william',user==='William');
    $('#topAvatar').textContent=user[0];
    $('#topAvatar').classList.toggle('william',user==='William');
    $$('.login-user').forEach(btn => btn.classList.toggle('active',btn.dataset.loginUser===selectedLoginUser));
    $('#sidebar').classList.toggle('collapsed',Boolean(Store.state.preferences.sidebarCollapsed));
  }

  function favorites(){
    const user=Store.state.currentUser;
    const types=['fair','talent','contact','task','file'];
    const result=[];
    types.forEach(type => Store.getCollection(type).forEach(item => {
      if (item.favoriteBy?.includes(user)) result.push({type,item});
    }));
    return result.slice(0,8);
  }

  function renderSidebar(){
    const fav=favorites();
    $('#sidebarFavorites').innerHTML=fav.length ? fav.map(({type,item}) => `<button class="side-record" data-open-record="${type}:${item.id}"><span>${UI.icon(type)}</span><b>${UI.esc(UI.recordTitle(type,item))}</b></button>`).join('') : `<div class="side-empty">Star a fair, performer, or contact.</div>`;
    const recent=Store.state.recentViewed.map(entry => ({...entry,item:Store.get(entry.type,entry.id)})).filter(x=>x.item).slice(0,5);
    $('#sidebarRecent').innerHTML=recent.length ? recent.map(({type,id,item}) => `<button class="side-record" data-open-record="${type}:${id}"><span>${UI.icon(type)}</span><b>${UI.esc(UI.recordTitle(type,item))}</b></button>`).join('') : `<div class="side-empty">Opened records appear here.</div>`;
  }

  function renderToday(){
    const user=Store.state.currentUser;
    const priorities=Intel.dueTasks(user).slice(0,6);
    const critical=priorities.filter(t=>t.risk>=65).length;
    const waiting=Store.state.tasks.filter(t=>t.owner===user&&t.status==='waiting').length;
    const complete=Intel.completedThisWeek(user).length;
    const next=Intel.nextFair();
    const follow=Intel.followUps().slice(0,5);
    const recent=Store.state.recentViewed.map(x=>({...x,item:Store.get(x.type,x.id)})).filter(x=>x.item).slice(0,4);
    const activity=Store.state.activity.slice(0,5);
    const readiness=next ? Intel.fairReadiness(next) : 0;

    $('#todayContent').innerHTML=`
      <div class="today-hero">
        <section class="greeting-card">
          <span class="eyebrow">${Intel.greeting()}</span>
          <h1>${UI.esc(user)}.</h1>
          <p>${critical ? `There ${critical===1?'is':'are'} ${critical} high-pressure item${critical===1?'':'s'} worth handling first.` : 'The production board is calm. Keep the current work moving forward.'}</p>
          <div class="today-counts">
            <span class="critical"><b>${critical}</b> critical</span>
            <span class="waiting"><b>${waiting}</b> waiting</span>
            <span class="complete"><b>${complete}</b> completed this week</span>
            <span><b>${Intel.seasonReadiness()}%</b> season readiness</span>
          </div>
        </section>
        ${next ? `<button class="next-fair-card" data-open-record="fair:${next.id}">
          <div><span class="eyebrow">Next fair</span><h3>${UI.esc(next.name)}</h3><p>${UI.esc(next.venue)} · ${UI.esc(Intel.formatDate(next.date))}</p></div>
          <div><div class="countdown"><strong>${Math.max(0,next.days ?? 0)}</strong><span>days away</span></div><div class="readiness-line"><div><span>Production readiness</span><b>${readiness}%</b></div><div class="meter"><i style="width:${readiness}%"></i></div></div></div>
        </button>` : ''}
      </div>
      <div class="today-grid">
        <section class="panel">
          <div class="panel-head"><div><span class="eyebrow">Focus</span><h3>Today’s priorities</h3><p>Highest-impact work assigned to ${UI.esc(user)}.</p></div><button class="text-button" data-view="mywork">View all →</button></div>
          <div class="priority-list">${priorities.length ? priorities.map(task => `<div class="priority-row"><button class="check-button" data-complete-task="${task.id}" aria-label="Complete task">✓</button><button style="display:block;border:0;background:transparent;color:inherit;text-align:left;padding:0" data-open-record="task:${task.id}"><b>${UI.esc(task.title)}</b><small>${UI.esc(fair(task.fairId)?.short || 'No fair')} · ${UI.esc(task.blockedBy ? `Blocked by ${task.blockedBy}` : task.description || 'Production task')}</small></button><em>${UI.esc(Intel.relativeDate(task.due))}</em></div>`).join('') : empty('Nothing urgent','Your current work is caught up.')}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><span class="eyebrow">Continue</span><h3>Pick up where you left off</h3></div></div>
          <div class="continue-list">${recent.length ? recent.map(entry => `<button class="continue-row" data-open-record="${entry.type}:${entry.id}"><span class="record-icon">${UI.icon(entry.type)}</span><span><b>${UI.esc(UI.recordTitle(entry.type,entry.item))}</b><small>${UI.esc(UI.recordSubtitle(entry.type,entry.item))}</small></span><span>›</span></button>`).join('') : empty('Nothing viewed yet','Open a fair or performer and it will stay within reach.')}</div>
        </section>
      </div>
      <div class="today-grid three">
        <section class="panel"><div class="panel-head"><div><span class="eyebrow">Waiting</span><h3>Follow-up queue</h3></div><button class="text-button" data-view="followups">Open center →</button></div><div class="followup-list">${follow.length ? follow.map(item => `<button class="followup-row" data-open-record="${item.kind}:${item.id}"><span class="priority-dot ${item.due<0?'critical':''}"></span><span><b>${UI.esc(item.name)}</b><small>${UI.esc(item.reason)}</small></span><em>${UI.esc(item.date ? Intel.relativeDate(item.date) : 'Follow up')}</em></button>`).join('') : empty('No follow-ups due','No one is currently waiting for outreach.')}</div></section>
        <section class="panel"><div class="panel-head"><div><span class="eyebrow">Fair health</span><h3>Readiness</h3></div></div><div class="continue-list">${Store.state.fairs.map(item => {const score=Intel.fairReadiness(item);return `<button class="continue-row" data-open-record="fair:${item.id}"><span class="record-icon">${item.code}</span><span><b>${UI.esc(item.short)}</b><small>${UI.esc(Intel.fairStatus(item).label)}</small><div class="meter" style="margin-top:6px"><i style="width:${score}%"></i></div></span><span>${score}%</span></button>`}).join('')}</div></section>
        <section class="panel"><div class="panel-head"><div><span class="eyebrow">Recent changes</span><h3>Activity</h3></div><button class="text-button" data-view="activity">Full log →</button></div><div class="recent-activity-list">${activity.map(activityRow).join('')}</div></section>
      </div>`;
  }

  function empty(title,message){ return `<div class="empty-state"><div><b>${UI.esc(title)}</b><p>${UI.esc(message)}</p></div></div>`; }
  function activityRow(a){ return `<div class="activity-item"><i></i><div><b>${UI.esc(a.actor)}</b><p>${UI.esc(a.action)}</p></div><time>${UI.esc(Intel.formatTimeAgo(a.timestamp))}</time></div>`; }

  function renderMyWork(){
    const user=Store.state.currentUser;
    const tasks=Store.state.tasks.filter(t=>t.owner===user);
    const assigned=tasks.filter(t=>t.status!=='complete').sort((a,b)=>Intel.taskRisk(b)-Intel.taskRisk(a));
    const dueToday=assigned.filter(t=>Intel.daysUntil(t.due)<=0);
    const waiting=assigned.filter(t=>t.status==='waiting');
    const completed=tasks.filter(t=>t.status==='complete').sort((a,b)=>new Date(b.completedAt||b.updatedAt)-new Date(a.completedAt||a.updatedAt)).slice(0,8);
    const hours=assigned.reduce((sum,t)=>sum+Number(t.estimatedHours||1),0);
    $('#myWorkContent').innerHTML=`
      <section class="work-hero"><div><span class="eyebrow">Personal workspace</span><h1>${UI.esc(user)}’s work.</h1><p>Only the production work assigned to you, organized by what needs movement.</p></div><div class="work-stats"><div class="work-stat"><strong>${assigned.length}</strong><span>open tasks</span></div><div class="work-stat"><strong>${waiting.length}</strong><span>waiting</span></div><div class="work-stat"><strong>${hours}h</strong><span>estimated effort</span></div></div></section>
      <div class="work-sections">
        ${workPanel('Due now',dueToday,'No work due now','Your immediate queue is clear.')}
        ${workPanel('Assigned to me',assigned.slice(0,10),'No assigned work','New assignments will appear here.')}
        ${workPanel('Waiting on someone',waiting,'Nothing waiting','No outside blockers are recorded.')}
        <section class="panel"><div class="panel-head"><div><span class="eyebrow">Done</span><h3>Recently finished</h3></div></div><div class="work-list">${completed.length?completed.map(task=>`<button class="continue-row" data-open-record="task:${task.id}"><span class="record-icon">✓</span><span><b>${UI.esc(task.title)}</b><small>${UI.esc(fair(task.fairId)?.short || 'No fair')} · ${UI.esc(Intel.formatTimeAgo(task.completedAt||task.updatedAt))}</small></span><span>›</span></button>`).join(''):empty('No completed tasks','Finished work will collect here.')}</div></section>
      </div>`;
  }
  function workPanel(title,items,emptyTitle,emptyMessage){ return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">Work queue</span><h3>${UI.esc(title)}</h3></div></div><div class="work-list">${items.length?items.map(task=>`<div class="priority-row"><button class="check-button" data-complete-task="${task.id}">✓</button><button style="display:block;border:0;background:transparent;color:inherit;text-align:left;padding:0" data-open-record="task:${task.id}"><b>${UI.esc(task.title)}</b><small>${UI.esc(fair(task.fairId)?.short || 'No fair')} · ${UI.esc(task.blockedBy || task.description || 'Production task')}</small></button><em>${UI.esc(Intel.relativeDate(task.due))}</em></div>`).join(''):empty(emptyTitle,emptyMessage)}</div></section>`; }

  function renderFairs(){
    $('#fairGrid').innerHTML=Store.state.fairs.map(item=>{
      const score=Intel.fairReadiness(item);const status=Intel.fairStatus(item);
      const taskCount=Store.state.tasks.filter(t=>t.fairId===item.id&&t.status!=='complete').length;
      const talentCount=Store.state.talent.filter(t=>t.fairId===item.id).length;
      const isFav=item.favoriteBy?.includes(Store.state.currentUser);
      return `<article class="fair-card" style="--fair-glow:${item.accent}33" data-open-record="fair:${item.id}"><div><div class="fair-card-top"><span class="status-pill ${status.className}">${UI.esc(status.label)}</span><span class="fair-score">${score}%</span></div><button class="favorite-star ${isFav?'active':''}" data-favorite="fair:${item.id}" aria-label="Favorite">${isFav?'★':'☆'}</button></div><div><span class="eyebrow">${UI.esc(Intel.formatDate(item.date,{month:'long',year:'numeric'}))}</span><h3>${UI.esc(item.name)}</h3><p>${UI.esc(item.venue)} · ${UI.esc(item.location)}</p><div class="fair-meta-line"><span><b>${taskCount}</b> open tasks</span><span><b>${talentCount}</b> talent</span><span><b>${Store.state.files.filter(f=>f.fairId===item.id).length}</b> files</span></div><div class="meter" style="margin-top:14px"><i style="width:${score}%"></i></div></div></article>`;
    }).join('');
  }

  function renderTalent(){
    const statuses=['All','Submitted','Reviewing','Offered','Contracted','Ready'];
    $('#talentToolbar').innerHTML=statuses.map(status=>`<button class="filter-button ${talentFilter===status?'active':''}" data-talent-filter="${status}">${status}</button>`).join('')+`<span class="toolbar-spacer"></span><span class="kicker">${Store.state.talent.length} records</span>`;
    const list=talentFilter==='All'?Store.state.talent:Store.state.talent.filter(t=>t.status===talentFilter);
    $('#talentGrid').innerHTML=list.length?list.map(item=>{
      const score=Intel.talentReadiness(item);const missing=Intel.talentMissing(item);const isFav=item.favoriteBy?.includes(Store.state.currentUser);
      return `<article class="record-card" data-open-record="talent:${item.id}"><button class="favorite-star ${isFav?'active':''}" data-favorite="talent:${item.id}">${isFav?'★':'☆'}</button><div class="record-card-head"><div><span class="record-badge">${UI.esc(item.status)}</span><h3>${UI.esc(item.name)}</h3><p>${UI.esc(item.type)} · ${UI.esc(fair(item.fairId)?.short || '')}</p></div><div class="readiness-ring" style="--score:${score}"><b>${score}%</b></div></div><div class="missing-chips">${missing.slice(0,4).map(x=>`<span>${UI.esc(x)}</span>`).join('') || '<span style="color:var(--green);background:rgba(69,223,145,.08)">Ready</span>'}</div><div class="record-card-bottom"><span>Owned by ${UI.esc(item.owner)}</span><strong>${UI.esc(item.performanceTime || 'Time TBD')}</strong></div></article>`;
    }).join(''):empty('No matching talent','Change the filter or add a performer.');
  }

  function renderContacts(){
    const types=['All','Fair Partner','Production','Talent','Vendor','Community Partner'];
    $('#contactToolbar').innerHTML=types.map(type=>`<button class="filter-button ${contactFilter===type?'active':''}" data-contact-filter="${type}">${type}</button>`).join('');
    const list=contactFilter==='All'?Store.state.contacts:Store.state.contacts.filter(c=>c.type===contactFilter);
    $('#contactGrid').innerHTML=list.length?list.map(item=>{
      const isFav=item.favoriteBy?.includes(Store.state.currentUser);
      return `<article class="contact-card" data-open-record="contact:${item.id}"><span class="contact-avatar">${UI.initials(item.name)}</span><div><span class="record-badge">${UI.esc(item.type)}</span><h3>${UI.esc(item.name)}</h3><p>${UI.esc(item.role)} · ${UI.esc(item.organization)}</p><small>${item.nextFollowUp?`Follow up ${UI.esc(Intel.relativeDate(item.nextFollowUp))}`:`Last contact ${UI.esc(item.lastContact?Intel.relativeDate(item.lastContact):'not recorded')}`}</small></div><button class="favorite-star ${isFav?'active':''}" data-favorite="contact:${item.id}">${isFav?'★':'☆'}</button></article>`;
    }).join(''):empty('No matching contacts','Add a contact or change the filter.');
  }

  function renderFollowUps(){
    const items=Intel.followUps();
    const overdue=items.filter(x=>x.due!==null&&x.due<0);
    const today=items.filter(x=>x.due===0||x.status==='Needs follow-up');
    const upcoming=items.filter(x=>x.due===null||x.due>0);
    const score=Math.max(0,100-Math.min(100,overdue.length*16+today.length*8));
    $('#followUpContent').innerHTML=`
      <section class="followup-hero"><div><span class="eyebrow">Relationship memory</span><h1>Follow-Up Center</h1><p>Know who is waiting, how long it has been, and what needs to be requested next.</p></div><div class="followup-score" style="--score:${score}"><div><strong>${score}%</strong><span>response health</span></div></div></section>
      <div class="followup-columns">${followColumn('Overdue',overdue,'No overdue follow-ups')}${followColumn('Handle now',today,'Nothing due today')}${followColumn('Upcoming',upcoming,'No upcoming follow-ups')}</div>`;
  }
  function followColumn(title,items,emptyTitle){ return `<section class="followup-column"><span class="eyebrow">${items.length} record${items.length===1?'':'s'}</span><h3>${UI.esc(title)}</h3>${items.length?items.map(item=>`<article class="followup-card"><div class="followup-card-head"><div><b>${UI.esc(item.name)}</b><p>${UI.esc(item.subtitle)}<br>${UI.esc(item.reason)}</p></div><small>${UI.esc(item.date?Intel.relativeDate(item.date):'Now')}</small></div><div class="followup-actions"><button class="mini-action primary" data-copy-followup="${item.kind}:${item.id}">Copy message</button><button class="mini-action" data-open-record="${item.kind}:${item.id}">Open</button><button class="mini-action" data-finish-followup="${item.kind}:${item.id}">Done</button></div></article>`).join(''):empty(emptyTitle,'The queue is clear.')}</section>`; }

  function renderTasks(){
    const owners=['All','Spencer','William','Fair Partner','Production'];
    $('#taskToolbar').innerHTML=`${owners.map(owner=>`<button class="filter-button ${taskOwnerFilter===owner?'active':''}" data-task-owner="${owner}">${owner}</button>`).join('')}<span class="toolbar-spacer"></span><select id="taskFairSelect"><option>All</option>${Store.state.fairs.map(f=>`<option value="${f.id}"${taskFairFilter===f.id?' selected':''}>${UI.esc(f.short)}</option>`).join('')}</select>`;
    let tasks=Store.state.tasks;
    if(taskOwnerFilter!=='All')tasks=tasks.filter(t=>t.owner===taskOwnerFilter);
    if(taskFairFilter!=='All')tasks=tasks.filter(t=>t.fairId===taskFairFilter);
    const cols=[['todo','To Do'],['inprogress','In Progress'],['waiting','Waiting'],['complete','Complete']];
    $('#taskBoard').innerHTML=cols.map(([status,label])=>{const list=tasks.filter(t=>t.status===status).sort((a,b)=>Intel.taskRisk(b)-Intel.taskRisk(a));return `<section class="kanban-column" data-task-column="${status}"><header class="kanban-head"><div><i></i><h3>${label}</h3></div><span>${list.length}</span></header><div class="task-list">${list.map(taskCard).join('')}</div></section>`}).join('');
    bindTaskDrag();
  }
  function taskCard(task){ return `<article class="task-card" draggable="true" data-task-id="${task.id}" data-open-record="task:${task.id}"><div class="task-card-top"><span class="priority-chip ${task.priority.toLowerCase()}">${UI.esc(task.priority)}</span><span class="owner-chip">${UI.esc(task.owner[0])}</span></div><h4>${UI.esc(task.title)}</h4><p>${UI.esc(fair(task.fairId)?.short || 'No fair')} · ${UI.esc(Intel.relativeDate(task.due))}</p>${task.blockedBy?`<span class="blocked-label">⚠ ${UI.esc(task.blockedBy)}</span>`:''}<div class="task-card-foot"><span>${Number(task.estimatedHours||1)}h estimate</span><span>${UI.esc(task.impact)} impact</span></div></article>`; }
  function bindTaskDrag(){
    let dragged=null;
    $$('.task-card').forEach(card=>{
      card.addEventListener('dragstart',e=>{dragged=card.dataset.taskId;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
      card.addEventListener('dragend',()=>{card.classList.remove('dragging');$$('.kanban-column').forEach(c=>c.classList.remove('task-card-over'));});
    });
    $$('.kanban-column').forEach(col=>{
      col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('task-card-over');});
      col.addEventListener('dragleave',()=>col.classList.remove('task-card-over'));
      col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('task-card-over');if(!dragged)return;const task=Store.get('task',dragged);const before={...task};task.status=col.dataset.taskColumn;task.updatedAt=Store.nowISO();if(task.status==='complete')task.completedAt=Store.nowISO();else delete task.completedAt;Store.log(Store.state.currentUser,`moved “${task.title}” to ${UI.statusText(task.status)}.`,`task`,task.id,task.fairId);Store.save();UI.toast('Task moved',UI.statusText(task.status),()=>{Object.assign(task,before);Store.save();});dragged=null;});
    });
  }

  function renderCalendar(){
    $('#calendarTitle').textContent=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(calendarMonth);
    const year=calendarMonth.getFullYear(),month=calendarMonth.getMonth();
    const firstDay=new Date(year,month,1).getDay(),daysInMonth=new Date(year,month+1,0).getDate();
    const cells=[];for(let i=0;i<firstDay;i++)cells.push('<div class="calendar-day empty"></div>');
    for(let day=1;day<=daysInMonth;day++){
      const date=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const events=Store.state.deadlines.filter(d=>d.date===date);
      cells.push(`<div class="calendar-day ${date===todayISO()?'today':''}"><span>${day}</span>${events.map(event=>`<button class="calendar-event ${Intel.daysUntil(event.date)<0?'overdue':''}" data-open-record="deadline:${event.id}">${UI.esc(event.title)}</button>`).join('')}</div>`);
    }
    $('#calendarDays').innerHTML=cells.join('');
  }

  function renderFiles(){
    $('#fileToolbar').innerHTML=`<button class="filter-button ${fileFairFilter==='All'?'active':''}" data-file-fair="All">All</button>${Store.state.fairs.map(f=>`<button class="filter-button ${fileFairFilter===f.id?'active':''}" data-file-fair="${f.id}">${UI.esc(f.code)}</button>`).join('')}`;
    const list=fileFairFilter==='All'?Store.state.files:Store.state.files.filter(f=>f.fairId===fileFairFilter);
    $('#fileList').innerHTML=list.length?list.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).map(item=>`<button class="file-row" data-open-record="file:${item.id}"><span class="file-icon">${UI.esc(item.type)}</span><span><b>${UI.esc(item.name)}</b><small>${UI.esc(item.folder)}</small></span><span>${UI.esc(fair(item.fairId)?.short || 'Shared')}</span><span>${UI.esc(item.owner)}</span><span>${UI.esc(Intel.formatTimeAgo(item.updatedAt))}</span></button>`).join(''):empty('No files here','Add a file record to this fair.');
  }

  function renderActivity(){ $('#activityFeed').innerHTML=Store.state.activity.length?Store.state.activity.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map(activityRow).join(''):empty('No activity yet','Changes will be recorded here.'); }

  function renderDayOf(){
    const fairItem=Intel.nextFair() || Store.state.fairs[0];
    const talent=Store.state.talent.filter(t=>t.fairId===fairItem?.id);
    const current=talent[0];const next=talent[1];
    const openIssues=Store.state.issues.filter(i=>i.status!=='Resolved');
    $('#dayOfContent').innerHTML=`
      <section class="dayof-hero"><div><span class="eyebrow">Live production workspace</span><h1>Day-of Command</h1><p>${UI.esc(fairItem?.name || 'Choose a fair')} · Touch-friendly local controls for backstage use.</p></div><span class="live-indicator"><i></i>Preview mode</span></section>
      <div class="dayof-grid"><section class="stage-now"><span class="eyebrow">Current stage block</span><h2>${UI.esc(current?.name || 'No act selected')}</h2><p>${UI.esc(current?.performanceTime || 'Stage time not set')} · ${UI.esc(fairItem?.stage || '')}</p><div class="stage-time" id="stageClock">${new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date())}</div><div class="stage-actions"><button class="stage-action" data-day-action="checkin:${current?.id||''}">Checked In</button><button class="stage-action" data-day-action="ready:${current?.id||''}">Ready</button><button class="stage-action" data-day-action="complete:${current?.id||''}">Complete</button></div><div class="drawer-section"><div class="drawer-section-head"><h3>Up next</h3></div>${next?UI.relatedRow('talent',next):empty('No next act','Add talent to the fair workspace.')}</div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">Live issues</span><h3>Production tracker</h3></div><button class="button ghost" data-create="issue">＋ Log issue</button></div><div class="issue-list">${openIssues.length?openIssues.map(issue=>`<article class="issue-card"><b>${UI.esc(issue.title)}</b><span>${UI.esc(issue.severity)} · ${UI.esc(issue.owner)} · ${UI.esc(Intel.formatTimeAgo(issue.createdAt))}</span><button class="mini-action" data-cycle-issue="${issue.id}">${UI.esc(issue.status)} →</button></article>`).join(''):empty('No live issues','The current production queue is clear.')}</div></section></div>`;
  }

  function renderNotifications(){
    const list=Intel.notifications();
    $('#notificationCount').textContent=list.length?String(list.length):'';
    $('#notificationList').innerHTML=list.length?list.map(item=>`<div class="notification-item ${item.severity}"><i></i><button style="border:0;background:transparent;color:inherit;text-align:left;padding:0" data-open-notification="${item.type}:${item.entityId}"><b>${UI.esc(item.title)}</b><p>${UI.esc(item.body)}</p></button><button data-dismiss-notification="${item.id}">×</button></div>`).join(''):empty('You’re caught up','No active local notifications.');
  }

  function renderBadges(){
    const user=Store.state.currentUser;
    const due=Intel.dueTasks(user).filter(t=>t.risk>=65).length;
    const my=Store.state.tasks.filter(t=>t.owner===user&&t.status!=='complete').length;
    const follow=Intel.followUps().filter(x=>x.due===null||x.due<=0).length;
    $('#todayBadge').textContent=due?String(due):'';$('#myWorkBadge').textContent=my?String(my):'';$('#followUpBadge').textContent=follow?String(follow):'';
  }

  function openDrawer(type,id,tab='overview'){
    if(!Store.get(type,id))return;
    currentDrawer={type,id};currentDrawerTab=tab;
    Store.addRecent(type,id);
    renderDrawer();
    $('#detailDrawer').classList.add('open');$('#detailDrawer').setAttribute('aria-hidden','false');$('#scrim').classList.add('open');
  }
  function renderDrawer(){
    if(!currentDrawer)return;
    const {type,id}=currentDrawer;const item=Store.get(type,id);if(!item){closeDrawer();return;}
    $('#drawerContent').innerHTML=UI.drawerHTML(type,id,currentDrawerTab);
    const active=item.favoriteBy?.includes(Store.state.currentUser);
    $('#drawerFavorite').textContent=active?'★':'☆';$('#drawerFavorite').classList.toggle('active',active);
  }
  function closeDrawer(){currentDrawer=null;$('#detailDrawer').classList.remove('open');$('#detailDrawer').setAttribute('aria-hidden','true');$('#scrim').classList.remove('open');}

  function createDefaults(type,relatedType='',relatedId=''){
    const defaults={};const related=Store.get(relatedType,relatedId);
    if(type==='task'||type==='deadline'||type==='file'||type==='note'){
      if(relatedType==='fair')defaults.fairId=relatedId;
      else if(related?.fairId)defaults.fairId=related.fairId;
    }
    if(type==='task'&&relatedType==='talent')defaults.talentId=relatedId;
    if(type==='task'&&relatedType==='contact')defaults.contactId=relatedId;
    if(type==='file'&&relatedType==='talent')defaults.talentId=relatedId;
    if(type==='deadline'){defaults.relatedType=relatedType;defaults.relatedId=relatedId;}
    if(type==='note'){defaults.relatedType=relatedType||'fair';defaults.relatedId=relatedId;}
    return defaults;
  }
  function openCreate(type,relatedType='',relatedId=''){UI.openRecordForm(type,{},createDefaults(type,relatedType,relatedId),saved=>{if(saved)openDrawer(type,saved.id);});}

  function completeTask(id){
    const task=Store.get('task',id);if(!task)return;const before={...task};task.status='complete';task.completedAt=Store.nowISO();task.updatedAt=Store.nowISO();Store.log(Store.state.currentUser,`completed “${task.title}.”`,'task',task.id,task.fairId);Store.save();UI.toast('Task completed',task.title,()=>{Object.assign(task,before);Store.save();});
  }
  function deleteRecord(type,id){
    const item=Store.get(type,id);if(!item)return;
    if(!confirm(`Delete ${UI.recordTitle(type,item)}? You can undo immediately afterward.`))return;
    const result=Store.remove(type,id);closeDrawer();Store.log(Store.state.currentUser,`deleted ${UI.typeLabel(type).toLowerCase()} “${UI.recordTitle(type,item)}.”`,type,id,item.fairId||'');
    UI.toast(`${UI.typeLabel(type)} deleted`,UI.recordTitle(type,item),()=>Store.restore(type,result.removed,result.index));
  }

  function followUpMessage(type,id){
    const item=Store.get(type,id);if(!item)return '';
    if(type==='contact')return `Hi ${item.name.split(' ')[0]},\n\nJust following up on the outstanding OATF production details. Please let us know when you have an update so we can keep the fair workspace moving.\n\nThank you,\nOATF Production`;
    if(type==='talent'){
      const missing=Intel.talentMissing(item);
      return `Hi ${item.name},\n\nWe’re checking in on your OATF production materials. We are still waiting on: ${missing.join(', ') || 'final production confirmation'}. Please send those when available so we can mark your record ready.\n\nThank you,\nOATF Production`;
    }
    return '';
  }
  async function copyFollowUp(type,id){
    const text=followUpMessage(type,id);if(!text)return;
    try{await navigator.clipboard.writeText(text);UI.toast('Follow-up copied','Ready to paste into email or text.');}
    catch{const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();UI.toast('Follow-up copied','Ready to paste.');}
  }
  function finishFollowUp(type,id){
    let contact=type==='contact'?Store.get('contact',id):Store.get('contact',Store.get('talent',id)?.contactId);
    if(!contact){UI.toast('No linked contact','Open the record and link a contact first.');return;}
    const before={...contact};contact.lastContact=todayISO();contact.nextFollowUp='';contact.status='Active';contact.updatedAt=Store.nowISO();Store.log(Store.state.currentUser,`completed follow-up with ${contact.name}.`,'contact',contact.id,contact.fairIds?.[0]||'');Store.save();UI.toast('Follow-up completed',contact.name,()=>{Object.assign(contact,before);Store.save();});
  }

  function openSearch(){
    closePopovers();$('#searchOverlay').classList.add('open');$('#searchOverlay').setAttribute('aria-hidden','false');const input=$('#globalSearch');input.value=Store.state.preferences.lastSearch||'';searchSelection=0;renderSearch(input.value);setTimeout(()=>{input.focus();input.select();},0);
  }
  function closeSearch(){ $('#searchOverlay').classList.remove('open');$('#searchOverlay').setAttribute('aria-hidden','true'); }
  function renderSearch(query){
    Store.state.preferences.lastSearch=query;
    const results=Intel.search(query);
    if(!query.trim()){
      const recent=Store.state.recentViewed.map(x=>({...x,item:Store.get(x.type,x.id)})).filter(x=>x.item);
      $('#searchResults').innerHTML=`<div class="search-group-title">Recently viewed</div>${recent.length?recent.map((x,i)=>searchResult(x.type,x.item,i)).join(''):empty('Search the production board','Find any connected fair, performer, task, contact, file, or deadline.')}`;
      return;
    }
    searchSelection=Math.min(searchSelection,Math.max(0,results.length-1));
    const grouped=results.reduce((map,result)=>{(map[result.type] ||= []).push(result);return map;},{});
    $('#searchResults').innerHTML=results.length?Object.entries(grouped).map(([type,list])=>`<div class="search-group-title">${UI.esc(UI.typeLabel(type))}</div>${list.map(result=>{const index=results.indexOf(result);return `<button class="search-result ${index===searchSelection?'selected':''}" data-search-open="${result.type}:${result.id}" data-search-index="${index}"><span>${UI.icon(result.type)}</span><span><b>${UI.esc(result.title)}</b><small>${UI.esc(result.subtitle)}</small></span><span>Open ↵</span></button>`}).join('')}`).join(''):empty('No results',`Nothing matched “${query}”.`);
  }
  function searchResult(type,item,index){return `<button class="search-result ${index===searchSelection?'selected':''}" data-search-open="${type}:${item.id}" data-search-index="${index}"><span>${UI.icon(type)}</span><span><b>${UI.esc(UI.recordTitle(type,item))}</b><small>${UI.esc(UI.recordSubtitle(type,item))}</small></span><span>Open ↵</span></button>`;}

  function closePopovers(){ $$('.popover').forEach(p=>p.classList.remove('open'));$('#userMenu').classList.remove('open'); }
  function togglePopover(selector){ const el=$(selector);const willOpen=!el.classList.contains('open');closePopovers();if(willOpen)el.classList.add('open'); }

  // Event listeners
  $('#enterBoard').addEventListener('click',enterBoard);
  $$('.login-user').forEach(btn=>btn.addEventListener('click',()=>{selectedLoginUser=btn.dataset.loginUser;renderUser();}));
  $('#mobileMenu').addEventListener('click',()=>{$('#sidebar').classList.toggle('open');$('#scrim').classList.toggle('open',$('#sidebar').classList.contains('open'));});
  $('#collapseSidebar').addEventListener('click',()=>{Store.state.preferences.sidebarCollapsed=!Store.state.preferences.sidebarCollapsed;Store.save();renderUser();});
  $('#scrim').addEventListener('click',()=>{closeDrawer();$('#sidebar').classList.remove('open');$('#scrim').classList.remove('open');});
  $('#closeDrawer').addEventListener('click',closeDrawer);
  $('#drawerEdit').addEventListener('click',()=>{if(!currentDrawer)return;const item=Store.get(currentDrawer.type,currentDrawer.id);UI.openRecordForm(currentDrawer.type,item,{},saved=>{currentDrawer={type:currentDrawer.type,id:saved.id};renderDrawer();});});
  $('#drawerFavorite').addEventListener('click',()=>{if(!currentDrawer)return;Store.toggleFavorite(currentDrawer.type,currentDrawer.id);renderDrawer();UI.toast('Favorites updated',entityName(currentDrawer.type,currentDrawer.id));});
  $('#searchTrigger').addEventListener('click',openSearch);
  $('#searchOverlay').addEventListener('click',e=>{if(e.target===$('#searchOverlay'))closeSearch();});
  $('#globalSearch').addEventListener('input',e=>{searchSelection=0;renderSearch(e.target.value);});
  $('#globalSearch').addEventListener('keydown',e=>{
    const results=$$('[data-search-open]');
    if(e.key==='ArrowDown'){e.preventDefault();searchSelection=Math.min(results.length-1,searchSelection+1);renderSearch(e.currentTarget.value);}
    if(e.key==='ArrowUp'){e.preventDefault();searchSelection=Math.max(0,searchSelection-1);renderSearch(e.currentTarget.value);}
    if(e.key==='Enter'&&results.length){e.preventDefault();const pair=results.find(x=>Number(x.dataset.searchIndex)===searchSelection)?.dataset.searchOpen||results[0].dataset.searchOpen;const {type,id}=recordFromPair(pair);closeSearch();openDrawer(type,id);}
  });
  $('#notificationButton').addEventListener('click',e=>{e.stopPropagation();togglePopover('#notificationPopover');});
  $('#quickAdd').addEventListener('click',e=>{e.stopPropagation();togglePopover('#quickPopover');});
  $('#topProfile').addEventListener('click',e=>{e.stopPropagation();togglePopover('#userMenu');});
  $('#userSwitcher').addEventListener('click',e=>{e.stopPropagation();togglePopover('#userMenu');});
  $('#mobileMore').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#scrim').classList.add('open');});
  $('#modalClose').addEventListener('click',UI.closeModal);$('#modalCancel').addEventListener('click',UI.closeModal);$('#modalShell').addEventListener('click',e=>{if(e.target===$('#modalShell'))UI.closeModal();});$('#recordForm').addEventListener('submit',UI.submitRecordForm);
  $('#toastUndo').addEventListener('click',UI.performUndo);
  $('#calendarPrev').addEventListener('click',()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar();});
  $('#calendarNext').addEventListener('click',()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar();});
  $('#clearNotifications').addEventListener('click',()=>{Store.state.preferences.dismissedNotifications=Intel.notifications().map(n=>n.id);Store.save();renderNotifications();});

  document.addEventListener('click',event=>{
    if(!event.target.closest('.popover')&&!event.target.closest('#notificationButton')&&!event.target.closest('#quickAdd')&&!event.target.closest('#topProfile')&&!event.target.closest('#userSwitcher'))closePopovers();

    const view=event.target.closest('[data-view]')?.dataset.view;if(view){showView(view);return;}
    const create=event.target.closest('[data-create]')?.dataset.create;if(create){closePopovers();openCreate(create);return;}
    const relatedCreate=event.target.closest('[data-create-related]')?.dataset.createRelated;if(relatedCreate){const [type,relatedType,relatedId]=relatedCreate.split(':');openCreate(type,relatedType,relatedId);return;}
    const open=event.target.closest('[data-open-record]')?.dataset.openRecord;if(open){event.preventDefault();event.stopPropagation();const {type,id}=recordFromPair(open);openDrawer(type,id);return;}
    const searchOpen=event.target.closest('[data-search-open]')?.dataset.searchOpen;if(searchOpen){const {type,id}=recordFromPair(searchOpen);closeSearch();openDrawer(type,id);return;}
    const favoritePair=event.target.closest('[data-favorite]')?.dataset.favorite;if(favoritePair){event.stopPropagation();const {type,id}=recordFromPair(favoritePair);Store.toggleFavorite(type,id);UI.toast('Favorites updated',entityName(type,id));return;}
    const complete=event.target.closest('[data-complete-task]')?.dataset.completeTask;if(complete){completeTask(complete);return;}
    const drawerTab=event.target.closest('[data-drawer-tab]')?.dataset.drawerTab;if(drawerTab){currentDrawerTab=drawerTab;renderDrawer();return;}
    const deletePair=event.target.closest('[data-delete-record]')?.dataset.deleteRecord;if(deletePair){const {type,id}=recordFromPair(deletePair);deleteRecord(type,id);return;}
    const notePair=event.target.closest('[data-add-drawer-note]')?.dataset.addDrawerNote;if(notePair){const text=$('#drawerNoteText')?.value.trim();if(!text)return;const {type,id}=recordFromPair(notePair);const item=Store.get(type,id);const note=Store.upsert('note',{body:text,fairId:type==='fair'?id:item?.fairId||'',relatedType:type,relatedId:id,author:Store.state.currentUser});Store.log(Store.state.currentUser,`added a note to ${UI.recordTitle(type,item)}.`,'note',note.id,note.fairId);renderDrawer();UI.toast('Note added','Shared production context saved.');return;}
    const talentStatus=event.target.closest('[data-talent-filter]')?.dataset.talentFilter;if(talentStatus){talentFilter=talentStatus;renderTalent();return;}
    const contactType=event.target.closest('[data-contact-filter]')?.dataset.contactFilter;if(contactType){contactFilter=contactType;renderContacts();return;}
    const taskOwner=event.target.closest('[data-task-owner]')?.dataset.taskOwner;if(taskOwner){taskOwnerFilter=taskOwner;renderTasks();return;}
    const fileFair=event.target.closest('[data-file-fair]')?.dataset.fileFair;if(fileFair){fileFairFilter=fileFair;renderFiles();return;}
    const copyPair=event.target.closest('[data-copy-followup]')?.dataset.copyFollowup;if(copyPair){const {type,id}=recordFromPair(copyPair);copyFollowUp(type,id);return;}
    const finishPair=event.target.closest('[data-finish-followup]')?.dataset.finishFollowup;if(finishPair){const {type,id}=recordFromPair(finishPair);finishFollowUp(type,id);return;}
    const dismiss=event.target.closest('[data-dismiss-notification]')?.dataset.dismissNotification;if(dismiss){Store.state.preferences.dismissedNotifications.push(dismiss);Store.save();renderNotifications();return;}
    const openNotification=event.target.closest('[data-open-notification]')?.dataset.openNotification;if(openNotification){const {type,id}=recordFromPair(openNotification);closePopovers();openDrawer(type,id);return;}
    const cycle=event.target.closest('[data-cycle-issue]')?.dataset.cycleIssue;if(cycle){const issue=Store.get('issue',cycle);const before={...issue};issue.status={Open:'Monitoring',Monitoring:'Resolved',Resolved:'Open'}[issue.status]||'Open';issue.updatedAt=Store.nowISO();Store.log(Store.state.currentUser,`changed issue “${issue.title}” to ${issue.status}.`,'issue',issue.id,issue.fairId);Store.save();UI.toast('Issue updated',issue.status,()=>{Object.assign(issue,before);Store.save();});return;}
    const dayAction=event.target.closest('[data-day-action]')?.dataset.dayAction;if(dayAction){const [action,id]=dayAction.split(':');if(!id)return;const talent=Store.get('talent',id);if(action==='ready'){talent.status='Ready';}if(action==='complete'){talent.status='Ready';talent.dayOfStatus='Complete';}if(action==='checkin'){talent.dayOfStatus='Checked In';}talent.updatedAt=Store.nowISO();Store.log(Store.state.currentUser,`${action==='checkin'?'checked in':action==='complete'?'completed':'marked ready'} ${talent.name}.`,'talent',talent.id,talent.fairId);Store.save();UI.toast('Day-of status updated',`${talent.name} · ${talent.dayOfStatus||talent.status}`);return;}
    const switchUser=event.target.closest('[data-switch-user]')?.dataset.switchUser;if(switchUser){Store.setCurrentUser(switchUser);selectedLoginUser=switchUser;closePopovers();UI.toast(`Viewing as ${switchUser}`,'Production Board priorities updated.');return;}
    const action=event.target.closest('[data-action]')?.dataset.action;if(action==='export'){const date=todayISO();UI.download(`oatf-os-production-backup-${date}.json`,Store.exportData());UI.toast('Backup exported','Production data downloaded.');closePopovers();return;}if(action==='import'){$('#importInput').click();closePopovers();return;}
  });

  document.addEventListener('change',event=>{
    if(event.target.id==='taskFairSelect'){taskFairFilter=event.target.value;renderTasks();}
  });
  $('#importInput').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{Store.importData(await file.text());UI.toast('Backup restored','Production Board data imported.');}catch(error){alert(error.message);}event.target.value='';});

  window.addEventListener('oatf:saving',()=>{$('#saveState').classList.add('saving');$('#saveState b').textContent='Saving';});
  window.addEventListener('oatf:saved',()=>{$('#saveState').classList.remove('saving');$('#saveState b').textContent='Saved';queueRender();});
  Store.subscribe(queueRender);

  document.addEventListener('keydown',event=>{
    const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
    if(event.key==='Escape'){closeSearch();UI.closeModal();closeDrawer();closePopovers();$('#sidebar').classList.remove('open');$('#scrim').classList.remove('open');return;}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();return;}
    if(typing)return;
    if(event.key==='/'){event.preventDefault();openSearch();return;}
    if(event.key.toLowerCase()==='n'){event.preventDefault();openCreate('task');return;}
    if(event.key.toLowerCase()==='p'){event.preventDefault();openCreate('talent');return;}
    if(event.key.toLowerCase()==='c'){event.preventDefault();openCreate('contact');return;}
    if(event.key.toLowerCase()==='g'){keyboardChord='g';clearTimeout(keyboardChordTimer);keyboardChordTimer=setTimeout(()=>keyboardChord='',1000);return;}
    if(keyboardChord==='g'){
      const key=event.key.toLowerCase();keyboardChord='';
      if(key==='t')showView('tasks');if(key==='f')showView('fairs');if(key==='c')showView('contacts');if(key==='m')showView('mywork');
    }
  });

  setInterval(()=>{const clock=$('#stageClock');if(clock)clock.textContent=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date());},30000);

  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});

  renderAll();
  if(sessionStorage.getItem(Store.SESSION_KEY)==='1') enterBoard();
})();
