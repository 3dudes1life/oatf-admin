(() => {
  'use strict';

  const Store = window.OATFStore;
  const Intel = window.OATFIntel;
  const UI = window.OATFUI;
  if (!Store || !Intel || !UI) return;

  const $ = selector => document.querySelector(selector);
  const esc = UI.esc;
  const clone = Store.clone;
  const now = () => Store.nowISO();
  const todayISO = () => new Date().toISOString().slice(0,10);
  const FAIR_COLLECTIONS = ['talent','tasks','schedules','deadlines','files','notes','issues','handoffs','incidents','decisions'];
  const TYPE_MAP = {
    talent:'talent',tasks:'task',schedules:'schedule',deadlines:'deadline',files:'file',
    notes:'note',issues:'issue',handoffs:'handoff',incidents:'incident',decisions:'decision'
  };
  let importedPackage = null;
  let selectedCaptureId = '';
  let activeDiff = null;
  let stagedOperations = [];

  function ensureState(){
    const state=Store.state;
    let changed=false;
    ['stateCaptures','changeSets','incidents','packageHistory'].forEach(key=>{
      if(!Array.isArray(state[key])){state[key]=[];changed=true;}
    });
    state.preferences.stateFairId ||= Intel.nextFair()?.id || state.fairs[0]?.id || '';
    state.preferences.stateTab ||= 'captures';
    state.preferences.packageMergeStrategy ||= 'newest';
    state.preferences.incidentFairId ||= state.preferences.stateFairId;
    if(changed)Store.save({immediate:true});
  }

  function fair(id){return Store.get('fair',id);}
  function formatBytes(bytes){
    if(bytes<1024)return `${bytes} B`;
    if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`;
    return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  }
  function recordTitle(type,record){
    return UI.recordTitle?.(type,record) || record?.title || record?.name || record?.id || 'Record';
  }
  function recordUpdated(record){
    return new Date(record?.updatedAt||record?.createdAt||0).getTime();
  }
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){
      return Object.fromEntries(Object.keys(value).sort().filter(key=>!['updatedAt','createdAt','completedAt'].includes(key)).map(key=>[key,stable(value[key])]));
    }
    return value;
  }
  function equalRecord(a,b){
    return JSON.stringify(stable(a))===JSON.stringify(stable(b));
  }
  function hashString(value){
    let hash=2166136261;
    const text=String(value);
    for(let i=0;i<text.length;i++){
      hash^=text.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return (hash>>>0).toString(16).padStart(8,'0');
  }

  function fairSnapshot(fairId){
    const snapshot={
      fair:clone(fair(fairId)),
      contacts:clone(Store.state.contacts.filter(contact=>contact.fairIds?.includes(fairId)))
    };
    FAIR_COLLECTIONS.forEach(collection=>{
      snapshot[collection]=clone(Store.state[collection]?.filter(record=>record.fairId===fairId)||[]);
    });
    return snapshot;
  }

  function snapshotRecordCount(data){
    return 1+(data.contacts?.length||0)+FAIR_COLLECTIONS.reduce((sum,key)=>sum+(data[key]?.length||0),0);
  }

  function captureState(label='Production state capture'){
    const fairId=Store.state.preferences.stateFairId;
    const data=fairSnapshot(fairId);
    const capture=Store.upsert('capture',{
      fairId,label,
      data,
      recordCount:snapshotRecordCount(data),
      fingerprint:hashString(JSON.stringify(stable(data))),
      createdBy:'Production'
    });
    selectedCaptureId=capture.id;
    Store.log('Production',`captured ${fair(fairId)?.short||'fair'} state “${label}”.`,'capture',capture.id,fairId);
    Store.save({immediate:true});
    UI.toast('State captured',`${capture.recordCount} connected records frozen for comparison.`);
    compareCapture(capture.id);
  }

  function collectionPairs(data){
    return [
      ['fair','fair',data.fair?[data.fair]:[]],
      ['contact','contacts',data.contacts||[]],
      ...FAIR_COLLECTIONS.map(collection=>[TYPE_MAP[collection],collection,data[collection]||[]])
    ];
  }

  function compareData(before,after){
    const changes=[];
    const beforeCollections=Object.fromEntries(collectionPairs(before).map(([type,key,rows])=>[key,{type,rows}]));
    const afterCollections=Object.fromEntries(collectionPairs(after).map(([type,key,rows])=>[key,{type,rows}]));
    const keys=new Set([...Object.keys(beforeCollections),...Object.keys(afterCollections)]);
    keys.forEach(key=>{
      const beforeInfo=beforeCollections[key]||{type:key,rows:[]};
      const afterInfo=afterCollections[key]||{type:beforeInfo.type,rows:[]};
      const beforeMap=new Map(beforeInfo.rows.map(row=>[row.id,row]));
      const afterMap=new Map(afterInfo.rows.map(row=>[row.id,row]));
      new Set([...beforeMap.keys(),...afterMap.keys()]).forEach(id=>{
        const oldRecord=beforeMap.get(id);
        const newRecord=afterMap.get(id);
        if(!oldRecord&&newRecord){
          changes.push({kind:'created',type:afterInfo.type,id,before:null,after:newRecord,title:recordTitle(afterInfo.type,newRecord)});
        }else if(oldRecord&&!newRecord){
          changes.push({kind:'deleted',type:beforeInfo.type,id,before:oldRecord,after:null,title:recordTitle(beforeInfo.type,oldRecord)});
        }else if(!equalRecord(oldRecord,newRecord)){
          const fields=[...new Set([...Object.keys(oldRecord),...Object.keys(newRecord)])]
            .filter(field=>!['updatedAt','createdAt','completedAt'].includes(field))
            .filter(field=>JSON.stringify(oldRecord[field])!==JSON.stringify(newRecord[field]));
          changes.push({kind:'updated',type:afterInfo.type,id,before:oldRecord,after:newRecord,title:recordTitle(afterInfo.type,newRecord),fields});
        }
      });
    });
    return changes;
  }

  function compareCapture(id){
    const capture=Store.get('capture',id);
    if(!capture)return;
    selectedCaptureId=id;
    const current=fairSnapshot(capture.fairId);
    activeDiff={
      source:'capture',
      sourceId:id,
      fairId:capture.fairId,
      before:capture.data,
      after:current,
      changes:compareData(capture.data,current),
      comparedAt:now()
    };
    render();
  }

  function restoreDiffRecord(index){
    if(!activeDiff)return;
    const change=activeDiff.changes[index];
    if(!change)return;
    window.OATFSystem?.createSnapshot?.('Before state-record restore');
    if(change.before){
      Store.upsert(change.type,clone(change.before));
    }else if(change.after){
      Store.remove(change.type,change.id);
    }
    Store.log('Production',`restored ${change.type} “${change.title}” from a state comparison.`,'',change.id,activeDiff.fairId);
    Store.save({immediate:true});
    UI.toast('Record restored','A checkpoint was created before the restore.');
    if(activeDiff.source==='capture')compareCapture(activeDiff.sourceId);
    else render();
  }

  function restoreCapture(id){
    const capture=Store.get('capture',id);
    if(!capture)return;
    if(!confirm(`Restore the complete “${capture.label}” state? A safety checkpoint will be created first.`))return;
    window.OATFSystem?.createSnapshot?.('Before complete state restore');
    const current=fairSnapshot(capture.fairId);
    const changes=compareData(current,capture.data);
    changes.forEach(change=>{
      if(change.after)Store.upsert(change.type,clone(change.after));
      else Store.remove(change.type,change.id);
    });
    Store.log('Production',`restored complete state capture “${capture.label}”.`,'capture',capture.id,capture.fairId);
    Store.save({immediate:true});
    UI.toast('State restored',`${changes.length} record change${changes.length===1?'':'s'} applied safely.`);
    activeDiff=null;
    render();
  }

  function stageOperation(form){
    const data=Object.fromEntries(new FormData(form).entries());
    const fairId=Store.state.preferences.stateFairId;
    const tasks=Store.state.tasks.filter(task=>task.fairId===fairId&&task.status!=='complete');
    let targets=[];
    if(data.scope==='all')targets=tasks;
    if(data.scope==='high')targets=tasks.filter(task=>task.priority==='High'||task.impact==='High');
    if(data.scope==='waiting')targets=tasks.filter(task=>task.status==='waiting'||task.blockedBy);
    if(data.scope==='owner')targets=tasks.filter(task=>task.owner===data.owner);
    if(!targets.length){
      UI.toast('No matching records','The selected scope has no unfinished tasks.');
      return;
    }
    stagedOperations.push({
      id:`op-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fairId,action:data.action,scope:data.scope,owner:data.owner||'',
      value:data.value||'',targetIds:targets.map(task=>task.id),
      label:operationLabel(data,targets.length)
    });
    UI.toast('Change staged',`${targets.length} task${targets.length===1?'':'s'} added to the transaction.`);
    render();
  }

  function operationLabel(data,count){
    const action={
      start:'Move to In Progress',complete:'Complete tasks',shift:'Shift due dates',
      assign:'Reassign owner',priority:'Change priority'
    }[data.action]||data.action;
    return `${action} · ${count} task${count===1?'':'s'}`;
  }

  function previewOperations(){
    const fairId=Store.state.preferences.stateFairId;
    const before=fairSnapshot(fairId);
    const after=clone(before);
    stagedOperations.forEach(operation=>{
      after.tasks.filter(task=>operation.targetIds.includes(task.id)).forEach(task=>{
        if(operation.action==='start')task.status='inprogress';
        if(operation.action==='complete'){task.status='complete';task.completedAt=now();}
        if(operation.action==='shift'){
          const date=new Date(`${task.due||todayISO()}T12:00:00`);
          date.setDate(date.getDate()+Number(operation.value||0));
          task.due=date.toISOString().slice(0,10);
        }
        if(operation.action==='assign')task.owner=operation.value||'Production';
        if(operation.action==='priority'){task.priority=operation.value||'Medium';task.impact=operation.value||'Medium';}
      });
    });
    return {before,after,changes:compareData(before,after)};
  }

  function commitOperations(){
    if(!stagedOperations.length)return;
    const preview=previewOperations();
    window.OATFSystem?.createSnapshot?.('Before transactional change set');
    const changeSet=Store.upsert('changeset',{
      fairId:Store.state.preferences.stateFairId,
      label:`Production change set · ${new Date().toLocaleString()}`,
      operations:clone(stagedOperations),
      changeCount:preview.changes.length,
      status:'Committed',
      committedAt:now()
    });
    preview.changes.forEach(change=>{
      if(change.after)Store.upsert(change.type,clone(change.after));
      else Store.remove(change.type,change.id);
    });
    Store.log('Production',`committed a ${preview.changes.length}-record transactional change set.`,'changeset',changeSet.id,changeSet.fairId);
    Store.save({immediate:true});
    stagedOperations=[];
    UI.toast('Change set committed',`${preview.changes.length} record change${preview.changes.length===1?'':'s'} applied after a safety checkpoint.`);
    render();
  }

  function packageForFair(fairId){
    const data=fairSnapshot(fairId);
    return {
      format:'oatf-production-fair-package',
      schemaVersion:'0.09',
      packageId:`pkg-${Date.now()}`,
      fairId,
      fairName:data.fair?.name||'Fair',
      createdAt:now(),
      createdBy:'Production',
      fingerprint:hashString(JSON.stringify(stable(data))),
      recordCount:snapshotRecordCount(data),
      data
    };
  }

  function exportPackage(){
    const fairId=Store.state.preferences.stateFairId;
    const pkg=packageForFair(fairId);
    const blob=new Blob([JSON.stringify(pkg,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=`oatf-production-${(fair(fairId)?.code||'fair').toLowerCase()}-${todayISO()}.json`;
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    Store.upsert('package',{
      fairId,direction:'Export',packageId:pkg.packageId,
      fingerprint:pkg.fingerprint,recordCount:pkg.recordCount,status:'Complete'
    });
    Store.log('Production',`exported a ${pkg.recordCount}-record fair package.`,'package',pkg.packageId,fairId);
    Store.save({immediate:true});
    UI.toast('Fair package exported','The package can be moved to another Production browser or device.');
    render();
  }

  function readPackageFile(file){
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const parsed=JSON.parse(reader.result);
        if(parsed?.format!=='oatf-production-fair-package'||!parsed.data?.fair)throw new Error('Not a valid OATF fair package.');
        importedPackage=parsed;
        const localFair=Store.get('fair',parsed.fairId);
        const localData=localFair?fairSnapshot(parsed.fairId):{fair:null,contacts:[],...Object.fromEntries(FAIR_COLLECTIONS.map(key=>[key,[]]))};
        const changes=compareData(localData,parsed.data);
        importedPackage.analysis={
          changes,
          created:changes.filter(item=>item.kind==='created').length,
          updated:changes.filter(item=>item.kind==='updated').length,
          deleted:changes.filter(item=>item.kind==='deleted').length,
          conflicts:changes.filter(item=>item.kind==='updated'&&item.before&&item.after).length,
          duplicate:localFair&&hashString(JSON.stringify(stable(localData)))===parsed.fingerprint
        };
        UI.toast('Package analyzed',`${changes.length} potential state change${changes.length===1?'':'s'} detected.`);
        render();
      }catch(error){
        UI.toast('Package rejected',error.message);
      }
    };
    reader.readAsText(file);
  }

  function resolvePackageRecord(change,strategy){
    if(change.kind==='created')return change.after;
    if(change.kind==='deleted')return strategy==='incoming'?null:change.before;
    if(strategy==='local')return change.before;
    if(strategy==='incoming')return change.after;
    return recordUpdated(change.after)>=recordUpdated(change.before)?change.after:change.before;
  }

  function mergePackage(){
    if(!importedPackage)return;
    const strategy=Store.state.preferences.packageMergeStrategy||'newest';
    const fairId=importedPackage.fairId;
    const changes=importedPackage.analysis?.changes||[];
    window.OATFSystem?.createSnapshot?.('Before fair-package merge');
    let applied=0,kept=0;
    changes.forEach(change=>{
      const resolved=resolvePackageRecord(change,strategy);
      if(resolved===change.before){kept++;return;}
      if(resolved)Store.upsert(change.type,clone(resolved));
      else Store.remove(change.type,change.id);
      applied++;
    });
    Store.upsert('package',{
      fairId,direction:'Import',packageId:importedPackage.packageId,
      fingerprint:importedPackage.fingerprint,recordCount:importedPackage.recordCount,
      strategy,status:'Merged',appliedCount:applied,keptLocalCount:kept
    });
    Store.log('Production',`merged fair package using ${strategy} resolution.`,'package',importedPackage.packageId,fairId);
    Store.save({immediate:true});
    UI.toast('Package merged',`${applied} incoming change${applied===1?'':'s'} applied · ${kept} local value${kept===1?'':'s'} preserved.`);
    importedPackage=null;
    render();
  }

  function logIncident(form){
    const data=Object.fromEntries(new FormData(form).entries());
    if(!data.title?.trim())return;
    const incident=Store.upsert('incident',{
      ...data,
      fairId:Store.state.preferences.incidentFairId||Store.state.preferences.stateFairId,
      occurredAt:data.occurredAt||now(),
      status:data.status||'Logged'
    });
    Store.log('Production',`logged ${data.kind?.toLowerCase()||'production'} event “${data.title}”.`,'incident',incident.id,incident.fairId);
    form.reset();
    Store.save({immediate:true});
    UI.toast('Timeline event logged','The event can now be replayed in sequence.');
    render();
  }

  function replayIncidents(){
    const fairId=Store.state.preferences.incidentFairId||Store.state.preferences.stateFairId;
    const incidents=Store.state.incidents.filter(item=>item.fairId===fairId).sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));
    if(!incidents.length)return;
    const lines=incidents.map(item=>`${new Date(item.occurredAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} — ${item.kind}: ${item.title}${item.detail?` — ${item.detail}`:''}`);
    navigator.clipboard?.writeText(lines.join('\n')).then(()=>UI.toast('Incident replay copied','The chronological production timeline is ready to paste.'));
  }

  function renderHero(){
    const fairId=Store.state.preferences.stateFairId;
    const captures=Store.state.stateCaptures.filter(item=>item.fairId===fairId);
    const packages=Store.state.packageHistory.filter(item=>item.fairId===fairId);
    const current=fairSnapshot(fairId);
    const fingerprint=hashString(JSON.stringify(stable(current)));
    const records=snapshotRecordCount(current);
    return `<section class="state-hero">
      <div>
        <span class="eyebrow">Production state engine</span>
        <h1>Every change should be explainable, portable, and reversible.</h1>
        <p>Capture a fair state, compare versions, stage a transaction, move a package between devices, resolve conflicts, and replay production events.</p>
        <div class="state-fair-select">
          <label><span>State focus fair</span><select id="stateFairSelect">${Store.state.fairs.map(item=>`<option value="${item.id}"${item.id===fairId?' selected':''}>${esc(item.name)}</option>`).join('')}</select></label>
          <button class="button ghost" data-capture-state>Capture State</button>
        </div>
      </div>
      <div class="state-fingerprint"><span>State fingerprint</span><strong>${fingerprint.slice(0,4)}·${fingerprint.slice(4)}</strong><small>${records} connected records</small></div>
      <div class="state-telemetry">
        <div><span>Captures</span><strong>${captures.length}</strong></div>
        <div><span>Exchange packages</span><strong>${packages.length}</strong></div>
        <div><span>Staged operations</span><strong>${stagedOperations.length}</strong></div>
      </div>
    </section>`;
  }

  function renderTabs(){
    const tab=Store.state.preferences.stateTab;
    const tabs=[
      ['captures','Captures & Diff','⧉'],
      ['changes','Change Sets','⇄'],
      ['exchange','Fair Exchange','↗'],
      ['timeline','Incident Replay','◷']
    ];
    return `<nav class="state-tabs">${tabs.map(([id,label,icon])=>`<button class="${tab===id?'active':''}" data-state-tab="${id}"><span>${icon}</span><b>${label}</b></button>`).join('')}</nav>`;
  }

  function renderCaptures(){
    const fairId=Store.state.preferences.stateFairId;
    const captures=Store.state.stateCaptures.filter(item=>item.fairId===fairId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    return `<div class="state-grid captures-grid">
      <article class="state-panel">
        <div class="state-panel-head"><div><span class="eyebrow">Versioned fair state</span><h3>State Captures</h3></div><button class="button ghost small-button" data-capture-state>New Capture</button></div>
        <div class="capture-list">${captures.length?captures.map(item=>`<article class="${item.id===selectedCaptureId?'active':''}">
          <button data-compare-capture="${item.id}"><span>⧉</span><div><b>${esc(item.label)}</b><small>${esc(Intel.formatTimeAgo(item.createdAt))} · ${item.recordCount} records · ${esc(item.fingerprint||'')}</small></div><em>Compare</em></button>
          <button data-restore-capture="${item.id}">Restore</button>
        </article>`).join(''):`<div class="state-empty"><b>No state captures yet.</b><span>Capture the fair now to create a baseline for visual comparison.</span></div>`}</div>
      </article>
      ${renderDiffPanel()}
    </div>`;
  }

  function renderDiffPanel(){
    if(!activeDiff)return `<article class="state-panel"><div class="state-panel-head"><div><span class="eyebrow">Visual comparison</span><h3>State Diff</h3></div></div><div class="state-empty tall"><b>Select a state capture.</b><span>The OS will show records created, updated, and deleted since that moment.</span></div></article>`;
    const changes=activeDiff.changes;
    const counts={
      created:changes.filter(item=>item.kind==='created').length,
      updated:changes.filter(item=>item.kind==='updated').length,
      deleted:changes.filter(item=>item.kind==='deleted').length
    };
    return `<article class="state-panel diff-panel">
      <div class="state-panel-head"><div><span class="eyebrow">Visual comparison</span><h3>State Diff</h3></div><span class="state-chip">${changes.length} changes</span></div>
      <div class="diff-summary"><div class="created"><strong>${counts.created}</strong><span>Created</span></div><div class="updated"><strong>${counts.updated}</strong><span>Updated</span></div><div class="deleted"><strong>${counts.deleted}</strong><span>Deleted</span></div></div>
      <div class="diff-list">${changes.length?changes.map((change,index)=>`<article class="${change.kind}">
        <span>${change.kind==='created'?'+':change.kind==='deleted'?'−':'~'}</span>
        <div><small>${esc(change.kind)} · ${esc(change.type)}</small><b>${esc(change.title)}</b>${change.fields?.length?`<em>${esc(change.fields.join(', '))}</em>`:''}</div>
        <button data-restore-diff-record="${index}">${change.kind==='created'?'Remove':'Restore'}</button>
      </article>`).join(''):`<div class="state-empty"><b>No drift detected.</b><span>The current fair matches the selected capture.</span></div>`}</div>
    </article>`;
  }

  function renderChangeSets(){
    const fairId=Store.state.preferences.stateFairId;
    const preview=stagedOperations.length?previewOperations():null;
    const history=Store.state.changeSets.filter(item=>item.fairId===fairId).sort((a,b)=>new Date(b.committedAt||b.createdAt)-new Date(a.committedAt||a.createdAt));
    return `<div class="state-grid changes-grid">
      <article class="state-panel">
        <div class="state-panel-head"><div><span class="eyebrow">Transactional operations</span><h3>Stage a Change</h3></div><span class="state-chip">Nothing changes until commit</span></div>
        <form id="stageOperationForm" class="operation-form">
          <label><span>Action</span><select name="action"><option value="start">Move to In Progress</option><option value="complete">Complete tasks</option><option value="shift">Shift due dates</option><option value="assign">Reassign owner</option><option value="priority">Change priority / impact</option></select></label>
          <label><span>Scope</span><select name="scope"><option value="all">All unfinished tasks</option><option value="high">High-impact work</option><option value="waiting">Waiting / blocked work</option><option value="owner">Tasks owned by</option></select></label>
          <label><span>Owner filter</span><select name="owner"><option>Production</option><option>William</option><option>Spencer</option></select></label>
          <label><span>Value</span><select name="value"><option value="1">+1 day</option><option value="7">+7 days</option><option value="-1">−1 day</option><option value="Production">Production</option><option value="William">William</option><option value="Spencer">Spencer</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
          <button class="button primary" type="submit">Stage Operation</button>
        </form>
        <div class="staged-list">${stagedOperations.length?stagedOperations.map((item,index)=>`<article><span>${index+1}</span><div><b>${esc(item.label)}</b><small>${item.targetIds.length} record target${item.targetIds.length===1?'':'s'}</small></div><button data-remove-operation="${item.id}">×</button></article>`).join(''):`<div class="state-empty"><b>No staged operations.</b><span>Combine multiple actions into one safe transaction.</span></div>`}</div>
      </article>
      <article class="state-panel">
        <div class="state-panel-head"><div><span class="eyebrow">Before committing</span><h3>Transaction Preview</h3></div><span class="state-chip">${preview?.changes.length||0} record changes</span></div>
        ${preview?`<div class="transaction-preview">${preview.changes.slice(0,20).map(change=>`<article class="${change.kind}"><span>${change.kind==='created'?'+':change.kind==='deleted'?'−':'~'}</span><div><b>${esc(change.title)}</b><small>${esc(change.type)} · ${esc(change.fields?.join(', ')||change.kind)}</small></div></article>`).join('')}</div><div class="transaction-actions"><button class="button ghost" data-clear-operations>Clear</button><button class="button primary" data-commit-operations>Commit Transaction</button></div>`:`<div class="state-empty tall"><b>Stage one or more operations.</b><span>The OS will calculate the exact record-level transaction before commit.</span></div>`}
      </article>
      <article class="state-panel full-span">
        <div class="state-panel-head"><div><span class="eyebrow">Committed transactions</span><h3>Change-Set History</h3></div><span class="state-chip">${history.length}</span></div>
        <div class="changeset-history">${history.length?history.slice(0,15).map(item=>`<article><span>⇄</span><div><b>${esc(item.label)}</b><small>${item.changeCount} record changes · ${esc(Intel.formatTimeAgo(item.committedAt||item.createdAt))}</small></div><em>${esc(item.status)}</em></article>`).join(''):`<div class="state-empty"><b>No committed change sets.</b><span>Transactional updates will be recorded here.</span></div>`}</div>
      </article>
    </div>`;
  }

  function renderExchange(){
    const fairId=Store.state.preferences.stateFairId;
    const history=Store.state.packageHistory.filter(item=>item.fairId===fairId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    return `<div class="state-grid exchange-grid">
      <article class="state-panel exchange-actions-panel">
        <div class="state-panel-head"><div><span class="eyebrow">Portable fair workspace</span><h3>Fair Package Exchange</h3></div><span class="state-chip">Manual local-first sync</span></div>
        <div class="package-actions">
          <button data-export-fair-package><span>↗</span><div><b>Export Current Fair</b><small>Package the fair and every connected Production record.</small></div></button>
          <label><input type="file" id="packageImportFile" accept=".json,application/json"><span>↙</span><div><b>Analyze Incoming Package</b><small>Nothing merges until conflicts are reviewed.</small></div></label>
        </div>
        <div class="package-explainer"><span>1</span><p>Export on one browser.</p><i>→</i><span>2</span><p>Move the JSON file.</p><i>→</i><span>3</span><p>Analyze and merge safely.</p></div>
      </article>
      ${renderPackageAnalysis()}
      <article class="state-panel full-span">
        <div class="state-panel-head"><div><span class="eyebrow">Exchange audit</span><h3>Package History</h3></div><span class="state-chip">${history.length}</span></div>
        <div class="package-history">${history.length?history.slice(0,20).map(item=>`<article><span>${item.direction==='Export'?'↗':'↙'}</span><div><b>${esc(item.direction)} · ${item.recordCount||0} records</b><small>${esc(item.status)}${item.strategy?` · ${esc(item.strategy)} resolution`:''} · ${esc(Intel.formatTimeAgo(item.createdAt))}</small></div><em>${esc(item.fingerprint||'')}</em></article>`).join(''):`<div class="state-empty"><b>No package exchanges yet.</b><span>Exports and imports will appear here.</span></div>`}</div>
      </article>
    </div>`;
  }

  function renderPackageAnalysis(){
    if(!importedPackage)return `<article class="state-panel"><div class="state-panel-head"><div><span class="eyebrow">Merge workspace</span><h3>Incoming Package</h3></div></div><div class="state-empty tall"><b>No package loaded.</b><span>Select an OATF fair-package JSON file to inspect it without changing local data.</span></div></article>`;
    const analysis=importedPackage.analysis;
    return `<article class="state-panel package-analysis">
      <div class="state-panel-head"><div><span class="eyebrow">Merge workspace</span><h3>${esc(importedPackage.fairName)}</h3></div><span class="state-chip">${importedPackage.recordCount} records</span></div>
      <div class="package-summary">
        <div><strong>${analysis.created}</strong><span>Incoming</span></div>
        <div><strong>${analysis.updated}</strong><span>Different</span></div>
        <div><strong>${analysis.conflicts}</strong><span>Conflicts</span></div>
        <div><strong>${analysis.duplicate?'Yes':'No'}</strong><span>Identical</span></div>
      </div>
      <label class="merge-strategy"><span>Conflict strategy</span><select id="packageMergeStrategy"><option value="newest"${Store.state.preferences.packageMergeStrategy==='newest'?' selected':''}>Keep newest record</option><option value="local"${Store.state.preferences.packageMergeStrategy==='local'?' selected':''}>Always keep local</option><option value="incoming"${Store.state.preferences.packageMergeStrategy==='incoming'?' selected':''}>Always use incoming</option></select></label>
      <div class="package-diff-list">${analysis.changes.slice(0,20).map(change=>`<article class="${change.kind}"><span>${change.kind==='created'?'+':change.kind==='deleted'?'−':'~'}</span><div><b>${esc(change.title)}</b><small>${esc(change.type)} · ${esc(change.fields?.join(', ')||change.kind)}</small></div></article>`).join('')||`<div class="state-empty"><b>Packages are identical.</b><span>No merge is needed.</span></div>`}</div>
      <div class="transaction-actions"><button class="button ghost" data-discard-package>Discard</button><button class="button primary" data-merge-package${analysis.duplicate?' disabled':''}>Merge Package</button></div>
    </article>`;
  }

  function renderTimeline(){
    const fairId=Store.state.preferences.incidentFairId||Store.state.preferences.stateFairId;
    const incidents=Store.state.incidents.filter(item=>item.fairId===fairId).sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));
    return `<div class="state-grid timeline-grid">
      <article class="state-panel">
        <div class="state-panel-head"><div><span class="eyebrow">Timestamped production memory</span><h3>Log Timeline Event</h3></div><span class="state-chip">Local event stream</span></div>
        <form id="incidentForm" class="incident-form">
          <label><span>Event type</span><select name="kind"><option>Decision</option><option>Delay</option><option>Performer</option><option>Issue</option><option>Stage</option><option>Handoff</option><option>Resolution</option></select></label>
          <label><span>Severity</span><select name="severity"><option>Info</option><option>Watch</option><option>High</option></select></label>
          <label class="full"><span>Title</span><input name="title" required placeholder="What happened?"></label>
          <label class="full"><span>Detail</span><textarea name="detail" placeholder="Context, response, and operational impact."></textarea></label>
          <label><span>Status</span><select name="status"><option>Logged</option><option>Monitoring</option><option>Resolved</option></select></label>
          <label><span>Occurred at</span><input name="occurredAt" type="datetime-local"></label>
          <button class="button primary" type="submit">Log Event</button>
        </form>
      </article>
      <article class="state-panel">
        <div class="state-panel-head"><div><span class="eyebrow">Chronological replay</span><h3>Incident Timeline</h3></div><button class="button ghost small-button" data-copy-incident-replay>Copy Replay</button></div>
        <div class="incident-timeline">${incidents.length?incidents.map(item=>`<article class="${String(item.severity).toLowerCase()}">
          <time>${new Date(item.occurredAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time><i></i>
          <div><span>${esc(item.kind)} · ${esc(item.status)}</span><b>${esc(item.title)}</b>${item.detail?`<p>${esc(item.detail)}</p>`:''}</div>
        </article>`).join(''):`<div class="state-empty tall"><b>No timeline events.</b><span>Log production decisions, delays, issues, stage changes, and resolutions.</span></div>`}</div>
      </article>
    </div>`;
  }

  function render(){
    const target=$('#stateEngineContent');
    if(!target)return;
    const tab=Store.state.preferences.stateTab||'captures';
    target.innerHTML=`
      ${renderHero()}
      ${renderTabs()}
      <section class="state-tab-content">
        ${tab==='captures'?renderCaptures():tab==='changes'?renderChangeSets():tab==='exchange'?renderExchange():renderTimeline()}
      </section>`;
    const badge=$('#stateEngineBadge');
    if(badge)badge.textContent=stagedOperations.length||'';
  }

  function openStateEngine(){
    document.querySelector('[data-view="stateengine"]')?.click();
    requestAnimationFrame(render);
  }

  function appendCommands(){
    const input=$('#globalSearch'),results=$('#searchResults');
    if(!input||!results)return;
    results.querySelector('.state-command-group')?.remove();
    const q=input.value.trim().toLowerCase();
    if(!q)return;
    const commands=[
      {test:/(state engine|state console|state manager)/,label:'Open Production State Engine',detail:'Capture, diff, transact, exchange, and replay',action:'open'},
      {test:/(capture state|create baseline|state snapshot)/,label:'Capture Current Fair State',detail:'Freeze connected records for later comparison',action:'capture'},
      {test:/(state diff|compare state|what changed)/,label:'Open State Diff',detail:'Compare current records against a saved capture',action:'tab:captures'},
      {test:/(change set|transaction|stage changes)/,label:'Open Transactional Change Sets',detail:`${stagedOperations.length} operation(s) staged`,action:'tab:changes'},
      {test:/(export fair package|fair package|move fair data)/,label:'Export Fair Package',detail:'Create a portable connected fair workspace',action:'export'},
      {test:/(merge package|import fair package|conflict resolver)/,label:'Open Package Merge',detail:'Analyze incoming data before applying it',action:'tab:exchange'},
      {test:/(incident replay|event replay|production timeline)/,label:'Open Incident Replay',detail:`${Store.state.incidents.length} timestamped event(s)`,action:'tab:timeline'}
    ].filter(command=>command.test.test(q));
    if(!commands.length)return;
    const group=document.createElement('section');
    group.className='os-command-group state-command-group';
    group.innerHTML=`<span class="eyebrow">State commands</span>${commands.map(command=>`<button data-state-command="${command.action}"><span>⧉</span><span><b>${esc(command.label)}</b><small>${esc(command.detail)}</small></span><em>Run ↵</em></button>`).join('')}`;
    results.prepend(group);
  }

  document.addEventListener('input',event=>{
    if(event.target?.id==='globalSearch')queueMicrotask(appendCommands);
    if(event.target?.id==='packageImportFile')readPackageFile(event.target.files?.[0]);
  });

  document.addEventListener('change',event=>{
    if(event.target?.id==='stateFairSelect'){
      Store.state.preferences.stateFairId=event.target.value;
      Store.state.preferences.incidentFairId=event.target.value;
      activeDiff=null;selectedCaptureId='';importedPackage=null;stagedOperations=[];
      Store.save();render();return;
    }
    if(event.target?.id==='packageMergeStrategy'){
      Store.state.preferences.packageMergeStrategy=event.target.value;
      Store.save();render();
    }
  });

  document.addEventListener('submit',event=>{
    if(event.target?.id==='stageOperationForm'){event.preventDefault();stageOperation(event.target);return;}
    if(event.target?.id==='incidentForm'){event.preventDefault();logIncident(event.target);}
  });

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-state-engine-open]')){openStateEngine();return;}
    const tab=event.target.closest('[data-state-tab]')?.dataset.stateTab;
    if(tab){Store.state.preferences.stateTab=tab;Store.save();render();return;}

    if(event.target.closest('[data-capture-state]')){
      const label=prompt('Name this state capture:',`${fair(Store.state.preferences.stateFairId)?.short||'Fair'} baseline`);
      if(label?.trim())captureState(label.trim());
      return;
    }

    const compare=event.target.closest('[data-compare-capture]')?.dataset.compareCapture;
    if(compare){compareCapture(compare);return;}
    const restore=event.target.closest('[data-restore-capture]')?.dataset.restoreCapture;
    if(restore){restoreCapture(restore);return;}
    const diffIndex=event.target.closest('[data-restore-diff-record]')?.dataset.restoreDiffRecord;
    if(diffIndex!==undefined){restoreDiffRecord(Number(diffIndex));return;}

    const removeOp=event.target.closest('[data-remove-operation]')?.dataset.removeOperation;
    if(removeOp){stagedOperations=stagedOperations.filter(item=>item.id!==removeOp);render();return;}
    if(event.target.closest('[data-clear-operations]')){stagedOperations=[];render();return;}
    if(event.target.closest('[data-commit-operations]')){commitOperations();return;}

    if(event.target.closest('[data-export-fair-package]')){exportPackage();return;}
    if(event.target.closest('[data-discard-package]')){importedPackage=null;render();return;}
    if(event.target.closest('[data-merge-package]')){mergePackage();return;}
    if(event.target.closest('[data-copy-incident-replay]')){replayIncidents();return;}

    const command=event.target.closest('[data-state-command]')?.dataset.stateCommand;
    if(command){
      $('#searchOverlay')?.classList.remove('open');
      if(command==='open')openStateEngine();
      else if(command==='capture'){openStateEngine();setTimeout(()=>captureState(`${fair(Store.state.preferences.stateFairId)?.short||'Fair'} command capture`),80);}
      else if(command==='export'){openStateEngine();setTimeout(exportPackage,80);}
      else if(command.startsWith('tab:')){
        Store.state.preferences.stateTab=command.split(':')[1];Store.save();openStateEngine();
      }
    }
  });

  window.addEventListener('oatf:saved',render);

  window.OATFStateEngine={
    render,openStateEngine,captureState,compareCapture,compareData,
    exportPackage,mergePackage,fairSnapshot,hashString
  };

  ensureState();
  render();
})();