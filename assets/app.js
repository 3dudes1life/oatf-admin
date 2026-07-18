
function enterPortal(){
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}
const titles={overview:'Command Center',fairs:'Fair Workspaces',fairdetail:'Fair Workspace',tasks:'Task Board',talent:'Talent Pipeline',calendar:'Production Calendar',files:'Files & Assets',activity:'Activity Log',dayof:'Day-of Command'};
document.querySelectorAll('[data-view]').forEach(el=>{
  el.addEventListener('click',()=>showView(el.dataset.view));
});
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
  const target=document.getElementById(id); if(target) target.classList.add('active-view');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id));
  document.getElementById('pageTitle').textContent=titles[id]||'OATF Admin';
  document.querySelector('.sidebar')?.classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}
function openFair(name){
  document.getElementById('fairTitle').textContent=name;
  showView('fairdetail');
}
const days=document.getElementById('days');
if(days){
  const cells=[];
  for(let i=28;i<=30;i++) cells.push({n:i,m:true});
  for(let i=1;i<=31;i++) cells.push({n:i});
  while(cells.length%7) cells.push({n:cells.length-30,m:true});
  cells.forEach(d=>{
    const div=document.createElement('div');
    if(d.m) div.className='muted-day';
    div.innerHTML=`<b>${d.n}</b>`;
    if(!d.m && d.n===18) div.innerHTML+=`<span class="event-chip">OC schedule review</span>`;
    if(!d.m && d.n===22) div.innerHTML+=`<span class="event-chip">SD offers due</span>`;
    if(!d.m && d.n===25) div.innerHTML+=`<span class="event-chip">Glam Show lineup</span>`;
    days.appendChild(div);
  });
}
