(() => {
  'use strict';

  const Store = window.OATFStore;
  const Intel = window.OATFIntel;
  const UI = window.OATFUI;
  if (!Store || !Intel || !UI) return;

  const $ = selector => document.querySelector(selector);
  const esc = UI.esc;
  const clone = Store.clone;
  const todayISO = () => new Date().toISOString().slice(0,10);
  const addDays = days => {
    const date = new Date();
    date.setDate(date.getDate()+days);
    return date.toISOString().slice(0,10);
  };
  const stamp = () => Store.nowISO();

  const TRACKED_TYPES = new Set(['fair','contact','talent','task','schedule','deadline','file','note','issue','handoff']);

  const MODES = [
    {
      id:'planning',label:'Planning',icon:'◇',
      description:'Balanced view for building fair workspaces and moving production forward.',
      view:'today',lens:'exceptions',density:'comfortable'
    },
    {
      id:'lock',label:'Production Lock',icon:'▣',
      description:'Compact exception-first mode for schedule, materials, and critical readiness.',
      view:'control',lens:'exceptions',density:'compact'
    },
    {
      id:'dayof',label:'Day-of',icon:'⚡',
      description:'Live production mode with stage status, check-in, issues, and handoffs.',
      view:'dayof',lens:'open-issues',density:'compact'
    },
    {
      id:'closeout',label:'Closeout',icon:'✓',
      description:'Resolve issues, preserve notes, and finish production records after the event.',
      view:'orchestration',lens:'open-issues',density:'comfortable'
    }
  ];

  const RULES = [
    {
      id:'critical-overdue',name:'Critical overdue work',icon:'!',
      description:'Alert when a High-priority or High-impact task passes its due date.',
      severity:'critical',
      evaluate(){
        return Store.state.tasks
          .filter(task => task.status!=='complete' && Intel.daysUntil(task.due)<0 && (task.priority==='High'||task.impact==='High'))
          .map(task => ({
            key:`critical-overdue:${task.id}`,fairId:task.fairId,entityType:'task',entityId:task.id,
            title:`${task.title} is critically overdue`,
            detail:`${Math.abs(Intel.daysUntil(task.due))} day(s) past due. Production should reassign, complete, or reset the deadline.`
          }));
      }
    },
    {
      id:'dependency-ready',name:'Dependency unlocked',icon:'→',
      description:'Alert when a task dependency is complete and the next task is ready to begin.',
      severity:'info',
      evaluate(){
        return Store.state.tasks
          .filter(task => task.status!=='complete' && task.dependsOnTaskId)
          .filter(task => Store.get('task',task.dependsOnTaskId)?.status==='complete')
          .map(task => ({
            key:`dependency-ready:${task.id}`,fairId:task.fairId,entityType:'task',entityId:task.id,
            title:`${task.title} is now available`,
            detail:`Its prerequisite is complete. This task can move into production.`
          }));
      }
    },
    {
      id:'missing-materials',name:'Contracted talent materials',icon:'◉',
      description:'Alert when contracted or ready talent is missing required production materials.',
      severity:'critical',
      evaluate(){
        return Store.state.talent
          .filter(talent => ['Contracted','Ready'].includes(talent.status))
          .map(talent => ({talent,missing:Intel.talentMissing(talent)}))
          .filter(item => item.missing.length)
          .map(({talent,missing}) => ({
            key:`missing-materials:${talent.id}:${missing.sort().join('-')}`,fairId:talent.fairId,entityType:'talent',entityId:talent.id,
            title:`${talent.name} is missing production material`,
            detail:`Missing: ${missing.join(', ')}.`
          }));
      }
    },
    {
      id:'followup-due',name:'Follow-up due',icon:'↗',
      description:'Alert when a contact follow-up is due or overdue.',
      severity:'warning',
      evaluate(){
        return Store.state.contacts
          .filter(contact => contact.nextFollowUp && Intel.daysUntil(contact.nextFollowUp)<=0 && contact.status!=='Active')
          .map(contact => ({
            key:`followup-due:${contact.id}:${contact.nextFollowUp}`,fairId:contact.fairIds?.[0]||'',entityType:'contact',entityId:contact.id,
            title:`Follow up with ${contact.name}`,
            detail:`Follow-up ${Intel.daysUntil(contact.nextFollowUp)<0?'overdue':'due today'} · ${contact.organization || contact.role || 'Production contact'}.`
          }));
      }
    },
    {
      id:'schedule-risk',name:'Run-of-show risk',icon:'≡',
      description:'Alert when overlaps, short transitions, or other schedule warnings are detected.',
      severity:'warning',
      evaluate(){
        return Store.state.fairs.flatMap(fair =>
          Intel.scheduleIssues(fair.id)
            .filter(issue => issue.severity!=='info')
            .map(issue => ({
              key:`schedule-risk:${fair.id}:${issue.id}`,fairId:fair.id,entityType:'schedule',entityId:issue.slotId||'',
              title:`${fair.short}: ${issue.title}`,
              detail:issue.body
            }))
        );
      }
    },
    {
      id:'stale-work',name:'Stale active work',icon:'◷',
      description:'Alert when incomplete work has not changed for 14 days.',
      severity:'warning',
      evaluate(){
        const cutoff = Date.now()-(14*86400000);
        return Store.state.tasks
          .filter(task => task.status!=='complete' && new Date(task.updatedAt||task.createdAt||0).getTime()<cutoff)
          .map(task => ({
            key:`stale-work:${task.id}`,fairId:task.fairId,entityType:'task',entityId:task.id,
            title:`${task.title} has gone stale`,
            detail:'No production update has been recorded in at least 14 days.'
          }));
      }
    },
    {
      id:'high-issue',name:'High-severity issue',icon:'⚠',
      description:'Alert while a high-severity production issue remains unresolved.',
      severity:'critical',
      evaluate(){
        return Store.state.issues
          .filter(issue => issue.status!=='Resolved' && issue.severity==='High')
          .map(issue => ({
            key:`high-issue:${issue.id}`,fairId:issue.fairId,entityType:'issue',entityId:issue.id,
            title:`High-severity issue: ${issue.title}`,
            detail:issue.detail || issue.description || 'Production escalation required.'
          }));
      }
    },
    {
      id:'handoff-gap',name:'Handoff continuity',icon:'↻',
      description:'Alert when an active fair has no recent Production handoff.',
      severity:'info',
      evaluate(){
        return Store.state.fairs
          .filter(fair => Intel.daysUntil(fair.date)>=0)
          .filter(fair => {
            const latest = Store.state.handoffs.filter(item=>item.fairId===fair.id)
              .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
            return !latest || Date.now()-new Date(latest.createdAt).getTime()>7*86400000;
          })
          .map(fair => ({
            key:`handoff-gap:${fair.id}:${new Date().toISOString().slice(0,10)}`,fairId:fair.id,entityType:'fair',entityId:fair.id,
            title:`${fair.short} needs a current handoff`,
            detail:'No Production handoff has been saved in the last seven days.'
          }));
      }
    }
  ];

  let suppressRevisions = false;
  let scanTimer = null;
  let runningScan = false;

  function ensureState(){
    const state = Store.state;
    let changed = false;

    if (!Array.isArray(state.alerts)){ state.alerts=[]; changed=true; }
    if (!Array.isArray(state.automations)){ state.automations=[]; changed=true; }
    if (!Array.isArray(state.revisions)){ state.revisions=[]; changed=true; }
    if (!Array.isArray(state.savedViews)){ state.savedViews=[]; changed=true; }

    RULES.forEach(rule => {
      if (!state.automations.some(item=>item.id===rule.id)){
        state.automations.push({
          id:rule.id,enabled:true,action:'alert',lastRun:'',lastMatchCount:0,createdAt:stamp(),updatedAt:stamp()
        });
        changed=true;
      }
    });

    state.preferences.focusMode ||= 'planning';
    state.preferences.osFairId ||= Intel.nextFair()?.id || state.fairs[0]?.id || '';
    state.preferences.automationAutoRun = state.preferences.automationAutoRun !== false;
    state.preferences.historyFairId ||= 'all';
    state.preferences.inboxFilter ||= 'open';

    if (changed) Store.save({immediate:true});
  }

  function collectionFor(type){
    return Store.getCollection(type);
  }

  function fairIdFor(type,record){
    if (!record) return '';
    if (type==='fair') return record.id;
    if (type==='contact') return record.fairIds?.[0] || '';
    return record.fairId || '';
  }

  function recordRevision(type,entityId,before,after,change){
    if (suppressRevisions || !TRACKED_TYPES.has(type)) return;
    Store.state.revisions.unshift({
      id:Store.uid('revision'),
      type,entityId,
      fairId:fairIdFor(type,after||before),
      change,
      before:before ? clone(before) : null,
      after:after ? clone(after) : null,
      actor:'Production',
      timestamp:stamp()
    });
    Store.state.revisions = Store.state.revisions.slice(0,250);
  }

  function installRevisionJournal(){
    if (Store.__kernelWrapped) return;
    Store.__kernelWrapped = true;

    const originalUpsert = Store.upsert.bind(Store);
    const originalRemove = Store.remove.bind(Store);
    const originalRestore = Store.restore.bind(Store);
    Store.__originalUpsert = originalUpsert;
    Store.__originalRemove = originalRemove;

    Store.upsert = function(type,record){
      const before = record?.id ? clone(Store.get(type,record.id)) : null;
      const result = originalUpsert(type,record);
      const after = clone(result);
      recordRevision(type,result.id,before,after,before?'updated':'created');
      Store.save();
      return result;
    };

    Store.remove = function(type,id){
      const before = clone(Store.get(type,id));
      const result = originalRemove(type,id);
      if (result && before) recordRevision(type,id,before,null,'deleted');
      Store.save();
      return result;
    };

    Store.restore = function(type,record,index){
      const before = clone(Store.get(type,record.id));
      const result = originalRestore(type,record,index);
      recordRevision(type,record.id,before,clone(record),'restored');
      Store.save();
      return result;
    };
  }

  function automationSetting(ruleId){
    return Store.state.automations.find(item=>item.id===ruleId);
  }

  function alertActive(alert){
    if (alert.status==='acknowledged') return false;
    if (alert.status==='snoozed' && alert.snoozedUntil && Intel.daysUntil(alert.snoozedUntil)>0) return false;
    return true;
  }

  function activeAlerts(){
    return Store.state.alerts
      .filter(alertActive)
      .sort((a,b)=>{
        const severity={critical:0,warning:1,info:2};
        return (severity[a.severity]??3)-(severity[b.severity]??3) || new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt);
      });
  }

  function createOrRefreshAlert(rule,result){
    const existing = Store.state.alerts.find(alert=>alert.key===result.key);
    const now = stamp();
    if (existing){
      existing.title=result.title;
      existing.detail=result.detail;
      existing.severity=rule.severity;
      existing.fairId=result.fairId||'';
      existing.entityType=result.entityType||'';
      existing.entityId=result.entityId||'';
      existing.ruleId=rule.id;
      existing.updatedAt=now;
      if (existing.status==='snoozed' && existing.snoozedUntil && Intel.daysUntil(existing.snoozedUntil)<=0){
        existing.status='open';
        existing.snoozedUntil='';
      }
      return false;
    }
    Store.state.alerts.unshift({
      id:Store.uid('alert'),
      key:result.key,ruleId:rule.id,
      severity:rule.severity,status:'open',
      fairId:result.fairId||'',entityType:result.entityType||'',entityId:result.entityId||'',
      title:result.title,detail:result.detail,
      createdAt:now,updatedAt:now,snoozedUntil:''
    });
    return true;
  }

  function executeTaskAction(rule,result){
    const generatedKey=`automation:${rule.id}:${result.key}`;
    if (Store.state.tasks.some(task=>task.automationKey===generatedKey && task.status!=='complete')) return;
    suppressRevisions=true;
    try{
      Store.__originalUpsert('task',{
        title:result.title,
        description:result.detail,
        fairId:result.fairId||Store.state.preferences.osFairId,
        owner:'Production',
        status:'todo',
        priority:rule.severity==='critical'?'High':'Medium',
        impact:rule.severity==='critical'?'High':'Medium',
        due:rule.severity==='critical'?todayISO():addDays(2),
        estimatedHours:1,
        blockedBy:'',
        dependsOnTaskId:'',
        talentId:result.entityType==='talent'?result.entityId:'',
        contactId:result.entityType==='contact'?result.entityId:'',
        phase:'',
        automationKey:generatedKey
      });
    }finally{
      suppressRevisions=false;
    }
  }

  function runAutomations({manual=false}={}){
    if (runningScan) return;
    runningScan=true;
    let created=0;
    let totalMatches=0;
    const now=stamp();

    try{
      RULES.forEach(rule=>{
        const setting=automationSetting(rule.id);
        if (!setting?.enabled) return;
        const results=rule.evaluate() || [];
        setting.lastRun=now;
        setting.lastMatchCount=results.length;
        setting.updatedAt=now;
        totalMatches+=results.length;

        results.forEach(result=>{
          if (createOrRefreshAlert(rule,result)) created++;
          if (setting.action==='task') executeTaskAction(rule,result);
        });
      });

      Store.state.alerts=Store.state.alerts.slice(0,300);
      Store.state.preferences.automationLastRun=now;
      Store.save({immediate:true});
    }finally{
      runningScan=false;
    }

    if (manual) UI.toast('Production automations complete',`${totalMatches} condition${totalMatches===1?'':'s'} matched · ${created} new inbox item${created===1?'':'s'}.`);
    render();
  }

  function scheduleScan(){
    if (!Store.state.preferences.automationAutoRun || runningScan) return;
    clearTimeout(scanTimer);
    scanTimer=setTimeout(()=>runAutomations(),600);
  }

  function setMode(modeId){
    const mode=MODES.find(item=>item.id===modeId);
    if (!mode) return;
    Store.state.preferences.focusMode=mode.id;
    Store.state.preferences.selectedLens=mode.lens;
    Store.state.preferences.systemDensity=mode.density;
    document.body.dataset.focusMode=mode.id;
    Store.log('Production',`activated ${mode.label} mode.`,'','','');
    Store.save({immediate:true});
    document.querySelector(`[data-view="${mode.view}"]`)?.click();
    UI.toast(`${mode.label} mode active`,mode.description);
    render();
  }

  function alertToTask(alertId){
    const alert=Store.state.alerts.find(item=>item.id===alertId);
    if (!alert) return;
    const exists=Store.state.tasks.find(task=>task.alertId===alert.id && task.status!=='complete');
    if (exists){
      UI.toast('Task already exists',exists.title);
      return;
    }
    Store.upsert('task',{
      title:alert.title,
      description:alert.detail,
      fairId:alert.fairId||Store.state.preferences.osFairId,
      owner:'Production',
      status:'todo',
      priority:alert.severity==='critical'?'High':'Medium',
      impact:alert.severity==='critical'?'High':'Medium',
      due:alert.severity==='critical'?todayISO():addDays(2),
      estimatedHours:1,blockedBy:'',dependsOnTaskId:'',
      talentId:alert.entityType==='talent'?alert.entityId:'',
      contactId:alert.entityType==='contact'?alert.entityId:'',
      phase:'',alertId:alert.id
    });
    alert.status='acknowledged';
    alert.updatedAt=stamp();
    Store.log('Production',`converted “${alert.title}” into a task.`,'task','',alert.fairId);
    Store.save({immediate:true});
    UI.toast('Task created','The inbox item is now actionable work.');
    render();
  }

  function updateAlert(alertId,status){
    const alert=Store.state.alerts.find(item=>item.id===alertId);
    if (!alert) return;
    alert.status=status;
    alert.updatedAt=stamp();
    if (status==='snoozed') alert.snoozedUntil=addDays(1);
    if (status==='open') alert.snoozedUntil='';
    Store.save({immediate:true});
    render();
  }

  function rollbackRevision(revisionId){
    const revision=Store.state.revisions.find(item=>item.id===revisionId);
    if (!revision) return;
    suppressRevisions=true;
    try{
      if (revision.before){
        Store.__originalUpsert(revision.type,clone(revision.before));
      }else if (revision.after){
        Store.__originalRemove(revision.type,revision.entityId);
      }
    }finally{
      suppressRevisions=false;
    }
    Store.state.revisions.unshift({
      id:Store.uid('revision'),
      type:revision.type,entityId:revision.entityId,fairId:revision.fairId,
      change:'rollback',before:clone(revision.after),after:clone(revision.before),
      actor:'Production',timestamp:stamp()
    });
    Store.log('Production',`rolled back a ${revision.type} change.`,'',revision.entityId,revision.fairId);
    Store.save({immediate:true});
    UI.toast('Change restored','The selected record version has been restored.');
    render();
  }

  function recordLabel(revision){
    const record=revision.after||revision.before;
    return UI.recordTitle?.(revision.type,record) || record?.title || record?.name || revision.entityId;
  }

  function auditData(){
    const state=Store.state;
    const issues=[];
    const ids=new Set();

    ['fairs','contacts','talent','tasks','schedules','deadlines','files','notes','issues','handoffs'].forEach(collectionName=>{
      (state[collectionName]||[]).forEach(record=>{
        const global=`${collectionName}:${record.id}`;
        if (ids.has(global)) issues.push({type:'duplicate',label:`Duplicate ID in ${collectionName}`,detail:record.id,repairable:false});
        ids.add(global);
      });
    });

    const fairIds=new Set(state.fairs.map(f=>f.id));
    ['talent','tasks','schedules','deadlines','files','notes','issues','handoffs'].forEach(collectionName=>{
      (state[collectionName]||[]).forEach(record=>{
        if (record.fairId && !fairIds.has(record.fairId)){
          issues.push({type:'orphan-fair',collectionName,id:record.id,label:`Orphaned ${collectionName.slice(0,-1)} record`,detail:`${record.title||record.name||record.id} references a missing fair.`,repairable:false});
        }
      });
    });

    const taskIds=new Set(state.tasks.map(task=>task.id));
    state.tasks.forEach(task=>{
      if (task.dependsOnTaskId && !taskIds.has(task.dependsOnTaskId)){
        issues.push({type:'broken-dependency',id:task.id,label:'Broken task dependency',detail:`${task.title} points to a missing prerequisite.`,repairable:true});
      }
    });

    const recentInvalid=(state.recentViewed||[]).filter(item=>!Store.get(item.type,item.id));
    if (recentInvalid.length){
      issues.push({type:'recent',label:'Invalid recent-item references',detail:`${recentInvalid.length} recent item(s) no longer exist.`,repairable:true});
    }

    const alertKeys=new Set();
    let duplicateAlerts=0;
    state.alerts.forEach(alert=>{
      if (alertKeys.has(alert.key)) duplicateAlerts++;
      alertKeys.add(alert.key);
    });
    if (duplicateAlerts){
      issues.push({type:'duplicate-alert',label:'Duplicate inbox entries',detail:`${duplicateAlerts} duplicate alert(s) detected.`,repairable:true});
    }

    return issues;
  }

  function repairData(){
    const issues=auditData();
    let repairs=0;

    issues.filter(item=>item.type==='broken-dependency').forEach(item=>{
      const task=Store.get('task',item.id);
      if (task){ task.dependsOnTaskId=''; repairs++; }
    });

    if (issues.some(item=>item.type==='recent')){
      Store.state.recentViewed=(Store.state.recentViewed||[]).filter(item=>Store.get(item.type,item.id));
      repairs++;
    }

    if (issues.some(item=>item.type==='duplicate-alert')){
      const seen=new Set();
      Store.state.alerts=Store.state.alerts.filter(alert=>{
        if (seen.has(alert.key)) return false;
        seen.add(alert.key);
        return true;
      });
      repairs++;
    }

    Store.state.preferences.osFairId = Store.get('fair',Store.state.preferences.osFairId)?.id || Intel.nextFair()?.id || Store.state.fairs[0]?.id || '';
    Store.save({immediate:true});
    UI.toast('Data Doctor complete',`${repairs} safe repair${repairs===1?'':'s'} applied. No production records were deleted.`);
    render();
  }

  function renderModes(){
    const current=Store.state.preferences.focusMode;
    return `<article class="kernel-panel mode-panel">
      <div class="kernel-panel-head"><div><span class="eyebrow">Context-aware workspace</span><h3>Operating Modes</h3></div><span class="kernel-status">Current: ${esc(MODES.find(m=>m.id===current)?.label || 'Planning')}</span></div>
      <div class="mode-grid">${MODES.map(mode=>`<button class="mode-card ${mode.id===current?'active':''}" data-kernel-mode="${mode.id}">
        <span>${mode.icon}</span><b>${esc(mode.label)}</b><small>${esc(mode.description)}</small>
      </button>`).join('')}</div>
    </article>`;
  }

  function renderInbox(){
    const filter=Store.state.preferences.inboxFilter;
    const alerts=Store.state.alerts
      .filter(alert=>filter==='all' || (filter==='open'&&alertActive(alert)) || alert.status===filter)
      .sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt))
      .slice(0,30);

    return `<article class="kernel-panel inbox-panel">
      <div class="kernel-panel-head">
        <div><span class="eyebrow">Production signals</span><h3>Smart Inbox</h3></div>
        <div class="kernel-actions">
          <select id="inboxFilter">
            <option value="open"${filter==='open'?' selected':''}>Open</option>
            <option value="all"${filter==='all'?' selected':''}>All</option>
            <option value="snoozed"${filter==='snoozed'?' selected':''}>Snoozed</option>
            <option value="acknowledged"${filter==='acknowledged'?' selected':''}>Acknowledged</option>
          </select>
          <button class="button ghost small-button" data-run-automations>Scan Now</button>
        </div>
      </div>
      <div class="kernel-inbox">${alerts.length ? alerts.map(alert=>`<article class="inbox-item ${alert.severity} ${alert.status}">
        <span class="inbox-severity">${alert.severity==='critical'?'!':alert.severity==='warning'?'△':'i'}</span>
        <div>
          <small>${esc(RULES.find(rule=>rule.id===alert.ruleId)?.name || 'OS signal')} · ${esc(Intel.formatTimeAgo(alert.updatedAt||alert.createdAt))}</small>
          <b>${esc(alert.title)}</b>
          <p>${esc(alert.detail)}</p>
        </div>
        <div class="inbox-actions">
          ${alert.entityType&&alert.entityId?`<button data-open-record="${alert.entityType}:${alert.entityId}">Open</button>`:''}
          ${alert.status!=='acknowledged'?`<button data-alert-task="${alert.id}">Make Task</button>`:''}
          ${alert.status==='snoozed'?`<button data-alert-status="${alert.id}:open">Wake</button>`:`<button data-alert-status="${alert.id}:snoozed">Tomorrow</button>`}
          ${alert.status!=='acknowledged'?`<button data-alert-status="${alert.id}:acknowledged">Done</button>`:''}
        </div>
      </article>`).join('') : `<div class="kernel-empty"><b>Inbox zero.</b><span>No production signals match this view.</span></div>`}</div>
    </article>`;
  }

  function renderAutomations(){
    return `<article class="kernel-panel automation-panel">
      <div class="kernel-panel-head">
        <div><span class="eyebrow">Deterministic local intelligence</span><h3>Automation Rules</h3></div>
        <label class="auto-run-toggle"><input type="checkbox" id="automationAutoRun"${Store.state.preferences.automationAutoRun?' checked':''}><span>Run while using OS</span></label>
      </div>
      <div class="automation-list">${RULES.map(rule=>{
        const setting=automationSetting(rule.id);
        return `<article class="automation-row ${setting?.enabled?'enabled':'disabled'}">
          <span class="automation-icon">${rule.icon}</span>
          <div><b>${esc(rule.name)}</b><p>${esc(rule.description)}</p><small>${setting?.lastRun?`${setting.lastMatchCount||0} match(es) · last run ${Intel.formatTimeAgo(setting.lastRun)}`:'Not run yet'}</small></div>
          <select data-automation-action="${rule.id}">
            <option value="alert"${setting?.action==='alert'?' selected':''}>Inbox only</option>
            <option value="task"${setting?.action==='task'?' selected':''}>Inbox + task</option>
          </select>
          <label class="switch"><input type="checkbox" data-automation-toggle="${rule.id}"${setting?.enabled?' checked':''}><span></span></label>
        </article>`;
      }).join('')}</div>
    </article>`;
  }

  function renderHistory(){
    const fairFilter=Store.state.preferences.historyFairId;
    const revisions=Store.state.revisions
      .filter(revision=>fairFilter==='all'||revision.fairId===fairFilter)
      .slice(0,40);

    return `<article class="kernel-panel history-panel">
      <div class="kernel-panel-head">
        <div><span class="eyebrow">Versioned local memory</span><h3>Change Journal</h3></div>
        <select id="historyFairFilter"><option value="all">All fairs</option>${Store.state.fairs.map(fair=>`<option value="${fair.id}"${fair.id===fairFilter?' selected':''}>${esc(fair.short)}</option>`).join('')}</select>
      </div>
      <div class="revision-list">${revisions.length ? revisions.map(revision=>`<article class="revision-row">
        <span class="revision-type">${esc(revision.type.slice(0,1).toUpperCase())}</span>
        <div><small>${esc(revision.change)} · ${esc(Intel.formatTimeAgo(revision.timestamp))}</small><b>${esc(recordLabel(revision))}</b><span>${esc(Store.get('fair',revision.fairId)?.short || 'Production')}</span></div>
        <button data-rollback-revision="${revision.id}">${revision.change==='created'?'Remove':'Restore'}</button>
      </article>`).join('') : `<div class="kernel-empty"><b>No version history yet.</b><span>New edits, creations, and deletions will be journaled here.</span></div>`}</div>
    </article>`;
  }

  function renderDoctor(){
    const issues=auditData();
    const repairable=issues.filter(issue=>issue.repairable).length;
    const storageBytes=new Blob([Store.exportData()]).size;
    const health=Math.max(0,100-issues.length*8);
    return `<article class="kernel-panel doctor-panel">
      <div class="kernel-panel-head">
        <div><span class="eyebrow">Reliability and recovery</span><h3>Data Doctor</h3></div>
        <div class="doctor-score"><strong>${health}%</strong><span>Data health</span></div>
      </div>
      <div class="doctor-stats">
        <div><strong>${Store.state.revisions.length}</strong><span>versions remembered</span></div>
        <div><strong>${activeAlerts().length}</strong><span>active signals</span></div>
        <div><strong>${Math.max(1,Math.round(storageBytes/1024))} KB</strong><span>local workspace</span></div>
        <div><strong>${repairable}</strong><span>safe repairs</span></div>
      </div>
      <div class="doctor-list">${issues.length ? issues.slice(0,12).map(issue=>`<article class="${issue.repairable?'repairable':'review'}"><span>${issue.repairable?'↻':'!'}</span><div><b>${esc(issue.label)}</b><small>${esc(issue.detail)}</small></div><em>${issue.repairable?'Safe repair':'Review'}</em></article>`).join('') : `<div class="doctor-healthy"><span>✓</span><div><b>Workspace integrity looks healthy.</b><small>No broken links, duplicate inbox keys, or invalid recent references detected.</small></div></div>`}</div>
      <div class="doctor-actions">
        <button class="button ghost" data-export-os-backup>Export Backup</button>
        <button class="button primary" data-repair-os${repairable?'':' disabled'}>Run Safe Repair</button>
      </div>
    </article>`;
  }

  function render(){
    const target=$('#osCenterContent');
    if (!target) return;

    document.body.dataset.focusMode=Store.state.preferences.focusMode||'planning';
    const active=activeAlerts();
    const critical=active.filter(alert=>alert.severity==='critical').length;
    const fairId=Store.state.preferences.osFairId || Intel.nextFair()?.id || Store.state.fairs[0]?.id || '';
    const fair=Store.get('fair',fairId);
    const autoEnabled=Store.state.automations.filter(item=>item.enabled).length;

    target.innerHTML=`
      <section class="kernel-hero">
        <div>
          <span class="eyebrow">OATF OS kernel</span>
          <h1>Production that remembers, reacts, and recovers.</h1>
          <p>V0.07 turns local records into operating modes, deterministic automations, a smart inbox, reversible history, and workspace self-repair.</p>
          <div class="kernel-fair-select"><label><span>OS focus fair</span><select id="osFairSelect">${Store.state.fairs.map(item=>`<option value="${item.id}"${item.id===fairId?' selected':''}>${esc(item.name)}</option>`).join('')}</select></label><button class="button ghost" data-run-automations>Run System Scan</button></div>
        </div>
        <div class="kernel-stat critical"><span>Critical signals</span><strong>${critical}</strong><small>${critical?'Production attention required':'No critical alerts'}</small></div>
        <div class="kernel-stat"><span>Rules active</span><strong>${autoEnabled}</strong><small>${Store.state.preferences.automationLastRun?`Scanned ${esc(Intel.formatTimeAgo(Store.state.preferences.automationLastRun))}`:'Awaiting first scan'}</small></div>
        <div class="kernel-stat"><span>Current fair</span><strong>${esc(fair?.code || '—')}</strong><small>${esc(fair?.short || 'No fair selected')}</small></div>
      </section>
      ${renderModes()}
      <div class="kernel-grid">
        ${renderInbox()}
        ${renderDoctor()}
      </div>
      ${renderAutomations()}
      ${renderHistory()}
    `;

    const badge=$('#osCenterBadge');
    if (badge) badge.textContent=active.length || '';
  }

  function openOSCenter(){
    document.querySelector('[data-view="oscenter"]')?.click();
    requestAnimationFrame(render);
  }

  function appendCommands(){
    const input=$('#globalSearch');
    const results=$('#searchResults');
    if (!input||!results) return;
    results.querySelector('.kernel-command-group')?.remove();
    const q=input.value.trim().toLowerCase();
    if (!q) return;

    const commands=[
      {test:/(os center|system center|kernel|operating system)/,label:'Open OS Center',detail:'Automations, modes, inbox, history, and repair',action:'open'},
      {test:/(run automations|system scan|scan production)/,label:'Run Production Automations',detail:'Evaluate every enabled deterministic rule',action:'scan'},
      {test:/(planning mode)/,label:'Activate Planning Mode',detail:'Balanced production workspace',action:'mode:planning'},
      {test:/(production lock|lock mode)/,label:'Activate Production Lock',detail:'Compact exception-first workspace',action:'mode:lock'},
      {test:/(day-of mode|day of mode)/,label:'Activate Day-of Mode',detail:'Live stage operations workspace',action:'mode:dayof'},
      {test:/(closeout mode)/,label:'Activate Closeout Mode',detail:'Issue resolution and production memory',action:'mode:closeout'},
      {test:/(data doctor|repair workspace|system health)/,label:'Open Data Doctor',detail:`${auditData().length} integrity finding(s)`,action:'open'},
      {test:/(change journal|version history|revision history)/,label:'Open Change Journal',detail:`${Store.state.revisions.length} version(s) remembered`,action:'open'}
    ].filter(command=>command.test.test(q));

    if (!commands.length) return;
    const group=document.createElement('section');
    group.className='os-command-group kernel-command-group';
    group.innerHTML=`<span class="eyebrow">OS commands</span>${commands.map(command=>`<button data-kernel-command="${command.action}"><span>◈</span><span><b>${esc(command.label)}</b><small>${esc(command.detail)}</small></span><em>Run ↵</em></button>`).join('')}`;
    results.prepend(group);
  }

  document.addEventListener('input',event=>{
    if (event.target?.id==='globalSearch') queueMicrotask(appendCommands);
  });

  document.addEventListener('change',event=>{
    const toggle=event.target.closest('[data-automation-toggle]');
    if (toggle){
      const setting=automationSetting(toggle.dataset.automationToggle);
      if (setting){ setting.enabled=toggle.checked; setting.updatedAt=stamp(); Store.save({immediate:true}); render(); }
      return;
    }

    const action=event.target.closest('[data-automation-action]');
    if (action){
      const setting=automationSetting(action.dataset.automationAction);
      if (setting){ setting.action=action.value; setting.updatedAt=stamp(); Store.save({immediate:true}); }
      return;
    }

    if (event.target?.id==='automationAutoRun'){
      Store.state.preferences.automationAutoRun=event.target.checked;
      Store.save({immediate:true});
      return;
    }

    if (event.target?.id==='inboxFilter'){
      Store.state.preferences.inboxFilter=event.target.value;
      Store.save();
      render();
      return;
    }

    if (event.target?.id==='historyFairFilter'){
      Store.state.preferences.historyFairId=event.target.value;
      Store.save();
      render();
      return;
    }

    if (event.target?.id==='osFairSelect'){
      Store.state.preferences.osFairId=event.target.value;
      Store.save();
      render();
    }
  });

  document.addEventListener('click',event=>{
    if (event.target.closest('[data-os-center-open]')){ openOSCenter(); return; }
    if (event.target.closest('[data-run-automations]')){ runAutomations({manual:true}); return; }

    const mode=event.target.closest('[data-kernel-mode]')?.dataset.kernelMode;
    if (mode){ setMode(mode); return; }

    const alertTask=event.target.closest('[data-alert-task]')?.dataset.alertTask;
    if (alertTask){ alertToTask(alertTask); return; }

    const statusPair=event.target.closest('[data-alert-status]')?.dataset.alertStatus;
    if (statusPair){
      const split=statusPair.lastIndexOf(':');
      updateAlert(statusPair.slice(0,split),statusPair.slice(split+1));
      return;
    }

    const rollback=event.target.closest('[data-rollback-revision]')?.dataset.rollbackRevision;
    if (rollback){ rollbackRevision(rollback); return; }

    if (event.target.closest('[data-repair-os]')){ repairData(); return; }

    if (event.target.closest('[data-export-os-backup]')){
      const blob=new Blob([Store.exportData()],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download=`oatf-os-production-backup-${todayISO()}.json`;
      anchor.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      Store.state.preferences.lastBackup=stamp();
      Store.save();
      UI.toast('Backup exported','A complete local Production backup was downloaded.');
      return;
    }

    const command=event.target.closest('[data-kernel-command]')?.dataset.kernelCommand;
    if (command){
      $('#searchOverlay')?.classList.remove('open');
      if (command==='open') openOSCenter();
      else if (command==='scan'){ openOSCenter(); runAutomations({manual:true}); }
      else if (command.startsWith('mode:')) setMode(command.split(':')[1]);
    }
  });

  window.addEventListener('oatf:saved',()=>{
    render();
    scheduleScan();
  });

  window.OATFKernel={
    render,runAutomations,setMode,activeAlerts,auditData,repairData,
    RULES,MODES,rollbackRevision
  };

  ensureState();
  installRevisionJournal();
  render();
  if (Store.state.preferences.automationAutoRun) setTimeout(()=>runAutomations(),850);
})();