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
  const addDaysISO = (iso,days) => {
    const date = new Date(`${iso || todayISO()}T12:00:00`);
    date.setDate(date.getDate()+Number(days||0));
    return date.toISOString().slice(0,10);
  };

  const SCENARIO_TYPES = [
    {id:'performer-cancel',label:'Performer cancellation',icon:'◉',description:'Remove a performer from the simulated lineup and expose schedule, task, and readiness impact.'},
    {id:'schedule-delay',label:'Schedule delay',icon:'◷',description:'Push the run of show forward and measure transition, overrun, and public schedule pressure.'},
    {id:'stage-cut',label:'Stage-time reduction',icon:'≡',description:'Reduce available stage time and identify blocks that no longer fit.'},
    {id:'material-loss',label:'Material becomes unavailable',icon:'▣',description:'Simulate missing music, agreement, bio, photo, or parking information.'},
    {id:'contact-unavailable',label:'Contact unavailable',icon:'◎',description:'See which talent, tasks, and follow-ups depend on a production contact.'},
    {id:'deadline-compression',label:'Deadline compression',icon:'▦',description:'Move unfinished work earlier and forecast workload pressure.'}
  ];

  let workingScenario = null;
  let selectedBulkTasks = new Set();

  function ensureState(){
    const state=Store.state;
    let changed=false;
    if (!Array.isArray(state.scenarios)){state.scenarios=[];changed=true;}
    if (!Array.isArray(state.decisions)){state.decisions=[];changed=true;}
    if (!Array.isArray(state.spaces)){state.spaces=[];changed=true;}
    state.preferences.twinFairId ||= Intel.nextFair()?.id || state.fairs[0]?.id || '';
    state.preferences.twinScenarioType ||= 'performer-cancel';
    state.preferences.twinHorizon ||= 14;
    state.preferences.activeSpaceId ||= state.spaces[0]?.id || '';
    if(changed)Store.save({immediate:true});
  }

  function fair(id){return Store.get('fair',id);}
  function fairState(fairId){
    return {
      fair:clone(fair(fairId)),
      talent:clone(Store.state.talent.filter(item=>item.fairId===fairId)),
      tasks:clone(Store.state.tasks.filter(item=>item.fairId===fairId)),
      schedules:clone(Store.state.schedules.filter(item=>item.fairId===fairId)),
      contacts:clone(Store.state.contacts.filter(item=>item.fairIds?.includes(fairId))),
      deadlines:clone(Store.state.deadlines.filter(item=>item.fairId===fairId)),
      issues:clone(Store.state.issues.filter(item=>item.fairId===fairId)),
      files:clone(Store.state.files.filter(item=>item.fairId===fairId))
    };
  }

  function minutes(value){
    if(!value)return 0;
    const parts=String(value).split(':').map(Number);
    return parts[0]*60+(parts[1]||0);
  }
  function clock(total){
    total=(Number(total)+1440)%1440;
    return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  }

  function localScheduleIssues(slots){
    const sorted=[...slots].sort((a,b)=>minutes(a.startTime)-minutes(b.startTime));
    const issues=[];
    sorted.forEach((slot,index)=>{
      const start=minutes(slot.startTime),end=minutes(slot.endTime);
      if(end<=start)issues.push({severity:'critical',title:`${slot.title} has an invalid time range`,slotId:slot.id});
      const next=sorted[index+1];
      if(next){
        const gap=minutes(next.startTime)-end;
        const required=Number(slot.bufferAfter||0);
        if(gap<0)issues.push({severity:'critical',title:`${slot.title} overlaps ${next.title}`,slotId:slot.id});
        else if(gap<required)issues.push({severity:'warning',title:`${slot.title} has only ${gap} transition minutes`,slotId:slot.id});
        else if(gap>35)issues.push({severity:'info',title:`${gap}-minute programming gap after ${slot.title}`,slotId:slot.id});
      }
    });
    return issues;
  }

  function localTalentMissing(talent){
    const missing=[];
    if(['Contracted','Ready'].includes(talent.status)){
      if(talent.agreementStatus!=='Received')missing.push('agreement');
      if(talent.musicStatus!=='Received')missing.push('music');
      if(talent.bioStatus!=='Received')missing.push('bio');
      if(talent.photoStatus!=='Received')missing.push('photo');
      if(!['Received','Not needed'].includes(talent.parkingStatus))missing.push('parking');
      if(!talent.arrivalTime)missing.push('arrival');
    }
    return missing;
  }

  function localReadiness(data){
    const tasks=data.tasks||[];
    const talent=data.talent||[];
    const schedules=data.schedules||[];
    const taskScore=tasks.length?tasks.reduce((sum,task)=>sum+({complete:100,inprogress:62,waiting:28,todo:20}[task.status]||20),0)/tasks.length:35;
    const talentScore=talent.length?talent.reduce((sum,item)=>{
      const missing=localTalentMissing(item).length;
      return sum+Math.max(0,100-missing*15-(['Submitted','Reviewing'].includes(item.status)?30:item.status==='Offered'?18:0));
    },0)/talent.length:25;
    const scheduleIssues=localScheduleIssues(schedules).filter(issue=>issue.severity!=='info').length;
    const scheduleScore=schedules.length?Math.max(0,100-scheduleIssues*18):0;
    const overdue=tasks.filter(task=>task.status!=='complete'&&Intel.daysUntil(task.due)<0).length;
    const openHigh=(data.issues||[]).filter(issue=>issue.status!=='Resolved'&&issue.severity==='High').length;
    return Math.max(0,Math.min(100,Math.round(taskScore*.36+talentScore*.36+scheduleScore*.28-overdue*4-openHigh*8)));
  }

  function scenarioInputs(type,fairId){
    const talent=Store.state.talent.filter(item=>item.fairId===fairId);
    const contacts=Store.state.contacts.filter(item=>item.fairIds?.includes(fairId));
    if(type==='performer-cancel')return `
      <label><span>Performer</span><select name="entityId">${talent.map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join('')}</select></label>
      <label><span>Replacement strategy</span><select name="strategy"><option value="gap">Leave programming gap</option><option value="extend">Extend neighboring blocks</option><option value="hold">Create replacement hold</option></select></label>`;
    if(type==='schedule-delay')return `
      <label><span>Delay</span><select name="amount"><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option></select></label>
      <label><span>Starting with</span><select name="entityId"><option value="">Entire run of show</option>${Store.state.schedules.filter(item=>item.fairId===fairId).map(item=>`<option value="${item.id}">${esc(item.title)} · ${esc(Intel.formatClock(item.startTime))}</option>`).join('')}</select></label>`;
    if(type==='stage-cut')return `
      <label><span>Minutes removed</span><select name="amount"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
      <label><span>Cut from</span><select name="strategy"><option value="end">End of program</option><option value="transitions">Transition buffers first</option></select></label>`;
    if(type==='material-loss')return `
      <label><span>Performer</span><select name="entityId">${talent.map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join('')}</select></label>
      <label><span>Material</span><select name="material"><option value="musicStatus">Music</option><option value="agreementStatus">Agreement</option><option value="bioStatus">Bio</option><option value="photoStatus">Photo</option><option value="parkingStatus">Parking</option></select></label>`;
    if(type==='contact-unavailable')return `
      <label><span>Contact</span><select name="entityId">${contacts.map(item=>`<option value="${item.id}">${esc(item.name)} · ${esc(item.role||item.organization)}</option>`).join('')}</select></label>
      <label><span>Unavailable for</span><select name="amount"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></label>`;
    return `
      <label><span>Move deadlines earlier</span><select name="amount"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></label>
      <label><span>Scope</span><select name="strategy"><option value="critical">High-impact work only</option><option value="all">All unfinished work</option></select></label>`;
  }

  function buildScenario(form){
    const values=Object.fromEntries(new FormData(form).entries());
    const fairId=values.fairId;
    const type=values.type;
    const before=fairState(fairId);
    const after=clone(before);
    const changes=[];
    const affected=[];
    const recommendations=[];
    const amount=Number(values.amount||0);

    if(type==='performer-cancel'){
      const talent=after.talent.find(item=>item.id===values.entityId);
      if(talent){
        after.talent=after.talent.filter(item=>item.id!==talent.id);
        const removedSlots=after.schedules.filter(slot=>slot.talentId===talent.id);
        after.schedules=after.schedules.filter(slot=>slot.talentId!==talent.id);
        const linkedTasks=after.tasks.filter(task=>task.talentId===talent.id&&task.status!=='complete');
        changes.push(`Remove ${talent.name} from the simulated talent lineup.`);
        changes.push(`Remove ${removedSlots.length} connected run-of-show block${removedSlots.length===1?'':'s'}.`);
        affected.push(...removedSlots.map(slot=>({type:'schedule',id:slot.id,label:slot.title})));
        affected.push(...linkedTasks.map(task=>({type:'task',id:task.id,label:task.title})));
        if(values.strategy==='hold'&&removedSlots.length){
          removedSlots.forEach(slot=>after.schedules.push({...slot,id:`sim-hold-${slot.id}`,title:'Replacement Talent Hold',publicTitle:'To Be Announced',talentId:'',status:'Draft'}));
          changes.push('Create replacement holds at the removed stage times.');
        }
        recommendations.push(linkedTasks.length?'Review and close performer-specific tasks.':'No incomplete performer-specific tasks remain.');
        recommendations.push('Confirm whether public schedule language needs to change.');
      }
    }

    if(type==='schedule-delay'){
      const sorted=[...after.schedules].sort((a,b)=>minutes(a.startTime)-minutes(b.startTime));
      const startIndex=values.entityId?Math.max(0,sorted.findIndex(slot=>slot.id===values.entityId)):0;
      sorted.slice(startIndex).forEach(slot=>{
        slot.startTime=clock(minutes(slot.startTime)+amount);
        slot.endTime=clock(minutes(slot.endTime)+amount);
        affected.push({type:'schedule',id:slot.id,label:slot.title});
      });
      after.schedules=sorted;
      changes.push(`Push ${sorted.length-startIndex} stage block${sorted.length-startIndex===1?'':'s'} by ${amount} minutes.`);
      recommendations.push('Notify the fair and backstage team before publishing revised times.');
    }

    if(type==='stage-cut'){
      const sorted=[...after.schedules].sort((a,b)=>minutes(a.startTime)-minutes(b.startTime));
      if(values.strategy==='transitions'){
        let remaining=amount;
        sorted.forEach(slot=>{
          if(remaining<=0)return;
          const reduction=Math.min(Number(slot.bufferAfter||0),remaining);
          slot.bufferAfter=Math.max(0,Number(slot.bufferAfter||0)-reduction);
          remaining-=reduction;
          if(reduction)affected.push({type:'schedule',id:slot.id,label:slot.title});
        });
        if(remaining>0){
          const last=sorted[sorted.length-1];
          if(last){last.endTime=clock(minutes(last.endTime)-remaining);affected.push({type:'schedule',id:last.id,label:last.title});}
        }
        changes.push(`Recover ${amount} minutes from transitions first, then the final block.`);
      }else{
        const last=sorted[sorted.length-1];
        if(last){
          const newEnd=minutes(last.endTime)-amount;
          if(newEnd<=minutes(last.startTime))after.schedules=sorted.filter(slot=>slot.id!==last.id);
          else last.endTime=clock(newEnd);
          affected.push({type:'schedule',id:last.id,label:last.title});
          changes.push(`Remove ${amount} minutes from the end of ${last.title}.`);
        }
      }
      after.schedules=sorted.filter(slot=>minutes(slot.endTime)>minutes(slot.startTime));
      recommendations.push('Review performer commitments before accepting reduced performance time.');
    }

    if(type==='material-loss'){
      const talent=after.talent.find(item=>item.id===values.entityId);
      if(talent){
        talent[values.material]='Pending';
        const label={musicStatus:'music',agreementStatus:'agreement',bioStatus:'bio',photoStatus:'photo',parkingStatus:'parking'}[values.material]||'material';
        changes.push(`Mark ${talent.name} ${label} as unavailable.`);
        affected.push({type:'talent',id:talent.id,label:talent.name});
        recommendations.push(`Create a recovery task for ${talent.name}'s ${label}.`);
      }
    }

    if(type==='contact-unavailable'){
      const contact=after.contacts.find(item=>item.id===values.entityId);
      if(contact){
        contact.status='Unavailable';
        contact.nextFollowUp=addDaysISO(todayISO(),amount);
        const linkedTalent=after.talent.filter(item=>item.contactId===contact.id);
        const linkedTasks=after.tasks.filter(item=>item.contactId===contact.id&&item.status!=='complete');
        changes.push(`Mark ${contact.name} unavailable for ${amount} day${amount===1?'':'s'}.`);
        affected.push(...linkedTalent.map(item=>({type:'talent',id:item.id,label:item.name})));
        affected.push(...linkedTasks.map(item=>({type:'task',id:item.id,label:item.title})));
        recommendations.push(linkedTasks.length?'Assign a backup owner for connected work.':'No active tasks currently depend on this contact.');
      }
    }

    if(type==='deadline-compression'){
      const selected=after.tasks.filter(task=>task.status!=='complete'&&(values.strategy==='all'||task.priority==='High'||task.impact==='High'));
      selected.forEach(task=>{
        task.due=addDaysISO(task.due,-amount);
        affected.push({type:'task',id:task.id,label:task.title});
      });
      changes.push(`Move ${selected.length} unfinished task deadline${selected.length===1?'':'s'} ${amount} day${amount===1?'':'s'} earlier.`);
      recommendations.push('Use the pressure forecast to rebalance work before confirming the new dates.');
    }

    const beforeScore=localReadiness(before);
    const afterScore=localReadiness(after);
    const beforeIssues=localScheduleIssues(before.schedules);
    const afterIssues=localScheduleIssues(after.schedules);

    workingScenario={
      id:Store.uid('scenario'),
      name:SCENARIO_TYPES.find(item=>item.id===type)?.label || 'Production scenario',
      type,fairId,inputs:values,before,after,changes,affected,recommendations,
      metrics:{
        beforeScore,afterScore,delta:afterScore-beforeScore,
        beforeScheduleIssues:beforeIssues.filter(item=>item.severity!=='info').length,
        afterScheduleIssues:afterIssues.filter(item=>item.severity!=='info').length,
        activeTasksBefore:before.tasks.filter(item=>item.status!=='complete').length,
        activeTasksAfter:after.tasks.filter(item=>item.status!=='complete').length
      },
      status:'Draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    };
    render();
  }

  function applyScenario(){
    const scenario=workingScenario;
    if(!scenario)return;
    window.OATFSystem?.createSnapshot?.();
    const before=scenario.before,after=scenario.after;

    const sync=(type,beforeRows,afterRows)=>{
      const afterIds=new Set(afterRows.map(item=>item.id));
      beforeRows.filter(item=>!afterIds.has(item.id)).forEach(item=>Store.remove(type,item.id));
      afterRows.forEach(item=>{
        const clean=clone(item);
        if(String(clean.id).startsWith('sim-hold-'))delete clean.id;
        Store.upsert(type,clean);
      });
    };

    if(scenario.type==='performer-cancel'){
      sync('talent',before.talent,after.talent);
      sync('schedule',before.schedules,after.schedules);
    }else if(['schedule-delay','stage-cut'].includes(scenario.type)){
      sync('schedule',before.schedules,after.schedules);
    }else if(scenario.type==='material-loss'){
      sync('talent',before.talent,after.talent);
    }else if(scenario.type==='contact-unavailable'){
      sync('contact',before.contacts,after.contacts);
    }else if(scenario.type==='deadline-compression'){
      sync('task',before.tasks,after.tasks);
    }

    scenario.status='Committed';
    scenario.committedAt=new Date().toISOString();
    Store.upsert('scenario',scenario);
    Store.upsert('decision',{
      fairId:scenario.fairId,
      title:`Committed scenario: ${scenario.name}`,
      decision:scenario.changes.join(' '),
      rationale:`Twin Lab forecast readiness ${scenario.metrics.beforeScore}% → ${scenario.metrics.afterScore}% (${scenario.metrics.delta>=0?'+':''}${scenario.metrics.delta}).`,
      status:'Active',author:'Production'
    });
    Store.log('Production',`committed the ${scenario.name} Twin Lab scenario.`,'scenario',scenario.id,scenario.fairId);
    Store.save({immediate:true});
    UI.toast('Scenario committed','A checkpoint was created before the approved changes were applied.');
    workingScenario=null;
    render();
  }

  function saveScenario(){
    if(!workingScenario)return;
    const copy={...workingScenario,status:'Saved',updatedAt:new Date().toISOString()};
    Store.upsert('scenario',copy);
    UI.toast('Scenario saved','The simulation is preserved without changing live Production data.');
    render();
  }

  function deleteScenario(id){
    Store.remove('scenario',id);
    UI.toast('Scenario removed','Live Production data was not changed.');
    render();
  }

  function pressureWindow(days){
    const fairId=Store.state.preferences.twinFairId;
    const tasks=Store.state.tasks.filter(task=>task.fairId===fairId&&task.status!=='complete');
    const deadlines=Store.state.deadlines.filter(item=>item.fairId===fairId);
    const dueTasks=tasks.filter(task=>{const d=Intel.daysUntil(task.due);return d>=0&&d<=days;});
    const dueDeadlines=deadlines.filter(item=>{const d=Intel.daysUntil(item.date);return d>=0&&d<=days;});
    const hours=dueTasks.reduce((sum,task)=>sum+Number(task.estimatedHours||1),0);
    const high=dueTasks.filter(task=>task.priority==='High'||task.impact==='High').length;
    return {days,dueTasks,dueDeadlines,hours,high,load:Math.min(100,Math.round(hours/(days*1.5)*100))};
  }

  function renderHorizon(){
    const windows=[7,14,30].map(pressureWindow);
    return `<article class="twin-panel horizon-panel">
      <div class="twin-panel-head"><div><span class="eyebrow">Capacity forecast</span><h3>Production Horizon</h3></div><span class="twin-chip">Estimated local workload</span></div>
      <div class="horizon-grid">${windows.map(item=>`<article class="${item.load>=80?'critical':item.load>=50?'warning':'healthy'}">
        <span>Next ${item.days} days</span><strong>${item.hours}h</strong><small>${item.dueTasks.length} tasks · ${item.high} high impact · ${item.dueDeadlines.length} deadlines</small>
        <i><b style="width:${item.load}%"></b></i><em>${item.load}% modeled load</em>
      </article>`).join('')}</div>
    </article>`;
  }

  function relationshipGroups(fairId){
    const data=fairState(fairId);
    return [
      {type:'talent',label:'Talent',icon:'◉',items:data.talent,health:item=>100-localTalentMissing(item).length*15},
      {type:'task',label:'Tasks',icon:'✓',items:data.tasks,health:item=>item.status==='complete'?100:item.status==='inprogress'?65:item.status==='waiting'?25:35},
      {type:'contact',label:'Contacts',icon:'◎',items:data.contacts,health:item=>item.status==='Active'?100:item.status==='Waiting'?55:35},
      {type:'schedule',label:'Run of Show',icon:'≡',items:data.schedules,health:item=>localScheduleIssues(data.schedules).some(issue=>issue.slotId===item.id&&issue.severity==='critical')?20:85},
      {type:'issue',label:'Issues',icon:'⚠',items:data.issues,health:item=>item.status==='Resolved'?100:item.severity==='High'?15:45},
      {type:'file',label:'Files',icon:'▣',items:data.files,health:()=>80}
    ];
  }

  function renderRelationshipMap(){
    const fairId=Store.state.preferences.twinFairId;
    const f=fair(fairId);
    const groups=relationshipGroups(fairId);
    return `<article class="twin-panel relationship-panel">
      <div class="twin-panel-head"><div><span class="eyebrow">Connected production graph</span><h3>${esc(f?.short||'Fair')} Relationship Map</h3></div><span class="twin-chip">${groups.reduce((sum,group)=>sum+group.items.length,0)} connected records</span></div>
      <div class="relationship-map">
        <button class="relationship-core" data-open-record="fair:${fairId}"><span>${esc(f?.code||'F')}</span><b>${esc(f?.short||'Fair')}</b><small>${localReadiness(fairState(fairId))}% twin readiness</small></button>
        <div class="relationship-spokes">${groups.map(group=>`<section>
          <header><span>${group.icon}</span><b>${group.label}</b><em>${group.items.length}</em></header>
          <div>${group.items.slice(0,6).map(item=>{
            const health=Math.max(0,Math.min(100,group.health(item)));
            return `<button data-open-record="${group.type}:${item.id}"><span><b>${esc(UI.recordTitle(group.type,item))}</b><small>${esc(UI.recordSubtitle(group.type,item))}</small></span><i class="${health<40?'risk':health<75?'watch':'good'}">${health}</i></button>`;
          }).join('') || `<small class="relationship-empty">No connected ${group.label.toLowerCase()}.</small>`}</div>
        </section>`).join('')}</div>
      </div>
    </article>`;
  }

  function saveSpace(){
    const name=prompt('Name this Production Space:','Fair Focus');
    if(!name?.trim())return;
    const currentView=[...document.querySelectorAll('.view')].find(view=>view.classList.contains('active'))?.id.replace('view-','')||'today';
    const space=Store.upsert('space',{
      name:name.trim(),icon:'◇',system:false,
      view:currentView,
      fairId:Store.state.preferences.twinFairId,
      mode:Store.state.preferences.focusMode||'planning',
      lens:Store.state.preferences.selectedLens||'exceptions',
      description:`Saved ${fair(Store.state.preferences.twinFairId)?.short||'Production'} workspace.`
    });
    Store.state.preferences.activeSpaceId=space.id;
    Store.save({immediate:true});
    UI.toast('Production Space saved',`${space.name} can restore this operating context.`);
    render();
  }

  function launchSpace(id){
    const space=Store.get('space',id);
    if(!space)return;
    Store.state.preferences.activeSpaceId=space.id;
    if(space.fairId){
      Store.state.preferences.twinFairId=space.fairId;
      Store.state.preferences.osFairId=space.fairId;
      Store.state.preferences.workflowFairId=space.fairId;
      Store.state.preferences.scheduleFairId=space.fairId;
      Store.state.preferences.dayOfFairId=space.fairId;
      Store.state.preferences.reportFairId=space.fairId;
    }
    Store.state.preferences.selectedLens=space.lens||'exceptions';
    Store.state.preferences.focusMode=space.mode||'planning';
    Store.save({immediate:true});
    if(window.OATFKernel?.setMode && space.mode)window.OATFKernel.setMode(space.mode);
    document.querySelector(`[data-view="${space.view||'today'}"]`)?.click();
    UI.toast(`${space.name} opened`,space.description);
  }

  function renderSpaces(){
    const active=Store.state.preferences.activeSpaceId;
    return `<article class="twin-panel spaces-panel">
      <div class="twin-panel-head"><div><span class="eyebrow">Persistent operating contexts</span><h3>Production Spaces</h3></div><button class="button ghost small-button" data-save-space>Save Current Space</button></div>
      <div class="spaces-grid">${Store.state.spaces.map(space=>`<article class="${space.id===active?'active':''}">
        <button data-launch-space="${space.id}"><span>${space.icon||'◇'}</span><div><b>${esc(space.name)}</b><small>${esc(space.description||'Saved Production workspace.')}</small></div><em>Open</em></button>
        ${space.system?'':`<button class="space-delete" data-delete-space="${space.id}" aria-label="Delete space">×</button>`}
      </article>`).join('')}</div>
    </article>`;
  }

  function bulkTasks(){
    const fairId=Store.state.preferences.twinFairId;
    return Store.state.tasks.filter(task=>task.fairId===fairId&&task.status!=='complete')
      .sort((a,b)=>((({High:0,Medium:1,Low:2}[a.priority] ?? 1)-({High:0,Medium:1,Low:2}[b.priority] ?? 1)) || ((Intel.daysUntil(a.due) ?? 9999)-(Intel.daysUntil(b.due) ?? 9999))));
  }

  function applyBulk(action){
    const tasks=bulkTasks().filter(task=>selectedBulkTasks.has(task.id));
    if(!tasks.length){UI.toast('Nothing selected','Choose one or more tasks first.');return;}
    window.OATFSystem?.createSnapshot?.();
    tasks.forEach(task=>{
      const update={...task};
      if(action==='complete'){update.status='complete';update.completedAt=new Date().toISOString();}
      if(action==='progress')update.status='inprogress';
      if(action==='tomorrow')update.due=addDaysISO(update.due,1);
      if(action==='week')update.due=addDaysISO(update.due,7);
      if(action==='production')update.owner='Production';
      Store.upsert('task',update);
    });
    Store.log('Production',`applied “${action}” to ${tasks.length} task${tasks.length===1?'':'s'} from the Bulk Deck.`,'','',Store.state.preferences.twinFairId);
    Store.save({immediate:true});
    selectedBulkTasks.clear();
    UI.toast('Bulk action complete',`${tasks.length} task${tasks.length===1?'':'s'} updated after creating a checkpoint.`);
    render();
  }

  function renderBulkDeck(){
    const tasks=bulkTasks();
    return `<article class="twin-panel bulk-panel">
      <div class="twin-panel-head"><div><span class="eyebrow">Multi-record operations</span><h3>Bulk Deck</h3></div><span class="twin-chip">${selectedBulkTasks.size} selected</span></div>
      <div class="bulk-toolbar">
        <button data-bulk-select-all>Select All</button><button data-bulk-action="progress">Start</button><button data-bulk-action="complete">Complete</button><button data-bulk-action="tomorrow">Due +1 Day</button><button data-bulk-action="week">Due +7 Days</button><button data-bulk-action="production">Assign Production</button>
      </div>
      <div class="bulk-list">${tasks.length?tasks.map(task=>`<label class="${selectedBulkTasks.has(task.id)?'selected':''}">
        <input type="checkbox" data-bulk-task="${task.id}"${selectedBulkTasks.has(task.id)?' checked':''}>
        <span class="bulk-priority ${String(task.priority).toLowerCase()}">${esc(task.priority)}</span>
        <span><b>${esc(task.title)}</b><small>${esc(task.owner||'Production')} · ${esc(Intel.relativeDate(task.due))}</small></span>
        <em>${esc(task.status.replace('inprogress','In Progress'))}</em>
      </label>`).join(''):`<div class="twin-empty"><b>No unfinished tasks.</b><span>This fair has no work available for bulk operations.</span></div>`}</div>
    </article>`;
  }

  function saveDecision(form){
    const data=Object.fromEntries(new FormData(form).entries());
    if(!data.title?.trim()||!data.decision?.trim())return;
    Store.upsert('decision',{...data,author:'Production',status:data.status||'Active'});
    Store.log('Production',`recorded the decision “${data.title}”.`,'decision','',data.fairId);
    form.reset();
    Store.save({immediate:true});
    UI.toast('Decision remembered','The rationale is now part of Production memory.');
    render();
  }

  function renderDecisionLog(){
    const fairId=Store.state.preferences.twinFairId;
    const decisions=Store.state.decisions.filter(item=>item.fairId===fairId).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
    return `<article class="twin-panel decision-panel">
      <div class="twin-panel-head"><div><span class="eyebrow">Production memory</span><h3>Decision Log</h3></div><span class="twin-chip">${decisions.length} decision${decisions.length===1?'':'s'}</span></div>
      <div class="decision-layout">
        <form id="decisionForm">
          <input type="hidden" name="fairId" value="${esc(fairId)}">
          <label><span>Decision title</span><input name="title" required placeholder="What was decided?"></label>
          <label><span>Status</span><select name="status"><option>Active</option><option>Superseded</option><option>Completed</option></select></label>
          <label class="full"><span>Decision</span><textarea name="decision" required placeholder="Record the decision clearly."></textarea></label>
          <label class="full"><span>Rationale</span><textarea name="rationale" placeholder="Why was this the right production choice?"></textarea></label>
          <button class="button primary" type="submit">Remember Decision</button>
        </form>
        <div class="decision-list">${decisions.length?decisions.slice(0,10).map(item=>`<article>
          <div><span>${esc(item.status)}</span><time>${esc(Intel.formatTimeAgo(item.updatedAt||item.createdAt))}</time></div>
          <b>${esc(item.title)}</b><p>${esc(item.decision)}</p>${item.rationale?`<small><strong>Why:</strong> ${esc(item.rationale)}</small>`:''}
        </article>`).join(''):`<div class="twin-empty"><b>No decisions recorded.</b><span>Capture production choices so the “why” is never lost.</span></div>`}</div>
      </div>
    </article>`;
  }

  function renderScenarioBuilder(){
    const fairId=Store.state.preferences.twinFairId;
    const type=Store.state.preferences.twinScenarioType;
    const scenarioType=SCENARIO_TYPES.find(item=>item.id===type);
    return `<article class="twin-panel scenario-builder">
      <div class="twin-panel-head"><div><span class="eyebrow">Non-destructive simulation</span><h3>Scenario Builder</h3></div><span class="twin-chip">Live data stays untouched</span></div>
      <form id="scenarioForm">
        <div class="scenario-type-grid">${SCENARIO_TYPES.map(item=>`<label class="${item.id===type?'active':''}">
          <input type="radio" name="type" value="${item.id}"${item.id===type?' checked':''}>
          <span>${item.icon}</span><b>${esc(item.label)}</b><small>${esc(item.description)}</small>
        </label>`).join('')}</div>
        <input type="hidden" name="fairId" value="${esc(fairId)}">
        <div class="scenario-fields">${scenarioInputs(type,fairId)}</div>
        <button class="button primary" type="submit">Run Simulation</button>
      </form>
      ${workingScenario?renderScenarioResult(workingScenario):`<div class="twin-empty scenario-empty"><b>Choose a production disruption.</b><span>The Twin Lab will calculate readiness, schedule, and record impact before anything changes.</span></div>`}
    </article>`;
  }

  function renderScenarioResult(scenario){
    const metrics=scenario.metrics;
    const delta=metrics.delta;
    return `<section class="scenario-result">
      <div class="scenario-result-head">
        <div><span class="eyebrow">Simulation result</span><h3>${esc(scenario.name)}</h3><p>${esc(fair(scenario.fairId)?.name||'Production')}</p></div>
        <div class="scenario-delta ${delta<0?'negative':delta>0?'positive':'neutral'}"><span>Readiness impact</span><strong>${delta>0?'+':''}${delta}</strong><small>${metrics.beforeScore}% → ${metrics.afterScore}%</small></div>
      </div>
      <div class="scenario-metrics">
        <div><span>Schedule warnings</span><strong>${metrics.beforeScheduleIssues} → ${metrics.afterScheduleIssues}</strong></div>
        <div><span>Affected records</span><strong>${scenario.affected.length}</strong></div>
        <div><span>Active tasks</span><strong>${metrics.activeTasksBefore} → ${metrics.activeTasksAfter}</strong></div>
        <div><span>Confidence</span><strong>${scenario.affected.length<8?'High':'Modeled'}</strong></div>
      </div>
      <div class="scenario-columns">
        <div><h4>Modeled changes</h4>${scenario.changes.map(item=>`<p>→ ${esc(item)}</p>`).join('')}</div>
        <div><h4>Recommended response</h4>${scenario.recommendations.map(item=>`<p>✓ ${esc(item)}</p>`).join('')}</div>
      </div>
      ${scenario.affected.length?`<div class="affected-strip">${scenario.affected.slice(0,12).map(item=>`<button data-open-record="${item.type}:${item.id}">${esc(item.label)}</button>`).join('')}</div>`:''}
      <div class="scenario-actions"><button class="button ghost" data-save-scenario>Save Without Applying</button><button class="button primary" data-apply-scenario>Approve & Commit</button></div>
    </section>`;
  }

  function renderSavedScenarios(){
    const fairId=Store.state.preferences.twinFairId;
    const scenarios=Store.state.scenarios.filter(item=>item.fairId===fairId).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
    return `<article class="twin-panel saved-scenarios">
      <div class="twin-panel-head"><div><span class="eyebrow">Alternative futures</span><h3>Saved Scenarios</h3></div><span class="twin-chip">${scenarios.length}</span></div>
      <div class="saved-scenario-list">${scenarios.length?scenarios.slice(0,10).map(item=>`<article>
        <span class="scenario-status ${String(item.status).toLowerCase()}">${esc(item.status)}</span>
        <div><b>${esc(item.name)}</b><small>${esc(Intel.formatTimeAgo(item.updatedAt||item.createdAt))} · readiness ${item.metrics?.beforeScore||0}% → ${item.metrics?.afterScore||0}%</small></div>
        <button data-load-scenario="${item.id}">Open</button><button data-delete-scenario="${item.id}">×</button>
      </article>`).join(''):`<div class="twin-empty"><b>No saved simulations.</b><span>Run a scenario and save it for later comparison.</span></div>`}</div>
    </article>`;
  }

  function render(){
    const target=$('#twinContent');
    if(!target)return;
    const fairId=Store.state.preferences.twinFairId||Store.state.fairs[0]?.id||'';
    const f=fair(fairId);
    const live=fairState(fairId);
    const readiness=localReadiness(live);
    const scheduleRisks=localScheduleIssues(live.schedules).filter(item=>item.severity!=='info').length;
    const missing=live.talent.reduce((sum,item)=>sum+localTalentMissing(item).length,0);
    const blocked=live.tasks.filter(item=>item.status==='waiting'||item.blockedBy||item.dependsOnTaskId&&Store.get('task',item.dependsOnTaskId)?.status!=='complete').length;

    target.innerHTML=`
      <section class="twin-hero">
        <div>
          <span class="eyebrow">Production digital twin</span>
          <h1>Test the future before Production lives it.</h1>
          <p>Model disruptions, see ripple effects across connected records, preserve the decision, and commit only approved changes.</p>
          <div class="twin-fair-select"><label><span>Digital twin fair</span><select id="twinFairSelect">${Store.state.fairs.map(item=>`<option value="${item.id}"${item.id===fairId?' selected':''}>${esc(item.name)}</option>`).join('')}</select></label><button class="button ghost" data-save-space>Save This Space</button></div>
        </div>
        <div class="twin-live-score"><span>Live twin health</span><strong>${readiness}%</strong><i><b style="width:${readiness}%"></b></i><small>${esc(f?.short||'Production')} current state</small></div>
        <div class="twin-telemetry"><div><span>Schedule risks</span><strong>${scheduleRisks}</strong></div><div><span>Missing materials</span><strong>${missing}</strong></div><div><span>Blocked work</span><strong>${blocked}</strong></div></div>
      </section>
      ${renderSpaces()}
      <div class="twin-grid">${renderScenarioBuilder()}${renderSavedScenarios()}</div>
      ${renderHorizon()}
      ${renderRelationshipMap()}
      <div class="twin-grid">${renderBulkDeck()}${renderDecisionLog()}</div>
    `;

    const badge=$('#twinBadge');
    if(badge)badge.textContent=Store.state.scenarios.filter(item=>item.status==='Saved').length||'';
  }

  function openTwin(){
    document.querySelector('[data-view="twin"]')?.click();
    requestAnimationFrame(render);
  }

  function appendCommands(){
    const input=$('#globalSearch'),results=$('#searchResults');
    if(!input||!results)return;
    results.querySelector('.twin-command-group')?.remove();
    const q=input.value.trim().toLowerCase();
    if(!q)return;
    const commands=[
      {test:/(twin lab|digital twin|scenario lab|simulation)/,label:'Open Production Twin Lab',detail:'Simulations, impact analysis, Spaces, and relationship map',action:'open'},
      {test:/(simulate performer cancellation|performer cancels|talent cancellation)/,label:'Simulate Performer Cancellation',detail:'Model lineup, schedule, task, and readiness impact',action:'scenario:performer-cancel'},
      {test:/(simulate delay|schedule delay|running late)/,label:'Simulate Schedule Delay',detail:'Push the run of show without changing live data',action:'scenario:schedule-delay'},
      {test:/(stage time cut|reduce stage time|shorter stage)/,label:'Simulate Stage-Time Reduction',detail:'Identify blocks and transitions that no longer fit',action:'scenario:stage-cut'},
      {test:/(relationship map|connected records|production graph)/,label:'Open Relationship Map',detail:'See fair, talent, tasks, contacts, schedule, issues, and files',action:'open'},
      {test:/(bulk deck|bulk tasks|multi select)/,label:'Open Bulk Deck',detail:`${bulkTasks().length} unfinished task(s) available`,action:'open'},
      {test:/(decision log|production decisions)/,label:'Open Decision Log',detail:`${Store.state.decisions.length} decision(s) remembered`,action:'open'}
    ].filter(command=>command.test.test(q));
    if(!commands.length)return;
    const group=document.createElement('section');
    group.className='os-command-group twin-command-group';
    group.innerHTML=`<span class="eyebrow">Twin commands</span>${commands.map(command=>`<button data-twin-command="${command.action}"><span>⬡</span><span><b>${esc(command.label)}</b><small>${esc(command.detail)}</small></span><em>Run ↵</em></button>`).join('')}`;
    results.prepend(group);
  }

  document.addEventListener('input',event=>{
    if(event.target?.id==='globalSearch')queueMicrotask(appendCommands);
  });

  document.addEventListener('change',event=>{
    if(event.target?.id==='twinFairSelect'){
      Store.state.preferences.twinFairId=event.target.value;
      workingScenario=null;selectedBulkTasks.clear();
      Store.save();render();return;
    }
    if(event.target?.name==='type'&&event.target.closest('#scenarioForm')){
      Store.state.preferences.twinScenarioType=event.target.value;
      Store.save();workingScenario=null;render();return;
    }
    const task=event.target.closest('[data-bulk-task]');
    if(task){
      if(task.checked)selectedBulkTasks.add(task.dataset.bulkTask);
      else selectedBulkTasks.delete(task.dataset.bulkTask);
      render();
    }
  });

  document.addEventListener('submit',event=>{
    if(event.target?.id==='scenarioForm'){event.preventDefault();buildScenario(event.target);return;}
    if(event.target?.id==='decisionForm'){event.preventDefault();saveDecision(event.target);}
  });

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-twin-open]')){openTwin();return;}
    if(event.target.closest('[data-save-scenario]')){saveScenario();return;}
    if(event.target.closest('[data-apply-scenario]')){applyScenario();return;}

    const load=event.target.closest('[data-load-scenario]')?.dataset.loadScenario;
    if(load){workingScenario=clone(Store.get('scenario',load));render();return;}
    const remove=event.target.closest('[data-delete-scenario]')?.dataset.deleteScenario;
    if(remove){deleteScenario(remove);return;}

    if(event.target.closest('[data-save-space]')){saveSpace();return;}
    const launch=event.target.closest('[data-launch-space]')?.dataset.launchSpace;
    if(launch){launchSpace(launch);return;}
    const deleteSpace=event.target.closest('[data-delete-space]')?.dataset.deleteSpace;
    if(deleteSpace){Store.remove('space',deleteSpace);render();return;}

    if(event.target.closest('[data-bulk-select-all]')){
      const tasks=bulkTasks();
      if(selectedBulkTasks.size===tasks.length)selectedBulkTasks.clear();
      else tasks.forEach(task=>selectedBulkTasks.add(task.id));
      render();return;
    }
    const bulk=event.target.closest('[data-bulk-action]')?.dataset.bulkAction;
    if(bulk){applyBulk(bulk);return;}

    const command=event.target.closest('[data-twin-command]')?.dataset.twinCommand;
    if(command){
      $('#searchOverlay')?.classList.remove('open');
      if(command.startsWith('scenario:')){
        Store.state.preferences.twinScenarioType=command.split(':')[1];
        Store.save();workingScenario=null;openTwin();
      }else openTwin();
    }
  });

  window.addEventListener('oatf:saved',render);

  window.OATFTwin={
    render,openTwin,buildScenario,applyScenario,localReadiness,localScheduleIssues,
    pressureWindow,relationshipGroups,SCENARIO_TYPES
  };

  ensureState();
  render();
})();