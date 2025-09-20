// Main menu controller: populate teams, show logo previews, validate selection, persist to storage
(function(){
  const $ = (id)=>document.getElementById(id);
  // Preload teams/rosters from data/ if present, then proceed
  async function preloadData(){
    // Attempt to load even under file://; if blocked, silently fall back to localStorage
    async function tryJSON(url){ try{ const r=await fetch(url,{cache:'no-cache'}); if(!r.ok) return null; return r.json(); }catch{ return null; } }
    async function tryCSV(url){ try{ const r=await fetch(url,{cache:'no-cache'}); if(!r.ok) return null; return r.text(); }catch{ return null; } }
    function parseTeamsCSV(text){
      const lines = String(text).split(/\r?\n/).filter(Boolean); if(lines.length<2) return [];
      const headers = lines[0].split(',').map(s=>s.trim().toLowerCase());
      const hidx = (h)=> headers.indexOf(h);
      const AGG_HEADERS = ['base running aggresiveness','base running aggressiveness','baserunning aggressiveness','run aggressiveness','extra base %'];
      const aggIdx = AGG_HEADERS.map(h=> hidx(h)).find(i=> i>=0);
      const makeKey = (s)=> String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
      const makeInitials = (name)=>{
        const words = String(name||'').trim().split(/\s+/).filter(Boolean);
        if(words.length){ return words.map(w=>w[0]).join('').slice(0,3).toUpperCase(); }
        return String(name||'').replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3) || 'TMS';
      };
      const out=[];
      for(let i=1;i<lines.length;i++){
        const cols=lines[i].split(',').map(s=>s.trim());
        const name = hidx('name')>=0 ? cols[hidx('name')] : cols[0];
        if(!name) continue;
        const keyRaw = hidx('key')>=0 ? cols[hidx('key')] : '';
        const key = keyRaw || makeKey(name);
        const initials = (hidx('initials')>=0 && cols[hidx('initials')]) ? cols[hidx('initials')] : makeInitials(name);
        const logo = hidx('logo')>=0 ? (cols[hidx('logo')]||'') : '';
        const runAgg = (typeof aggIdx==='number' && aggIdx>=0) ? (parseFloat(cols[aggIdx]||'0')||0) : 0;
        out.push({ key, name, initials, logo, runAgg });
      }
      return out;
    }
    // Prefer CSV; fallback to JSON
    const tc = await tryCSV('data/teams.csv');
    if(tc){ const arr=parseTeamsCSV(tc); if(arr.length) localStorage.setItem('ibl.teams', JSON.stringify(arr)); }
    else { const tj = await tryJSON('data/teams.json'); if(Array.isArray(tj) && tj.length) localStorage.setItem('ibl.teams', JSON.stringify(tj)); }
  // Do not purge existing rosters; we will merge any successfully loaded per-team files
    // Attempt per-team preload for teams list (so lineup page has them immediately)
    try{
      let teamList = (()=>{ try { return JSON.parse(localStorage.getItem('ibl.teams')||'[]'); } catch { return []; } })();
      if(!Array.isArray(teamList) || teamList.length===0){
        // Fallback to default sample teams so per-team preload works without a teams file
        teamList = [
          { key:'Yankees', name:'New York Yankees' },
          { key:'Tigers', name:'Detroit Tigers' }
        ];
      }
  const existing = {}; // do not merge
      const FIELD_CODES = ['C','1B','2B','3B','SS','LF','CF','RF','P'];
      function simpleSlug(s){ return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
      function parsePosTokens(text){
        if(!text) return [];
        const raw = String(text).replace(/^[^\[]*\[/,'[').replace(/[\[\]]/g,'');
        const parts = raw.split(/[;|,\s]+/).map(t=>t.trim().toUpperCase()).filter(Boolean);
        return parts.filter(p=> FIELD_CODES.includes(p));
      }
      function parseRosterCSV(csv){
        try{
          const lines = String(csv).split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length);
          const out=[];
          if(!lines.length) return out;
          const first = lines[0].toLowerCase();
          const hasHeader = /name|player/.test(first);
          const rows = hasHeader ? lines.slice(1) : lines;
          for(const line of rows){
            const cols = line.split(',').map(x=>x.trim());
            const name = cols[0];
            if(!name || /^#|^;/.test(name)) continue;
            let pos = [];
            for(const c of cols.slice(1)){
              if(/\[.*\]|^(C|1B|2B|3B|SS|LF|CF|RF|P)(\b|\s|,|;)/i.test(c)){ pos = parsePosTokens(c); break; }
            }
            if(pos.length){ out.push({ name, pos }); }
            else { out.push(name); }
          }
          return out;
        }catch(_){ return []; }
      }
      function parseRosterTXT(text){
        try{
          const lines = String(text).split(/\r?\n/);
          const out=[];
          for(const raw of lines){
            const line = raw.trim();
            if(!line || line.startsWith('#') || line.startsWith(';')) continue;
            const m = line.match(/\[(.*?)\]/);
            if(m){
              const name = line.replace(m[0],'').trim();
              const pos = parsePosTokens(m[0]);
              if(name) out.push({ name, pos });
            } else {
              out.push(line);
            }
          }
          return out;
        }catch(_){ return []; }
      }
      function nameFor(key){ const t = Array.isArray(teamList) ? teamList.find(x=>x.key===key) : null; return t?.name || key; }
      async function tryLoadPerTeam(teamKey){
        const candidates = Array.from(new Set([
          String(teamKey), String(teamKey).toLowerCase(), simpleSlug(teamKey),
          String(nameFor(teamKey)), String(nameFor(teamKey)).toLowerCase(), simpleSlug(nameFor(teamKey))
        ].filter(Boolean)));
        for(const baseRaw of candidates){
          const base = `data/rosters/${encodeURIComponent(baseRaw)}`;
          try{ const rj = await fetch(`${base}.json`, { cache:'no-cache' }); if(rj.ok){ const arr = await rj.json(); if(Array.isArray(arr) && arr.length) return arr; } }catch(_){ }
          try{ const rc = await fetch(`${base}.csv`, { cache:'no-cache' }); if(rc.ok){ const txt = await rc.text(); const arr = parseRosterCSV(txt); if(arr.length) return arr; } }catch(_){ }
          try{ const rt = await fetch(`${base}.txt`, { cache:'no-cache' }); if(rt.ok){ const txt = await rt.text(); const arr = parseRosterTXT(txt); if(arr.length) return arr; } }catch(_){ }
        }
        return null;
      }
      const updates = {};
      for(const t of teamList){ const arr = await tryLoadPerTeam(t.key); if(arr) updates[t.key]=arr; }
      try{
        const prev = JSON.parse(localStorage.getItem('ibl.rosters')||'{}')||{};
        const merged = Object.assign({}, prev, updates);
        localStorage.setItem('ibl.rosters', JSON.stringify(merged));
      }catch(_){ localStorage.setItem('ibl.rosters', JSON.stringify(updates)); }
    }catch(_){ }
  }

  // Load teams from localStorage (ibl.teams) or fall back to defaults
  const DEFAULT_TEAMS = [
    { key:'Yankees', name:'New York Yankees', initials:'NYY', logo:'Logos/yankees.png' },
    { key:'Tigers',  name:'Detroit Tigers',    initials:'DET', logo:'Logos/tigers.png'  }
  ];
  function loadTeams(){
    try{ const raw = JSON.parse(localStorage.getItem('ibl.teams')||'null'); return Array.isArray(raw) && raw.length ? raw : DEFAULT_TEAMS; }catch{ return DEFAULT_TEAMS; }
  }
  const TEAM_REGISTRY = loadTeams();

  function populateSelect(selectEl){
    selectEl.innerHTML = TEAM_REGISTRY.map(t=>`<option value="${t.key}">${t.name}</option>`).join('');
  }

  function teamByKey(key){ return TEAM_REGISTRY.find(t=>t.key===key); }

  function updatePreview(which, teamKey){
    const info = teamByKey(teamKey);
    const preview = $(`${which}-preview`);
    const initialsEl = $(`${which}-initials`);
    if(!info || !preview || !initialsEl) return;
    // Try to set background image if logo exists; otherwise keep initials
    preview.style.background = info.logo ? `center/cover no-repeat url('${info.logo}'), radial-gradient(120px 120px at 30% 30%, #1e3c72 0%, #2a5298 60%, #184e77 100%)` : preview.style.background;
    initialsEl.textContent = info.initials;
    initialsEl.style.display = 'grid';
  }

  function validate(){
    const home = $('home-team').value;
    const away = $('away-team').value;
    const start = $('start-game-btn');
    const ok = home && away && home !== away;
    start.disabled = !ok;
    return ok;
  }

  function swap(){
    const hSel=$('home-team'), aSel=$('away-team');
    const h=hSel.value, a=aSel.value;
    hSel.value=a; aSel.value=h;
    updatePreview('home', aSel.value);
    updatePreview('away', hSel.value);
    validate();
  }

  function saveAndGo(){
    if(!validate()) return;
    const home = $('home-team').value;
    const away = $('away-team').value;
    localStorage.setItem('ibl.selection', JSON.stringify({ home, away }));
    window.location.href = 'lineup.html';
  }

  function restore(){
    try{
      const raw = localStorage.getItem('ibl.selection');
      if(!raw) return;
      const sel = JSON.parse(raw);
      if(sel.home) $('home-team').value = sel.home;
      if(sel.away) $('away-team').value = sel.away;
    }catch(_){/* ignore */}
  }

  async function init(){
    await preloadData();
    // re-evaluate team registry after preload
    const arr = loadTeams();
    // replace options if selects exist
    const hs=$('home-team'), as=$('away-team');
    if(hs && as){
      hs.innerHTML = arr.map(t=>`<option value="${t.key}">${t.name}</option>`).join('');
      as.innerHTML = arr.map(t=>`<option value="${t.key}">${t.name}</option>`).join('');
    }
    if(!$('main-menu')) return;
    populateSelect($('home-team'));
    populateSelect($('away-team'));
    restore();
    updatePreview('home', $('home-team').value);
    updatePreview('away', $('away-team').value);
    validate();

    $('home-team').addEventListener('change', (e)=>{ updatePreview('home', e.target.value); validate(); });
    $('away-team').addEventListener('change', (e)=>{ updatePreview('away', e.target.value); validate(); });
    $('swap-btn').addEventListener('click', swap);
    $('start-game-btn').addEventListener('click', saveAndGo);
    // Randomize matchup
    const rand = document.getElementById('random-btn');
    if(rand){
      rand.addEventListener('click', ()=>{
        if(!Array.isArray(TEAM_REGISTRY) || TEAM_REGISTRY.length<2) return;
        const idx1 = Math.floor(Math.random()*TEAM_REGISTRY.length);
        let idx2 = Math.floor(Math.random()*TEAM_REGISTRY.length);
        if(idx2===idx1) idx2 = (idx1+1)%TEAM_REGISTRY.length;
        $('home-team').value = TEAM_REGISTRY[idx1].key;
        $('away-team').value = TEAM_REGISTRY[idx2].key;
        updatePreview('home', $('home-team').value);
        updatePreview('away', $('away-team').value);
        validate();
      });
    }
    // Resume last game if exists
    try{
      const rb = document.getElementById('resume-btn');
      if(rb && localStorage.getItem('ibl.gameState')){
        rb.style.display = 'inline-block';
        rb.addEventListener('click', ()=> window.location.href='game.html');
      }
    }catch(_){ }

    // If running off file://, inform user that auto-scan is disabled
    try{
      if(typeof location!=='undefined' && location.protocol==='file:'){
        const tip = document.querySelector('#main-menu .tip');
        if(tip){ tip.textContent = 'Tip: You are opening this file locally. Use Manage Teams and Import Players to load data (auto-scan of data/ is disabled).'; }
      }
    }catch(_){ }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
