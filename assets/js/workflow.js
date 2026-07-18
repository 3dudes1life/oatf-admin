(() => {
  'use strict';

  const Store = window.OATFStore;
  const Intel = window.OATFIntel;
  const UI = window.OATFUI;
  if (!Store || !Intel || !UI) return;

  const $ = selector => document.querySelector(selector);
  const esc = UI.esc;
  const todayISO = () => new Date().toISOString().slice(0,10);
  const addDays = days => {
    const date = new Date();
    date.setDate(date.getDate()+days);
    return date.toISOString().slice(0,10);
  };

  const PHASES = [
    {id:'foundation',label:'Foundation',icon:'◇',description:'Fair profile, contacts, ownership, and initial deadlines.'},
    {id:'booking',label:'Booking',icon:'◉',description:'Talent pipeline, contacts, offers, and performer commitments.'},
    {id:'materials',label:'Materials',icon:'▣',description:'Agreements, music, bios, photos, parking, and arrivals.'},
    {id:'schedule',label:'Schedule',icon:'≡',description:'Run of show, public schedule, transitions, and stage logic.'},
    {id:'dayof',label:'Day-of Prep',icon:'⚡',description:'Call sheet, checklists, handoffs, issue readiness, and final locks.'},
    {id:'closeout',label:'Closeout',icon:'✓',description:'Resolve issues, archive records, capture notes, and close production.'}
  ];

  const PLAYBOOKS = [
    {
      id:'fair-setup',
      name:'New Fair Foundation',
      description:'Build the minimum production structure for a newly confirmed fair.',
      phase:'foundation',
      tasks:[
        ['Complete fair production profile',0,'High','Production'],
        ['Confirm fair entertainment and production contacts',2,'High','Production'],
        ['Confirm stage, load-in, parking, and credential process',5,'High','Production'],
        ['Create first production deadline map',7,'Medium','Production']
      ]
    },
    {
      id:'talent-lock',
      name:'Talent Lock',
      description:'Move confirmed performers from booking into production readiness.',
      phase:'booking',
      tasks:[
        ['Confirm complete talent lineup',0,'High','Production'],
        ['Connect every performer to a contact record',1,'High','Production'],
        ['Send outstanding talent agreements',2,'High','Production'],
        ['Confirm performance lengths and stage needs',4,'Medium','Production']
      ]
    },
    {
      id:'materials-lock',
      name:'Materials Lock',
      description:'Collect every asset needed for marketing, playback, parking, and stage management.',
      phase:'materials',
      tasks:[
        ['Collect final music from all contracted talent',0,'High','Production'],
        ['Confirm bios and photos for public-facing talent',1,'High','Production'],
        ['Confirm parking and arrival details',3,'High','Production'],
        ['Review stage requirements with production lead',5,'Medium','Production']
      ]
    },
    {
      id:'thirty-day-lock',
      name:'30-Day Production Lock',
      description:'Protect schedule quality and expose unresolved production risk.',
      phase:'schedule',
      tasks:[
        ['Lock internal run of show',0,'High','Production'],
        ['Review schedule transitions and programming gaps',1,'High','Production'],
        ['Confirm public schedule titles',2,'Medium','Production'],
        ['Generate and review production readiness report',3,'Medium','Production']
      ]
    },
    {
      id:'seven-day-ready',
      name:'7-Day Day-of Readiness',
      description:'Turn the workspace into a live event operating plan.',
      phase:'dayof',
      tasks:[
        ['Generate final day-of call sheet',0,'High','Production'],
        ['Confirm every performer arrival and check-in contact',1,'High','Production'],
        ['Review emergency and fair-side production contacts',2,'High','Production'],
        ['Complete live production checklist',3,'High','Production'],
        ['Create final shift handoff',5,'Medium','Production']
      ]
    },
    {
      id:'closeout',
      name:'Post-Event Closeout',
      description:'Resolve operational loose ends and preserve learning for the next fair.',
      phase:'closeout',
      tasks:[
        ['Resolve or document all open production issues',0,'High','Production'],
        ['Capture post-event production notes',1,'Medium','Production'],
        ['Archive final schedule and call sheet records',2,'Medium','Production'],
        ['Complete production closeout summary',4,'Medium','Production']
      ]
    }
  ];

  function ensureState(){
    let changed = false;
    const state = Store.state;
    if (!Array.isArray(state.handoffs)){ state.handoffs=[]; changed=true; }
    if (!Array.isArray(state.playbookRuns)){ state.playbookRuns=[]; changed=true; }
    if (!state.preferences.workflowFairId){
      state.preferences.workflowFairId = Intel.nextFair()?.id || state.fairs[0]?.id || '';
      changed = true;
    }
    if (!state.preferences.workflowPhase){ state.preferences.workflowPhase='all'; changed=true; }
    state.tasks.forEach(task => {
      if (typeof task.dependsOnTaskId !== 'string'){ task.dependsOnTaskId=''; changed=true; }
      if (typeof task.phase !== 'string'){ task.phase=''; changed=true; }
      if (typeof task.gateKey !== 'string'){ task.gateKey=''; changed=true; }
    });
    if (changed) Store.save({immediate:true});
  }

  function fairRecord(fairId){ return Store.get('fair',fairId); }
  function fairTasks(fairId){ return Store.state.tasks.filter(task => task.fairId===fairId); }
  function fairTalent(fairId){ return Store.state.talent.filter(talent => talent.fairId===fairId); }
  function fairContacts(fairId){ return Store.state.contacts.filter(contact => contact.fairIds?.includes(fairId)); }
  function fairIssues(fairId){ return Store.state.issues.filter(issue => issue.fairId===fairId); }

  function inferPhase(task){
    if (task.phase) return task.phase;
    const text = `${task.title} ${task.description || ''}`.toLowerCase();
    if (/closeout|post-event|archive|recap|after action/.test(text)) return 'closeout';
    if (/call sheet|check-in|day-of|credential|load-in|emergency|handoff/.test(text)) return 'dayof';
    if (/schedule|run of show|stage time|transition|public title/.test(text)) return 'schedule';
    if (/music|bio|photo|parking|arrival|material|agreement|stage needs/.test(text)) return 'materials';
    if (/talent|performer|offer|lineup|book|contract/.test(text)) return 'booking';
    return 'foundation';
  }

  function dependencyState(task){
    if (!task.dependsOnTaskId) return {blocked:false,label:'Independent'};
    const parent = Store.get('task',task.dependsOnTaskId);
    if (!parent) return {blocked:true,label:'Missing dependency',missing:true};
    return {
      blocked:parent.status!=='complete',
      label:parent.status==='complete' ? `Unlocked by ${parent.title}` : `Waiting for ${parent.title}`,
      parent
    };
  }

  function taskAvailable(task){
    return task.status!=='complete' && !dependencyState(task).blocked && !task.blockedBy;
  }

  function phaseMetrics(fairId,phaseId){
    const tasks = fairTasks(fairId).filter(task => inferPhase(task)===phaseId);
    const complete = tasks.filter(task => task.status==='complete').length;
    const blocked = tasks.filter(task => dependencyState(task).blocked || task.status==='waiting' || task.blockedBy).length;
    const overdue = tasks.filter(task => task.status!=='complete' && Intel.daysUntil(task.due)<0).length;
    const score = tasks.length ? Math.round(complete/tasks.length*100) : phaseBaseline(fairId,phaseId);
    return {tasks,complete,blocked,overdue,score};
  }

  function phaseBaseline(fairId,phaseId){
    const fair = fairRecord(fairId);
    const talent = fairTalent(fairId);
    const schedule = Intel.scheduleForFair(fairId);
    const contacts = fairContacts(fairId);
    if (phaseId==='foundation'){
      const checks=[fair?.venue,fair?.stage,fair?.date,contacts.some(c=>c.type==='Fair Partner')];
      return Math.round(checks.filter(Boolean).length/checks.length*100);
    }
    if (phaseId==='booking'){
      if (!talent.length) return 0;
      return Math.round(talent.filter(t=>['Contracted','Ready'].includes(t.status)).length/talent.length*100);
    }
    if (phaseId==='materials'){
      if (!talent.length) return 0;
      return Math.round(talent.reduce((sum,t)=>sum+Intel.talentReadiness(t),0)/talent.length);
    }
    if (phaseId==='schedule'){
      if (!schedule.length) return 0;
      const issues=Intel.scheduleIssues(fairId).filter(i=>i.severity!=='info').length;
      return Math.max(0,100-issues*15);
    }
    if (phaseId==='dayof'){
      const prefs=Store.state.preferences.dayOfChecks?.[fairId] || {};
      const checks=Object.values(prefs);
      return checks.length ? Math.round(checks.filter(Boolean).length/checks.length*100) : 20;
    }
    if (phaseId==='closeout'){
      const issues=fairIssues(fairId);
      if (!issues.length) return 0;
      return Math.round(issues.filter(i=>i.status==='Resolved').length/issues.length*100);
    }
    return 0;
  }

  function workflowScore(fairId){
    const metrics=PHASES.map(phase=>phaseMetrics(fairId,phase.id));
    const weights={foundation:.15,booking:.15,materials:.25,schedule:.2,dayof:.2,closeout:.05};
    return Math.round(metrics.reduce((sum,m,index)=>sum+m.score*weights[PHASES[index].id],0));
  }

  function gates(fairId){
    const fair=fairRecord(fairId);
    const talent=fairTalent(fairId);
    const schedule=Intel.scheduleForFair(fairId);
    const scheduleIssues=Intel.scheduleIssues(fairId).filter(i=>i.severity!=='info');
    const openHigh=fairIssues(fairId).filter(i=>i.status!=='Resolved'&&i.severity==='High');
    const overdue=fairTasks(fairId).filter(t=>t.status!=='complete'&&Intel.daysUntil(t.due)<0);
    const waiting=fairTasks(fairId).filter(t=>t.status==='waiting'||dependencyState(t).blocked||t.blockedBy);
    const contracted=talent.filter(t=>['Contracted','Ready'].includes(t.status));
    const missingMaterials=contracted.flatMap(t=>Intel.talentMissing(t).map(item=>({talent:t,item})));
    const fairPartner=fairContacts(fairId).some(c=>c.type==='Fair Partner');

    return [
      {key:'profile',label:'Fair production profile complete',pass:Boolean(fair?.venue&&fair?.stage&&fair?.date),critical:true,detail:'Venue, stage, and event date must be recorded.'},
      {key:'contact',label:'Fair-side production contact connected',pass:fairPartner,critical:true,detail:'A Fair Partner contact is required.'},
      {key:'talent',label:'Talent lineup production-ready',pass:contracted.length>0&&contracted.length===talent.length,critical:true,detail:`${contracted.length}/${talent.length || 0} talent records contracted or ready.`},
      {key:'materials',label:'Required performer materials received',pass:missingMaterials.length===0&&contracted.length>0,critical:true,detail:missingMaterials.length ? `${missingMaterials.length} material requirement(s) remain.` : 'No missing required materials.'},
      {key:'schedule',label:'Run of show is valid',pass:schedule.length>0&&scheduleIssues.length===0,critical:true,detail:schedule.length ? `${scheduleIssues.length} schedule warning(s).` : 'No run of show exists.'},
      {key:'overdue',label:'No overdue critical work',pass:overdue.filter(t=>t.priority==='High'||t.impact==='High').length===0,critical:true,detail:`${overdue.length} overdue task(s).`},
      {key:'blocked',label:'Blocking work has an owner and path',pass:waiting.length===0,critical:false,detail:`${waiting.length} waiting or dependency-blocked task(s).`},
      {key:'issues',label:'No unresolved high-severity issues',pass:openHigh.length===0,critical:true,detail:`${openHigh.length} high-severity issue(s) open.`}
    ];
  }

  function gateDecision(fairId){
    const list=gates(fairId);
    const criticalFailures=list.filter(g=>g.critical&&!g.pass).length;
    const warnings=list.filter(g=>!g.critical&&!g.pass).length;
    if (criticalFailures===0&&warnings===0) return {status:'GO',tone:'go',label:'Production cleared'};
    if (criticalFailures===0) return {status:'CONDITIONAL GO',tone:'conditional',label:'Proceed with active monitoring'};
    return {status:'HOLD',tone:'hold',label:`${criticalFailures} critical gate${criticalFailures===1?'':'s'} unresolved`};
  }

  function nextAvailable(fairId){
    return fairTasks(fairId)
      .filter(taskAvailable)
      .sort((a,b)=>{
        const priority={High:0,Medium:1,Low:2};
        const aDue=Intel.daysUntil(a.due); const bDue=Intel.daysUntil(b.due);
        return (priority[a.priority]??1)-(priority[b.priority]??1) || (aDue??9999)-(bDue??9999);
      });
  }

  function chainRows(fairId){
    const tasks=fairTasks(fairId);
    const roots=tasks.filter(task=>!task.dependsOnTaskId);
    const seen=new Set();
    const rows=[];
    function visit(task,depth=0){
      if (!task||seen.has(task.id)) return;
      seen.add(task.id);
      rows.push({task,depth,state:dependencyState(task)});
      tasks.filter(child=>child.dependsOnTaskId===task.id).forEach(child=>visit(child,depth+1));
    }
    roots.forEach(root=>visit(root));
    tasks.filter(task=>!seen.has(task.id)).forEach(task=>visit(task,0));
    return rows;
  }

  function applyPlaybook(playbookId,fairId){
    const playbook=PLAYBOOKS.find(item=>item.id===playbookId);
    const fair=fairRecord(fairId);
    if (!playbook||!fair) return;
    const existing=fairTasks(fairId);
    let created=0;
    let previousId='';
    playbook.tasks.forEach(([title,offset,priority,owner])=>{
      const duplicate=existing.find(task=>task.title.toLowerCase()===title.toLowerCase());
      if (duplicate){ previousId=duplicate.id; return; }
      const task=Store.upsert('task',{
        title,fairId,owner,status:'todo',priority,impact:priority,
        due:addDays(offset),estimatedHours:1,description:`Created from the ${playbook.name} playbook.`,
        phase:playbook.phase,dependsOnTaskId:previousId,blockedBy:'',talentId:'',contactId:''
      });
      previousId=task.id;
      created++;
    });
    Store.state.playbookRuns.unshift({
      id:Store.uid('playbook-run'),playbookId,fairId,createdCount:created,createdAt:Store.nowISO(),actor:'Production'
    });
    Store.log('Production',`applied the ${playbook.name} playbook to ${fair.short}.`,'fair',fair.id,fair.id);
    Store.save({immediate:true});
    UI.toast('Playbook applied',created ? `${created} connected task${created===1?'':'s'} created.` : 'All playbook tasks already existed.');
    render();
  }

  function completeTask(taskId){
    const task=Store.get('task',taskId);
    if (!task) return;
    task.status='complete';
    task.completedAt=Store.nowISO();
    task.updatedAt=Store.nowISO();
    Store.log('Production',`completed “${task.title}” from Orchestration.`,'task',task.id,task.fairId);
    Store.save();
    UI.toast('Workflow advanced',task.title);
  }

  function saveHandoff(form){
    const data=Object.fromEntries(new FormData(form).entries());
    if (!data.summary.trim()) return;
    const handoff=Store.upsert('handoff',{
      fairId:data.fairId,
      author:'Production',
      shift:data.shift || 'Planning',
      summary:data.summary.trim(),
      blockers:data.blockers.trim(),
      decisions:data.decisions.trim(),
      nextAction:data.nextAction.trim()
    });
    Store.log('Production',`created a ${handoff.shift} handoff.`,'handoff',handoff.id,handoff.fairId);
    form.reset();
    Store.save({immediate:true});
    UI.toast('Handoff saved','The next Production session has a clear starting point.');
    render();
  }

  function renderPhaseRail(fairId){
    return `<div class="phase-rail">${PHASES.map(phase=>{
      const metric=phaseMetrics(fairId,phase.id);
      const tone=metric.score>=80?'healthy':metric.score>=50?'active':'risk';
      return `<button class="phase-card ${tone}" data-workflow-phase="${phase.id}">
        <span class="phase-icon">${phase.icon}</span>
        <div><small>${phase.label}</small><strong>${metric.score}%</strong></div>
        <i><b style="width:${metric.score}%"></b></i>
        <em>${metric.complete}/${metric.tasks.length || 0} tasks · ${metric.blocked} blocked</em>
      </button>`;
    }).join('')}</div>`;
  }

  function renderGatePanel(fairId){
    const decision=gateDecision(fairId);
    const list=gates(fairId);
    return `<article class="os-panel gate-panel">
      <div class="os-panel-head">
        <div><span class="eyebrow">Readiness gate</span><h3>Go / No-Go Decision</h3></div>
        <div class="gate-decision ${decision.tone}"><strong>${decision.status}</strong><span>${esc(decision.label)}</span></div>
      </div>
      <div class="gate-list">${list.map(gate=>`<button class="gate-row ${gate.pass?'pass':'fail'}" data-workflow-gate="${gate.key}">
        <span>${gate.pass?'✓':'!'}</span>
        <div><b>${esc(gate.label)}</b><small>${esc(gate.detail)}</small></div>
        <em>${gate.critical?'Required':'Monitor'}</em>
      </button>`).join('')}</div>
    </article>`;
  }

  function renderNextWork(fairId){
    const available=nextAvailable(fairId).slice(0,6);
    return `<article class="os-panel">
      <div class="os-panel-head"><div><span class="eyebrow">Workflow queue</span><h3>Next Available Work</h3></div><span class="count-pill">${available.length}</span></div>
      <div class="next-work-list">${available.length ? available.map(task=>`<article>
        <div class="workflow-priority ${String(task.priority).toLowerCase()}">${esc(task.priority)}</div>
        <div><small>${esc(PHASES.find(p=>p.id===inferPhase(task))?.label || 'Production')} · ${esc(Intel.relativeDate(task.due))}</small><b>${esc(task.title)}</b><span>${esc(task.owner || 'Production')}</span></div>
        <button data-workflow-complete="${task.id}">Complete</button>
      </article>`).join('') : `<div class="workflow-empty"><b>No immediately available work.</b><span>Resolve dependencies or add the next production task.</span></div>`}</div>
    </article>`;
  }

  function renderDependencies(fairId){
    const rows=chainRows(fairId);
    return `<article class="os-panel dependency-panel">
      <div class="os-panel-head"><div><span class="eyebrow">Dependency engine</span><h3>Production Chain</h3></div><span class="count-pill">${rows.length}</span></div>
      <div class="chain-list">${rows.length ? rows.map(({task,depth,state})=>`<button class="chain-row ${state.blocked?'blocked':''} ${task.status==='complete'?'complete':''}" style="--depth:${depth}" data-open-record="task:${task.id}">
        <span class="chain-node">${task.status==='complete'?'✓':state.blocked?'×':'→'}</span>
        <div><b>${esc(task.title)}</b><small>${esc(state.label)} · ${esc(task.status.replace('inprogress','In Progress'))}</small></div>
        <em>${esc(PHASES.find(p=>p.id===inferPhase(task))?.label || 'Production')}</em>
      </button>`).join('') : `<div class="workflow-empty"><b>No tasks in this fair.</b><span>Apply a playbook to create a connected workflow.</span></div>`}</div>
    </article>`;
  }

  function renderPlaybooks(fairId){
    const runs=Store.state.playbookRuns.filter(run=>run.fairId===fairId);
    return `<article class="os-panel playbook-panel">
      <div class="os-panel-head"><div><span class="eyebrow">Reusable production systems</span><h3>Playbooks</h3></div><span class="count-pill">${runs.length} run${runs.length===1?'':'s'}</span></div>
      <div class="playbook-grid">${PLAYBOOKS.map(playbook=>{
        const run=runs.find(item=>item.playbookId===playbook.id);
        return `<article class="playbook-card">
          <span>${esc(PHASES.find(p=>p.id===playbook.phase)?.label || '')}</span>
          <h4>${esc(playbook.name)}</h4>
          <p>${esc(playbook.description)}</p>
          <div><small>${playbook.tasks.length} connected steps</small><button data-apply-playbook="${playbook.id}">${run?'Run again':'Apply'}</button></div>
        </article>`;
      }).join('')}</div>
    </article>`;
  }

  function renderHandoffs(fairId){
    const handoffs=Store.state.handoffs.filter(item=>item.fairId===fairId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    return `<article class="os-panel handoff-panel">
      <div class="os-panel-head"><div><span class="eyebrow">Operational continuity</span><h3>Production Handoffs</h3></div><span class="count-pill">${handoffs.length}</span></div>
      <div class="handoff-layout">
        <form class="handoff-form" id="handoffForm">
          <input type="hidden" name="fairId" value="${esc(fairId)}">
          <label><span>Session / shift</span><select name="shift"><option>Planning</option><option>Pre-production</option><option>Load-in</option><option>Live stage</option><option>Closeout</option></select></label>
          <label class="full"><span>What changed?</span><textarea name="summary" required placeholder="Summarize the current production state."></textarea></label>
          <label><span>Blockers</span><textarea name="blockers" placeholder="What is still preventing progress?"></textarea></label>
          <label><span>Decisions</span><textarea name="decisions" placeholder="What was decided?"></textarea></label>
          <label class="full"><span>Next action</span><input name="nextAction" placeholder="The first thing Production should do next."></label>
          <button class="button primary" type="submit">Save Handoff</button>
        </form>
        <div class="handoff-history">${handoffs.length ? handoffs.slice(0,8).map(item=>`<article>
          <div><span>${esc(item.shift)}</span><time>${esc(Intel.formatTimeAgo(item.createdAt))}</time></div>
          <b>${esc(item.summary)}</b>
          ${item.blockers?`<p><strong>Blockers:</strong> ${esc(item.blockers)}</p>`:''}
          ${item.decisions?`<p><strong>Decision:</strong> ${esc(item.decisions)}</p>`:''}
          ${item.nextAction?`<p class="next-action"><strong>Next:</strong> ${esc(item.nextAction)}</p>`:''}
        </article>`).join('') : `<div class="workflow-empty"><b>No handoffs yet.</b><span>Capture the state so the next session starts with context.</span></div>`}</div>
      </div>
    </article>`;
  }

  function render(){
    const target=$('#orchestrationContent');
    if (!target) return;
    const state=Store.state;
    const fairId=state.preferences.workflowFairId || Intel.nextFair()?.id || state.fairs[0]?.id || '';
    const fair=fairRecord(fairId);
    if (!fair){
      target.innerHTML='<div class="workflow-empty"><b>Add a fair to start orchestration.</b></div>';
      return;
    }
    const score=workflowScore(fairId);
    const decision=gateDecision(fairId);
    const blocked=fairTasks(fairId).filter(task=>dependencyState(task).blocked||task.status==='waiting'||task.blockedBy).length;
    const next=nextAvailable(fairId).length;

    target.innerHTML=`
      <section class="orchestration-hero">
        <div>
          <span class="eyebrow">Production orchestration</span>
          <h1>${esc(fair.short)} Workflow</h1>
          <p>The OS connects phases, dependencies, readiness gates, playbooks, and handoffs into one production path.</p>
          <div class="workflow-fair-switcher">
            <label><span>Active fair</span><select id="workflowFairSelect">${state.fairs.map(item=>`<option value="${item.id}"${item.id===fairId?' selected':''}>${esc(item.name)}</option>`).join('')}</select></label>
            <button class="button ghost" data-workflow-report>Generate Readiness Report</button>
          </div>
        </div>
        <div class="orchestration-score">
          <span>Workflow health</span><strong>${score}%</strong>
          <i><b style="width:${score}%"></b></i>
          <small>${blocked} blocked · ${next} available now</small>
        </div>
        <div class="hero-decision ${decision.tone}">
          <span>Current decision</span><strong>${decision.status}</strong><small>${esc(decision.label)}</small>
        </div>
      </section>
      ${renderPhaseRail(fairId)}
      <div class="orchestration-grid">
        ${renderGatePanel(fairId)}
        ${renderNextWork(fairId)}
      </div>
      ${renderDependencies(fairId)}
      ${renderPlaybooks(fairId)}
      ${renderHandoffs(fairId)}
    `;

    const badge=$('#orchestrationBadge');
    if (badge) badge.textContent=gates(fairId).filter(g=>!g.pass).length || '';
  }

  function openWorkflow(){
    document.querySelector('[data-view="orchestration"]')?.click();
    requestAnimationFrame(render);
  }

  function commandResults(query){
    const q=String(query||'').trim().toLowerCase();
    if (!q) return [];
    const fairId=Store.state.preferences.workflowFairId;
    const commands=[
      {match:/(orchestration|workflow|production flow)/,label:'Open Production Orchestration',detail:'Phases, gates, playbooks, dependencies, and handoffs',action:'workflow:open'},
      {match:/(go no go|go\/no-go|readiness gate|production gate)/,label:'Open Go / No-Go Gate',detail:`Current decision: ${gateDecision(fairId).status}`,action:'workflow:open'},
      {match:/(next available|next work|what can we do now)/,label:'Show Next Available Work',detail:`${nextAvailable(fairId).length} unblocked task(s) are ready`,action:'workflow:open'},
      {match:/(playbook|30 day|7 day|fair setup)/,label:'Open Production Playbooks',detail:'Apply reusable connected task systems',action:'workflow:open'},
      {match:/(handoff|shift notes|session notes)/,label:'Create a Production Handoff',detail:'Preserve blockers, decisions, and next action',action:'workflow:open'}
    ];
    return commands.filter(command=>command.match.test(q));
  }

  function appendCommands(){
    const input=$('#globalSearch');
    const results=$('#searchResults');
    if (!input||!results) return;
    results.querySelector('.workflow-command-group')?.remove();
    const commands=commandResults(input.value);
    if (!commands.length) return;
    const group=document.createElement('section');
    group.className='os-command-group workflow-command-group';
    group.innerHTML=`<span class="eyebrow">Workflow commands</span>${commands.map(command=>`<button data-workflow-command="${command.action}"><span>◇</span><span><b>${esc(command.label)}</b><small>${esc(command.detail)}</small></span><em>Run ↵</em></button>`).join('')}`;
    results.prepend(group);
  }

  document.addEventListener('input',event=>{
    if (event.target?.id==='globalSearch') queueMicrotask(appendCommands);
  });

  document.addEventListener('change',event=>{
    if (event.target?.id==='workflowFairSelect'){
      Store.setPreference('workflowFairId',event.target.value);
      render();
    }
  });

  document.addEventListener('submit',event=>{
    if (event.target?.id==='handoffForm'){
      event.preventDefault();
      saveHandoff(event.target);
    }
  });

  document.addEventListener('click',event=>{
    if (event.target.closest('[data-workflow-open]')){ openWorkflow(); return; }
    const phase=event.target.closest('[data-workflow-phase]')?.dataset.workflowPhase;
    if (phase){
      const first=fairTasks(Store.state.preferences.workflowFairId).find(task=>inferPhase(task)===phase);
      if (first) document.querySelector(`[data-open-record="task:${first.id}"]`)?.click();
      return;
    }
    const playbook=event.target.closest('[data-apply-playbook]')?.dataset.applyPlaybook;
    if (playbook){ applyPlaybook(playbook,Store.state.preferences.workflowFairId); return; }
    const complete=event.target.closest('[data-workflow-complete]')?.dataset.workflowComplete;
    if (complete){ completeTask(complete); return; }
    const command=event.target.closest('[data-workflow-command]')?.dataset.workflowCommand;
    if (command){ $('#searchOverlay')?.classList.remove('open'); openWorkflow(); return; }
    if (event.target.closest('[data-workflow-report]')){
      Store.setPreference('reportFairId',Store.state.preferences.workflowFairId);
      Store.setPreference('reportType','readiness-report');
      document.querySelector('[data-view="briefing"]')?.click();
      return;
    }
    const gate=event.target.closest('[data-workflow-gate]')?.dataset.workflowGate;
    if (gate){
      const failed=gates(Store.state.preferences.workflowFairId).find(item=>item.key===gate&&!item.pass);
      if (failed) UI.toast('Gate requirement',failed.detail);
      else UI.toast('Gate passed','This production requirement is currently satisfied.');
    }
  });

  window.addEventListener('oatf:saved',render);
  window.OATFWorkflow={
    render,PHASES,PLAYBOOKS,inferPhase,phaseMetrics,workflowScore,gates,gateDecision,
    dependencyState,nextAvailable,applyPlaybook
  };

  ensureState();
  render();
})();