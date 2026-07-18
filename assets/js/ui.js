(() => {
  'use strict';
  const Store = window.OATFStore;
  const Intel = window.OATFIntel;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
  const initials = name => String(name || '?').split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
  const icon = type => ({fair:'🎡',talent:'◉',task:'☑',contact:'◎',file:'▣',deadline:'▦',note:'✎',issue:'⚡',schedule:'≡'}[type] || '•');
  const typeLabel = type => ({fair:'Fair',talent:'Talent',task:'Task',contact:'Contact',file:'File',deadline:'Deadline',note:'Note',issue:'Issue',schedule:'Stage Block'}[type] || type);
  const fairName = id => Store.get('fair',id)?.short || 'All fairs';
  const statusText = value => String(value || '').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,x => x.toUpperCase());

  function field(name,label,type='text',value='',options=[],extra={}){
    const required = extra.required === false ? '' : ' required';
    const full = extra.full ? ' full' : '';
    const placeholder = extra.placeholder ? ` placeholder="${esc(extra.placeholder)}"` : '';
    if (type === 'textarea') return `<label class="form-field${full}"><span>${esc(label)}</span><textarea name="${esc(name)}"${required}${placeholder}>${esc(value)}</textarea></label>`;
    if (type === 'select') return `<label class="form-field${full}"><span>${esc(label)}</span><select name="${esc(name)}"${required}>${options.map(option => {
      const val = typeof option === 'object' ? option.value : option;
      const text = typeof option === 'object' ? option.label : option;
      return `<option value="${esc(val)}"${String(val)===String(value)?' selected':''}>${esc(text)}</option>`;
    }).join('')}</select></label>`;
    if (type === 'multiselect'){
      const current = Array.isArray(value) ? value : [];
      return `<label class="form-field${full}"><span>${esc(label)}</span><select name="${esc(name)}" multiple size="${Math.min(4,options.length)}">${options.map(option => `<option value="${esc(option.value)}"${current.includes(option.value)?' selected':''}>${esc(option.label)}</option>`).join('')}</select></label>`;
    }
    return `<label class="form-field${full}"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}"${required}${placeholder}></label>`;
  }
  function section(title,fields){ return `<section class="form-section"><div class="form-section-title">${esc(title)}</div><div class="form-grid">${fields.join('')}</div></section>`; }
  function fairOptions(includeBlank=false){
    const options = Store.state.fairs.map(f => ({value:f.id,label:f.name}));
    return includeBlank ? [{value:'',label:'All fairs / not assigned'},...options] : options;
  }
  function talentOptions(fairId='',includeBlank=true){
    let list = Store.state.talent;
    if (fairId) list = list.filter(t => t.fairId === fairId);
    const options = list.map(t => ({value:t.id,label:t.name}));
    return includeBlank ? [{value:'',label:'No linked talent'},...options] : options;
  }
  function contactOptions(includeBlank=true){
    const options = Store.state.contacts.map(c => ({value:c.id,label:`${c.name} · ${c.organization}`}));
    return includeBlank ? [{value:'',label:'No linked contact'},...options] : options;
  }

  function schema(type,record={},defaults={}){
    const r = {...defaults,...record};
    if (type === 'fair') return {
      title:record.id ? 'Edit fair workspace' : 'Add fair workspace',
      html:[
        section('Fair',[
          field('name','Fair name','text',r.name || ''),field('short','Short name','text',r.short || ''),field('code','Code','text',r.code || '',[],{placeholder:'OC'}),field('date','Event date','date',r.date || ''),field('venue','Venue','text',r.venue || ''),field('location','Location','text',r.location || '')
        ]),
        section('Production',[
          field('stage','Stage / area','text',r.stage || ''),field('status','Status','select',r.status || 'Planning',['Planning','On track','Needs review','Waiting on fair','At risk']),field('summary','Workspace summary','textarea',r.summary || '',[],{full:true,required:false})
        ])
      ].join('')
    };
    if (type === 'task') return {
      title:record.id ? 'Edit task' : 'New production task',
      html:[
        section('Task',[
          field('title','Task title','text',r.title || ''),field('owner','Owner','select',r.owner || Store.state.currentUser,['Spencer','William','Fair Partner','Production']),field('fairId','Fair','select',r.fairId || '',fairOptions()),field('due','Due date','date',r.due || ''),field('status','Status','select',r.status || 'todo',[{value:'todo',label:'To Do'},{value:'inprogress',label:'In Progress'},{value:'waiting',label:'Waiting'},{value:'complete',label:'Complete'}]),field('priority','Priority','select',r.priority || 'Medium',['High','Medium','Low'])
        ]),
        section('Relationships',[
          field('talentId','Linked talent','select',r.talentId || '',talentOptions('',true),{required:false}),field('contactId','Linked contact','select',r.contactId || '',contactOptions(true),{required:false}),field('blockedBy','Blocked by','text',r.blockedBy || '',[],{required:false}),field('estimatedHours','Estimated hours','number',r.estimatedHours || 1)
        ]),
        section('Details',[
          field('impact','Operational impact','select',r.impact || 'Medium',['High','Medium','Low']),field('description','Description','textarea',r.description || '',[],{full:true,required:false})
        ])
      ].join('')
    };
    if (type === 'talent') return {
      title:record.id ? 'Edit talent record' : 'Add talent',
      html:[
        section('Overview',[
          field('name','Talent name','text',r.name || ''),field('type','Performance type','text',r.type || ''),field('fairId','Fair','select',r.fairId || '',fairOptions()),field('owner','Owner','select',r.owner || Store.state.currentUser,['Spencer','William']),field('status','Pipeline status','select',r.status || 'Submitted',['Submitted','Reviewing','Offered','Contracted','Ready']),field('contactId','Linked contact','select',r.contactId || '',contactOptions(true),{required:false})
        ]),
        section('Readiness',[
          field('agreementStatus','Talent agreement','select',r.agreementStatus || 'Not started',['Not started','Sent','Pending','Received','Approved']),field('musicStatus','Music','select',r.musicStatus || 'Not requested',['Not requested','Pending','Received']),field('bioStatus','Bio','select',r.bioStatus || 'Pending',['Not requested','Pending','Received']),field('photoStatus','Photo','select',r.photoStatus || 'Pending',['Not requested','Pending','Received']),field('parkingStatus','Parking','select',r.parkingStatus || 'Not requested',['Not requested','Pending','Received','Confirmed','Not needed']),field('arrivalTime','Arrival time','text',r.arrivalTime || '',[],{required:false}),field('performanceTime','Performance time','text',r.performanceTime || '',[],{required:false})
        ]),
        section('Production',[
          field('stageNeeds','Stage needs','textarea',r.stageNeeds || '',[],{full:true,required:false}),field('notes','Shared notes','textarea',r.notes || '',[],{full:true,required:false})
        ])
      ].join('')
    };
    if (type === 'contact') return {
      title:record.id ? 'Edit contact' : 'Add production contact',
      html:[
        section('Contact',[
          field('name','Name','text',r.name || ''),field('role','Role','text',r.role || ''),field('organization','Organization','text',r.organization || ''),field('type','Contact type','select',r.type || 'Fair Partner',['Fair Partner','Production','Talent','Vendor','Community Partner']),field('email','Email','email',r.email || '',[],{required:false}),field('phone','Phone','tel',r.phone || '',[],{required:false})
        ]),
        section('Relationship',[
          field('fairIds','Related fairs','multiselect',r.fairIds || [],fairOptions()),field('status','Status','select',r.status || 'Active',['Active','Waiting','Needs follow-up','Paused']),field('lastContact','Last contacted','date',r.lastContact || '',[],{required:false}),field('nextFollowUp','Next follow-up','date',r.nextFollowUp || '',[],{required:false}),field('notes','Relationship notes','textarea',r.notes || '',[],{full:true,required:false})
        ])
      ].join('')
    };

    if (type === 'schedule') return {
      title:record.id ? 'Edit stage block' : 'Add stage block',
      html:[
        section('Stage block',[
          field('title','Internal title','text',r.title || ''),field('publicTitle','Public title','text',r.publicTitle || '',[],{required:false}),field('fairId','Fair','select',r.fairId || Store.state.preferences.scheduleFairId || Store.state.fairs[0]?.id || '',fairOptions()),field('talentId','Linked talent','select',r.talentId || '',talentOptions('',true),{required:false}),field('kind','Block type','select',r.kind || 'Performance',['Performance','Host / Emcee','Story Time','Glam Show','Community','Break','Technical','Closing']),field('status','Production status','select',r.status || 'Draft',['Draft','Needs review','At risk','Locked','Ready'])
        ]),
        section('Timing',[
          field('startTime','Start time','time',r.startTime || '12:00'),field('endTime','End time','time',r.endTime || '12:30'),field('bufferAfter','Required transition minutes','number',r.bufferAfter ?? 10),field('order','Sort order','number',r.order || 10),field('publicVisible','Public schedule','select',String(r.publicVisible ?? true),[{value:'true',label:'Show publicly'},{value:'false',label:'Internal only'}])
        ]),
        section('Production notes',[field('internalNotes','Internal notes','textarea',r.internalNotes || '',[],{full:true,required:false})])
      ].join('')
    };

    if (type === 'deadline') return {
      title:record.id ? 'Edit deadline' : 'Add deadline',
      html:[section('Deadline',[
        field('title','Deadline title','text',r.title || ''),field('date','Date','date',r.date || ''),field('fairId','Fair','select',r.fairId || '',fairOptions()),field('owner','Owner','select',r.owner || Store.state.currentUser,['Spencer','William','Fair Partner','Production']),field('kind','Type','select',r.kind || 'Production',['Production','Talent','Schedule','Materials','Fair Partner','Marketing']),field('relatedType','Related record type','select',r.relatedType || '',[{value:'',label:'None'},{value:'fair',label:'Fair'},{value:'talent',label:'Talent'},{value:'task',label:'Task'},{value:'contact',label:'Contact'}],{required:false}),field('relatedId','Related record ID','text',r.relatedId || '',[],{required:false})])].join('')
    };
    if (type === 'file') return {
      title:record.id ? 'Edit file record' : 'Add file record',
      html:[section('File index',[
        field('name','File name','text',r.name || ''),field('type','File type','select',r.type || 'PDF',['PDF','DOC','PNG','JPG','XLS','AUDIO','VIDEO','LINK','OTHER']),field('folder','Folder','text',r.folder || 'General'),field('fairId','Fair','select',r.fairId || '',fairOptions(true),{required:false}),field('talentId','Linked talent','select',r.talentId || '',talentOptions('',true),{required:false}),field('owner','Owner','select',r.owner || Store.state.currentUser,['Spencer','William','Production']),field('notes','Notes','textarea',r.notes || '',[],{full:true,required:false})])].join('')
    };
    if (type === 'note') return {
      title:record.id ? 'Edit note' : 'Add shared note',
      html:[section('Note',[
        field('fairId','Fair','select',r.fairId || '',fairOptions(true),{required:false}),field('relatedType','Connect to','select',r.relatedType || 'fair',[{value:'fair',label:'Fair'},{value:'talent',label:'Talent'},{value:'task',label:'Task'},{value:'contact',label:'Contact'},{value:'file',label:'File'}]),field('relatedId','Related record ID','text',r.relatedId || '',[],{required:false}),field('body','Note','textarea',r.body || '',[],{full:true})
      ])].join('')
    };
    if (type === 'issue') return {
      title:record.id ? 'Edit issue' : 'Log day-of issue',
      html:[section('Issue',[
        field('title','Issue','text',r.title || ''),field('fairId','Fair','select',r.fairId || Store.state.fairs[0]?.id || '',fairOptions()),field('owner','Owner','select',r.owner || Store.state.currentUser,['Spencer','William','Production','Fair Partner']),field('status','Status','select',r.status || 'Open',['Open','Monitoring','Resolved']),field('severity','Severity','select',r.severity || 'Medium',['High','Medium','Low'])
      ])].join('')
    };
    throw new Error(`No form schema for ${type}`);
  }

  let modalContext = null;
  function openRecordForm(type,record={},defaults={},onSaved){
    const shell = document.getElementById('modalShell');
    const data = schema(type,record,defaults);
    document.getElementById('modalEyebrow').textContent = record.id ? `Edit ${typeLabel(type)}` : `Create ${typeLabel(type)}`;
    document.getElementById('modalTitle').textContent = data.title;
    document.getElementById('formBody').innerHTML = data.html;
    modalContext = {type,record,onSaved};
    shell.classList.add('open'); shell.setAttribute('aria-hidden','false');
    setTimeout(() => shell.querySelector('input,select,textarea')?.focus(),0);
  }
  function closeModal(){
    const shell = document.getElementById('modalShell');
    shell.classList.remove('open'); shell.setAttribute('aria-hidden','true');
    document.getElementById('recordForm').reset(); modalContext = null;
  }
  function parseForm(form){
    const fd = new FormData(form); const data = {};
    for (const [key,value] of fd.entries()){
      if (key === 'fairIds'){
        if (!data.fairIds) data.fairIds=[];
        data.fairIds.push(value);
      }else data[key]=value;
    }
    if ('estimatedHours' in data) data.estimatedHours = Number(data.estimatedHours || 1);
    if ('bufferAfter' in data) data.bufferAfter = Number(data.bufferAfter || 0);
    if ('order' in data) data.order = Number(data.order || 0);
    if ('publicVisible' in data) data.publicVisible = data.publicVisible === 'true';
    return data;
  }
  function submitRecordForm(event){
    event.preventDefault();
    if (!modalContext) return;
    const {type,record,onSaved} = modalContext;
    const data = parseForm(event.currentTarget);
    if (type === 'contact' && !data.fairIds) data.fairIds=[];
    if (type === 'note') data.author = record.author || Store.state.currentUser;
    const saved = Store.upsert(type,{...record,...data});
    Store.log(Store.state.currentUser,`${record.id ? 'updated' : 'created'} ${typeLabel(type).toLowerCase()} “${saved.name || saved.title || saved.body?.slice(0,35) || 'record'}.”`,type,saved.id,saved.fairId || saved.fairIds?.[0] || '');
    closeModal();
    toast(record.id ? 'Changes saved' : `${typeLabel(type)} created`,'Production Board updated');
    onSaved?.(saved);
  }

  let toastTimer = null; let undoAction = null;
  function toast(title,message='',undo=null){
    const el = document.getElementById('toast');
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = message;
    undoAction = typeof undo === 'function' ? undo : null;
    el.classList.toggle('can-undo',Boolean(undoAction)); el.classList.add('open');
    clearTimeout(toastTimer); toastTimer=setTimeout(() => {el.classList.remove('open');undoAction=null;},3500);
  }
  function performUndo(){ if (undoAction){ const fn=undoAction;undoAction=null;fn();document.getElementById('toast').classList.remove('open');toast('Restored','Your last action was undone.'); } }

  function recordTitle(type,item){ return item?.name || item?.title || (type==='note' ? item?.body?.slice(0,55) : 'Record'); }
  function recordSubtitle(type,item){
    if (!item) return '';
    if (type === 'fair') return `${Intel.formatDate(item.date)} · ${item.location}`;
    if (type === 'talent') return `${item.type} · ${fairName(item.fairId)}`;
    if (type === 'task') return `${item.owner} · ${Intel.relativeDate(item.due)}`;
    if (type === 'contact') return `${item.role} · ${item.organization}`;
    if (type === 'file') return `${item.type} · ${item.folder}`;
    if (type === 'schedule') return `${Intel.formatClock(item.startTime)}–${Intel.formatClock(item.endTime)} · ${fairName(item.fairId)}`;
    if (type === 'deadline') return `${Intel.relativeDate(item.date)} · ${item.owner}`;
    if (type === 'note') return `${item.author} · ${Intel.formatTimeAgo(item.createdAt)}`;
    if (type === 'issue') return `${item.status} · ${item.owner}`;
    return '';
  }
  function relatedRow(type,item){ return `<button class="related-record" data-open-record="${esc(type)}:${esc(item.id)}"><span>${icon(type)}</span><span><b>${esc(recordTitle(type,item))}</b><small>${esc(recordSubtitle(type,item))}</small></span><span>›</span></button>`; }
  function timelineHTML(items){
    if (!items.length) return `<div class="empty-state"><div><b>No activity yet</b><p>Changes connected to this record will appear here.</p></div></div>`;
    return `<div class="drawer-timeline">${items.map(a => `<div class="timeline-row"><i></i><div><b>${esc(a.actor)}</b><p>${esc(a.action)}</p></div><time>${esc(Intel.formatTimeAgo(a.timestamp))}</time></div>`).join('')}</div>`;
  }
  function notesHTML(type,id,items){
    return `<div class="related-list">${items.length ? items.map(n => relatedRow('note',n)).join('') : `<div class="empty-state"><div><b>No connected notes</b><p>Add shared context without leaving this record.</p></div></div>`}</div><div class="drawer-section note-composer"><h3>Add a note</h3><textarea id="drawerNoteText" placeholder="Add shared production context…"></textarea><button class="button primary" data-add-drawer-note="${esc(type)}:${esc(id)}">Add Note</button></div>`;
  }

  function overviewHTML(type,item,related){
    const fair = item.fairId ? Store.get('fair',item.fairId) : null;
    if (type === 'fair'){
      const score = Intel.fairReadiness(item); const status = Intel.fairStatus(item);
      return `<div class="detail-grid">
        <div class="detail-card"><span>Readiness</span><b>${score}% · ${esc(status.label)}</b><div class="meter" style="margin-top:9px"><i style="width:${score}%"></i></div></div>
        <div class="detail-card"><span>Event date</span><b>${esc(Intel.formatDate(item.date))}</b><p>${esc(Intel.relativeDate(item.date))}</p></div>
        <div class="detail-card"><span>Venue</span><b>${esc(item.venue || 'Not set')}</b><p>${esc(item.location || '')}</p></div>
        <div class="detail-card"><span>Stage</span><b>${esc(item.stage || 'Not set')}</b></div>
        <div class="detail-card full"><span>Workspace</span><b>${related.tasks.length} tasks · ${related.talent.length} talent · ${related.contacts.length} contacts · ${related.files.length} files</b><p>${esc(item.summary || '')}</p></div>
      </div>`;
    }
    if (type === 'talent'){
      const score = Intel.talentReadiness(item); const missing = Intel.talentMissing(item);
      return `<div class="detail-grid">
        <div class="detail-card"><span>Readiness</span><b>${score}%</b><div class="meter" style="margin-top:9px"><i style="width:${score}%"></i></div></div>
        <div class="detail-card"><span>Pipeline</span><b>${esc(item.status)}</b><p>Owned by ${esc(item.owner)}</p></div>
        <div class="detail-card"><span>Fair</span><b>${esc(fair?.name || 'Not assigned')}</b><p>${esc(item.performanceTime || 'Stage time not set')}</p></div>
        <div class="detail-card"><span>Arrival</span><b>${esc(item.arrivalTime || 'Not set')}</b><p>${esc(item.parkingStatus || 'Parking not set')}</p></div>
        <div class="detail-card full"><span>Missing production items</span><b>${missing.length ? esc(missing.join(' · ')) : 'Production-ready'}</b></div>
        <div class="detail-card full"><span>Stage needs</span><b>${esc(item.stageNeeds || 'Not entered')}</b><p>${esc(item.notes || '')}</p></div>
      </div>`;
    }
    if (type === 'task') return `<div class="detail-grid">
      <div class="detail-card"><span>Status</span><b>${esc(statusText(item.status))}</b><p>${esc(item.priority)} priority · ${esc(item.impact)} impact</p></div>
      <div class="detail-card"><span>Due</span><b>${esc(Intel.formatDate(item.due))}</b><p>${esc(Intel.relativeDate(item.due))}</p></div>
      <div class="detail-card"><span>Owner</span><b>${esc(item.owner)}</b></div>
      <div class="detail-card"><span>Fair</span><b>${esc(fair?.name || 'Not assigned')}</b></div>
      <div class="detail-card full"><span>Blocked by</span><b>${esc(item.blockedBy || 'Nothing')}</b></div>
      <div class="detail-card full"><span>Description</span><b>${esc(item.description || 'No description')}</b><p>${Number(item.estimatedHours || 1)} estimated hour${Number(item.estimatedHours || 1)===1?'':'s'}</p></div>
    </div>`;
    if (type === 'contact') return `<div class="detail-grid">
      <div class="detail-card"><span>Role</span><b>${esc(item.role)}</b><p>${esc(item.organization)}</p></div>
      <div class="detail-card"><span>Status</span><b>${esc(item.status)}</b></div>
      <div class="detail-card"><span>Email</span><b>${esc(item.email || 'Not entered')}</b></div>
      <div class="detail-card"><span>Phone</span><b>${esc(item.phone || 'Not entered')}</b></div>
      <div class="detail-card"><span>Last contacted</span><b>${esc(item.lastContact ? Intel.formatDate(item.lastContact) : 'Not recorded')}</b></div>
      <div class="detail-card"><span>Next follow-up</span><b>${esc(item.nextFollowUp ? Intel.relativeDate(item.nextFollowUp) : 'Not scheduled')}</b></div>
      <div class="detail-card full"><span>Relationship notes</span><b>${esc(item.notes || 'No notes')}</b></div>
    </div>`;
    if (type === 'file') return `<div class="detail-grid"><div class="detail-card"><span>Type</span><b>${esc(item.type)}</b></div><div class="detail-card"><span>Folder</span><b>${esc(item.folder)}</b></div><div class="detail-card"><span>Owner</span><b>${esc(item.owner)}</b></div><div class="detail-card"><span>Updated</span><b>${esc(Intel.formatTimeAgo(item.updatedAt))}</b></div><div class="detail-card full"><span>Notes</span><b>${esc(item.notes || 'No notes')}</b><p>This version indexes the file record. Actual uploads connect later.</p></div></div>`;
    if (type === 'schedule') { const talent=item.talentId?Store.get('talent',item.talentId):null; const issues=Intel.scheduleIssues(item.fairId).filter(x=>x.slotId===item.id); return `<div class="detail-grid"><div class="detail-card"><span>Stage time</span><b>${esc(Intel.formatClock(item.startTime))}–${esc(Intel.formatClock(item.endTime))}</b><p>${Number(item.bufferAfter||0)} minute transition required</p></div><div class="detail-card"><span>Status</span><b>${esc(item.status)}</b><p>${esc(item.kind)}</p></div><div class="detail-card"><span>Public title</span><b>${esc(item.publicTitle||'Internal only')}</b></div><div class="detail-card"><span>Talent</span><b>${esc(talent?.name||'No linked talent')}</b></div><div class="detail-card full"><span>Schedule intelligence</span><b>${issues.length?esc(issues.map(x=>x.title).join(' · ')):'No conflicts detected'}</b></div><div class="detail-card full"><span>Internal notes</span><b>${esc(item.internalNotes||'No notes')}</b></div></div>`; }
    if (type === 'deadline') return `<div class="detail-grid"><div class="detail-card"><span>Date</span><b>${esc(Intel.formatDate(item.date))}</b><p>${esc(Intel.relativeDate(item.date))}</p></div><div class="detail-card"><span>Owner</span><b>${esc(item.owner)}</b></div><div class="detail-card"><span>Type</span><b>${esc(item.kind)}</b></div><div class="detail-card"><span>Fair</span><b>${esc(fair?.name || 'Not assigned')}</b></div></div>`;
    if (type === 'note') return `<div class="detail-grid"><div class="detail-card"><span>Author</span><b>${esc(item.author)}</b></div><div class="detail-card"><span>Created</span><b>${esc(Intel.formatTimeAgo(item.createdAt))}</b></div><div class="detail-card full"><span>Note</span><b>${esc(item.body)}</b></div></div>`;
    if (type === 'issue') return `<div class="detail-grid"><div class="detail-card"><span>Status</span><b>${esc(item.status)}</b></div><div class="detail-card"><span>Severity</span><b>${esc(item.severity)}</b></div><div class="detail-card"><span>Owner</span><b>${esc(item.owner)}</b></div><div class="detail-card"><span>Fair</span><b>${esc(fair?.name || 'Not assigned')}</b></div></div>`;
    return '';
  }

  function drawerHTML(type,id,tab='overview'){
    const item = Store.get(type,id); if (!item) return '';
    const related = Intel.related(type,id);
    const tabs = [
      {id:'overview',label:'Overview'},
      {id:'work',label:'Connected Work'},
      {id:'files',label:'Files'},
      {id:'timeline',label:'Timeline'},
      {id:'notes',label:'Notes'}
    ];
    let body='';
    if (tab === 'overview') body=overviewHTML(type,item,related);
    if (tab === 'work') body=`<div class="drawer-section"><div class="drawer-section-head"><h3>Tasks</h3><button class="text-button" data-create-related="task:${type}:${id}">＋ Add task</button></div><div class="related-list">${related.tasks.length?related.tasks.map(x=>relatedRow('task',x)).join(''):`<div class="empty-state"><div><b>No connected tasks</b><p>Create work directly from this record.</p></div></div>`}</div></div><div class="drawer-section"><div class="drawer-section-head"><h3>Run of Show</h3><button class="text-button" data-create-related="schedule:${type}:${id}">＋ Add block</button></div><div class="related-list">${related.schedules?.length?related.schedules.map(x=>relatedRow('schedule',x)).join(''):`<div class="empty-state"><div><b>No connected stage blocks</b><p>Build the run of show from this record.</p></div></div>`}</div></div><div class="drawer-section"><div class="drawer-section-head"><h3>Talent</h3></div><div class="related-list">${related.talent.length?related.talent.map(x=>relatedRow('talent',x)).join(''):`<div class="empty-state"><div><b>No connected talent</b><p>Talent linked to this record will appear here.</p></div></div>`}</div></div><div class="drawer-section"><div class="drawer-section-head"><h3>Contacts</h3></div><div class="related-list">${related.contacts.length?related.contacts.map(x=>relatedRow('contact',x)).join(''):`<div class="empty-state"><div><b>No connected contacts</b><p>Link a fair or talent contact to this record.</p></div></div>`}</div></div>`;
    if (tab === 'files') body=`<div class="drawer-section"><div class="drawer-section-head"><h3>Files</h3><button class="text-button" data-create-related="file:${type}:${id}">＋ Add file record</button></div><div class="related-list">${related.files.length?related.files.map(x=>relatedRow('file',x)).join(''):`<div class="empty-state"><div><b>No connected files</b><p>Add a file record to keep production assets organized.</p></div></div>`}</div></div><div class="drawer-section"><div class="drawer-section-head"><h3>Deadlines</h3><button class="text-button" data-create-related="deadline:${type}:${id}">＋ Add deadline</button></div><div class="related-list">${related.deadlines.length?related.deadlines.map(x=>relatedRow('deadline',x)).join(''):`<div class="empty-state"><div><b>No connected deadlines</b><p>Deadline relationships will appear here.</p></div></div>`}</div></div>`;
    if (tab === 'timeline') body=timelineHTML(related.activity);
    if (tab === 'notes') body=notesHTML(type,id,related.notes);
    return `<div class="drawer-hero"><div class="drawer-hero-top"><div class="drawer-big-icon">${icon(type)}</div><div><span class="eyebrow">${esc(typeLabel(type))}</span><h1>${esc(recordTitle(type,item))}</h1><p>${esc(recordSubtitle(type,item))}</p></div></div></div><div class="drawer-tabs">${tabs.map(t=>`<button class="${t.id===tab?'active':''}" data-drawer-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div><div class="drawer-body">${body}<div class="drawer-section"><button class="button ghost" data-delete-record="${esc(type)}:${esc(id)}">Delete ${esc(typeLabel(type))}</button></div></div>`;
  }

  function download(name,content,type='application/json'){
    const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  window.OATFUI = {esc,initials,icon,typeLabel,fairName,statusText,field,section,schema,openRecordForm,closeModal,submitRecordForm,toast,performUndo,recordTitle,recordSubtitle,relatedRow,timelineHTML,drawerHTML,download};
})();
