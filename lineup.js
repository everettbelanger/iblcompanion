(function(){
  const $ = (id)=>document.getElementById(id);
  const selection = (()=>{ try { return JSON.parse(localStorage.getItem('ibl.selection')||'null'); } catch(_) { return null; } })();
  if(!selection){ window.location.href = 'index.html'; return; }

  // Team data (match main.js)
  const teams = {
    Yankees:{ name:'New York Yankees', logo:'Logos/yankees.png', roster:{}},
    Tigers:{ name:'Detroit Tigers', logo:'Logos/tigers.png', roster:{} }
  };
  // Load imported rosters with positions
  let imported = (()=>{ try { return JSON.parse(localStorage.getItem('ibl.rosters')||'{}'); } catch { return {}; } })();
  // Defensive positions (excluding DH); DH is lineup-only
  const POS = ['catcher','first','second','third','short','left','center','right','pitcher'];
  const POS_LABEL = { catcher:'Catcher', first:'First Base', second:'Second Base', third:'Third Base', short:'Shortstop', left:'Left Field', center:'Center Field', right:'Right Field', pitcher:'Pitcher', DH:'Designated Hitter' };
  const FIELD_CODES = ['C','1B','2B','3B','SS','LF','CF','RF','P','SP','RP'];
  const CODE_TO_KEY = { C:'catcher', '1B':'first', '2B':'second', '3B':'third', SS:'short', LF:'left', CF:'center', RF:'right', P:'pitcher', SP:'pitcher', RP:'pitcher' };
  const POS_ABBR = { catcher:'C', first:'1B', second:'2B', third:'3B', short:'SS', left:'LF', center:'CF', right:'RF', pitcher:'P', DH:'DH' };

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
        // naive split (assumes no commas in names)
        const cols = line.split(',').map(x=>x.trim());
        const name = cols[0];
        if(!name || /^#|^;/.test(name)) continue;
        // try to find pos column, else look for bracket in any col
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

  function rosterList(teamKey){
    const arr = imported[teamKey] || [];
    const FIELD = ['C','1B','2B','3B','SS','LF','CF','RF'];
    if(!Array.isArray(arr)) return [];
    return arr.map(p=>{
      if(typeof p === 'string') return { name:p, pos: FIELD.slice() };
      const pos = Array.isArray(p.pos) ? p.pos : (typeof p.pos==='string' ? p.pos.replace(/[\[\]]/g,'').split(/[;|,\s]+/).filter(Boolean) : FIELD.slice());
      return { name: p.name, pos };
    }).filter(x=> x.name);
  }
  function hitters(teamKey){
    const isPitcher = (p)=> Array.isArray(p.pos) && (p.pos.includes('P') || p.pos.includes('SP') || p.pos.includes('RP'));
    return rosterList(teamKey).filter(p=> !isPitcher(p)).map(p=>p.name);
  }
  function pitchers(teamKey){
    // Prefer SP, then dual SP/RP and legacy P, then RP
    const list = rosterList(teamKey);
    const isSP = (p)=> Array.isArray(p.pos) && p.pos.includes('SP');
    const isLegacyP = (p)=> Array.isArray(p.pos) && p.pos.includes('P');
    const isRP = (p)=> Array.isArray(p.pos) && p.pos.includes('RP');
    const rankType = (p)=> (isSP(p)&&isRP(p))?0 : (isSP(p)?1 : (isLegacyP(p)?2 : (isRP(p)?3 : 4)));
    // Sort by type rank, then name
    const ordered = list.slice().filter(p=> isSP(p) || isLegacyP(p) || isRP(p)).sort((a,b)=> rankType(a)-rankType(b) || a.name.localeCompare(b.name));
    const seen = new Set();
    return ordered.filter(p=>{ if(seen.has(p.name)) return false; seen.add(p.name); return true; }).map(p=>p.name);
  }
  function eligibleFor(teamKey, pos){
    const map = { catcher:'C', first:'1B', second:'2B', third:'3B', short:'SS', left:'LF', center:'CF', right:'RF', pitcher:'P' };
    const code = map[pos];
    return rosterList(teamKey).filter(p=>p.pos.includes(code)).map(p=>p.name);
  }

  function eligibleKeysForPlayer(teamKey, player){
    if(!player) return [];
    const rec = rosterList(teamKey).find(p=> p.name===player);
    if(!rec) return [];
    const keys = new Set();
    (rec.pos||[]).forEach(code=>{ const k = CODE_TO_KEY[code]; if(k && k!=='pitcher') keys.add(k); });
    return Array.from(keys);
  }

  function buildOrder(containerId, teamKey){
    const cont = $(containerId); cont.innerHTML='';
    for(let i=1;i<=9;i++){
      const row = document.createElement('div'); row.className='order';
      const label = document.createElement('div'); label.textContent = i+':';
      const playerSel = document.createElement('select'); playerSel.id = `${containerId}-${i}`;
      playerSel.innerHTML = `<option value="">— select —</option>` + hitters(teamKey).map(n=>`<option value="${n}">${n}</option>`).join('');
      const posSel = document.createElement('select'); posSel.id = `${containerId}-pos-${i}`; posSel.dataset.side = containerId.startsWith('away')?'away':'home';
      posSel.innerHTML = `<option value="">— pos —</option><option value="DH">DH</option>`; posSel.disabled = true;
      // Hook: when player selection changes, refresh pos options and re-check duplicates
      playerSel.addEventListener('change', ()=> { refreshRowPosOptions(teamKey, playerSel, posSel); updateTakenPositions(containerId); });
      // Hook: when position changes, allow taking an already-picked spot by replacing the previous holder
      posSel.addEventListener('change', ()=> handlePosChange(containerId, posSel));
      row.appendChild(label); row.appendChild(playerSel); row.appendChild(posSel); cont.appendChild(row);
    }
  }

  function refreshRowPosOptions(teamKey, playerSel, posSel){
    const name = playerSel.value;
    if(!name){ posSel.innerHTML = `<option value="">— pos —</option><option value="DH">DH</option>`; posSel.disabled = true; return; }
    const keys = eligibleKeysForPlayer(teamKey, name);
    const options = [ '<option value="">— pos —</option>', ...keys.map(k=>`<option value="${k}">${POS_ABBR[k]||k.toUpperCase()}</option>`), '<option value="DH">DH</option>' ];
    posSel.innerHTML = options.join('');
    posSel.disabled = false;
    try{ const orderPrefix = posSel.id.split('-pos-')[0]; updateTakenPositions(orderPrefix); }catch(_){ }
  }

  function autofillOrder(prefix, teamKey){
    const list = hitters(teamKey).slice(0,9);
    for(let i=1;i<=9;i++){
      const pEl = $(`${prefix}-${i}`);
      const posEl = $(`${prefix}-pos-${i}`);
      if(pEl){
        pEl.value = list[i-1]||'';
        if(pEl.value && posEl){
          // Build pos options for this player since programmatic set doesn't fire 'change'
          refreshRowPosOptions(teamKey, pEl, posEl);
        } else if(posEl){
          posEl.value=''; posEl.disabled=true;
        }
      }
    }
    // Re-evaluate duplicates after autofill
    updateTakenPositions(prefix);
  }
  function refreshAllRowPosOptions(orderPrefix, teamKey){
    for(let i=1;i<=9;i++){
      const pEl = $(`${orderPrefix}-${i}`);
      const posEl = $(`${orderPrefix}-pos-${i}`);
      if(pEl && pEl.value && posEl){ refreshRowPosOptions(teamKey, pEl, posEl); }
    }
    updateTakenPositions(orderPrefix);
  }
  function autoAssignPositions(orderPrefix, teamKey){
    // Assign positions to current lineup: try to fill C,1B,2B,3B,SS,LF,CF,RF once; leftover becomes DH
    const need = ['catcher','first','second','third','short','left','center','right'];
    const used = new Set();
    let dhUsed = false;
    // Ensure each row has its pos options built for current player selection
    refreshAllRowPosOptions(orderPrefix, teamKey);
    for(let i=1;i<=9;i++){
      const pEl = $(`${orderPrefix}-${i}`);
      const posEl = $(`${orderPrefix}-pos-${i}`);
      if(!pEl || !posEl) continue;
      const name = pEl.value;
      if(!name){ posEl.value=''; posEl.disabled = true; continue; }
      const keys = eligibleKeysForPlayer(teamKey, name).filter(k=> !used.has(k));
      const pick = keys.find(k=> need.includes(k));
      if(pick){ posEl.value = pick; used.add(pick); }
      else {
        if(!dhUsed){ posEl.value = 'DH'; dhUsed = true; }
        else { posEl.value = ''; }
      }
      posEl.disabled = false;
    }
    updateTakenPositions(orderPrefix);
  }
  function syncDefenseToOrder(side){ /* legacy no-op: positions now chosen per lineup row */ }
  function updateTakenPositions(orderPrefix){
    // Maintain enabled state of position selects based on whether a player is chosen; do not disable duplicates
    for(let i=1;i<=9;i++){
      const pSel = document.getElementById(`${orderPrefix}-${i}`);
      const posSel = document.getElementById(`${orderPrefix}-pos-${i}`);
      if(!posSel) continue;
      if(!pSel || !pSel.value){ posSel.disabled = true; posSel.value = ''; }
      else { posSel.disabled = false; }
    }
  }

  function handlePosChange(orderPrefix, posSel){
    const chosen = posSel.value;
    if(!chosen){ updateTakenPositions(orderPrefix); return; }
    // If another row already has this position/DH, clear it there and give it to the current row
    for(let i=1;i<=9;i++){
      const other = document.getElementById(`${orderPrefix}-pos-${i}`);
      if(!other || other===posSel) continue;
      if(other.value === chosen){
        other.value = '';
      }
    }
    updateTakenPositions(orderPrefix);
  }
  function clearTeam(prefix){
    for(let i=1;i<=9;i++){ const pEl = $(`${prefix}order-${i}`); const posEl = $(`${prefix}order-pos-${i}`); if(pEl) pEl.value=''; if(posEl){ posEl.value=''; posEl.disabled=true; } }
    const pit = $(`${prefix}pitcher`); if(pit) pit.value='';
    updateTakenPositions(`${prefix}order`);
  }

  function validateTeam(teamKey, prefix, errorId){
    const errEl=$(errorId); errEl.textContent='';
    // lineup and assigned positions per batter
    const lineup=[]; const lineupPos=[];
    for(let i=1;i<=9;i++){
      const v = $(`${prefix}-${i}`).value; if(!v){ errEl.textContent='Please complete the 9-player batting order.'; return null; }
      const pv = $(`${prefix}-pos-${i}`).value; if(!pv){ errEl.textContent='Please assign a position (including DH) for each batter.'; return null; }
      lineup.push(v); lineupPos.push(pv);
    }
    const dup = lineup.find((n,idx)=> lineup.indexOf(n)!==idx);
    if(dup){ errEl.textContent=`Lineup has duplicates: ${dup}.`; return null; }
    // pitcher
    const pitcher = $(`${prefix.replace('order','pitcher')}`).value; if(!pitcher){ errEl.textContent='Please select a starting pitcher.'; return null; }
    // Build defense mapping from lineup-assigned positions (DH excluded), plus pitcher
    const defense={};
    const need = ['catcher','first','second','third','short','left','center','right'];
    // Ensure exactly one DH and all eight field positions are covered
    const dhCount = lineupPos.filter(x=> x==='DH').length;
    if(dhCount!==1){ errEl.textContent = 'You must assign exactly one DH in the lineup.'; return null; }
    // Uniqueness across defensive positions
    const taken = new Set();
    for(let i=0;i<9;i++){
      const pos = lineupPos[i]; const name = lineup[i];
      if(pos==='DH') continue;
      if(!need.includes(pos)){ errEl.textContent = `Invalid position for ${name}.`; return null; }
      if(taken.has(pos)){ errEl.textContent = `Duplicate assignment at ${POS_ABBR[pos]||pos.toUpperCase()} detected.`; return null; }
      // eligibility check for this player at this pos
      const elig = eligibleKeysForPlayer(teamKey, name);
      if(!elig.includes(pos)){ errEl.textContent = `${name} is not eligible for ${POS_ABBR[pos]||pos.toUpperCase()}.`; return null; }
      defense[pos] = name; taken.add(pos);
    }
    // Ensure all eight field positions are assigned
    const missing = need.filter(k=> !defense[k]);
    if(missing.length){ errEl.textContent = `Assign all defensive positions (missing: ${missing.map(k=>POS_ABBR[k]||k.toUpperCase()).join(', ')}).`; return null; }
    // Add pitcher from pitcher selector
    defense.pitcher = pitcher;
    return { lineup, lineupPos, pitcher, defense };
  }

  function getSavedLineups(){
    try{ const raw = localStorage.getItem('ibl.savedLineups'); return raw ? JSON.parse(raw) : {}; }catch(_){ return {}; }
  }
  function setSavedLineups(data){
    try{ localStorage.setItem('ibl.savedLineups', JSON.stringify(data||{})); }catch(_){ }
  }

  function saveTeamLineup(teamKey, prefix, profileName){
    const errId = prefix.includes('away') ? 'away-error' : 'home-error';
    const validated = validateTeam(teamKey, prefix, errId);
    if(!validated) return false;
    const name = (profileName || '').trim() || 'Default';
    const data = getSavedLineups();
    if(!data[teamKey]) data[teamKey] = { profiles:{}, lastName: name };
    if(!data[teamKey].profiles) data[teamKey].profiles = {};
    data[teamKey].profiles[name] = {
      lineup: validated.lineup,
      lineupPos: validated.lineupPos,
      pitcher: validated.pitcher
    };
    data[teamKey].lastName = name;
    setSavedLineups(data);
    return true;
  }

  function loadTeamLineup(teamKey, prefix, profileName){
    try{
      const data = getSavedLineups();
      const bucket = data && data[teamKey];
      if(!bucket) return false;
      let saved = null;
      if(bucket.profiles){
        const name = (profileName || bucket.lastName || 'Default');
        saved = bucket.profiles[name] || null;
      } else {
        // Backwards compatibility with older format
        saved = bucket;
      }
      if(!saved || !Array.isArray(saved.lineup) || !Array.isArray(saved.lineupPos)) return false;
      // Populate batting order rows
      for(let i=1;i<=9;i++){
        const pEl = $(`${prefix}-${i}`);
        const posEl = $(`${prefix}-pos-${i}`);
        if(pEl){ pEl.value = saved.lineup[i-1] || ''; }
        if(posEl){
          if(pEl && pEl.value){ refreshRowPosOptions(teamKey, pEl, posEl); }
          posEl.value = saved.lineupPos[i-1] || '';
          posEl.disabled = !pEl || !pEl.value;
        }
      }
      // Pitcher
      const pitSel = $(`${prefix.replace('order','pitcher')}`);
      if(pitSel && saved.pitcher){ pitSel.value = saved.pitcher; }
      // Re-evaluate duplicates and taken positions
      updateTakenPositions(prefix);
      return true;
    }catch(_){ return false; }
  }

  function refreshSavedListUI(teamKey, listSelId){
    try{
      const sel = $(listSelId); if(!sel) return;
      const data = getSavedLineups();
      const bucket = data && data[teamKey];
      const names = bucket && bucket.profiles ? Object.keys(bucket.profiles) : [];
      const last = bucket && bucket.lastName;
      sel.innerHTML = '<option value="">— saved lineups —</option>' + names.map(n=>`<option value="${n}">${n}</option>`).join('');
      if(last && names.includes(last)){ sel.value = last; }
    }catch(_){ }
  }

  function saveAndStart(){
    const away = validateTeam(selection.away, 'away-order', 'away-error');
    const awayErr = (document.getElementById('away-error')?.textContent||'').trim();
    const home = validateTeam(selection.home, 'home-order', 'home-error');
    const homeErr = (document.getElementById('home-error')?.textContent||'').trim();
    if(!away || !home){
      const msg = (!away && awayErr) ? awayErr : ((!home && homeErr) ? homeErr : 'Please complete lineups and defense before starting.');
      alert(msg);
      const el = !away ? document.getElementById('away-error') : document.getElementById('home-error');
      if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    // Starting a fresh game: clear any persisted in-game defensive assignments
    // so the selected lineup/pitcher appear on the field immediately.
    try { localStorage.removeItem('ibl.inGameDefense'); } catch(_) { /* ignore */ }
    // Also clear any previously saved game snapshot to avoid stale state bleed-over.
    try { localStorage.removeItem('ibl.gameState'); } catch(_) { /* ignore */ }
    localStorage.setItem('ibl.setup', JSON.stringify({ away, home }));
    window.location.href = 'game.html';
  }

  async function preload(){
    try{
      // Avoid fetch to local files when running via file:// (blocked by browsers). Rely on existing localStorage.
      if(typeof location!=='undefined' && location.protocol==='file:') return;
      // Do not load rosters.json anymore; only per-team files
      // If per-team files exist, load selected teams individually and merge
      const needAway = !imported[selection.away];
      const needHome = !imported[selection.home];
      const updates = {};

      let teamList = (()=>{ try { return JSON.parse(localStorage.getItem('ibl.teams')||'[]'); } catch { return []; } })();
      if(!Array.isArray(teamList) || teamList.length===0){ teamList = [ { key: selection.away, name: selection.away }, { key: selection.home, name: selection.home } ]; }
      const nameFor = (key)=>{ const t = Array.isArray(teamList) ? teamList.find(x=>x.key===key) : null; return t?.name || key; };

      async function tryLoadPerTeam(teamKey){
        const candidates = Array.from(new Set([
          String(teamKey), String(teamKey).toLowerCase(),
          simpleSlug(teamKey),
          String(nameFor(teamKey)), String(nameFor(teamKey)).toLowerCase(),
          simpleSlug(nameFor(teamKey))
        ].filter(Boolean)));
        for(const baseRaw of candidates){
          const base = `data/rosters/${encodeURIComponent(baseRaw)}`;
          // JSON
          try{
            const res = await fetch(`${base}.json`, { cache:'no-cache' });
            if(res.ok){ const arr = await res.json(); if(Array.isArray(arr)){ return arr; } }
          }catch(_){ }
          // CSV
          try{
            const res = await fetch(`${base}.csv`, { cache:'no-cache' });
            if(res.ok){ const txt = await res.text(); const arr = parseRosterCSV(txt); if(Array.isArray(arr) && arr.length){ return arr; } }
          }catch(_){ }
          // TXT
          try{
            const res = await fetch(`${base}.txt`, { cache:'no-cache' });
            if(res.ok){ const txt = await res.text(); const arr = parseRosterTXT(txt); if(Array.isArray(arr) && arr.length){ return arr; } }
          }catch(_){ }
        }
        return null;
      }

      if(needAway){ const arr = await tryLoadPerTeam(selection.away); if(arr) updates[selection.away] = arr; }
      if(needHome){ const arr = await tryLoadPerTeam(selection.home); if(arr) updates[selection.home] = arr; }
      if(Object.keys(updates).length){ const merged = Object.assign({}, imported, updates); imported = merged; try{ localStorage.setItem('ibl.rosters', JSON.stringify(merged)); }catch(_){ } }
    }catch(_){ }
  }

  async function init(){
    await preload();
    // Titles
  const teamList = (()=>{ try { return JSON.parse(localStorage.getItem('ibl.teams')||'[]'); } catch { return []; } })();
  const nameFor = (key)=>{ const t = Array.isArray(teamList) ? teamList.find(x=>x.key===key) : null; return t?.name || key; };
  // Set titles and add roster status badges
  const awayTitleEl = $('away-title');
  const homeTitleEl = $('home-title');
  if(awayTitleEl){
    awayTitleEl.textContent = `Away: ${nameFor(selection.away)}`;
    const badge = document.createElement('span');
    const loaded = hitters(selection.away).length > 0 || pitchers(selection.away).length > 0;
    badge.textContent = loaded ? ' roster loaded' : ' no roster';
    badge.style.marginLeft = '8px';
    badge.style.fontSize = '.9rem';
    badge.style.padding = '2px 8px';
    badge.style.borderRadius = '10px';
    badge.style.background = loaded ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)';
    badge.style.border = `1px solid ${loaded ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.55)'}`;
    awayTitleEl.appendChild(badge);
  }
  if(homeTitleEl){
    homeTitleEl.textContent = `Home: ${nameFor(selection.home)}`;
    const badge = document.createElement('span');
    const loaded = hitters(selection.home).length > 0 || pitchers(selection.home).length > 0;
    badge.textContent = loaded ? ' roster loaded' : ' no roster';
    badge.style.marginLeft = '8px';
    badge.style.fontSize = '.9rem';
    badge.style.padding = '2px 8px';
    badge.style.borderRadius = '10px';
    badge.style.background = loaded ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)';
    badge.style.border = `1px solid ${loaded ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.55)'}`;
    homeTitleEl.appendChild(badge);
  }
    // Orders
    buildOrder('away-order', selection.away);
    buildOrder('home-order', selection.home);
  // Hide legacy defense UI; defense is now selected per lineup row
  const ad = $('away-defense'); if(ad && ad.closest('.section')) ad.closest('.section').style.display='none';
  const hd = $('home-defense'); if(hd && hd.closest('.section')) hd.closest('.section').style.display='none';
    // Pitchers
    const ap=$('away-pitcher'), hp=$('home-pitcher');
    function pitcherLabel(teamKey, name){
      const rec = rosterList(teamKey).find(p=> p.name===name) || {};
      const pos = rec.pos||[];
      const type = (pos.includes('SP')&&pos.includes('RP'))?'SP/RP':(pos.includes('SP')?'SP':(pos.includes('RP')?'RP':(pos.includes('P')?'P':'')));
      const role = rec.role ? ` — ${rec.role}` : '';
      return `${name}${type?` [${type}]`:''}${role}`;
    }
    ap.innerHTML = `<option value="">— select —</option>` + pitchers(selection.away).map(n=>`<option value="${n}">${pitcherLabel(selection.away, n)}</option>`).join('');
    hp.innerHTML = `<option value="">— select —</option>` + pitchers(selection.home).map(n=>`<option value="${n}">${pitcherLabel(selection.home, n)}</option>`).join('');

    // Actions
  $('import-players').onclick = ()=> window.location.href='import.html';
  $('back-to-menu').onclick = ()=> window.location.href='index.html';
    $('start-game').onclick = saveAndStart;
    $('away-autofill').onclick = ()=> autofillOrder('away-order', selection.away);
    $('home-autofill').onclick = ()=> autofillOrder('home-order', selection.home);
  $('away-autodef').onclick = ()=> autoAssignPositions('away-order', selection.away);
  $('home-autodef').onclick = ()=> autoAssignPositions('home-order', selection.home);
    const awaySync = $('away-syncdef'); if(awaySync) awaySync.onclick = ()=> syncDefenseToOrder('away');
    const homeSync = $('home-syncdef'); if(homeSync) homeSync.onclick = ()=> syncDefenseToOrder('home');
    $('away-clear').onclick = ()=> clearTeam('away-');
    $('home-clear').onclick = ()=> clearTeam('home-');

    // Save/Load per-team lineup
    const awaySave = $('away-save'); if(awaySave) awaySave.onclick = ()=>{
      const name = ($('away-lineup-name')?.value||'').trim();
      const ok = saveTeamLineup(selection.away, 'away-order', name);
      if(ok){ refreshSavedListUI(selection.away, 'away-saved-list'); }
      alert(ok ? `Away lineup saved${name?` as "${name}"`:''}.` : 'Failed to save away lineup.');
    };
    const awayLoad = $('away-load'); if(awayLoad) awayLoad.onclick = ()=>{
      const pick = ($('away-saved-list')?.value||'').trim();
      const ok = loadTeamLineup(selection.away, 'away-order', pick||null);
      alert(ok ? `Away lineup loaded${pick?` (${pick})`:''}.` : 'No saved away lineup found.');
    };
    const homeSave = $('home-save'); if(homeSave) homeSave.onclick = ()=>{
      const name = ($('home-lineup-name')?.value||'').trim();
      const ok = saveTeamLineup(selection.home, 'home-order', name);
      if(ok){ refreshSavedListUI(selection.home, 'home-saved-list'); }
      alert(ok ? `Home lineup saved${name?` as "${name}"`:''}.` : 'Failed to save home lineup.');
    };
    const homeLoad = $('home-load'); if(homeLoad) homeLoad.onclick = ()=>{
      const pick = ($('home-saved-list')?.value||'').trim();
      const ok = loadTeamLineup(selection.home, 'home-order', pick||null);
      alert(ok ? `Home lineup loaded${pick?` (${pick})`:''}.` : 'No saved home lineup found.');
    };

    // Try to pre-fill sensible defaults if rosters are present
    try{
      if(hitters(selection.away).length >= 9){
        autofillOrder('away-order', selection.away);
      }
      if(hitters(selection.home).length >= 9){
        autofillOrder('home-order', selection.home);
      }
      // Build options for all rows before assigning positions
      refreshAllRowPosOptions('away-order', selection.away);
      refreshAllRowPosOptions('home-order', selection.home);
      autoAssignPositions('away-order', selection.away);
      autoAssignPositions('home-order', selection.home);
      const apList = pitchers(selection.away); if(apList.length) $('away-pitcher').value = apList[0];
      const hpList = pitchers(selection.home); if(hpList.length) $('home-pitcher').value = hpList[0];
      // Populate saved lists and auto-load last used if available
      refreshSavedListUI(selection.away, 'away-saved-list');
      refreshSavedListUI(selection.home, 'home-saved-list');
      try{
        const data = getSavedLineups();
        if(data && data[selection.away]){ loadTeamLineup(selection.away, 'away-order', (data[selection.away].lastName||null)); }
        if(data && data[selection.home]){ loadTeamLineup(selection.home, 'home-order', (data[selection.home].lastName||null)); }
      }catch(_){ }
    }catch(_){ /* non-fatal */ }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
