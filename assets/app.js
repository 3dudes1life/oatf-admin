(() => {
  'use strict';

  const STORAGE_KEY = 'oatf-admin-v001';
  const SESSION_KEY = 'oatf-admin-session';

  const seed = {
    season: 2027,
    fairs: [
      {id:'river', name:'Riverside County Fair', short:'Riverside', month:'February 2027', venue:'National Date Festival', city:'Indio, CA', status:'On track', progress:82},
      {id:'sd', name:'San Diego County Fair', short:'San Diego', month:'June 2027', venue:'Del Mar Fairgrounds', city:'Del Mar, CA', status:'Needs review', progress:61},
      {id:'oc', name:'Orange County Fair', short:'Orange County', month:'July 2027', venue:'OC Fair & Event Center', city:'Costa Mesa, CA', status:'Waiting on fair', progress:49}
    ],
    tasks: [
      {id:1,title:'Finalize Plaza Stage schedule',description:'Confirm timing with fair entertainment team.',fair:'Orange County',owner:'Spencer',due:'Tomorrow',status:'todo',priority:'High'},
      {id:2,title:'Send performer offer letters',description:'Use updated family-friendly contract language.',fair:'San Diego',owner:'William',due:'Jul 22',status:'todo',priority:'High'},
      {id:3,title:'Update presenting sponsor deck',description:'Add Fantasy Springs activation ideas.',fair:'Riverside',owner:'William',due:'Jul 24',status:'progress',priority:'Medium'},
      {id:4,title:'Confirm Glam Show lineup',description:'Three performers pending final confirmation.',fair:'Orange County',owner:'Spencer',due:'Jul 25',status:'progress',priority:'High'},
      {id:5,title:'Approve stage footprint',description:'Waiting on fair production department.',fair:'San Diego',owner:'Fair Partner',due:'Waiting 3 days',status:'waiting',priority:'Medium'},
      {id:6,title:'Confirm load-in parking',description:'Need vehicle access and credentials.',fair:'Orange County',owner:'Fair Partner',due:'Waiting 5 days',status:'waiting',priority:'High'},
      {id:7,title:'Fair agreement signed',description:'Final executed agreement uploaded.',fair:'Riverside',owner:'William',due:'Jul 14',status:'complete',priority:'High'},
      {id:8,title:'Reserve OATF stage branding',description:'Backdrop and pennants allocated.',fair:'San Diego',owner:'Spencer',due:'Jul 11',status:'complete',priority:'Medium'}
    ],
    talent: [
      {id:1,name:'Golden State Squares',type:'Dance performance',fair:'Orange County',status:'Contracted',fee:'—',music:'Received',owner:'Spencer'},
      {id:2,name:'Summer Daze',type:'Story Time + Glam Show',fair:'Orange County',status:'Offered',fee:'200',music:'Pending',owner:'William'},
      {id:3,name:'Ross Alan',type:'Live music',fair:'San Diego',status:'Contracted',fee:'—',music:'Received',owner:'Spencer'},
      {id:4,name:'Nicole & Scotty',type:'Live music',fair:'San Diego',status:'Reviewing',fee:'—',music:'Not requested',owner:'William'},
      {id:5,name:'Hashtag Truly',type:'Live performance',fair:'Riverside',status:'Submitted',fee:'—',music:'Not requested',owner:'Spencer'}
    ],
    deadlines: [
      {id:1,date:'2026-07-18',title:'OC schedule review',fair:'Orange County'},
      {id:2,date:'2026-07-22',title:'SD offers due',fair:'San Diego'},
      {id:3,date:'2026-07-25',title:'Glam Show lineup',fair:'Orange County'}
    ],
    files: [
      {id:1,name:'OC_Fair_2027_Run_of_Show_v3.pdf',type:'PDF',folder:'Stage & Production',fair:'Orange County',owner:'Spencer',updated:'18 min ago'},
      {id:2,name:'Family_Friendly_Talent_Agreement.docx',type:'DOC',folder:'Shared Templates',fair:'All fairs',owner:'William',updated:'Yesterday'},
      {id:3,name:'OATF_2027_Stage_Backdrop.png',type:'PNG',folder:'Brand & Marketing',fair:'All fairs',owner:'William',updated:'Jul 16'}
    ],
    notes: [
      {id:1,fair:'Orange County',body:'Let’s make sure the Plaza Stage has stronger OATF visual branding this year—flags, pennants, and the full backdrop.',author:'William',created:'Today at 9:42 AM'}
    ],
    issues: [
      {id:1,title:'Performer parking credential missing',status:'Open',owner:'Spencer',created:'8 min ago'},
      {id:2,title:'Stage-left monitor adjustment',status:'Resolved',owner:'Production',created:'22 min ago'}
    ],
    activity: [
      {id:1,actor:'Spencer',action:'moved Golden State Squares from “Offered” to “Contracted.”',context:'Orange County Fair · Talent',time:'18 min ago'},
      {id:2,actor:'William',action:'approved OATF_2027_Stage_Backdrop.png.',context:'Brand & Marketing',time:'1 hr ago'},
      {id:3,actor:'OC Fair Partner',action:'commented on Plaza Stage load-in.',context:'Orange County Fair · Task #128',time:'Yesterday'},
      {id:4,actor:'Spencer',action:'uploaded OC_Fair_2027_Run_of_Show_v3.pdf.',context:'Orange County Fair · Files',time:'Yesterday'}
    ]
  };

  let state = loadState();
  let currentMonth = new Date(2026, 6, 1);
  let taskFairFilter = 'all';
  let taskOwnerFilter = 'All owners';

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seed);
    } catch {
      return structuredClone(seed);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    refreshAll();
  }

  function nextId(list) {
    return Math.max(0, ...list.map(item => Number(item.id) || 0)) + 1;
  }

  function logActivity(actor, action, context) {
    state.activity.unshift({
      id: nextId(state.activity),
      actor,
      action,
      context,
      time: 'Just now'
    });
  }

  window.enterPortal = function enterPortal() {
    document.getElementById('login')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    sessionStorage.setItem(SESSION_KEY, '1');
    refreshAll();
  };

  const titles = {
    overview:'Command Center', fairs:'Fair Workspaces', fairdetail:'Fair Workspace',
    tasks:'Task Board', talent:'Talent Pipeline', calendar:'Production Calendar',
    files:'Files & Assets', activity:'Activity Log', dayof:'Day-of Command'
  };

  window.showView = function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById(id)?.classList.add('active-view');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === id));
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = titles[id] || 'OATF Admin';
    document.querySelector('.sidebar')?.classList.remove('open');
    window.scrollTo({top:0, behavior:'smooth'});
    history.replaceState(null, '', `#${id}`);
  };

  window.openFair = function openFair(name) {
    document.getElementById('fairTitle').textContent = name;
    showView('fairdetail');
  };

  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => showView(el.dataset.view));
  });

  // Mobile navigation
  const mobileMenu = document.querySelector('.mobile-menu');
  mobileMenu?.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('open'));

  // ---------- Modal system ----------
  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.innerHTML = `
    <div class="admin-modal-card" role="dialog" aria-modal="true">
      <div class="admin-modal-head">
        <div><span class="kicker" id="modalKicker">Create</span><h2 id="modalTitle">New item</h2></div>
        <button class="modal-close" aria-label="Close">×</button>
      </div>
      <form id="modalForm"><div id="modalFields" class="form-grid"></div><div class="modal-actions"><button type="button" class="ghost modal-cancel">Cancel</button><button class="primary" type="submit">Save</button></div></form>
    </div>`;
  document.body.appendChild(modal);

  let modalSubmit = null;
  const field = (name, label, type='text', options=[]) => {
    if (type === 'select') {
      return `<label><span>${label}</span><select name="${name}" required>${options.map(x => `<option>${x}</option>`).join('')}</select></label>`;
    }
    if (type === 'textarea') {
      return `<label class="full-field"><span>${label}</span><textarea name="${name}" required></textarea></label>`;
    }
    return `<label><span>${label}</span><input name="${name}" type="${type}" required></label>`;
  };

  function openModal({kicker='Create', title, fields, submit}) {
    document.getElementById('modalKicker').textContent = kicker;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalFields').innerHTML = fields;
    modalSubmit = submit;
    modal.classList.add('open');
    setTimeout(() => modal.querySelector('input,select,textarea')?.focus(), 0);
  }

  function closeModal() {
    modal.classList.remove('open');
    document.getElementById('modalForm').reset();
    modalSubmit = null;
  }

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  modal.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    modalSubmit?.(data);
    closeModal();
  });

  // ---------- Toast ----------
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  document.body.appendChild(toast);
  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ---------- Action buttons ----------
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'new-task') {
      openModal({
        title:'New task',
        fields:[
          field('title','Task title'),
          field('fair','Fair','select',['Riverside','San Diego','Orange County']),
          field('owner','Owner','select',['William','Spencer','Fair Partner']),
          field('due','Due date'),
          field('priority','Priority','select',['High','Medium','Low']),
          field('description','Description','textarea')
        ].join(''),
        submit:data => {
          state.tasks.push({...data,id:nextId(state.tasks),status:'todo'});
          logActivity('William', `created task “${data.title}.”`, `${data.fair} · Tasks`);
          saveState(); notify('Task created');
        }
      });
    }

    if (action === 'add-talent') {
      openModal({
        title:'Add talent',
        fields:[
          field('name','Talent name'),
          field('type','Performance type'),
          field('fair','Fair','select',['Riverside','San Diego','Orange County']),
          field('status','Status','select',['Submitted','Reviewing','Offered','Contracted','Ready']),
          field('fee','Fee'),
          field('music','Music','select',['Not requested','Pending','Received']),
          field('owner','Owner','select',['William','Spencer'])
        ].join(''),
        submit:data => {
          state.talent.push({...data,id:nextId(state.talent)});
          logActivity('William', `added ${data.name} to the talent pipeline.`, `${data.fair} · Talent`);
          saveState(); notify('Talent added');
        }
      });
    }

    if (action === 'create-fair') {
      openModal({
        title:'Create fair workspace',
        fields:[
          field('name','Fair name'),
          field('short','Short name'),
          field('month','Event month'),
          field('venue','Venue'),
          field('city','City'),
          field('status','Status','select',['Planning','On track','Needs review','Waiting on fair'])
        ].join(''),
        submit:data => {
          state.fairs.push({...data,id:`fair-${Date.now()}`,progress:10});
          logActivity('William', `created the ${data.name} workspace.`, 'Fair Workspaces');
          saveState(); notify('Fair workspace created');
        }
      });
    }

    if (action === 'add-deadline') {
      openModal({
        title:'Add deadline',
        fields:[
          field('title','Deadline title'),
          field('date','Date','date'),
          field('fair','Fair','select',['Riverside','San Diego','Orange County','All fairs'])
        ].join(''),
        submit:data => {
          state.deadlines.push({...data,id:nextId(state.deadlines)});
          logActivity('William', `added deadline “${data.title}.”`, `${data.fair} · Calendar`);
          saveState(); notify('Deadline added');
        }
      });
    }

    if (action === 'add-file') {
      openModal({
        title:'Add file record',
        kicker:'Local demo',
        fields:[
          field('name','File name'),
          field('type','File type','select',['PDF','DOC','PNG','JPG','XLS','ZIP']),
          field('folder','Folder','select',['2027 Fair Agreements','Talent Contracts','Stage & Production','Brand & Marketing','Shared Templates']),
          field('fair','Fair','select',['All fairs','Riverside','San Diego','Orange County']),
          field('owner','Owner','select',['William','Spencer','Fair Partner'])
        ].join(''),
        submit:data => {
          state.files.unshift({...data,id:nextId(state.files),updated:'Just now'});
          logActivity(data.owner, `added ${data.name}.`, `${data.folder} · Files`);
          saveState(); notify('File record added');
        }
      });
    }

    if (action === 'log-issue') {
      openModal({
        title:'Log live issue',
        fields:[
          field('title','Issue'),
          field('owner','Assign to','select',['William','Spencer','Production','Fair Partner']),
          field('status','Status','select',['Open','Monitoring','Resolved'])
        ].join(''),
        submit:data => {
          state.issues.unshift({...data,id:nextId(state.issues),created:'Just now'});
          logActivity('William', `logged live issue “${data.title}.”`, 'Day-of Command');
          saveState(); notify('Issue logged');
        }
      });
    }

    if (action === 'post-note') {
      const textarea = event.target.closest('.panel')?.querySelector('textarea');
      const body = textarea?.value.trim();
      if (!body) return notify('Write a note first');
      state.notes.unshift({id:nextId(state.notes),fair:document.getElementById('fairTitle')?.textContent || 'Shared',body,author:'William',created:'Just now'});
      logActivity('William', 'posted a shared note.', `${state.notes[0].fair} · Notes`);
      textarea.value = '';
      saveState(); notify('Note posted');
    }

    if (action === 'publish-update') notify('Publishing is staged for connection later');
    if (action === 'preview-page') window.open('https://outatthefair.com', '_blank', 'noopener');
  });

  // ---------- Tasks ----------
  const statusMeta = {
    todo:['To do','todo'], progress:['In progress','progress'],
    waiting:['Waiting','waiting'], complete:['Complete','complete']
  };

  function ownerInitial(owner) {
    return owner === 'Spencer' ? 'S' : owner === 'Fair Partner' ? 'F' : 'W';
  }

  function ownerClass(owner) {
    return owner === 'Spencer' ? 'purple' : owner === 'Fair Partner' ? 'gold' : '';
  }

  function fairClass(fair) {
    return fair === 'Orange County' ? 'oc' : fair === 'San Diego' ? 'sd' : 'river';
  }

  function renderTasks() {
    const board = document.getElementById('taskBoard');
    if (!board) return;

    board.innerHTML = Object.entries(statusMeta).map(([status,[label]]) => {
      const tasks = state.tasks.filter(t =>
        t.status === status &&
        (taskFairFilter === 'all' || t.fair === taskFairFilter) &&
        (taskOwnerFilter === 'All owners' || t.owner === taskOwnerFilter)
      );
      return `<div class="column" data-status="${status}">
        <div class="column-head"><b>${label}</b><span>${tasks.length}</span></div>
        <div class="task-dropzone">
          ${tasks.map(t => `<article class="task-card ${status === 'complete' ? 'complete' : ''}" draggable="true" data-task-id="${t.id}">
            <div class="task-card-top"><span class="tag ${fairClass(t.fair)}">${t.fair}</span><button class="card-menu" data-task-delete="${t.id}" aria-label="Delete task">•••</button></div>
            <h4>${escapeHTML(t.title)}</h4>
            <p>${escapeHTML(t.description)}</p>
            <div><span class="avatar xs ${ownerClass(t.owner)}">${ownerInitial(t.owner)}</span><time>${escapeHTML(t.due)}</time></div>
          </article>`).join('')}
        </div>
      </div>`;
    }).join('');

    board.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', () => card.classList.add('dragging'));
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    board.querySelectorAll('.column').forEach(column => {
      column.addEventListener('dragover', e => e.preventDefault());
      column.addEventListener('drop', e => {
        e.preventDefault();
        const card = board.querySelector('.dragging');
        if (!card) return;
        const task = state.tasks.find(t => String(t.id) === card.dataset.taskId);
        if (!task) return;
        task.status = column.dataset.status;
        logActivity('William', `moved “${task.title}” to ${statusMeta[task.status][0]}.`, `${task.fair} · Tasks`);
        saveState();
        notify('Task moved');
      });
    });
  }

  document.addEventListener('click', e => {
    const id = e.target.closest('[data-task-delete]')?.dataset.taskDelete;
    if (!id) return;
    const task = state.tasks.find(t => String(t.id) === id);
    if (!task || !confirm(`Delete “${task.title}”?`)) return;
    state.tasks = state.tasks.filter(t => String(t.id) !== id);
    saveState(); notify('Task deleted');
  });

  document.querySelectorAll('[data-task-fair]').forEach(btn => {
    btn.addEventListener('click', () => {
      taskFairFilter = btn.dataset.taskFair;
      document.querySelectorAll('[data-task-fair]').forEach(x => x.classList.toggle('active', x === btn));
      renderTasks();
    });
  });

  document.getElementById('taskOwnerFilter')?.addEventListener('change', e => {
    taskOwnerFilter = e.target.value;
    renderTasks();
  });

  // ---------- Talent ----------
  function statusClass(status) {
    return ({Contracted:'green',Ready:'green',Offered:'yellow',Reviewing:'cyan',Submitted:'pink'})[status] || 'cyan';
  }

  function renderTalent() {
    const table = document.getElementById('talentTable');
    if (!table) return;
    table.innerHTML = `<div class="table-head"><span>Talent</span><span>Fair</span><span>Status</span><span>Fee</span><span>Music</span><span>Owner</span></div>` +
      state.talent.map(t => `<div data-talent-id="${t.id}">
        <span><b>${escapeHTML(t.name)}</b><small>${escapeHTML(t.type)}</small></span>
        <span>${escapeHTML(t.fair)}</span>
        <span><button class="pill ${statusClass(t.status)} talent-status" data-talent-status="${t.id}">${escapeHTML(t.status)}</button></span>
        <span>${t.fee === '—' ? '$—' : `$${escapeHTML(t.fee)}`}</span>
        <span>${escapeHTML(t.music)}</span>
        <span class="avatar xs ${ownerClass(t.owner)}">${ownerInitial(t.owner)}</span>
      </div>`).join('');

    const counts = ['Submitted','Reviewing','Offered','Contracted','Ready'].map(status => ({
      status, count: state.talent.filter(t => t.status === status).length
    }));
    const strip = document.getElementById('pipelineStrip');
    if (strip) strip.innerHTML = counts.map(x => `<span>${x.status} <b>${x.count}</b></span>`).join('');
  }

  document.addEventListener('click', e => {
    const id = e.target.closest('[data-talent-status]')?.dataset.talentStatus;
    if (!id) return;
    const talent = state.talent.find(t => String(t.id) === id);
    const statuses = ['Submitted','Reviewing','Offered','Contracted','Ready'];
    talent.status = statuses[(statuses.indexOf(talent.status) + 1) % statuses.length];
    logActivity('William', `moved ${talent.name} to ${talent.status}.`, `${talent.fair} · Talent`);
    saveState(); notify(`Talent moved to ${talent.status}`);
  });

  // ---------- Calendar ----------
  function renderCalendar() {
    const title = document.getElementById('calendarTitle');
    const days = document.getElementById('days');
    if (!title || !days) return;

    title.textContent = currentMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    days.innerHTML = '';

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year,month,1).getDay();
    const count = new Date(year,month+1,0).getDate();
    const prevCount = new Date(year,month,0).getDate();

    const cells = [];
    for (let i=firstDay-1;i>=0;i--) cells.push({n:prevCount-i,muted:true,date:new Date(year,month-1,prevCount-i)});
    for (let i=1;i<=count;i++) cells.push({n:i,date:new Date(year,month,i)});
    while (cells.length % 7) {
      const n = cells.length - firstDay - count + 1;
      cells.push({n,muted:true,date:new Date(year,month+1,n)});
    }

    cells.forEach(cell => {
      const div = document.createElement('div');
      if (cell.muted) div.className = 'muted-day';
      const iso = localISO(cell.date);
      const events = state.deadlines.filter(d => d.date === iso);
      div.innerHTML = `<b>${cell.n}</b>${events.map(evt => `<button class="event-chip" data-deadline-id="${evt.id}">${escapeHTML(evt.title)}</button>`).join('')}`;
      days.appendChild(div);
    });
  }

  document.getElementById('calendarPrev')?.addEventListener('click', () => {
    currentMonth = new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);
    renderCalendar();
  });
  document.getElementById('calendarNext')?.addEventListener('click', () => {
    currentMonth = new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);
    renderCalendar();
  });

  // ---------- Files ----------
  function renderFiles() {
    const container = document.getElementById('recentFiles');
    if (!container) return;
    container.innerHTML = `<div class="panel-head"><div><span class="kicker">Recently updated</span><h3>Files</h3></div><span class="demo-storage">Local demo records</span></div>` +
      state.files.map(f => `<div class="file-row">
        <span>${escapeHTML(f.type)}</span>
        <p><b>${escapeHTML(f.name)}</b><small>${escapeHTML(f.fair)} · ${escapeHTML(f.folder)} · Added by ${escapeHTML(f.owner)}</small></p>
        <time>${escapeHTML(f.updated)}</time>
      </div>`).join('');
  }

  // ---------- Activity ----------
  function renderActivity() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    feed.innerHTML = state.activity.map(item => `<div>
      <span class="avatar sm ${item.actor.includes('Spencer') ? 'purple' : item.actor.includes('Partner') ? 'gold' : ''}">${escapeHTML(item.actor[0])}</span>
      <p><b>${escapeHTML(item.actor)}</b> ${escapeHTML(item.action)}<small>${escapeHTML(item.context)}</small></p>
      <time>${escapeHTML(item.time)}</time>
    </div>`).join('');
  }

  // ---------- Fair workspaces ----------
  function renderFairs() {
    const cards = document.querySelector('.workspace-cards');
    if (!cards) return;
    cards.innerHTML = state.fairs.map(f => `<article class="workspace-card ${f.id === 'river' ? 'river-card' : f.id === 'sd' ? 'sd-card' : f.id === 'oc' ? 'oc-card' : 'new-fair-card'}" data-open-fair="${escapeHTML(f.name)}">
      <div class="workspace-top"><span class="pill ${f.progress > 70 ? 'green' : f.progress > 50 ? 'yellow' : 'pink'}">${escapeHTML(f.status)}</span><b>${f.progress}%</b></div>
      <div><span class="kicker">${escapeHTML(f.month)}</span><h3>${escapeHTML(f.name)}</h3><p>${escapeHTML(f.venue)} · ${escapeHTML(f.city)}</p></div>
      <div class="workspace-stats"><span><b>${state.tasks.filter(t=>t.fair===f.short).length}</b> tasks</span><span><b>${state.talent.filter(t=>t.fair===f.short).length}</b> talent</span><span><b>${state.files.filter(x=>x.fair===f.short || x.fair==='All fairs').length}</b> files</span></div>
    </article>`).join('');
  }

  document.addEventListener('click', e => {
    const name = e.target.closest('[data-open-fair]')?.dataset.openFair;
    if (name) openFair(name);
  });

  // ---------- Notes ----------
  function renderNotes() {
    const panel = document.querySelector('#fairdetail .note-box');
    if (!panel) return;
    const latest = state.notes[0];
    if (!latest) return;
    panel.innerHTML = `<p>“${escapeHTML(latest.body)}”</p><span>${escapeHTML(latest.author)} · ${escapeHTML(latest.created)}</span>`;
  }

  // ---------- Day-of issues ----------
  function renderIssues() {
    const urgentPanel = [...document.querySelectorAll('#dayof .panel')].find(p => p.textContent.includes('Live issues'));
    if (!urgentPanel) return;
    urgentPanel.querySelectorAll('.issue').forEach(x => x.remove());
    state.issues.forEach(issue => {
      const div = document.createElement('div');
      div.className = 'issue';
      div.innerHTML = `<button class="pill ${issue.status === 'Resolved' ? 'green' : issue.status === 'Monitoring' ? 'cyan' : 'yellow'}" data-issue-id="${issue.id}">${escapeHTML(issue.status)}</button><p><b>${escapeHTML(issue.title)}</b><small>Assigned to ${escapeHTML(issue.owner)} · ${escapeHTML(issue.created)}</small></p>`;
      urgentPanel.appendChild(div);
    });
  }

  document.addEventListener('click', e => {
    const id = e.target.closest('[data-issue-id]')?.dataset.issueId;
    if (!id) return;
    const issue = state.issues.find(i => String(i.id) === id);
    const statuses = ['Open','Monitoring','Resolved'];
    issue.status = statuses[(statuses.indexOf(issue.status)+1)%statuses.length];
    saveState(); notify(`Issue marked ${issue.status}`);
  });

  // ---------- Global search + command palette ----------
  const palette = document.createElement('div');
  palette.className = 'command-palette';
  palette.innerHTML = `<div class="command-card"><div class="command-search"><span>⌕</span><input placeholder="Search fairs, tasks, talent, and files…" aria-label="Global search"><kbd>ESC</kbd></div><div class="command-results"></div><div class="command-foot"><span>⌘/Ctrl + K to open</span><span>Local demo search</span></div></div>`;
  document.body.appendChild(palette);

  const searchInput = palette.querySelector('input');
  const results = palette.querySelector('.command-results');

  function openPalette() {
    palette.classList.add('open');
    searchInput.value = '';
    renderSearch('');
    setTimeout(() => searchInput.focus(), 0);
  }
  function closePalette() { palette.classList.remove('open'); }

  function renderSearch(query) {
    const q = query.trim().toLowerCase();
    const rows = [];
    state.fairs.forEach(f => rows.push({type:'Fair',title:f.name,meta:`${f.month} · ${f.status}`,view:'fairs'}));
    state.tasks.forEach(t => rows.push({type:'Task',title:t.title,meta:`${t.fair} · ${t.owner} · ${statusMeta[t.status][0]}`,view:'tasks'}));
    state.talent.forEach(t => rows.push({type:'Talent',title:t.name,meta:`${t.fair} · ${t.status}`,view:'talent'}));
    state.files.forEach(f => rows.push({type:'File',title:f.name,meta:`${f.folder} · ${f.fair}`,view:'files'}));
    const filtered = rows.filter(row => !q || `${row.type} ${row.title} ${row.meta}`.toLowerCase().includes(q)).slice(0,12);
    results.innerHTML = filtered.length ? filtered.map(row => `<button data-search-view="${row.view}"><span>${row.type}</span><b>${escapeHTML(row.title)}</b><small>${escapeHTML(row.meta)}</small></button>`).join('') : `<div class="empty-state">No matches found.</div>`;
  }

  searchInput.addEventListener('input', e => renderSearch(e.target.value));
  palette.addEventListener('click', e => { if (e.target === palette) closePalette(); });
  document.addEventListener('click', e => {
    const view = e.target.closest('[data-search-view]')?.dataset.searchView;
    if (view) { showView(view); closePalette(); }
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); openPalette();
    }
    if (e.key === 'Escape') { closePalette(); closeModal(); }
  });

  // Add top action buttons.
  const topActions = document.querySelector('.top-actions');
  if (topActions) {
    const tools = document.createElement('div');
    tools.className = 'admin-tools';
    tools.innerHTML = `<button class="icon-tool" id="globalSearch" title="Search (⌘K)">⌕</button><button class="icon-tool" id="backupMenu" title="Backup and settings">⚙</button>`;
    topActions.prepend(tools);
    document.getElementById('globalSearch').addEventListener('click', openPalette);
    document.getElementById('backupMenu').addEventListener('click', openSettings);
  }

  // ---------- Backup/settings ----------
  function openSettings() {
    openModal({
      kicker:'Local workspace',
      title:'Backup & settings',
      fields:`<div class="settings-actions full-field">
        <button type="button" class="ghost" id="exportData">Export JSON backup</button>
        <label class="ghost file-import">Import JSON backup<input type="file" id="importData" accept=".json,application/json"></label>
        <button type="button" class="danger-button" id="resetData">Reset demo data</button>
        <p>Everything in V0.01 is stored only in this browser using localStorage. Export backups before clearing browser data.</p>
      </div>`,
      submit:() => {}
    });
    modal.querySelector('.modal-actions').style.display = 'none';

    document.getElementById('exportData').onclick = () => {
      const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `oatf-admin-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    };

    document.getElementById('importData').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state = JSON.parse(await file.text());
        saveState(); closeModal(); notify('Backup imported');
      } catch {
        notify('That backup could not be read');
      }
    };

    document.getElementById('resetData').onclick = () => {
      if (!confirm('Reset all local dashboard data?')) return;
      state = structuredClone(seed);
      saveState(); closeModal(); notify('Demo data reset');
    };
  }

  // ---------- Helpers ----------
  function localISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function escapeHTML(value='') {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  }

  function refreshMetrics() {
    const metrics = document.querySelectorAll('.metric strong');
    if (metrics.length >= 4) {
      metrics[0].textContent = state.tasks.filter(t => t.status !== 'complete').length;
      metrics[1].textContent = state.talent.length;
      metrics[2].textContent = state.tasks.filter(t => t.status === 'waiting').length;
      metrics[3].textContent = state.files.length;
    }
  }

  function refreshAll() {
    renderTasks();
    renderTalent();
    renderCalendar();
    renderFiles();
    renderActivity();
    renderFairs();
    renderNotes();
    renderIssues();
    refreshMetrics();
  }

  // Auto-enter after the first demo login during the tab session.
  if (sessionStorage.getItem(SESSION_KEY) === '1') enterPortal();

  const initialView = location.hash.replace('#','');
  if (initialView && document.getElementById(initialView)) showView(initialView);

  refreshAll();
})();