(() => {
  'use strict';

  const Store = window.OATFStore;
  const UI = window.OATFUI;
  if (!Store) return;

  const $ = selector => document.querySelector(selector);
  let resizeTimer = null;
  let lastMode = '';

  function ensurePreferences(){
    const p=Store.state.preferences;
    let changed=false;
    if(!['auto','full','compact'].includes(p.sidebarBehavior)){p.sidebarBehavior='auto';changed=true;}
    if(!['balanced','roomy','dense'].includes(p.mediumDesktopDensity)){p.mediumDesktopDensity='balanced';changed=true;}
    if(p.shellTourDismissed===undefined){p.shellTourDismissed=false;changed=true;}
    if(changed)Store.save({immediate:true});
  }

  function viewportClass(){
    const width=window.innerWidth;
    if(width<=960)return 'mobile';
    if(width<=1320)return 'medium';
    return 'wide';
  }

  function effectiveMode(){
    const viewport=viewportClass();
    if(viewport==='mobile')return 'mobile';
    const behavior=Store.state.preferences.sidebarBehavior||'auto';
    if(behavior==='full')return 'full';
    if(behavior==='compact')return 'compact';
    return viewport==='medium'?'compact':'full';
  }

  function labelNavigation(){
    document.querySelectorAll('.nav-link').forEach(button=>{
      const label=button.querySelector('b')?.textContent?.trim()||'Navigation';
      button.dataset.navLabel=label;
      button.setAttribute('aria-label',label);
      button.setAttribute('title',label);
    });
    document.querySelectorAll('.side-record').forEach(button=>{
      const label=button.querySelector('b')?.textContent?.trim();
      if(label)button.setAttribute('title',label);
    });
  }

  function sync({announce=false}={}){
    const sidebar=$('#sidebar');
    if(!sidebar)return;
    const mode=effectiveMode();
    const viewport=viewportClass();

    document.body.dataset.shellMode=mode;
    document.body.dataset.viewportClass=viewport;
    document.body.dataset.mediumDensity=Store.state.preferences.mediumDesktopDensity||'balanced';

    if(mode==='mobile'){
      sidebar.classList.remove('collapsed');
    }else{
      sidebar.classList.toggle('collapsed',mode==='compact');
      Store.state.preferences.sidebarCollapsed=mode==='compact';
    }

    const toggle=$('#collapseSidebar');
    if(toggle){
      toggle.textContent=mode==='compact'?'›':'‹';
      toggle.setAttribute('aria-label',mode==='compact'?'Expand sidebar':'Collapse sidebar');
      toggle.setAttribute('title',mode==='compact'?'Expand sidebar':'Collapse sidebar');
    }

    labelNavigation();

    const diagnostic=$('#shellDiagnostic');
    if(diagnostic){
      diagnostic.innerHTML=`<strong>${window.innerWidth}×${window.innerHeight}</strong><span>${mode} shell</span>`;
    }

    if(announce&&lastMode&&lastMode!==mode){
      UI?.toast?.('Layout updated',`${mode[0].toUpperCase()+mode.slice(1)} shell is active.`);
    }
    lastMode=mode;
  }

  function setBehavior(value,{announce=true}={}){
    if(!['auto','full','compact'].includes(value))return;
    Store.state.preferences.sidebarBehavior=value;
    Store.save({immediate:true});
    sync({announce});
    window.dispatchEvent(new CustomEvent('oatf:shellchange',{detail:{behavior:value,mode:effectiveMode()}}));
  }

  function cycleSidebar(){
    if(viewportClass()==='mobile')return;
    const mode=effectiveMode();
    setBehavior(mode==='compact'?'full':'compact');
  }

  function showFirstFitNotice(){
    if(Store.state.preferences.shellTourDismissed||viewportClass()!=='medium')return;
    const notice=document.createElement('div');
    notice.className='shell-fit-notice';
    notice.innerHTML=`<span>◫</span><div><b>Compact navigation is active.</b><small>Hover the icon rail to temporarily expand it, or choose a permanent sidebar style in Release Center.</small></div><button aria-label="Dismiss layout notice">×</button>`;
    document.body.appendChild(notice);
    requestAnimationFrame(()=>notice.classList.add('open'));
    notice.querySelector('button').addEventListener('click',()=>{
      Store.state.preferences.shellTourDismissed=true;
      Store.save({immediate:true});
      notice.classList.remove('open');
      setTimeout(()=>notice.remove(),220);
    });
  }

  function installToggleOverride(){
    const toggle=$('#collapseSidebar');
    if(!toggle||toggle.dataset.shellBound)return;
    toggle.dataset.shellBound='true';
    toggle.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      cycleSidebar();
    },true);
  }

  function installResize(){
    window.addEventListener('resize',()=>{
      clearTimeout(resizeTimer);
      resizeTimer=setTimeout(()=>sync(),90);
    },{passive:true});
  }

  function installOnlineStatus(){
    const update=()=>{
      document.body.dataset.connection=navigator.onLine?'online':'offline';
      const status=$('#connectionStatus');
      if(status)status.textContent=navigator.onLine?'Online':'Offline';
    };
    window.addEventListener('online',update);
    window.addEventListener('offline',update);
    update();
  }

  function init(){
    ensurePreferences();
    installToggleOverride();
    installResize();
    installOnlineStatus();
    sync();
    setTimeout(showFirstFitNotice,650);
  }

  document.addEventListener('click',event=>{
    const command=event.target.closest('[data-shell-behavior]')?.dataset.shellBehavior;
    if(command)setBehavior(command);
  });

  window.addEventListener('oatf:saved',()=>sync());
  window.addEventListener('oatf:viewchange',()=>labelNavigation());

  window.OATFShell={
    sync,setBehavior,effectiveMode,viewportClass,labelNavigation
  };

  init();
})();