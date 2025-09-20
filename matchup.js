(function(){
  const $ = (id)=>document.getElementById(id);
  async function tryText(url){ try{ const res = await fetch(url, { cache:'no-cache' }); if(!res.ok) return null; return await res.text(); }catch{ return null; } }
  async function tryJSON(url){ try{ const res = await fetch(url, { cache:'no-cache' }); if(!res.ok) return null; return await res.json(); }catch{ return null; } }
  function parseTeamsCSV(text){
    const lines = String(text||'').split(/\r?\n/).filter(l=> l.trim()); if(lines.length < 2) return [];
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const idx = (h)=> headers.indexOf(h);
    const makeKey = (s)=> String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    const out=[];
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(',').map(c=>c.trim());
      const name = idx('name')>=0 ? cols[idx('name')] : cols[0]; if(!name) continue;
      const key = (idx('key')>=0 && cols[idx('key')]) ? cols[idx('key')] : makeKey(name);
      const initials = (idx('initials')>=0 && cols[idx('initials')]) ? cols[idx('initials')] : null;
      const logo = (idx('logo')>=0 && cols[idx('logo')]) ? cols[idx('logo')] : '';
      const AGG_HEADERS = ['base running aggresiveness','base running aggressiveness','baserunning aggressiveness','run aggressiveness','extra base %'];
      const aggIdx = AGG_HEADERS.map(h=> idx(h)).find(i=> i>=0);
      const runAgg = (typeof aggIdx==='number' && aggIdx>=0) ? (parseFloat(cols[aggIdx]||'0')||0) : 0;
      out.push({ key, name, initials, logo, runAgg });
    }
    return out;
  }
  async function loadTeams(){
    // Prefer CSV from data/teams.csv, fallback to data/teams.json, then localStorage, then minimal built-ins
    // Note: fetch to local files may fail under file://; that's okay—we'll fallback gracefully.
    const csv = await tryText('data/teams.csv');
    if(csv){ const arr = parseTeamsCSV(csv); if(arr.length){ try{ localStorage.setItem('ibl.teams', JSON.stringify(arr)); }catch(_){} return arr; } }
    const json = await tryJSON('data/teams.json');
    if(Array.isArray(json) && json.length){ try{ localStorage.setItem('ibl.teams', JSON.stringify(json)); }catch(_){} return json; }
    try{ const raw = JSON.parse(localStorage.getItem('ibl.teams')||'null'); if(Array.isArray(raw)&&raw.length) return raw; }catch{}
    return [
      { key:'Yankees', name:'New York Yankees', initials:'NYY', logo:'Logos/yankees.png' },
      { key:'Tigers', name:'Detroit Tigers', initials:'DET', logo:'Logos/tigers.png' }
    ];
  }

  function computeInitials(t){
    if(!t) return '—';
    if(t.initials && typeof t.initials==='string') return t.initials.toUpperCase();
    const src = t.name || t.key || '';
    const parts = String(src).trim().split(/\s+/);
    if(parts.length===1) return parts[0].slice(0,3).toUpperCase();
    return parts.slice(0,3).map(w=>w[0]).join('').toUpperCase();
  }

  function setLogo(prefix, team){
    const img = $(`${prefix}-logo-img`);
    const txt = $(`${prefix}-logo-txt`);
    const initials = (team && (team.initials || computeInitials(team))) || prefix.toUpperCase();
    if(txt){ txt.textContent = initials; txt.style.display='grid'; }
    if(!img) return;
    // Generate candidate logo paths:
    const candidates = [];
    if(team){
      if(team.logo) candidates.push(team.logo);
      const baseNames = Array.from(new Set([
        team.key,
        team.name,
        (team.name||'').replace(/^City\s+/i,''),
        (team.name||'').replace(/^New\s+York\s+/i,'NY ')
      ].filter(Boolean)));
      baseNames.forEach(n=>{
        const slug = String(n).trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g,'')
          .replace(/[^A-Za-z0-9]+/g,'-')
          .replace(/^-+|-+$/g,'')
          .toLowerCase();
        if(slug) candidates.push(`Logos/${slug}.png`);
        if(slug) candidates.push(`Logos/${slug}.jpg`);
      });
    }
    // Deduplicate while preserving order
    const tried = new Set();
    const queue = candidates.filter(c=>{ if(tried.has(c)) return false; tried.add(c); return true; });
    if(!queue.length){
      img.removeAttribute('src');
      img.style.display='none';
      if(txt) txt.style.display='grid';
      return;
    }
    img.style.display='none';
    if(txt) txt.style.display='grid';
    img.alt = team && team.name ? `${team.name} logo` : 'Team logo';
    function loadNext(){
      if(!queue.length){
        img.removeAttribute('src');
        img.style.display='none';
        if(txt) txt.style.display='grid';
        return;
      }
      const src = queue.shift();
      img.onerror = loadNext;
      img.onload = ()=>{ img.style.display='block'; if(txt) txt.style.display='none'; };
      // Force reload if same src
      if(img.src && img.src.endsWith(src)){
        img.src='';
        setTimeout(()=>{ img.src=src; },0);
      } else {
        img.src = src;
      }
    }
    loadNext();
  }

  function computeInitialsFromName(name){
    const parts = String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return '';
    if(parts.length===1) return parts[0].slice(0,3).toUpperCase();
    return parts.map(w=>w[0]).join('').slice(0,3).toUpperCase();
  }

  function refreshPickerDisplay(side, arr){
    const sel = document.getElementById(`${side}-team`);
    const nameEl = document.getElementById(`${side}-pick-name`);
    const subEl = document.getElementById(`${side}-pick-sub`);
    const key = sel?.value;
    const t = arr.find(x=> x.key===key) || null;
    if(nameEl) nameEl.textContent = t ? (t.name || t.key) : 'Team';
    if(subEl) subEl.textContent = t ? ((t.initials && String(t.initials)) || computeInitialsFromName(t.name||t.key)) : '';
    try{ updateLogos(); }catch(_){ }
  }

  function populate(arr){
    const options = arr.map(t=>`<option value="${t.key}">${t.name}</option>`).join('');
    $('home-team').innerHTML = options;
    $('away-team').innerHTML = options;
    // Default different teams if no prior selection
    try{
      const sel=JSON.parse(localStorage.getItem('ibl.selection')||'null');
      if(!sel){
        if(arr.length>0) $('home-team').value = arr[0].key;
        if(arr.length>1) $('away-team').value = arr[1].key;
      } else {
        if(sel.home) $('home-team').value = sel.home;
        if(sel.away) $('away-team').value = sel.away;
      }
    }catch{}
    refreshPickerDisplay('home', arr);
    refreshPickerDisplay('away', arr);
  }

  function save(){
    const home=$('home-team').value, away=$('away-team').value;
    if(!home||!away||home===away){ alert('Choose two different teams.'); return; }
    localStorage.setItem('ibl.selection', JSON.stringify({ home, away }));
    try{
      const hc = { home: document.getElementById('home-controller')?.value || 'User', away: document.getElementById('away-controller')?.value || 'User' };
      localStorage.setItem('ibl.controllers', JSON.stringify(hc));
    }catch(_){ }
    window.location.href = 'lineup.html';
  }
  function back(){ history.back(); }
  async function updateLogos(){
    const arr = await loadTeams();
    const tk=(k)=>arr.find(t=>t.key===k)||null;
    const h=tk($('home-team').value), a=tk($('away-team').value);
    setLogo('home', h||{ name:'Home'});
    setLogo('away', a||{ name:'Away'});
    try{ if(h) $('home-name').textContent = h.name; if(a) $('away-name').textContent = a.name; }catch(_){ }
  }
  async function init(){
    const arr = await loadTeams();
    populate(arr);
    try{ const sel=JSON.parse(localStorage.getItem('ibl.selection')||'null'); if(sel){ if(sel.home) $('home-team').value=sel.home; if(sel.away) $('away-team').value=sel.away; } }catch{}
    await updateLogos();
  $('home-team').addEventListener('change', ()=> refreshPickerDisplay('home', arr));
  $('away-team').addEventListener('change', ()=> refreshPickerDisplay('away', arr));
    // Wire picker arrow buttons
    function step(side, dir){
      const sel = document.getElementById(`${side}-team`); if(!sel) return;
      const keys = arr.map(t=>t.key);
      const idx = Math.max(0, keys.indexOf(sel.value));
      let next = idx + dir; if(next < 0) next = keys.length - 1; if(next >= keys.length) next = 0;
      sel.value = keys[next];
      refreshPickerDisplay(side, arr);
      try{ const cur = JSON.parse(localStorage.getItem('ibl.selection')||'{}')||{}; cur[side] = sel.value; localStorage.setItem('ibl.selection', JSON.stringify(cur)); }catch(_){ }
    }
    const hp=document.getElementById('home-prev'), hn=document.getElementById('home-next');
    const ap=document.getElementById('away-prev'), an=document.getElementById('away-next');
    if(hp) hp.addEventListener('click', ()=> step('home', -1));
    if(hn) hn.addEventListener('click', ()=> step('home', +1));
    if(ap) ap.addEventListener('click', ()=> step('away', -1));
    if(an) an.addEventListener('click', ()=> step('away', +1));

    // Team selection modal (logo grid)
    function buildTeamSelectModal(side){
      const wrap = document.createElement('div');
      wrap.className = 'ts-backdrop';
      wrap.innerHTML = `
        <div class="ts-panel" role="dialog" aria-modal="true">
          <div class="ts-header">
            <h3 class="ts-title">Select ${side==='home'?'Home':'Away'} Team</h3>
            <button class="ts-close" aria-label="Close">×</button>
          </div>
          <div class="ts-grid"></div>
        </div>`;
      return wrap;
    }
    function openTeamSelect(side){
      if(document.querySelector('.ts-backdrop')) return;
      const modal = buildTeamSelectModal(side);
      document.body.appendChild(modal);
      const grid = modal.querySelector('.ts-grid');
      const closeBtn = modal.querySelector('.ts-close');
      const backdrop = modal;
      const panel = modal.querySelector('.ts-panel');
      const header = modal.querySelector('.ts-header');
      function scaleGridToFit(){
        try{
          if(!panel || !grid || !header) return;
          // reset any previous scale to measure natural size
          grid.style.transform = 'scale(1)';
          const panelRect = panel.getBoundingClientRect();
          const gridRect = grid.getBoundingClientRect();
          const headerRect = header.getBoundingClientRect();
          const spaceAboveGrid = gridRect.top - panelRect.top; // includes header + padding
          const available = panel.clientHeight - spaceAboveGrid - 8; // small bottom padding
          const needed = grid.scrollHeight; // natural height needed
          const scale = Math.max(0.5, Math.min(1, available / Math.max(1, needed)));
          grid.style.transform = `scale(${scale})`;
        }catch(_){ }
      }
      // build sorted teams A-Z by name
      const sorted = [...arr].sort((a,b)=> String(a.name||a.key).localeCompare(String(b.name||b.key)));
      // create tiles
      sorted.forEach((t, i)=>{
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'ts-tile';
        tile.style.animationDelay = `${Math.min(i*0.02, 0.4)}s`;
        tile.innerHTML = `
          <div class="ts-logo"><img alt="${(t.name||t.key)} logo" /><span>${(t.initials||computeInitials(t))}</span></div>
          <div class="ts-name">${t.name||t.key}</div>`;
        // load logo fallbacks similar to setLogo
        const img = tile.querySelector('img');
        const txt = tile.querySelector('.ts-logo span');
        const candidates = [];
        if(t.logo) candidates.push(t.logo);
        const baseNames = Array.from(new Set([
          t.key,
          t.name,
          (t.name||'').replace(/^City\s+/i,''),
          (t.name||'').replace(/^New\s+York\s+/i,'NY ')
        ].filter(Boolean)));
        baseNames.forEach(n=>{
          const slug = String(n).trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g,'')
            .replace(/[^A-Za-z0-9]+/g,'-')
            .replace(/^-+|-+$/g,'')
            .toLowerCase();
          if(slug){ candidates.push(`Logos/${slug}.png`); candidates.push(`Logos/${slug}.jpg`); }
        });
        const tried = new Set();
        const queue = candidates.filter(c=>{ if(tried.has(c)) return false; tried.add(c); return true; });
        img.style.display='none'; txt.style.display='grid';
        function loadNext(){
          if(!queue.length){ img.removeAttribute('src'); img.style.display='none'; txt.style.display='grid'; return; }
          const src = queue.shift();
          img.onerror = loadNext;
          img.onload = ()=>{ img.style.display='block'; txt.style.display='none'; };
          img.src = src;
        }
        if(queue.length) loadNext();
        tile.addEventListener('click', ()=>{
          const sel = document.getElementById(`${side}-team`);
          if(sel){ sel.value = t.key; refreshPickerDisplay(side, arr); try{ const cur=JSON.parse(localStorage.getItem('ibl.selection')||'{}')||{}; cur[side]=t.key; localStorage.setItem('ibl.selection', JSON.stringify(cur)); }catch(_){ } }
          backdrop.remove();
        });
        grid.appendChild(tile);
      });
      // After tiles are in, scale to fit
      requestAnimationFrame(scaleGridToFit);
      setTimeout(scaleGridToFit, 60);
      setTimeout(scaleGridToFit, 180);
      const onResize = ()=> scaleGridToFit();
      window.addEventListener('resize', onResize);
      function close(){ backdrop.remove(); }
      closeBtn?.addEventListener('click', close);
      backdrop.addEventListener('click', (e)=>{ if(e.target===backdrop) close(); });
      document.addEventListener('keydown', function onEsc(ev){ if(ev.key==='Escape'){ close(); document.removeEventListener('keydown', onEsc); window.removeEventListener('resize', onResize); } });
    }
    // click targets on pick displays
    document.getElementById('home-pick')?.addEventListener('click', ()=> openTeamSelect('home'));
    document.getElementById('away-pick')?.addEventListener('click', ()=> openTeamSelect('away'));
    // Controller dropdowns
    const HC_KEY = 'ibl.controllers';
    function loadControllers(){ try{ const v = JSON.parse(localStorage.getItem(HC_KEY)||'null'); return v&&typeof v==='object'?v:{ home:'User', away:'User' }; }catch(_){ return { home:'User', away:'User' }; } }
    function saveControllers(v){ try{ localStorage.setItem(HC_KEY, JSON.stringify(v)); }catch(_){ } }
    const ctrl = loadControllers();
    const homeCtrl = document.getElementById('home-controller'); if(homeCtrl) homeCtrl.value = ctrl.home||'User';
    const awayCtrl = document.getElementById('away-controller'); if(awayCtrl) awayCtrl.value = ctrl.away||'User';
    homeCtrl?.addEventListener('change', ()=>{ const v=loadControllers(); v.home=homeCtrl.value; saveControllers(v); });
    awayCtrl?.addEventListener('change', ()=>{ const v=loadControllers(); v.away=awayCtrl.value; saveControllers(v); });
    $('start').addEventListener('click', save);
    $('back').addEventListener('click', back);
    // Simple venue/weather placeholder (could be enhanced with real data later)
    try{
      const venueEl = document.getElementById('venue');
      const weatherEl = document.getElementById('weather');
      if(venueEl){ venueEl.textContent = 'Venue: Classic Park'; }
      if(weatherEl){ weatherEl.textContent = 'Weather: Clear 72°F'; }
    }catch(_){ }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
