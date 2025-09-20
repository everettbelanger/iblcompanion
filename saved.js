(function(){
  'use strict';
  function byId(id){ return document.getElementById(id); }
  function fmtDate(ts){ try{ const d = new Date(ts); return d.toLocaleString(); }catch{ return String(ts); } }
  function fmtScore(g){ try{ return `${g.away} ${g.score[g.away]||0} - ${g.score[g.home]||0} ${g.home}`; }catch{ return ''; } }
  function render(){
    const key = 'ibl.savedGames';
    let list=[]; try{ const raw = localStorage.getItem(key); list = raw ? JSON.parse(raw) : []; }catch(_){ list=[]; }
    const el = byId('list');
    if(!list.length){ el.innerHTML = '<div class="sub">No saved games yet.</div>'; return; }
    // Most recent first
    list = list.slice().reverse();
    el.innerHTML = list.map((g, idx)=>{
      const i = list.length - 1 - idx; // original index in storage order
      return `<div class="row">
        <div>
          <div><strong>${g.title||fmtScore(g)}</strong></div>
          <div class="sub">${fmtScore(g)} • ${fmtDate(g.savedAt||g.finalizedAt||Date.now())}</div>
          ${g.notes? `<div class="sub" style="margin-top:4px;">${g.notes}</div>`:''}
        </div>
        <div style="display:flex;gap:8px;">
          <button data-view="${i}" class="btn">View</button>
          <button data-del="${i}" class="btn secondary">Delete</button>
        </div>
      </div>`;
    }).join('');
    el.querySelectorAll('button[data-view]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const i = parseInt(btn.getAttribute('data-view'),10);
        try{
          const raw = localStorage.getItem(key); const arr = raw ? JSON.parse(raw) : [];
          const g = arr[i]; if(!g) return;
          localStorage.setItem('ibl.postgame', JSON.stringify(g));
          window.location.href = 'postgame.html';
        }catch(_){ }
      });
    });
    el.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const i = parseInt(btn.getAttribute('data-del'),10);
        try{
          const raw = localStorage.getItem(key); const arr = raw ? JSON.parse(raw) : [];
          arr.splice(i,1); localStorage.setItem(key, JSON.stringify(arr));
          render();
        }catch(_){ }
      });
    });
  }
  render();
})();
