(() => {
  'use strict';

  const Store = window.OATFStore;
  const Intel = window.OATFIntel;
  const UI = window.OATFUI;
  if (!Store || !Intel || !UI) return;

  const $ = selector => document.querySelector(selector);
  const esc = UI.esc;
  const now = () => Store.nowISO();
  const REQUIRED_VIEWS = ['today','mywork','fairs','talent','contacts','schedule','dayof','control','orchestration','oscenter','twin','stateengine','briefing','release'];
  const REQUIRED_MODULES = ['OATFStore','OATFIntel','OATFUI','OATFKernel','OATFWorkflow','OATFTwin','OATFStateEngine','OATFShell','OATFSimplify'];
  const COLLECTIONS = ['fairs','contacts','talent','tasks','schedules','deadlines','files','notes','issues','handoffs','scenarios','decisions','stateCaptures','changeSets','incidents','packageHistory','spaces','activity'];
  const runtimeErrors = [];
  let lastResults = [];

  window.addEventListener('error', event => {
    runtimeErrors.unshift({
      type:'error',
      message:event.message || 'Unknown runtime error',
      source:event.filename || '',
      line:event.lineno || 0,
      time:now()
    });
    runtimeErrors.splice(25);
    render();
  });

  window.addEventListener('unhandledrejection', event => {
    runtimeErrors.unshift({
      type:'promise',
      message:String(event.reason?.message || event.reason || 'Unhandled promise rejection'),
      source:'',
      line:0,
      time:now()
    });
    runtimeErrors.splice(25);
    render();
  });

  function ensurePreferences(){
    const p=Store.state.preferences;
    let changed=false;
    const defaults={
      navigationMode:'full',
      textScale:'normal',
      reducedMotion:false,
      highContrast:false,
      focusOutlines:true,
      onboardingDismissed:false,
      releaseTestLastRun:'',
      releaseTestPassCount:0,
      releaseTestFailCount:0,
      releaseCandidateAccepted:false,
      sidebarBehavior:'auto',
      mediumDesktopDensity:'balanced',
      shellTourDismissed:false
    };
    Object.entries(defaults).forEach(([key,value])=>{
      if(p[key]===undefined){p[key]=value;changed=true;}
    });
    if(changed)Store.save({immediate:true});
    applyAppearance();
  }

  function applyAppearance(){
    const p=Store.state.preferences;
    document.body.dataset.navMode=p.navigationMode||'full';
    document.body.dataset.textScale=p.textScale||'normal';
    document.body.dataset.contrast=p.highContrast?'high':'standard';
    document.body.dataset.motion=p.reducedMotion?'reduced':'full';
    document.body.dataset.focusOutlines=p.focusOutlines===false?'minimal':'visible';
  }

  function setupItems(){
    const state=Store.state;
    const fair=state.fairs[0];
    const fairContact=state.contacts.some(contact=>contact.type==='Fair Partner'||contact.fairIds?.length);
    const schedule=state.schedules.length>0;
    const backup=Boolean(state.preferences.lastBackup);
    const capture=state.stateCaptures?.length>0;
    const testRun=Boolean(state.preferences.releaseTestLastRun);
    return [
      {id:'identity',label:'Production workspace boundary is active',detail:'This build is Production-only. Admin credentials and private records are not included.',done:state.meta?.portal==='production'},
      {id:'fair',label:'At least one fair workspace exists',detail:'Create the fair profile that connected records will use.',done:state.fairs.length>0,view:'fairs'},
      {id:'contact',label:'A fair-side production contact is connected',detail:'Add a Fair Partner, entertainment, or production contact.',done:fairContact,view:'contacts'},
      {id:'talent',label:'At least one performer is connected',detail:'Talent readiness drives materials and stage workflows.',done:state.talent.length>0,view:'talent'},
      {id:'schedule',label:'A run of show exists',detail:'Add at least one stage block and validate timing.',done:schedule,view:'schedule'},
      {id:'backup',label:'A current Production backup was exported',detail:'Export a JSON backup before using the release candidate operationally.',done:backup,action:'backup'},
      {id:'capture',label:'A fair-state baseline was captured',detail:'Create a State Engine baseline before major edits.',done:capture,view:'stateengine'},
      {id:'qa',label:'The release test suite was run',detail:'Run local checks after uploading the build.',done:testRun,action:'tests'}
    ];
  }

  function uniqueIdsTest(){
    const duplicates=[];
    COLLECTIONS.forEach(collection=>{
      const seen=new Set();
      (Store.state[collection]||[]).forEach(record=>{
        if(!record?.id)return;
        if(seen.has(record.id))duplicates.push(`${collection}:${record.id}`);
        seen.add(record.id);
      });
    });
    return {pass:duplicates.length===0,detail:duplicates.length?`${duplicates.length} duplicate ID(s): ${duplicates.slice(0,3).join(', ')}`:'Every collection has unique record IDs.'};
  }

  function referencesTest(){
    const fairIds=new Set(Store.state.fairs.map(fair=>fair.id));
    const broken=[];
    ['talent','tasks','schedules','deadlines','files','notes','issues','handoffs','incidents','decisions'].forEach(collection=>{
      (Store.state[collection]||[]).forEach(record=>{
        if(record.fairId&&!fairIds.has(record.fairId))broken.push(`${collection}:${record.id}`);
      });
    });
    Store.state.tasks.forEach(task=>{
      if(task.dependsOnTaskId&&!Store.get('task',task.dependsOnTaskId))broken.push(`dependency:${task.id}`);
    });
    return {pass:broken.length===0,detail:broken.length?`${broken.length} broken record reference(s) detected.`:'Connected record references are valid.'};
  }

  function scheduleTest(){
    const invalid=[];
    const pattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
    Store.state.schedules.forEach(slot=>{
      if(!pattern.test(slot.startTime||'')||!pattern.test(slot.endTime||''))invalid.push(slot.title||slot.id);
      else{
        const [sh,sm]=slot.startTime.split(':').map(Number);
        const [eh,em]=slot.endTime.split(':').map(Number);
        if(eh*60+em<=sh*60+sm)invalid.push(slot.title||slot.id);
      }
    });
    return {pass:invalid.length===0,detail:invalid.length?`${invalid.length} run-of-show block(s) have invalid timing.`:'All stage blocks use valid forward-moving times.'};
  }

  function storageTest(){
    try{
      const key='oatf-v010-write-test';
      localStorage.setItem(key,'ok');
      const pass=localStorage.getItem(key)==='ok';
      localStorage.removeItem(key);
      return {pass,detail:pass?'Browser storage is writable.':'Browser storage write/read failed.'};
    }catch(error){
      return {pass:false,detail:`Storage error: ${error.message}`};
    }
  }

  function exportBoundaryTest(){
    const forbiddenTopLevel=['budgets','revenue','payments','contracts','negotiations','insurance','adminCredentials','executiveNotes'];
    const found=forbiddenTopLevel.filter(key=>Object.prototype.hasOwnProperty.call(Store.state,key));
    return {pass:found.length===0,detail:found.length?`Private/Admin collection(s) found: ${found.join(', ')}`:'Production data model contains no Admin-only collections.'};
  }

  async function runTests({manual=true}={}){
    const syncTests=[
      {id:'version',label:'Release storage version',run:()=>({pass:Store.STORAGE_KEY==='oatf-os-production-v012',detail:`Active key: ${Store.STORAGE_KEY}`})},
      {id:'portal',label:'Production permission boundary',run:()=>({pass:Store.state.meta?.portal==='production',detail:'Workspace is explicitly scoped to Production.'})},
      {id:'admin-boundary',label:'Admin data separation',run:exportBoundaryTest},
      {id:'views',label:'Required application views',run:()=>{
        const missing=REQUIRED_VIEWS.filter(view=>!document.getElementById(`view-${view}`));
        return {pass:missing.length===0,detail:missing.length?`Missing views: ${missing.join(', ')}`:`${REQUIRED_VIEWS.length} required views are present.`};
      }},
      {id:'modules',label:'Application module availability',run:()=>{
        const missing=REQUIRED_MODULES.filter(module=>!window[module]);
        return {pass:missing.length===0,detail:missing.length?`Missing modules: ${missing.join(', ')}`:`${REQUIRED_MODULES.length} application modules loaded.`};
      }},
      {id:'responsive-shell',label:'Responsive application shell',run:()=>{
        const mode=window.OATFShell?.effectiveMode?.();
        const labels=[...document.querySelectorAll('.nav-link')].every(button=>button.dataset.navLabel);
        return {pass:Boolean(mode&&labels),detail:mode?`${mode} shell active at ${window.innerWidth}×${window.innerHeight}.`:'Responsive shell did not initialize.'};
      }},
      {id:'focused-workflow',label:'Focused Production workflow',run:()=>{
        const core=['today','fairs','mywork','schedule','dayof','contacts','files'];
        const corePresent=core.every(view=>document.querySelector(`.simplified-main-nav [data-view="${view}"]`));
        const todayFocused=Boolean(document.querySelector('.focus-dashboard'));
        return {pass:corePresent&&todayFocused&&Boolean(window.OATFSimplify),detail:corePresent&&todayFocused?'Simplified navigation and focused Today dashboard are active.':'Focused workflow did not initialize completely.'};
      }},
      {id:'ids',label:'Unique record IDs',run:uniqueIdsTest},
      {id:'references',label:'Connected-record integrity',run:referencesTest},
      {id:'schedule',label:'Run-of-show timing',run:scheduleTest},
      {id:'storage',label:'Local persistence',run:storageTest},
      {id:'runtime',label:'Runtime error monitor',run:()=>({pass:runtimeErrors.length===0,detail:runtimeErrors.length?`${runtimeErrors.length} runtime error(s) captured this session.`:'No runtime errors captured this session.'})},
      {id:'service-worker',label:'Offline-capable browser support',run:()=>({pass:'serviceWorker' in navigator,detail:'serviceWorker' in navigator?'Service worker API is available.':'This browser does not expose the service worker API.'})},
      {id:'backup',label:'Backup readiness',run:()=>({pass:Boolean(Store.state.preferences.lastBackup),detail:Store.state.preferences.lastBackup?`Last export: ${Intel.formatTimeAgo(Store.state.preferences.lastBackup)}`:'No backup export has been recorded yet.',warning:true})}
    ];

    lastResults=syncTests.map(test=>{
      try{
        const result=test.run();
        return {...test,...result};
      }catch(error){
        return {...test,pass:false,detail:error.message};
      }
    });

    // Manifest fetch is asynchronous and may fail when opening file:// directly.
    try{
      const response=await fetch('manifest.webmanifest',{cache:'no-store'});
      const manifest=await response.json();
      lastResults.push({
        id:'manifest',
        label:'PWA manifest',
        pass:Boolean(manifest?.name&&manifest?.start_url),
        detail:manifest?.name?`${manifest.name} manifest loaded.`:'Manifest is missing required fields.'
      });
    }catch(error){
      const localFile=location.protocol==='file:';
      lastResults.push({
        id:'manifest',
        label:'PWA manifest',
        pass:localFile,
        warning:localFile,
        detail:localFile?'Manifest fetch is blocked by file:// preview. Re-test after static hosting.':`Manifest load failed: ${error.message}`
      });
    }

    const passes=lastResults.filter(result=>result.pass).length;
    const failures=lastResults.filter(result=>!result.pass&&!result.warning).length;
    Store.state.preferences.releaseTestLastRun=now();
    Store.state.preferences.releaseTestPassCount=passes;
    Store.state.preferences.releaseTestFailCount=failures;
    Store.save({immediate:true});
    if(manual)UI.toast('Release tests complete',`${passes} passed · ${failures} failed.`);
    render();
    return lastResults;
  }

  function releaseScore(){
    const setup=setupItems();
    const setupScore=setup.filter(item=>item.done).length/setup.length*45;
    const tests=lastResults.length?lastResults:storedResultsSummary();
    const testTotal=Math.max(1,tests.length);
    const testScore=tests.filter(item=>item.pass).length/testTotal*45;
    const runtimeScore=runtimeErrors.length?0:10;
    return Math.round(setupScore+testScore+runtimeScore);
  }

  function storedResultsSummary(){
    const pass=Number(Store.state.preferences.releaseTestPassCount||0);
    const fail=Number(Store.state.preferences.releaseTestFailCount||0);
    if(!pass&&!fail)return [];
    return [
      ...Array.from({length:pass},(_,index)=>({id:`stored-pass-${index}`,pass:true})),
      ...Array.from({length:fail},(_,index)=>({id:`stored-fail-${index}`,pass:false}))
    ];
  }

  function releaseDecision(){
    const score=releaseScore();
    const requiredSetup=setupItems().filter(item=>['identity','fair','contact','schedule','backup','qa'].includes(item.id));
    const missingRequired=requiredSetup.filter(item=>!item.done).length;
    const failures=lastResults.length?lastResults.filter(result=>!result.pass&&!result.warning).length:Number(Store.state.preferences.releaseTestFailCount||0);
    if(score>=90&&missingRequired===0&&failures===0)return {status:'READY',tone:'ready',detail:'Release Candidate passes the local launch gate.'};
    if(score>=72&&failures===0)return {status:'CONDITIONAL',tone:'conditional',detail:'Usable for testing; finish setup before operational reliance.'};
    return {status:'HOLD',tone:'hold',detail:'Resolve setup or test failures before treating this as launch-ready.'};
  }

  function exportBackup(){
    const blob=new Blob([Store.exportData()],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=`oatf-os-production-v012-backup-${new Date().toISOString().slice(0,10)}.json`;
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    Store.state.preferences.lastBackup=now();
    Store.save({immediate:true});
    UI.toast('Backup exported','The Release Center recorded the new backup.');
    render();
  }

  function releaseReport(){
    const setup=setupItems();
    const decision=releaseDecision();
    const results=lastResults.length?lastResults:[];
    const lines=[
      'OATF OS Production V0.12 — Release Candidate Report',
      `Generated: ${new Date().toLocaleString()}`,
      `Decision: ${decision.status}`,
      `Readiness score: ${releaseScore()}%`,
      '',
      'SETUP',
      ...setup.map(item=>`${item.done?'PASS':'OPEN'} — ${item.label}`),
      '',
      'LOCAL TESTS',
      ...(results.length?results.map(item=>`${item.pass?'PASS':item.warning?'WARN':'FAIL'} — ${item.label}: ${item.detail}`):['Not run in this session.']),
      '',
      'PERMISSION BOUNDARY',
      'Production portal only. No Admin credentials, budgets, revenue, fair payments, private agreements, negotiations, insurance, or executive-only notes are included.',
      '',
      'DEPLOYMENT NOTE',
      'This remains a local-first static web application. Authentication, live multi-device sync, cloud storage, and server-side backups are not included.'
    ];
    return lines.join('\n');
  }

  function copyReport(){
    const text=releaseReport();
    navigator.clipboard?.writeText(text).then(()=>UI.toast('Release report copied','The local readiness report is ready to paste.'));
  }

  function downloadReport(){
    const blob=new Blob([releaseReport()],{type:'text/plain'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=`oatf-os-v012-release-report-${new Date().toISOString().slice(0,10)}.txt`;
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    UI.toast('Release report downloaded','The report contains no Admin-only information.');
  }

  function onboardingCards(){
    const items=setupItems();
    return `<article class="release-panel onboarding-panel">
      <div class="release-panel-head">
        <div><span class="eyebrow">Guided launch setup</span><h3>Production Setup</h3></div>
        <span class="release-chip">${items.filter(item=>item.done).length}/${items.length} complete</span>
      </div>
      <div class="setup-list">${items.map(item=>`<article class="${item.done?'done':'open'}">
        <span>${item.done?'✓':'○'}</span>
        <div><b>${esc(item.label)}</b><small>${esc(item.detail)}</small></div>
        ${item.done?'<em>Complete</em>':item.view?`<button data-release-view="${item.view}">Open</button>`:item.action==='backup'?'<button data-release-backup>Export</button>':'<button data-release-tests>Run</button>'}
      </article>`).join('')}</div>
    </article>`;
  }

  function testPanel(){
    const results=lastResults;
    return `<article class="release-panel test-panel">
      <div class="release-panel-head">
        <div><span class="eyebrow">Local release validation</span><h3>QA Test Suite</h3></div>
        <button class="button primary small-button" data-release-tests>Run All Tests</button>
      </div>
      <div class="test-summary">
        <div><strong>${results.filter(item=>item.pass).length||Store.state.preferences.releaseTestPassCount||0}</strong><span>Passed</span></div>
        <div><strong>${results.filter(item=>!item.pass&&!item.warning).length||Store.state.preferences.releaseTestFailCount||0}</strong><span>Failed</span></div>
        <div><strong>${results.filter(item=>item.warning).length}</strong><span>Warnings</span></div>
      </div>
      <div class="release-tests">${results.length?results.map(result=>`<article class="${result.pass?'pass':result.warning?'warn':'fail'}">
        <span>${result.pass?'✓':result.warning?'△':'!'}</span>
        <div><b>${esc(result.label)}</b><small>${esc(result.detail)}</small></div>
        <em>${result.pass?'Pass':result.warning?'Warning':'Fail'}</em>
      </article>`).join(''):`<div class="release-empty"><b>Tests have not run in this session.</b><span>Run the suite after uploading or opening the Release Candidate.</span></div>`}</div>
    </article>`;
  }

  function appearancePanel(){
    const p=Store.state.preferences;
    const shellMode=window.OATFShell?.effectiveMode?.()||'loading';
    return `<article class="release-panel appearance-panel">
      <div class="release-panel-head"><div><span class="eyebrow">Accessibility and display fit</span><h3>Experience Controls</h3></div><span class="release-chip">Saved locally</span></div>
      <div class="appearance-grid">
        <label><span>Navigation contents</span><select id="releaseNavigationMode"><option value="full"${p.navigationMode==='full'?' selected':''}>Full OS</option><option value="simple"${p.navigationMode==='simple'?' selected':''}>Simple Production</option></select><small>Simple mode hides advanced operations and system screens from the sidebar.</small></label>
        <label><span>Sidebar fit</span><select id="releaseSidebarBehavior"><option value="auto"${p.sidebarBehavior==='auto'?' selected':''}>Auto — recommended</option><option value="full"${p.sidebarBehavior==='full'?' selected':''}>Always full</option><option value="compact"${p.sidebarBehavior==='compact'?' selected':''}>Always compact</option></select><small>Auto uses full navigation on wide screens, an icon rail on medium screens, and a drawer on mobile.</small></label>
        <label><span>Medium-screen density</span><select id="releaseMediumDensity"><option value="roomy"${p.mediumDesktopDensity==='roomy'?' selected':''}>Roomy</option><option value="balanced"${p.mediumDesktopDensity==='balanced'?' selected':''}>Balanced</option><option value="dense"${p.mediumDesktopDensity==='dense'?' selected':''}>Dense</option></select><small>Tunes spacing and Run of Show layout on laptop and windowed desktop sizes.</small></label>
        <label><span>Text size</span><select id="releaseTextScale"><option value="compact"${p.textScale==='compact'?' selected':''}>Compact</option><option value="normal"${p.textScale==='normal'?' selected':''}>Normal</option><option value="large"${p.textScale==='large'?' selected':''}>Large</option></select><small>Changes interface text without altering saved records.</small></label>
        <label class="release-toggle"><div><b>Reduce motion</b><small>Minimize transitions and smooth scrolling.</small></div><input type="checkbox" id="releaseReducedMotion"${p.reducedMotion?' checked':''}></label>
        <label class="release-toggle"><div><b>High contrast</b><small>Strengthen borders, text, and focus states.</small></div><input type="checkbox" id="releaseHighContrast"${p.highContrast?' checked':''}></label>
        <label class="release-toggle"><div><b>Visible focus outlines</b><small>Recommended for keyboard and switch navigation.</small></div><input type="checkbox" id="releaseFocusOutlines"${p.focusOutlines!==false?' checked':''}></label>
        <div class="release-shell-readout"><span>Current display fit</span><div id="shellDiagnostic"><strong>${window.innerWidth}×${window.innerHeight}</strong><span>${shellMode} shell</span></div><small>Hover the compact rail to temporarily reveal labels without moving the workspace.</small></div>
      </div>
    </article>`;
  }

  function boundaryPanel(){
    return `<article class="release-panel boundary-panel">
      <div class="release-panel-head"><div><span class="eyebrow">Permission architecture</span><h3>Portal Boundary</h3></div><span class="release-chip safe">Separated</span></div>
      <div class="boundary-grid">
        <article class="production-boundary"><span>P</span><div><b>Production</b><small>Shared fair operations workspace for William and Spencer.</small></div><em>Installed</em></article>
        <article class="admin-boundary"><span>A</span><div><b>OATF Admin</b><small>Private financial, agreement, negotiation, insurance, and executive layer.</small></div><em>Separate portal</em></article>
      </div>
      <p class="boundary-note"><strong>Important:</strong> This static Release Candidate does not provide real authentication. The future Admin password must be enforced by a backend or hosting authentication layer—not stored in this Production ZIP.</p>
    </article>`;
  }

  function diagnosticsPanel(){
    const state=Store.state;
    const exportSize=new Blob([Store.exportData()]).size;
    const counts=COLLECTIONS.reduce((sum,key)=>sum+(state[key]?.length||0),0);
    return `<article class="release-panel diagnostics-panel">
      <div class="release-panel-head"><div><span class="eyebrow">Local runtime health</span><h3>Diagnostics</h3></div><span class="release-chip ${runtimeErrors.length?'danger':'safe'}">${runtimeErrors.length?'Attention':'Healthy'}</span></div>
      <div class="diagnostic-stats">
        <div><strong>0.12</strong><span>Release Candidate</span></div>
        <div><strong>${counts}</strong><span>Local records</span></div>
        <div><strong>${Math.max(1,Math.round(exportSize/1024))} KB</strong><span>Workspace export</span></div>
        <div><strong>${runtimeErrors.length}</strong><span>Runtime errors</span></div><div><strong>${window.innerWidth}×${window.innerHeight}</strong><span>Viewport</span></div><div><strong id="connectionStatus">${navigator.onLine?'Online':'Offline'}</strong><span>Connection</span></div>
      </div>
      <div class="error-console">${runtimeErrors.length?runtimeErrors.map(error=>`<article><span>!</span><div><b>${esc(error.message)}</b><small>${esc(error.source||'Application')} ${error.line?`· line ${error.line}`:''} · ${esc(Intel.formatTimeAgo(error.time))}</small></div></article>`).join(''):`<div class="release-empty compact"><b>No runtime errors captured.</b><span>The monitor resets when this browser session closes.</span></div>`}</div>
    </article>`;
  }

  function helpPanel(){
    const shortcuts=[
      ['⌘ / Ctrl + K','Universal search'],
      ['N','New task'],
      ['T','Tasks'],
      ['F','Fairs'],
      ['P','Talent'],
      ['Esc','Close overlays'],
      ['?','Open shortcut help']
    ];
    return `<article class="release-panel help-panel">
      <div class="release-panel-head"><div><span class="eyebrow">Built-in support</span><h3>Operator Help</h3></div><button class="button ghost small-button" data-shortcut-help>Show Shortcuts</button></div>
      <div class="help-grid">
        <section><h4>Start every session</h4><p>Open Today, review critical work, confirm the active fair, then use Action Board for execution.</p></section>
        <section><h4>Before a major change</h4><p>Create a State Capture or checkpoint. Use Twin Lab when testing schedule or talent changes.</p></section>
        <section><h4>Before day-of</h4><p>Run the QA suite, export a backup, generate the call sheet, and confirm the Go / No-Go gate.</p></section>
        <section><h4>When moving devices</h4><p>Use a full backup for the whole workspace or Fair Package Exchange for one fair.</p></section>
      </div>
      <div class="shortcut-strip">${shortcuts.map(([key,label])=>`<span><kbd>${esc(key)}</kbd>${esc(label)}</span>`).join('')}</div>
    </article>`;
  }

  function renderHero(){
    const score=releaseScore();
    const decision=releaseDecision();
    return `<section class="release-hero">
      <div>
        <span class="eyebrow">V0.12 Release Candidate</span>
        <h1>Stop adding features. Prove the operating system.</h1>
        <p>This release focuses on clarity, setup, testing, accessibility, boundaries, migration safety, and deployment readiness.</p>
        <div class="release-actions"><button class="button primary" data-release-tests>Run Release Tests</button><button class="button ghost" data-release-backup>Export Backup</button><button class="button ghost" data-download-release-report>Download Report</button></div>
      </div>
      <div class="release-score"><span>Local readiness</span><strong>${score}%</strong><i><b style="width:${score}%"></b></i><small>${setupItems().filter(item=>item.done).length}/${setupItems().length} setup items complete</small></div>
      <div class="release-decision ${decision.tone}"><span>Launch gate</span><strong>${decision.status}</strong><small>${esc(decision.detail)}</small></div>
    </section>`;
  }

  function render(){
    const target=$('#releaseCenterContent');
    if(!target)return;
    applyAppearance();
    target.innerHTML=`
      ${renderHero()}
      <div class="release-grid">${onboardingCards()}${testPanel()}</div>
      <div class="release-grid">${appearancePanel()}${boundaryPanel()}</div>
      <div class="release-grid">${diagnosticsPanel()}${helpPanel()}</div>
      <article class="release-panel final-gate">
        <div><span class="eyebrow">Release handoff</span><h3>V0.10 Candidate Decision</h3><p>The app is still local-first. Marking it accepted records your internal test decision; it does not add authentication, cloud sync, or server security.</p></div>
        <label><input type="checkbox" id="releaseCandidateAccepted"${Store.state.preferences.releaseCandidateAccepted?' checked':''}><span>I accept this build as the Production Release Candidate for controlled testing.</span></label>
        <div><button class="button ghost" data-copy-release-report>Copy Report</button><button class="button primary" data-download-release-report>Download Report</button></div>
      </article>`;
    const badge=$('#releaseBadge');
    if(badge)badge.textContent=releaseDecision().status==='READY'?'GO':'RC';
  }

  function openReleaseCenter(){
    document.querySelector('[data-view="release"]')?.click();
    requestAnimationFrame(render);
  }

  function showShortcutHelp(){
    let overlay=$('#releaseShortcutOverlay');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='releaseShortcutOverlay';
      overlay.className='release-shortcut-overlay';
      overlay.innerHTML=`<section><button aria-label="Close shortcut help" data-close-shortcuts>×</button><span class="eyebrow">Keyboard shortcuts</span><h2>Move through Production faster.</h2><div>
        <p><kbd>⌘ / Ctrl + K</kbd><span>Search and commands</span></p>
        <p><kbd>N</kbd><span>New task</span></p>
        <p><kbd>T</kbd><span>Tasks</span></p>
        <p><kbd>F</kbd><span>Fairs</span></p>
        <p><kbd>P</kbd><span>Talent</span></p>
        <p><kbd>Esc</kbd><span>Close drawers and overlays</span></p>
        <p><kbd>?</kbd><span>Toggle this help</span></p>
      </div></section>`;
      document.body.appendChild(overlay);
    }
    overlay.classList.add('open');
  }

  function appendCommands(){
    const input=$('#globalSearch'),results=$('#searchResults');
    if(!input||!results)return;
    results.querySelector('.release-command-group')?.remove();
    const q=input.value.trim().toLowerCase();
    if(!q)return;
    const commands=[
      {test:/(release center|launch center|release candidate)/,label:'Open Release Center',detail:'Setup, QA, accessibility, diagnostics, and deployment readiness',action:'open'},
      {test:/(run release tests|qa suite|smoke tests)/,label:'Run Release Tests',detail:'Validate views, modules, storage, references, timing, and boundaries',action:'tests'},
      {test:/(simple navigation|simple mode)/,label:'Enable Simple Production Navigation',detail:'Hide advanced OS screens from the sidebar',action:'nav:simple'},
      {test:/(full navigation|full os)/,label:'Enable Full OS Navigation',detail:'Show operations and system screens',action:'nav:full'},
      {test:/(release report|launch report)/,label:'Download Release Report',detail:`Current local readiness: ${releaseScore()}%`,action:'report'},
      {test:/(accessibility|reduce motion|high contrast)/,label:'Open Experience Controls',detail:'Text, contrast, motion, navigation, and focus settings',action:'open'}
    ].filter(command=>command.test.test(q));
    if(!commands.length)return;
    const group=document.createElement('section');
    group.className='os-command-group release-command-group';
    group.innerHTML=`<span class="eyebrow">Release commands</span>${commands.map(command=>`<button data-release-command="${command.action}"><span>◆</span><span><b>${esc(command.label)}</b><small>${esc(command.detail)}</small></span><em>Run ↵</em></button>`).join('')}`;
    results.prepend(group);
  }

  document.addEventListener('input',event=>{
    if(event.target?.id==='globalSearch')queueMicrotask(appendCommands);
  });

  document.addEventListener('change',event=>{
    const p=Store.state.preferences;
    if(event.target?.id==='releaseNavigationMode'){p.navigationMode=event.target.value;Store.save();applyAppearance();render();return;}
    if(event.target?.id==='releaseSidebarBehavior'){p.sidebarBehavior=event.target.value;Store.save({immediate:true});window.OATFShell?.sync?.({announce:true});render();return;}
    if(event.target?.id==='releaseMediumDensity'){p.mediumDesktopDensity=event.target.value;Store.save({immediate:true});window.OATFShell?.sync?.();render();return;}
    if(event.target?.id==='releaseTextScale'){p.textScale=event.target.value;Store.save();applyAppearance();return;}
    if(event.target?.id==='releaseReducedMotion'){p.reducedMotion=event.target.checked;Store.save();applyAppearance();return;}
    if(event.target?.id==='releaseHighContrast'){p.highContrast=event.target.checked;Store.save();applyAppearance();return;}
    if(event.target?.id==='releaseFocusOutlines'){p.focusOutlines=event.target.checked;Store.save();applyAppearance();return;}
    if(event.target?.id==='releaseCandidateAccepted'){p.releaseCandidateAccepted=event.target.checked;Store.save({immediate:true});render();}
  });

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-release-center-open]')){openReleaseCenter();return;}
    if(event.target.closest('[data-release-tests]')){runTests();return;}
    if(event.target.closest('[data-release-backup]')){exportBackup();return;}
    if(event.target.closest('[data-copy-release-report]')){copyReport();return;}
    if(event.target.closest('[data-download-release-report]')){downloadReport();return;}
    if(event.target.closest('[data-shortcut-help]')){showShortcutHelp();return;}
    if(event.target.closest('[data-close-shortcuts]')){$('#releaseShortcutOverlay')?.classList.remove('open');return;}

    const view=event.target.closest('[data-release-view]')?.dataset.releaseView;
    if(view){document.querySelector(`[data-view="${view}"]`)?.click();return;}

    const command=event.target.closest('[data-release-command]')?.dataset.releaseCommand;
    if(command){
      $('#searchOverlay')?.classList.remove('open');
      if(command==='open')openReleaseCenter();
      else if(command==='tests'){openReleaseCenter();setTimeout(()=>runTests(),80);}
      else if(command==='report'){downloadReport();}
      else if(command.startsWith('nav:')){
        Store.state.preferences.navigationMode=command.split(':')[1];
        Store.save({immediate:true});applyAppearance();openReleaseCenter();
      }
    }
  });

  document.addEventListener('keydown',event=>{
    if(event.key==='?'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&event.target.tagName!=='INPUT'&&event.target.tagName!=='TEXTAREA'){
      event.preventDefault();
      const overlay=$('#releaseShortcutOverlay');
      if(overlay?.classList.contains('open'))overlay.classList.remove('open');
      else showShortcutHelp();
    }
  });

  window.addEventListener('oatf:saved',render);

  window.OATFRelease={
    render,openReleaseCenter,runTests,releaseScore,releaseDecision,releaseReport,runtimeErrors
  };

  ensurePreferences();
  render();
})();