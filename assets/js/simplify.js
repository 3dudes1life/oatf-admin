(() => {
  'use strict';

  const Store=window.OATFStore;
  const UI=window.OATFUI;
  if(!Store)return;

  const $=selector=>document.querySelector(selector);

  function applyFirstRun(){
    const p=Store.state.preferences;
    if(!p.v12SimplifiedApplied){
      p.navigationMode='simple';
      p.sidebarBehavior='auto';
      p.dashboardDensity='focused';
      p.actionBoardMode='guided';
      p.v12SimplifiedApplied=true;
      Store.save({immediate:true});
    }
    document.body.dataset.navMode=p.navigationMode||'simple';
    document.body.dataset.dashboardDensity=p.dashboardDensity||'focused';
  }

  function closeMore(){
    document.body.classList.remove('simple-more-open');
    $('#simpleMoreToggle')?.setAttribute('aria-expanded','false');
  }

  function toggleMore(){
    const open=document.body.classList.toggle('simple-more-open');
    $('#simpleMoreToggle')?.setAttribute('aria-expanded',String(open));
    if(open&&window.innerWidth<=960){
      $('#sidebar')?.classList.add('open');
      $('#scrim')?.classList.add('open');
    }
  }

  function syncMoreVisibility(){
    const simple=(Store.state.preferences.navigationMode||'simple')==='simple';
    document.body.classList.toggle('simplified-navigation',simple);
    if(!simple)closeMore();
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('#simpleMoreToggle')){
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleMore();
      return;
    }
    if(event.target.closest('[data-view]'))closeMore();
  },true);

  window.addEventListener('oatf:saved',()=>{
    applyFirstRun();
    syncMoreVisibility();
  });

  window.addEventListener('resize',()=>{
    if(window.innerWidth>960&&$('#sidebar')?.classList.contains('open')){
      $('#sidebar').classList.remove('open');
      $('#scrim')?.classList.remove('open');
    }
  },{passive:true});

  window.OATFSimplify={toggleMore,closeMore,syncMoreVisibility};
  applyFirstRun();
  syncMoreVisibility();
})();