(() => {
  'use strict';

  const STORAGE_KEY = 'oatf-os-production-v007';
  const LEGACY_KEYS = ['oatf-os-production-v006','oatf-os-production-v005','oatf-os-production-v004','oatf-os-production-v003','oatf-admin-v002','oatf-admin-v001'];
  const SESSION_KEY = 'oatf-os-session';

  const nowISO = () => new Date().toISOString();
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

  const seed = {
    meta:{version:'0.07',portal:'production',createdAt:'2026-07-18T16:00:00-07:00'},
    currentUser:'Production',
    preferences:{lastView:'today',lastRecord:null,sidebarCollapsed:false,lastSearch:'',dismissedNotifications:[],scheduleFairId:'fair-oc',scheduleMode:'internal',dayOfFairId:'fair-oc',dayOfSlotId:'schedule-oc-gss',dayOfChecks:{},selectedLens:'exceptions',reportFairId:'fair-oc',reportType:'production-brief',lastCheckpoint:'',lastBackup:'',systemDensity:'comfortable',workflowFairId:'fair-oc',workflowPhase:'all',workflowMode:'orchestration',focusMode:'planning',osFairId:'fair-oc',automationAutoRun:true,historyFairId:'all',inboxFilter:'open'},
    recentViewed:[],
    fairs:[
      {id:'fair-riv',name:'Riverside County Fair',short:'Riverside',code:'RIV',date:'2027-02-20',location:'Indio, CA',venue:'National Date Festival',stage:'Main Stage',status:'On track',summary:'Early-season production workspace for Riverside County Fair.',accent:'#ff7b56',favoriteBy:['William'],createdAt:'2026-07-10T09:00:00-07:00',updatedAt:'2026-07-17T13:30:00-07:00'},
      {id:'fair-sd',name:'San Diego County Fair',short:'San Diego',code:'SD',date:'2027-06-19',location:'Del Mar, CA',venue:'Del Mar Fairgrounds',stage:'Paddock Stage',status:'Needs review',summary:'Full-day family-friendly stage production at the San Diego County Fair.',accent:'#8c63ff',favoriteBy:['Spencer','William'],createdAt:'2026-07-10T09:04:00-07:00',updatedAt:'2026-07-18T10:30:00-07:00'},
      {id:'fair-oc',name:'Orange County Fair',short:'Orange County',code:'OC',date:'2027-07-24',location:'Costa Mesa, CA',venue:'OC Fair & Event Center',stage:'Plaza Stage',status:'Waiting on fair',summary:'Plaza Stage programming, talent readiness, branding, and day-of production.',accent:'#ff3e98',favoriteBy:['Spencer','William'],createdAt:'2026-07-10T09:08:00-07:00',updatedAt:'2026-07-18T15:40:00-07:00'}
    ],
    contacts:[
      {id:'contact-spencer',name:'Spencer Johnson',role:'Production Lead',organization:'Hyperion LA',type:'Production',email:'spencer@hyperionla.com',phone:'',fairIds:['fair-sd','fair-oc','fair-riv'],lastContact:'2026-07-18',nextFollowUp:'',status:'Active',notes:'Shared production lead for OATF OS.',favoriteBy:['William'],createdAt:'2026-07-10T09:10:00-07:00',updatedAt:'2026-07-18T15:45:00-07:00'},
      {id:'contact-oc',name:'Andrew Martinez',role:'Entertainment Contact',organization:'OC Fair & Event Center',type:'Fair Partner',email:'andrew@example.com',phone:'',fairIds:['fair-oc'],lastContact:'2026-07-14',nextFollowUp:'2026-07-21',status:'Waiting',notes:'Primary fair contact for stage and production details.',favoriteBy:['Spencer'],createdAt:'2026-07-10T09:12:00-07:00',updatedAt:'2026-07-14T15:20:00-07:00'},
      {id:'contact-sd',name:'Mary Lawson',role:'Entertainment Department',organization:'San Diego County Fair',type:'Fair Partner',email:'mary@example.com',phone:'',fairIds:['fair-sd'],lastContact:'2026-07-16',nextFollowUp:'2026-07-23',status:'Active',notes:'Fair-side entertainment and production contact.',favoriteBy:['William'],createdAt:'2026-07-10T09:14:00-07:00',updatedAt:'2026-07-16T11:00:00-07:00'},
      {id:'contact-summer',name:'Summer Daze',role:'Performer',organization:'Independent Talent',type:'Talent',email:'summer@example.com',phone:'',fairIds:['fair-oc'],lastContact:'2026-07-09',nextFollowUp:'2026-07-19',status:'Needs follow-up',notes:'Story Time and Glam Show performer.',favoriteBy:['Spencer','William'],createdAt:'2026-07-10T09:16:00-07:00',updatedAt:'2026-07-09T14:00:00-07:00'},
      {id:'contact-gss',name:'Golden State Squares',role:'Dance Group',organization:'Golden State Squares',type:'Talent',email:'hello@goldenstatesquares.example',phone:'',fairIds:['fair-oc'],lastContact:'2026-07-17',nextFollowUp:'',status:'Active',notes:'Opening performance group.',favoriteBy:['Spencer'],createdAt:'2026-07-10T09:18:00-07:00',updatedAt:'2026-07-17T09:20:00-07:00'},
      {id:'contact-ross',name:'Ross Alan',role:'Performer',organization:'Independent Talent',type:'Talent',email:'ross@example.com',phone:'',fairIds:['fair-sd'],lastContact:'2026-07-12',nextFollowUp:'2026-07-20',status:'Waiting',notes:'Live music performance.',favoriteBy:['William'],createdAt:'2026-07-10T09:20:00-07:00',updatedAt:'2026-07-12T10:00:00-07:00'}
    ],
    talent:[
      {id:'talent-gss',name:'Golden State Squares',type:'Dance group',fairId:'fair-oc',contactId:'contact-gss',owner:'Spencer',status:'Contracted',agreementStatus:'Received',musicStatus:'Received',bioStatus:'Received',photoStatus:'Received',parkingStatus:'Pending',arrivalTime:'11:15 AM',performanceTime:'12:15 PM',stageNeeds:'Open dance floor and four handheld microphones.',notes:'Kicks off the day.',favoriteBy:['Spencer','William'],createdAt:'2026-07-10T09:30:00-07:00',updatedAt:'2026-07-18T15:10:00-07:00'},
      {id:'talent-summer',name:'Summer Daze',type:'Drag performer · Story Time',fairId:'fair-oc',contactId:'contact-summer',owner:'Spencer',status:'Contracted',agreementStatus:'Pending',musicStatus:'Pending',bioStatus:'Received',photoStatus:'Received',parkingStatus:'Pending',arrivalTime:'12:15 PM',performanceTime:'1:00 PM / 5:00 PM',stageNeeds:'Story Time chair, handheld microphone, Glam Show playback.',notes:'Appears in Story Time and Glam Show.',favoriteBy:['Spencer','William'],createdAt:'2026-07-10T09:33:00-07:00',updatedAt:'2026-07-17T16:30:00-07:00'},
      {id:'talent-ross',name:'Ross Alan',type:'Live music',fairId:'fair-sd',contactId:'contact-ross',owner:'Spencer',status:'Offered',agreementStatus:'Sent',musicStatus:'Pending',bioStatus:'Received',photoStatus:'Received',parkingStatus:'Not requested',arrivalTime:'2:00 PM',performanceTime:'2:45 PM',stageNeeds:'Vocal mic, monitor mix, stereo playback.',notes:'Production follow-up needed before schedule lock.',favoriteBy:['William'],createdAt:'2026-07-10T09:35:00-07:00',updatedAt:'2026-07-18T12:20:00-07:00'},
      {id:'talent-nicole',name:'Nicole & Scotty',type:'Live music',fairId:'fair-sd',contactId:'',owner:'William',status:'Reviewing',agreementStatus:'Not started',musicStatus:'Not requested',bioStatus:'Pending',photoStatus:'Pending',parkingStatus:'Not requested',arrivalTime:'',performanceTime:'1:30 PM',stageNeeds:'Two vocal microphones and playback input.',notes:'Confirm final 2027 availability.',favoriteBy:[],createdAt:'2026-07-10T09:37:00-07:00',updatedAt:'2026-07-16T10:45:00-07:00'},
      {id:'talent-hashtag',name:'hashtag truly',type:'Live performance',fairId:'fair-riv',contactId:'',owner:'Spencer',status:'Submitted',agreementStatus:'Not started',musicStatus:'Not requested',bioStatus:'Pending',photoStatus:'Pending',parkingStatus:'Not requested',arrivalTime:'',performanceTime:'',stageNeeds:'TBD',notes:'Early pipeline consideration.',favoriteBy:[],createdAt:'2026-07-10T09:40:00-07:00',updatedAt:'2026-07-15T09:00:00-07:00'}
    ],
    tasks:[
      {id:'task-oc-schedule',title:'Finalize OC stage schedule',fairId:'fair-oc',talentId:'',contactId:'contact-oc',owner:'Spencer',status:'inprogress',priority:'High',impact:'High',due:'2026-07-19',blockedBy:'Final fair timing confirmation',estimatedHours:2,description:'Lock the public schedule and production transition windows.',createdAt:'2026-07-12T08:00:00-07:00',updatedAt:'2026-07-18T15:30:00-07:00'},
      {id:'task-summer-parking',title:'Confirm Summer Daze parking',fairId:'fair-oc',talentId:'talent-summer',contactId:'contact-summer',owner:'Spencer',status:'waiting',priority:'High',impact:'High',due:'2026-07-19',blockedBy:'OC Fair credential details',estimatedHours:1,description:'Confirm where Summer should park and how credentials will be delivered.',createdAt:'2026-07-13T09:00:00-07:00',updatedAt:'2026-07-18T11:15:00-07:00'},
      {id:'task-gss-parking',title:'Send Golden State Squares parking instructions',fairId:'fair-oc',talentId:'talent-gss',contactId:'contact-gss',owner:'Spencer',status:'todo',priority:'Medium',impact:'Medium',due:'2026-07-21',blockedBy:'',estimatedHours:1,description:'Send final arrival and parking instructions.',createdAt:'2026-07-14T11:00:00-07:00',updatedAt:'2026-07-17T12:00:00-07:00'},
      {id:'task-ross-music',title:'Collect Ross Alan music files',fairId:'fair-sd',talentId:'talent-ross',contactId:'contact-ross',owner:'Spencer',status:'waiting',priority:'High',impact:'High',due:'2026-07-20',blockedBy:'Ross Alan',estimatedHours:1,description:'Receive final performance tracks and confirm playback order.',createdAt:'2026-07-12T10:15:00-07:00',updatedAt:'2026-07-18T12:25:00-07:00'},
      {id:'task-sd-offers',title:'Send San Diego offer confirmations',fairId:'fair-sd',talentId:'',contactId:'contact-sd',owner:'William',status:'inprogress',priority:'High',impact:'High',due:'2026-07-22',blockedBy:'',estimatedHours:3,description:'Confirm the remaining 2027 talent lineup.',createdAt:'2026-07-11T08:30:00-07:00',updatedAt:'2026-07-18T09:40:00-07:00'},
      {id:'task-riv-list',title:'Build Riverside talent target list',fairId:'fair-riv',talentId:'',contactId:'',owner:'Spencer',status:'todo',priority:'Medium',impact:'Medium',due:'2026-07-29',blockedBy:'',estimatedHours:2,description:'Prepare the first outreach list for Riverside.',createdAt:'2026-07-15T13:00:00-07:00',updatedAt:'2026-07-15T13:00:00-07:00'},
      {id:'task-branding',title:'Confirm OC stage branding inventory',fairId:'fair-oc',talentId:'',contactId:'contact-oc',owner:'William',status:'complete',priority:'Medium',impact:'High',due:'2026-07-17',blockedBy:'',estimatedHours:1,description:'Confirm flags, pennants, and backdrop inventory.',createdAt:'2026-07-10T12:00:00-07:00',updatedAt:'2026-07-17T15:00:00-07:00',completedAt:'2026-07-17T15:00:00-07:00'}
    ],

    schedules:[
      {id:'schedule-oc-welcome',fairId:'fair-oc',title:'Host Welcome',publicTitle:'Welcome to Out at the Fair',talentId:'',kind:'Host / Emcee',startTime:'12:00',endTime:'12:10',bufferAfter:5,publicVisible:true,status:'Locked',internalNotes:'Opening welcome, safety language, and sponsor acknowledgements.',order:10,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'},
      {id:'schedule-oc-gss',fairId:'fair-oc',title:'Golden State Squares',publicTitle:'Golden State Squares',talentId:'talent-gss',kind:'Performance',startTime:'12:15',endTime:'12:55',bufferAfter:5,publicVisible:true,status:'Needs review',internalNotes:'Confirm floor is cleared before the group enters.',order:20,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'},
      {id:'schedule-oc-story',fairId:'fair-oc',title:'OATF Story Time',publicTitle:'OATF Story Time featuring Summer Daze',talentId:'talent-summer',kind:'Story Time',startTime:'13:00',endTime:'13:20',bufferAfter:10,publicVisible:true,status:'At risk',internalNotes:'Chair preset. Handheld mic. Agreement and playback still pending.',order:30,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'},
      {id:'schedule-oc-community',fairId:'fair-oc',title:'Community Stage Block',publicTitle:'Community Celebration',talentId:'',kind:'Community',startTime:'13:30',endTime:'14:10',bufferAfter:10,publicVisible:true,status:'Draft',internalNotes:'Final participant list not yet locked.',order:40,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'},
      {id:'schedule-oc-glam',fairId:'fair-oc',title:'OATF Glam Show',publicTitle:'OATF Glam Show',talentId:'talent-summer',kind:'Glam Show',startTime:'17:00',endTime:'17:45',bufferAfter:15,publicVisible:true,status:'At risk',internalNotes:'Final lineup and music order must be locked.',order:50,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'},
      {id:'schedule-sd-open',fairId:'fair-sd',title:'Opening Ceremony',publicTitle:'Opening Ceremony',talentId:'',kind:'Host / Emcee',startTime:'11:00',endTime:'11:10',bufferAfter:0,publicVisible:true,status:'Draft',internalNotes:'Emcee welcome and fair acknowledgements.',order:10,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'},
      {id:'schedule-sd-nicole',fairId:'fair-sd',title:'Nicole & Scotty',publicTitle:'Nicole & Scotty',talentId:'talent-nicole',kind:'Performance',startTime:'13:30',endTime:'14:10',bufferAfter:15,publicVisible:true,status:'At risk',internalNotes:'Availability, bio, photo, and final production details remain open.',order:20,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'},
      {id:'schedule-sd-ross',fairId:'fair-sd',title:'Ross Alan',publicTitle:'Ross Alan',talentId:'talent-ross',kind:'Performance',startTime:'14:45',endTime:'15:25',bufferAfter:15,publicVisible:true,status:'Needs review',internalNotes:'Music still pending.',order:30,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'},
      {id:'schedule-riv-block',fairId:'fair-riv',title:'Programming Block',publicTitle:'Out at the Fair',talentId:'talent-hashtag',kind:'Performance',startTime:'12:00',endTime:'12:30',bufferAfter:15,publicVisible:true,status:'Draft',internalNotes:'Placeholder until the Riverside lineup is developed.',order:10,createdAt:'2026-07-18T16:00:00-07:00',updatedAt:'2026-07-18T16:00:00-07:00'}
    ],
    deadlines:[
      {id:'deadline-oc-review',title:'OC schedule review',date:'2026-07-19',fairId:'fair-oc',owner:'Spencer',kind:'Schedule',relatedType:'task',relatedId:'task-oc-schedule',createdAt:'2026-07-12T08:05:00-07:00',updatedAt:'2026-07-18T15:30:00-07:00'},
      {id:'deadline-sd-offers',title:'San Diego offers due',date:'2026-07-22',fairId:'fair-sd',owner:'William',kind:'Talent',relatedType:'task',relatedId:'task-sd-offers',createdAt:'2026-07-11T08:35:00-07:00',updatedAt:'2026-07-18T09:40:00-07:00'},
      {id:'deadline-glam',title:'Glam Show lineup lock',date:'2026-07-25',fairId:'fair-oc',owner:'Spencer',kind:'Talent',relatedType:'fair',relatedId:'fair-oc',createdAt:'2026-07-13T09:30:00-07:00',updatedAt:'2026-07-17T12:00:00-07:00'}
    ],
    files:[
      {id:'file-oc-ros',name:'OC_Fair_2027_Run_of_Show_v3.pdf',type:'PDF',folder:'Stage & Production',fairId:'fair-oc',talentId:'',owner:'Spencer',updatedAt:'2026-07-18T15:10:00-07:00',notes:'Current working run of show record.'},
      {id:'file-talent-template',name:'Family_Friendly_Talent_Agreement.docx',type:'DOC',folder:'Shared Templates',fairId:'',talentId:'',owner:'William',updatedAt:'2026-07-17T10:00:00-07:00',notes:'Shared production agreement template. No fee data stored here.'},
      {id:'file-backdrop',name:'OATF_2027_Stage_Backdrop.png',type:'PNG',folder:'Brand & Marketing',fairId:'fair-oc',talentId:'',owner:'William',updatedAt:'2026-07-16T14:00:00-07:00',notes:'Approved production backdrop artwork.'},
      {id:'file-ross-bio',name:'Ross_Alan_Bio_2027.docx',type:'DOC',folder:'Talent Materials',fairId:'fair-sd',talentId:'talent-ross',owner:'Spencer',updatedAt:'2026-07-15T09:15:00-07:00',notes:'Approved bio.'}
    ],
    notes:[
      {id:'note-oc-brand',body:'Let’s make sure the Plaza Stage has stronger OATF visual branding this year—flags, pennants, and the full backdrop.',fairId:'fair-oc',relatedType:'fair',relatedId:'fair-oc',author:'William',createdAt:'2026-07-18T09:42:00-07:00'},
      {id:'note-summer',body:'Story Time and Glam Show are both confirmed conceptually. Keep the production details together in this record.',fairId:'fair-oc',relatedType:'talent',relatedId:'talent-summer',author:'Spencer',createdAt:'2026-07-17T16:35:00-07:00'}
    ],
    issues:[
      {id:'issue-parking',title:'Performer parking credential missing',fairId:'fair-oc',status:'Open',owner:'Spencer',severity:'High',createdAt:'2026-07-18T15:32:00-07:00',updatedAt:'2026-07-18T15:32:00-07:00'},
      {id:'issue-monitor',title:'Stage-left monitor adjustment',fairId:'fair-sd',status:'Resolved',owner:'Production',severity:'Medium',createdAt:'2026-07-18T15:15:00-07:00',updatedAt:'2026-07-18T15:25:00-07:00'}
    ],
    handoffs:[
      {id:'handoff-seed-1',fairId:'fair-oc',author:'Production',shift:'Planning',summary:'OC workspace is waiting on final parking and Summer Daze music.',blockers:'Summer Daze music and parking confirmation.',decisions:'Keep the public schedule unchanged until performer readiness is complete.',nextAction:'Follow up on missing materials and confirm backstage arrival flow.',createdAt:'2026-07-18T15:50:00-07:00'}
    ],
    playbookRuns:[],
    activity:[
      {id:'act-1',actor:'Spencer',action:'moved Golden State Squares to Contracted.',entityType:'talent',entityId:'talent-gss',fairId:'fair-oc',timestamp:'2026-07-18T15:42:00-07:00'},
      {id:'act-2',actor:'William',action:'approved the OC stage backdrop record.',entityType:'file',entityId:'file-backdrop',fairId:'fair-oc',timestamp:'2026-07-18T14:45:00-07:00'},
      {id:'act-3',actor:'Spencer',action:'updated the Orange County run of show.',entityType:'file',entityId:'file-oc-ros',fairId:'fair-oc',timestamp:'2026-07-18T13:20:00-07:00'},
      {id:'act-4',actor:'William',action:'continued San Diego offer confirmations.',entityType:'task',entityId:'task-sd-offers',fairId:'fair-sd',timestamp:'2026-07-18T09:40:00-07:00'},
      {id:'act-5',actor:'Spencer',action:'added a production note for Summer Daze.',entityType:'talent',entityId:'talent-summer',fairId:'fair-oc',timestamp:'2026-07-17T16:35:00-07:00'}
    ]
  };

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function normalizeDate(value){
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  function findFairId(state, value){
    if (!value) return '';
    const match = state.fairs.find(fair => [fair.id,fair.name,fair.short,fair.code].some(v => String(v).toLowerCase() === String(value).toLowerCase()) || fair.name.toLowerCase().includes(String(value).toLowerCase()));
    return match?.id || '';
  }

  function migrateLegacy(legacy){
    const state = clone(seed);
    if (!legacy || typeof legacy !== 'object') return state;

    if (Array.isArray(legacy.fairs) && legacy.fairs.length){
      state.fairs = legacy.fairs.map((fair,index) => ({
        id:fair.id && String(fair.id).startsWith('fair-') ? fair.id : `fair-legacy-${index+1}`,
        name:fair.name || `Fair ${index+1}`,
        short:fair.short || fair.name || `Fair ${index+1}`,
        code:(fair.short || fair.name || `F${index+1}`).split(' ').map(x => x[0]).join('').slice(0,3).toUpperCase(),
        date:fair.date || '',location:fair.location || '',venue:fair.venue || '',stage:fair.stage || '',status:fair.status || 'Planning',summary:fair.summary || '',accent:fair.accent || '#8c63ff',favoriteBy:fair.favoriteBy || [],createdAt:normalizeDate(fair.createdAt) || nowISO(),updatedAt:normalizeDate(fair.updatedAt) || nowISO()
      }));
    }

    state.tasks = (legacy.tasks || []).map((task,index) => ({
      id:String(task.id || `legacy-task-${index+1}`).startsWith('task-') ? String(task.id) : `task-legacy-${task.id || index+1}`,
      title:task.title || 'Untitled task',fairId:findFairId(state,task.fairId || task.fair),talentId:task.talentId || '',contactId:task.contactId || '',owner:task.owner || 'Spencer',status:task.status === 'progress' ? 'inprogress' : task.status || 'todo',priority:task.priority || 'Medium',impact:task.impact || 'Medium',due:task.due || '',blockedBy:task.blockedBy || '',estimatedHours:Number(task.estimatedHours || 1),description:task.description || '',createdAt:normalizeDate(task.createdAt) || nowISO(),updatedAt:normalizeDate(task.updatedAt) || nowISO(),completedAt:task.completedAt || ''
    }));

    state.talent = (legacy.talent || []).map((item,index) => ({
      id:String(item.id || `legacy-talent-${index+1}`).startsWith('talent-') ? String(item.id) : `talent-legacy-${item.id || index+1}`,
      name:item.name || 'Untitled talent',type:item.type || 'Performer',fairId:findFairId(state,item.fairId || item.fair),contactId:item.contactId || '',owner:item.owner || 'Spencer',status:item.status || 'Submitted',agreementStatus:item.agreementStatus || (item.status === 'Contracted' || item.status === 'Ready' ? 'Received' : 'Not started'),musicStatus:item.musicStatus || item.music || 'Not requested',bioStatus:item.bioStatus || 'Pending',photoStatus:item.photoStatus || 'Pending',parkingStatus:item.parkingStatus || 'Not requested',arrivalTime:item.arrivalTime || '',performanceTime:item.performanceTime || '',stageNeeds:item.stageNeeds || '',notes:item.notes || '',favoriteBy:item.favoriteBy || [],createdAt:normalizeDate(item.createdAt) || nowISO(),updatedAt:normalizeDate(item.updatedAt) || nowISO()
    }));

    state.deadlines = (legacy.deadlines || []).map((item,index) => ({id:String(item.id || index+1).startsWith('deadline-') ? String(item.id) : `deadline-legacy-${item.id || index+1}`,title:item.title || 'Deadline',date:item.date || '',fairId:findFairId(state,item.fairId || item.fair),owner:item.owner || 'Spencer',kind:item.kind || 'Production',relatedType:item.relatedType || '',relatedId:item.relatedId || '',createdAt:normalizeDate(item.createdAt) || nowISO(),updatedAt:normalizeDate(item.updatedAt) || nowISO()}));
    state.files = (legacy.files || []).map((item,index) => ({id:String(item.id || index+1).startsWith('file-') ? String(item.id) : `file-legacy-${item.id || index+1}`,name:item.name || 'Untitled file',type:item.type || 'FILE',folder:item.folder || 'General',fairId:findFairId(state,item.fairId || item.fair),talentId:item.talentId || '',owner:item.owner || 'Spencer',updatedAt:normalizeDate(item.updatedAt) || nowISO(),notes:item.notes || ''}));
    state.notes = (legacy.notes || []).map((item,index) => ({id:String(item.id || index+1).startsWith('note-') ? String(item.id) : `note-legacy-${item.id || index+1}`,body:item.body || '',fairId:findFairId(state,item.fairId || item.fair),relatedType:item.relatedType || 'fair',relatedId:item.relatedId || findFairId(state,item.fairId || item.fair),author:item.author || 'William',createdAt:normalizeDate(item.createdAt) || nowISO()}));
    state.issues = (legacy.issues || []).map((item,index) => ({id:String(item.id || index+1).startsWith('issue-') ? String(item.id) : `issue-legacy-${item.id || index+1}`,title:item.title || 'Issue',fairId:findFairId(state,item.fairId || item.fair),status:item.status || 'Open',owner:item.owner || 'Spencer',severity:item.severity || 'Medium',createdAt:normalizeDate(item.createdAt) || nowISO(),updatedAt:normalizeDate(item.updatedAt) || nowISO()}));
    state.activity = (legacy.activity || []).map((item,index) => ({id:String(item.id || index+1).startsWith('act-') ? String(item.id) : `act-legacy-${item.id || index+1}`,actor:item.actor || 'OATF',action:item.action || '',entityType:item.entityType || '',entityId:item.entityId || '',fairId:findFairId(state,item.fairId || item.context || ''),timestamp:normalizeDate(item.timestamp) || nowISO()}));
    state.contacts = clone(seed.contacts);
    state.currentUser = 'Production';
    state.preferences = {...state.preferences,...(legacy.preferences || {})};
    state.recentViewed = legacy.recentViewed || [];
    return state;
  }


  function upgradeState(input){
    const upgraded = input && typeof input === 'object' ? input : clone(seed);
    upgraded.meta = {...(upgraded.meta || {}),version:'0.07',portal:'production'};
    upgraded.currentUser = 'Production';
    upgraded.preferences = {...seed.preferences,...(upgraded.preferences || {})};
    upgraded.recentViewed = Array.isArray(upgraded.recentViewed) ? upgraded.recentViewed : [];
    upgraded.schedules = Array.isArray(upgraded.schedules) && upgraded.schedules.length ? upgraded.schedules : clone(seed.schedules);
    upgraded.handoffs = Array.isArray(upgraded.handoffs) ? upgraded.handoffs : clone(seed.handoffs || []);
    upgraded.playbookRuns = Array.isArray(upgraded.playbookRuns) ? upgraded.playbookRuns : [];
    upgraded.tasks = Array.isArray(upgraded.tasks) ? upgraded.tasks.map(task => ({
      dependsOnTaskId:task.dependsOnTaskId || '',
      phase:task.phase || '',
      gateKey:task.gateKey || '',
      ...task
    })) : [];
    ['fairs','talent','contacts','tasks','files','schedules'].forEach(key => {
      (upgraded[key] || []).forEach(item => {
        const hadFavorite = Array.isArray(item.favoriteBy) && item.favoriteBy.length;
        item.favoriteBy = hadFavorite ? ['Production'] : [];
      });
    });
    return upgraded;
  }

  function validateState(state){
    const required = ['fairs','contacts','talent','tasks','deadlines','files','notes','issues','activity'];
    return state && typeof state === 'object' && required.every(key => Array.isArray(state[key]));
  }

  function load(){
    try{
      const current = localStorage.getItem(STORAGE_KEY);
      if (current){
        const parsed = JSON.parse(current);
        if (validateState(parsed)) return upgradeState(parsed);
      }
      for (const key of LEGACY_KEYS){
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const migrated = migrateLegacy(JSON.parse(raw));
        const upgraded = upgradeState(migrated);
        localStorage.setItem(STORAGE_KEY,JSON.stringify(upgraded));
        return upgraded;
      }
    }catch(error){ console.warn('OATF OS load failed',error); }
    const fresh = upgradeState(clone(seed));
    localStorage.setItem(STORAGE_KEY,JSON.stringify(fresh));
    return fresh;
  }

  let state = load();
  const listeners = new Set();
  let saveTimer = null;

  function notify(){ listeners.forEach(fn => fn(state)); }
  function persist(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    notify();
  }
  function save({immediate=false}={}){
    clearTimeout(saveTimer);
    window.dispatchEvent(new CustomEvent('oatf:saving'));
    if (immediate){
      persist();
      window.dispatchEvent(new CustomEvent('oatf:saved'));
      return;
    }
    saveTimer = setTimeout(() => {
      persist();
      window.dispatchEvent(new CustomEvent('oatf:saved'));
    },220);
  }

  function getCollection(type){
    const map = {fair:'fairs',contact:'contacts',talent:'talent',task:'tasks',schedule:'schedules',deadline:'deadlines',file:'files',note:'notes',issue:'issues',handoff:'handoffs',activity:'activity'};
    return state[map[type] || type];
  }
  function get(type,id){ return getCollection(type)?.find(item => item.id === id) || null; }
  function upsert(type,record){
    const collection = getCollection(type);
    if (!collection) throw new Error(`Unknown collection: ${type}`);
    const index = collection.findIndex(item => item.id === record.id);
    const stamp = nowISO();
    if (index >= 0) collection[index] = {...collection[index],...record,updatedAt:stamp};
    else collection.push({...record,id:record.id || uid(type),createdAt:record.createdAt || stamp,updatedAt:stamp});
    save();
    return index >= 0 ? collection[index] : collection[collection.length-1];
  }
  function remove(type,id){
    const collection = getCollection(type);
    const index = collection.findIndex(item => item.id === id);
    if (index < 0) return null;
    const [removed] = collection.splice(index,1);
    save();
    return {removed,index};
  }
  function restore(type,record,index){
    const collection = getCollection(type);
    collection.splice(Math.min(index,collection.length),0,record);
    save();
  }
  function log(actor,action,entityType='',entityId='',fairId=''){
    state.activity.unshift({id:uid('act'),actor,action,entityType,entityId,fairId,timestamp:nowISO()});
    state.activity = state.activity.slice(0,400);
    save();
  }
  function setCurrentUser(){ state.currentUser = 'Production'; save({immediate:true}); }
  function setPreference(key,value){ state.preferences[key] = value; save(); }
  function addRecent(type,id){
    state.recentViewed = state.recentViewed.filter(item => !(item.type === type && item.id === id));
    state.recentViewed.unshift({type,id,viewedAt:nowISO()});
    state.recentViewed = state.recentViewed.slice(0,8);
    state.preferences.lastRecord = {type,id};
    save();
  }
  function toggleFavorite(type,id,user=state.currentUser){
    const item = get(type,id);
    if (!item) return false;
    item.favoriteBy = Array.isArray(item.favoriteBy) ? item.favoriteBy : [];
    const index = item.favoriteBy.indexOf(user);
    if (index >= 0) item.favoriteBy.splice(index,1); else item.favoriteBy.push(user);
    item.updatedAt = nowISO();
    save();
    return index < 0;
  }
  function exportData(){
    return JSON.stringify({...state,exportedAt:nowISO()},null,2);
  }
  function importData(data){
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!validateState(parsed)) throw new Error('This backup is not a valid OATF OS Production Board file.');
    state = upgradeState(parsed);
    save({immediate:true});
  }
  function reset(){ state = clone(seed); save({immediate:true}); }
  function subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); }

  window.OATFStore = {
    STORAGE_KEY,SESSION_KEY,uid,nowISO,clone,
    get state(){ return state; },
    getCollection,get,upsert,remove,restore,log,save,setCurrentUser,setPreference,addRecent,toggleFavorite,exportData,importData,reset,subscribe
  };
})();
