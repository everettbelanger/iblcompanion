(function(){
  'use strict';
  const $ = (id)=> document.getElementById(id);
  const logEl = ()=> $('log');
  function log(msg,type){ const el=logEl(); if(!el) return; const time=new Date().toISOString().split('T')[1].replace('Z',''); el.innerHTML += `<div class="${type||''}"><span style="opacity:.55;">${time}</span> ${msg}</div>`; el.scrollTop=el.scrollHeight; }

  // Helpers
  const readText = (file)=> new Promise((res,rej)=>{ const fr=new FileReader(); fr.onerror=()=>rej(new Error('read failed')); fr.onload=()=>res(String(fr.result||'')); fr.readAsText(file); });
  const ext = (name)=>{ const m=String(name||'').match(/\.([^.]+)$/); return m? m[1].toLowerCase():''; };

  // Normalization utilities
  const normBat = (v)=>{ if(v==null) return null; const s=String(v).trim().toUpperCase(); if(!s) return null; if(['R','L','S'].includes(s)) return s; if(/^RIGHT/.test(s)||/^(RH|RHB|RHH)$/.test(s)) return 'R'; if(/^LEFT/.test(s)||/^(LH|LHB|LHH)$/.test(s)) return 'L'; if(/^SWITCH/.test(s)||s==='B'||s==='SHB'||s==='SWH') return 'S'; return s.charAt(0); };
  const normThrow = (v)=>{ if(v==null) return null; const s=String(v).trim().toUpperCase(); if(!s) return null; if(['R','L'].includes(s)) return s; if(/^RIGHT/.test(s)||s==='RH') return 'R'; if(/^LEFT/.test(s)||s==='LH') return 'L'; const c=s.charAt(0); return (c==='R'||c==='L')? c : null; };
  const FIELD_POS = ['C','1B','2B','3B','SS','LF','CF','RF'];
  const normPosList = (list)=>{ if(!list||!Array.isArray(list)||!list.length) return FIELD_POS.slice(); return list.map(x=>String(x).toUpperCase().trim()).filter(Boolean); };

  const parseTeamsCSV = (text)=>{
    const lines = String(text||'').split(/\r?\n/).filter(l=>l.trim()); if(!lines.length) return [];
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const hasHeader = ['name','key','initials','logo'].some(h=> headers.includes(h));
    const idx=(h)=> headers.indexOf(h);
    const AGG_HEADERS = ['base running aggresiveness','base running aggressiveness','baserunning aggressiveness','run aggressiveness','extra base %'];
    const aggIdx = AGG_HEADERS.map(h=> idx(h)).find(i=> i>=0);
    const makeKey=(s)=> String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    const makeInitials=(name)=>{ const words=String(name||'').trim().split(/\s+/).filter(Boolean); return words.length? words.map(w=>w[0]).join('').slice(0,3).toUpperCase(): (String(name||'').replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3)||'TMS'); };
    const out=[]; const start = hasHeader?1:0;
    for(let i=start;i<lines.length;i++){
      const cols = lines[i].split(',').map(c=>c.trim()); if(!cols.length) continue;
      const name = hasHeader ? (idx('name')>=0? cols[idx('name')] : cols[0]) : cols[0]; if(!name) continue;
      const key = hasHeader && idx('key')>=0 ? cols[idx('key')] : '';
      const initials = hasHeader && idx('initials')>=0 ? cols[idx('initials')] : '';
      const logo = hasHeader && idx('logo')>=0 ? cols[idx('logo')] : '';
      const runAgg = (typeof aggIdx==='number' && aggIdx>=0) ? (parseFloat(cols[aggIdx]||'')||undefined) : undefined;
      out.push(Object.assign({ key: key||makeKey(name), name, initials: (initials||makeInitials(name)).toUpperCase().slice(0,3), logo }, (runAgg!==undefined? { runAgg } : {})));
    }
    return out;
  };

  const normalizeRosterArray = (arr)=>{ if(!Array.isArray(arr)) return []; return arr.map(item=>{
    if(typeof item==='string') return { name:item, bats:null, throws:null, pos:FIELD_POS.slice() };
    const name=item.name||''; if(!name) return null;
      // Accept alternate keys: bat, throw
      const bats=normBat(item.bats||item.bathand||item.bat||item.B||null);
      const throws=normThrow(item.throws||item.throwhand||item.throw||item.T||null);
    const rawPos=item.pos||item.positions||null; let pos = Array.isArray(rawPos)? rawPos : (typeof rawPos==='string'? rawPos.split(/[;,\s]+/): null);
    pos=normPosList(pos);
    // Optional: batters faced limit (bfLimit) with flexible key names
    const bfLimit = (function(v){ const n=parseFloat(v); return isNaN(n)? undefined : n; })(
      item.bfLimit||item.bf||item.BF||item.bf_limit||item["bf limit"]||item["batters faced limit"]||item["batters_faced_limit"]||item.battersFacedLimit
    );
    const armVal = (function(v){ const n=parseFloat(v); return isNaN(n)? undefined : n; })(item.arm||item.Arm||item.armStrength||item['arm strength']||item['throwing arm']||undefined);
    const speedVal = (function(v){ const n=parseFloat(v); return isNaN(n)? undefined : n; })(item.speed||item.Speed||item.SPD||undefined);
    return Object.assign({ name,bats,throws,pos }
      , (bfLimit!==undefined? { bfLimit } : {})
      , (armVal!==undefined? { arm: armVal } : {})
      , (speedVal!==undefined? { speed: speedVal } : {})
    );
  }).filter(Boolean); };

  const parseRosterCSV = (text)=>{
    const lines = String(text||'').split(/\r?\n/).filter(l=>l.trim()); if(!lines.length) return [];
    let headers = lines[0].split(',');
    let csvStyle = true;
    if(headers.length===1){
      // Maybe space-delimited header line
      const wsHead = lines[0].trim().split(/\s+/);
      if(wsHead.length>=3 && /name/i.test(wsHead[0]) && wsHead.some(h=>/bat|bats/i.test(h)) && wsHead.some(h=>/throw|throws/i.test(h))){
        headers = wsHead;
        csvStyle = false;
      }
    }
    headers = headers.map(h=>h.trim().toLowerCase());
    const hasHeader = ['name','bats','bat','throws','throw','pos','position','positions','bathand','throwhand','vs l pitcher rating','vs r pitcher rating'].some(h=> headers.includes(h));
    const idx=(h)=> headers.indexOf(h);
    // Flexible header index finder (supports stray spaces / singular forms / synonyms)
    function findHeader(regexes){
      for(let i=0;i<headers.length;i++){
        const h=headers[i];
        for(const r of regexes){ if(r.test(h)) return i; }
      }
      return -1;
    }
  const nameIdx = findHeader([/^name$/]);
  const batIdx = findHeader([/^bats?$/,/^bat_hand$/,/^bathand$/,/^hit$/]);
  const throwIdx = findHeader([/^throws?$/,/^throw_hand$/,/^throwhand$/,/^pitch$/]);
  const posIdx = findHeader([/^positions?$/,/^pos$/,/^position$/]);
  const speedIdx = findHeader([/^speed$/,/^spd$/]);
  const armIdx = findHeader([/^arm$/,/^arm strength$/,/^arm rating$/,/^throwing arm$/]);
  const vsLIdx = findHeader([/^vs\s*l\s*pitcher\s*rating$/, /^vs\s*l\s*pitcher$/, /^vs\s*left\s*pitcher\s*rating$/, /^vsl$/]);
  const vsRIdx = findHeader([/^vs\s*r\s*pitcher\s*rating$/, /^vs\s*r\s*pitcher$/, /^vs\s*right\s*pitcher\s*rating$/, /^vsr$/]);
  // Flexible bfLimit header detection
  const bfIdx = findHeader([/^(bf[ _]?limit)$/,/^batters[ _]?faced[ _]?limit$/,/^batters_faced_limit$/]);
    const out=[]; const start = hasHeader?1:0;
    const POS_CODES = new Set(['C','1B','2B','3B','SS','LF','CF','RF','OF','IF','UTIL','DH','PH','PR']);
    function parseWhitespace(raw){
      const parts = raw.split(/\s+/).filter(Boolean);
      if(parts.length < 2) return null;
      // Support endings like R R, L R, S R, or combined R/R, L/R, S/R, and word forms
      let tThrow=null, tBat=null, consume=0;
      const last = parts[parts.length-1];
      const lastUp = last.toUpperCase();
      const secondLast = parts[parts.length-2];
      const secondUp = secondLast ? secondLast.toUpperCase() : '';
      const normWord = (w)=>{ if(!w) return ''; const u=w.toUpperCase(); if(/^RIGHT/.test(u)) return 'R'; if(/^LEFT/.test(u)) return 'L'; if(/^SWITCH/.test(u)||u==='B'||u==='SW'||u==='SWITCHHITTER') return 'S'; return (/^[RLS]$/.test(u)? u : ''); };
      // Pattern 1: separate single letters at end
      if(/^[RLS]$/.test(secondUp) && /^[RL]$/.test(lastUp)){
        tBat=secondUp; tThrow=lastUp; consume=2;
      } else if(/^[RLS]\/[RL]$/.test(lastUp)){
        // Pattern 2: combined like R/R or S/R
        const m=lastUp.match(/^([RLS])\/([RL])$/); if(m){ tBat=m[1]; tThrow=m[2]; consume=1; }
      } else {
        // Pattern 3: word forms at end (Left Right / Switch R / Right Right etc.)
        const batWord = normWord(secondLast);
        const throwWord = normWord(last);
        if(batWord && throwWord && /^[RL]$/.test(throwWord)) { tBat=batWord; tThrow=throwWord; consume=2; }
      }
      if(!tBat || !tThrow){ return null; }
      const core = parts.slice(0, parts.length-consume);
      // Split core into name (until first token that is clearly a position code) then remaining as positions
      let nameTokens=[]; let posTokens=[]; let hitPos=false;
      for(const token of core){
        const up=token.toUpperCase();
        if(!hitPos && POS_CODES.has(up)) hitPos=true;
        if(hitPos) posTokens.push(up); else nameTokens.push(token);
      }
      if(!nameTokens.length) return null;
      const name = nameTokens.join(' ');
      const pos = posTokens.length? posTokens : null;
      return { name, bats: normBat(tBat), throws: normThrow(tThrow), pos: normPosList(pos) };
    }
    for(let i=start;i<lines.length;i++){
      const rawLine = lines[i];
      // If line has no commas treat as whitespace roster row
      if(rawLine.indexOf(',') === -1){
        const parsed = parseWhitespace(rawLine);
        if(parsed){ out.push(parsed); continue; }
        // If not parsed, attempt to detect combined tokens inside line e.g., NAME POS POS R/R
  const combMatch = rawLine.match(/\b([A-Za-z .'-]+)\s+(.*)\s+([RLS])\/([RL])$/i);
        if(combMatch){
          const name = combMatch[1].trim();
          const middle = combMatch[2].trim();
          const bat = combMatch[3].toUpperCase();
          const thr = combMatch[4].toUpperCase();
          const posTokens = middle.split(/\s+/).filter(t=> POS_CODES.has(t.toUpperCase()));
          out.push({ name, bats: bat, throws: thr, pos: normPosList(posTokens.length? posTokens : null) });
          continue;
        }
        // Fallback regex: look anywhere for first ([RLS]) followed by optional slash and second ([RL]) later
  const generic = rawLine.match(/([A-Za-z .'-]+?)\s+([A-Z0-9 /]+)?\s*([RLS])\s*[\/ ]\s*([RL])\s*$/i);
        if(generic){
          const name = generic[1].trim();
          const bat = generic[3].toUpperCase();
          const thr = generic[4].toUpperCase();
          out.push({ name, bats: bat, throws: thr, pos: normPosList(null) });
          continue;
        }
        // Log a debug line once for an unparsable format (but don't spam)
        if(i < start+5){ log('Unparsed roster line: '+rawLine,'danger'); }
      }
  const cols = csvStyle ? rawLine.split(',').map(c=>c.trim()) : rawLine.trim().split(/\s+/).map(c=>c.trim()); if(!cols.length) continue;
      const name = hasHeader? (nameIdx>=0? cols[nameIdx] : (idx('name')>=0? cols[idx('name')] : cols[0])) : cols[0]; if(!name) continue;
      const batsRaw = hasHeader? (batIdx>=0? cols[batIdx] : (idx('bats')>=0? cols[idx('bats')] : (idx('bat')>=0? cols[idx('bat')] : (idx('bathand')>=0? cols[idx('bathand')] : null)))) : null;
      const throwsRaw = hasHeader? (throwIdx>=0? cols[throwIdx] : (idx('throws')>=0? cols[idx('throws')] : (idx('throw')>=0? cols[idx('throw')] : (idx('throwhand')>=0? cols[idx('throwhand')] : null)))) : null;
    const posStr = hasHeader? (posIdx>=0? cols[posIdx] : (idx('pos')>=0? cols[idx('pos')] : (idx('positions')>=0? cols[idx('positions')] : ''))) : (cols[1]||'');
  const speed = hasHeader && speedIdx>=0 ? (parseFloat(cols[speedIdx]||'')||undefined) : undefined;
      const arm = hasHeader && armIdx>=0 ? (parseFloat(cols[armIdx]||'')||undefined) : undefined;
  const bfLimit = hasHeader && bfIdx>=0 ? (parseFloat(cols[bfIdx]||'')||undefined) : undefined;
    const vsL = hasHeader && vsLIdx>=0 ? (parseFloat(cols[vsLIdx]||'')||undefined) : undefined;
    const vsR = hasHeader && vsRIdx>=0 ? (parseFloat(cols[vsRIdx]||'')||undefined) : undefined;
      if(i===start && hasHeader){
        // Debug first parsed row header mapping
        try{ log(`Header map -> name:${nameIdx} bat:${batIdx} throw:${throwIdx} pos:${posIdx}`); }catch(_){ }
      }
      let bats = normBat(batsRaw); let throws = normThrow(throwsRaw);
      let repaired = false;
      // Repair heuristic: if header expects 4 columns but this row produced only 3 (missing comma before bat)
      if(hasHeader && headers.length>=4 && cols.length === headers.length-1){
        // Attempt to pull trailing tokens from positions field
        if((bats==null || throws==null) && posStr){
          const tokens = posStr.split(/\s+/).filter(Boolean);
          // Pattern separate tokens ... BAT THROW
          if(tokens.length>=2){
            const t1 = tokens[tokens.length-2].toUpperCase();
            const t2 = tokens[tokens.length-1].toUpperCase();
            const isBat = (x)=> /^[RLS]$/.test(x) || /^(LEFT|RIGHT|SWITCH)$/.test(x);
            const isThr = (x)=> /^[RL]$/.test(x) || /^(LEFT|RIGHT)$/.test(x);
            const normWord=(w)=>{ if(/^RIGHT/.test(w)) return 'R'; if(/^LEFT/.test(w)) return 'L'; if(/^SWITCH/.test(w)) return 'S'; return /^[RLS]$/.test(w)? w : null; };
            if(isBat(t1) && isThr(t2)){
              if(bats==null) bats = normBat(normWord(t1)||t1.charAt(0));
              if(throws==null) throws = normThrow(normWord(t2)||t2.charAt(0));
              tokens.splice(tokens.length-2,2);
              repaired = true;
              // Update posStr after removal
            } else {
              // Combined token at end like R/R or S/R
              const last = tokens[tokens.length-1].toUpperCase();
              const m = last.match(/^([RLS])\/([RL])$/);
              if(m){
                if(bats==null) bats = normBat(m[1]);
                if(throws==null) throws = normThrow(m[2]);
                tokens.pop();
                repaired = true;
              }
            }
            if(repaired){
              try{ log(`Repaired row for ${name}: bats=${bats||'-'} throws=${throws||'-'}`); }catch(_){ }
              // Reconstruct posStr without trailing tokens
              // Keep tokens that are not handedness
              // They may already be POS codes or free-form
              const newPosStr = tokens.join(' ');
              // Overwrite posStr for position parsing below
              // eslint-disable-next-line no-var
              var _posStrOverride = newPosStr; // use var to access below
            }
          }
        }
      }
      // Choose override if set
      const finalPosStr = (typeof _posStrOverride === 'string') ? _posStrOverride : posStr;
      const pos = finalPosStr? finalPosStr.replace(/\[\]/g,'').split(/[;|,\s]+/).map(s=>s.trim()).filter(Boolean) : null;
      out.push(Object.assign({ name, bats, throws, pos: normPosList(pos) }
        , (typeof speed==='number'? { speed }:{}), (typeof arm==='number'? { arm }:{}), (typeof bfLimit==='number'? { bfLimit }:{}), (typeof vsL==='number'? { vsL }:{}), (typeof vsR==='number'? { vsR }:{})));
    }
    return out;
  };

  const parseRosterTXT = (text)=>{ const out=[]; const lines=String(text||'').split(/\r?\n/); for(let raw of lines){ if(!raw) continue; let line=raw.replace(/#.*/,'').trim(); if(!line) continue; let bats=null, throws=null, pos=null; const m=line.match(/\[(.*?)\]/); if(m){ const inside=m[1]; pos=inside.split(/[;,\s]+/).filter(Boolean); line=line.replace(m[0],'').trim(); } const bt=line.match(/\b([LRS])\/([LR])\b/i); if(bt){ bats=bt[1].toUpperCase(); throws=bt[2].toUpperCase(); line=line.replace(bt[0],'').trim(); } line=line.replace(/[,-]$/,'').trim(); const name=line; if(!name) continue; out.push({ name, bats, throws, pos: normPosList(pos) }); } return out; };

  function loadLS(key, fallback){ try{ const v=localStorage.getItem(key); return v? JSON.parse(v): fallback; }catch(_){ return fallback; } }
  function saveLS(key,val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){ } }

  function refreshSummary(){
    const teams = loadLS('ibl.teams', []);
    const rosters = loadLS('ibl.rosters', {});
    const sumEl = $('summary'); if(!sumEl) return;
    const teamCount = teams.length;
    const rosterTeams = Object.keys(rosters).length;
    let playerTotal = 0; for(const k in rosters) playerTotal += (rosters[k]||[]).length;
    sumEl.innerHTML = `
      <div class="badge">Teams <strong>${teamCount}</strong></div>
      <div class="badge">Rostered Teams <strong>${rosterTeams}</strong></div>
      <div class="badge">Total Players <strong>${playerTotal}</strong></div>
    `;
  }

  function init(){
    const teamInput = $('teams-file');
    const teamBtn = $('import-teams');
    const teamStatus = $('teams-status');
    if(teamInput){ teamInput.addEventListener('change',()=>{ teamBtn.disabled = !(teamInput.files && teamInput.files.length); }); }
    if(teamBtn){ teamBtn.addEventListener('click', async ()=>{
      try{
        if(!teamInput.files || !teamInput.files[0]) return;
        teamStatus.textContent='Importing teams…';
        const file = teamInput.files[0];
        const text = await readText(file);
        let arr=[]; const e=ext(file.name);
  if(e==='csv') arr=parseTeamsCSV(text); else if(e==='json'){ const data=JSON.parse(text); if(Array.isArray(data)) arr=data.map(t=>({ key: t.key || (t.name? t.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'):''), name:t.name||t.key||'', initials:(t.initials||'').toUpperCase().slice(0,3)||undefined, logo:t.logo||'', ...(typeof t.runAgg==='number'? { runAgg: t.runAgg } : {}) })).filter(t=>t.name); }
        if(!arr.length){ teamStatus.textContent='No teams found.'; teamStatus.style.color='salmon'; return; }
        saveLS('ibl.teams', arr);
        teamStatus.textContent=`Imported ${arr.length} teams.`; teamStatus.style.color='#a7f3d0';
        log(`Imported ${arr.length} team(s).`);
        refreshSummary();
      }catch(err){ teamStatus.textContent='Import failed.'; teamStatus.style.color='salmon'; log('Teams import failed: '+err,'danger'); }
    }); }

    const rosterInput = $('roster-files');
    const rosterBtn = $('import-rosters');
    const rosterStatus = $('rosters-status');
    if(rosterInput){ rosterInput.addEventListener('change',()=>{ rosterBtn.disabled = !(rosterInput.files && rosterInput.files.length); }); }
    if(rosterBtn){ rosterBtn.addEventListener('click', async ()=>{
      try{
        if(!rosterInput.files || !rosterInput.files.length) return;
        rosterStatus.textContent='Importing rosters…'; rosterStatus.style.color='';
        const list = Array.from(rosterInput.files);
        const teams = loadLS('ibl.teams', []);
        const findTeamKey=(base)=>{ if(!base) return base; const low=String(base).toLowerCase(); let t=teams.find(t=> String(t.key||'').toLowerCase()===low); if(t) return t.key; t=teams.find(t=> String(t.name||'').toLowerCase()===low); if(t) return t.key; return base; };
        const byKey={}; let fileCount=0, playerCount=0;
        const debug = {};
        for(const file of list){
          const base = String(file.name||'').replace(/\.[^.]+$/,'');
            const guess = findTeamKey(base);
            const text = await readText(file); const e=ext(file.name);
            let arr=[]; if(e==='csv') arr=parseRosterCSV(text); else if(e==='json'){ try{ const data=JSON.parse(text); arr=normalizeRosterArray(data); }catch(_){ arr=[]; } } else if(e==='txt') arr=parseRosterTXT(text);
            if(arr.length){
              byKey[guess]=arr; fileCount++; playerCount+=arr.length; log(`Roster ${file.name}: ${arr.length} players -> ${guess}`);
              const sample = arr.slice(0,5).map(p=>`${p.name}(${p.bats||'-'}/${p.throws||'-'})`).join(', ');
              log(`  Sample: ${sample}`);
              debug[guess]=arr.slice(0,10);
            } else { log(`Roster ${file.name}: 0 players`,'danger'); }
        }
        const prev = loadLS('ibl.rosters', {});
        saveLS('ibl.rosters', Object.assign({}, prev, byKey));
        try{ window.__iblLastRosterSample = debug; }catch(_){ }
        rosterStatus.textContent=`Imported ${fileCount} file(s), ${playerCount} players.`; rosterStatus.style.color='#a7f3d0';
        refreshSummary();
      }catch(err){ rosterStatus.textContent='Roster import failed.'; rosterStatus.style.color='salmon'; log('Roster import failed: '+err,'danger'); }
    }); }

    const wipeBtn = $('wipe-data');
    if(wipeBtn){ wipeBtn.addEventListener('click',()=>{
      if(!confirm('Clear imported teams and rosters? This cannot be undone.')) return;
      localStorage.removeItem('ibl.teams');
      localStorage.removeItem('ibl.rosters');
      refreshSummary();
      log('Cleared ibl.teams and ibl.rosters.');
    }); }

    const exportBtn = $('export-data');
    if(exportBtn){ exportBtn.addEventListener('click',()=>{
      try{
        const blob = new Blob([JSON.stringify({ teams: loadLS('ibl.teams', []), rosters: loadLS('ibl.rosters', {}) }, null, 2)], {type:'application/json'});
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ibl-export.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
        log('Exported data to ibl-export.json');
        $('export-status').textContent='Exported.'; $('export-status').style.color='#a7f3d0';
      }catch(err){ $('export-status').textContent='Export failed'; $('export-status').style.color='salmon'; log('Export failed: '+err,'danger'); }
    }); }

    const storageBtn = $('open-storage');
    if(storageBtn){ storageBtn.addEventListener('click',()=>{
      const teams = loadLS('ibl.teams', []);
      const rosters = loadLS('ibl.rosters', {});
      log('Current Teams: '+teams.length);
      for(const t of teams){ log(`  Team ${t.key} (${t.initials||''}): ${t.name}`); }
      log('Rosters: '+Object.keys(rosters).length);
      for(const k in rosters){ log(`  ${k}: ${rosters[k].length} players`); }
    }); }

    refreshSummary();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
