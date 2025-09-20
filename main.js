// Returns a map of pitcher name -> last-game BF for a given team (from saved games)
function getLastGameBFMap(teamKey) {
  try {
    const gamesRaw = localStorage.getItem('ibl.savedGames');
    if (!gamesRaw) return {};
    const list = JSON.parse(gamesRaw) || [];
    // Find most recent game for this team
    const teamGames = list.filter(g => g && g.stats && g.stats.pitching && (g.home === teamKey || g.away === teamKey));
    if (!teamGames.length) return {};
    // Sort by finalizedAt/savedAt descending
    teamGames.sort((a, b) => ((b.finalizedAt || b.savedAt || 0) - (a.finalizedAt || a.savedAt || 0)));
    const last = teamGames[0];
    const pit = (last.stats && last.stats.pitching) || {};
    const out = {};
    Object.entries(pit).forEach(([name, st]) => {
      out[name] = Number(st.BF || 0);
    });
    return out;
  } catch { return {}; }
}
// Baseball Companion App - Clean Minimal Base
(function(){
  const $ = (id)=>document.getElementById(id);

  // Fallback built-in teams if none imported
  const teams = {
    Yankees:{ name:'New York Yankees', logo:'Logos/yankees.png', roster:{
      pitchers:['Will Warren','Luke Weaver'],
      catchers:['Ben Rice','Austin Wells'],
      infielders:['Paul Goldschmidt','DJ LeMahieu','Ryan McMahon','Jose Caballero','Anthony Volpe'],
      outfielders:['Aaron Judge','Cody Bellinger','Giancarlo Stanton']
    }},
    Tigers:{ name:'Detroit Tigers', logo:'Logos/tigers.png', roster:{
      pitchers:['Tarik Skubal','Jack Flaherty'],
      catchers:['Dillon Dingler','Jake Rogers'],
      infielders:['Javier Báez','Andy Ibáñez','Zach McKinstry','Trey Sweeney','Spencer Torkelson'],
      outfielders:['Kerry Carpenter','Riley Greene','Jahmai Jones']
    }}
  };

  // Imported teams and rosters (dynamic getters so late preloads are seen)
  function getTEAM_LIST(){ try { const t = JSON.parse(localStorage.getItem('ibl.teams')||'[]'); return Array.isArray(t)?t:[]; } catch { return []; } }
  function getROSTERS(){ try { const r = JSON.parse(localStorage.getItem('ibl.rosters')||'{}'); return r && typeof r==='object' ? r : {}; } catch { return {}; } }
  function teamInfo(key){
    const t = getTEAM_LIST().find(x=>x.key===key);
    if(t) return { name: t.name || key, logo: t.logo || '', initials: t.initials || null, runAgg: (typeof t.runAgg==='number'?t.runAgg:0) };
    // Fallback to built-ins
    const b = teams[key];
    return b ? { name: b.name, logo: b.logo, initials: null, runAgg: 0 } : { name: key, logo: '', initials: null, runAgg: 0 };
  }

  // Team abbreviation/initials for scorebug (prefers teams.csv 'initials')
  const DEFAULT_TEAM_ABBR = {
    // Short keys
    'Yankees':'NYY','Tigers':'DET','Dodgers':'LAD','Cubs':'CHC','Red Sox':'BOS','Orioles':'BAL','Blue Jays':'TOR','Rays':'TBR','Guardians':'CLE','White Sox':'CHW','Royals':'KCR','Twins':'MIN','Astros':'HOU','Mariners':'SEA','Rangers':'TEX','Athletics':'OAK','Angels':'LAA','Phillies':'PHI','Braves':'ATL','Mets':'NYM','Nationals':'WSH','Marlins':'MIA','Cardinals':'STL','Brewers':'MIL','Pirates':'PIT','Reds':'CIN','Padres':'SDP','Giants':'SFG','Diamondbacks':'ARI','Rockies':'COL',
    // Full names
    'New York Yankees':'NYY','Detroit Tigers':'DET','Los Angeles Dodgers':'LAD','Chicago Cubs':'CHC','Boston Red Sox':'BOS','Baltimore Orioles':'BAL','Toronto Blue Jays':'TOR','Tampa Bay Rays':'TBR','Cleveland Guardians':'CLE','Chicago White Sox':'CHW','Kansas City Royals':'KCR','Minnesota Twins':'MIN','Houston Astros':'HOU','Seattle Mariners':'SEA','Texas Rangers':'TEX','Oakland Athletics':'OAK','Los Angeles Angels':'LAA','Philadelphia Phillies':'PHI','Atlanta Braves':'ATL','New York Mets':'NYM','Washington Nationals':'WSH','Miami Marlins':'MIA','St. Louis Cardinals':'STL','Milwaukee Brewers':'MIL','Pittsburgh Pirates':'PIT','Cincinnati Reds':'CIN','San Diego Padres':'SDP','San Francisco Giants':'SFG','Arizona Diamondbacks':'ARI','Colorado Rockies':'COL'
  };
  function teamAbbr(key){
    try{
      const info = teamInfo(key);
      if(info && info.initials){ return String(info.initials).toUpperCase().slice(0,3); }
      if(DEFAULT_TEAM_ABBR.hasOwnProperty(key)) return DEFAULT_TEAM_ABBR[key];
      const name = (info && info.name) ? info.name : String(key);
      const words = String(name).trim().split(/\s+/).filter(Boolean);
      if(words.length>=2){ return words.map(w=> w[0]).join('').slice(0,3).toUpperCase(); }
      const letters = String(name).replace(/[^A-Za-z]/g,'');
      return (letters.slice(0,3) || String(key).slice(0,3)).toUpperCase();
    }catch(_){ return String(key||'').slice(0,3).toUpperCase(); }
  }

  // Lightweight in-app toast (replaces native alert popups)
  function showToast(message, opts){
    try{
      const { timeout = 2600 } = opts || {};
      let container = document.getElementById('ibl-toast-container');
      if(!container){
        container = document.createElement('div');
        container.id = 'ibl-toast-container';
        Object.assign(container.style,{
          position:'fixed', left:'50%', bottom:'24px', transform:'translateX(-50%)',
          display:'flex', flexDirection:'column', gap:'10px', zIndex:'1200', pointerEvents:'none'
        });
        document.body.appendChild(container);
      }
      const t = document.createElement('div');
      Object.assign(t.style,{
        pointerEvents:'auto', maxWidth:'80vw', color:'#001222', background:'#00eaff',
        borderRadius:'12px', padding:'10px 12px', boxShadow:'0 6px 20px rgba(0,0,0,0.28)',
        border:'2px solid #fff', fontWeight:'600'
      });
      t.textContent = String(message||'');
      t.addEventListener('click', ()=>{ try{ t.remove(); }catch(_){ } });
      container.appendChild(t);
      setTimeout(()=>{ try{ t.remove(); }catch(_){ } }, Math.max(800, timeout));
    }catch(_){ /* ignore */ }
  }

  // Normalize bullpen/pitching role strings to proper casing
  function normalizePitchRole(v){
    if(v===undefined || v===null) return null;
    let s = String(v).trim(); if(!s) return null;
    s = s.toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
    // Common shorthands
    const alias = {
      'lr':'long relief', 'long':'long relief', 'long reliever':'long relief',
      'loogy':'specialist', 'spec':'specialist',
      'mid':'middle relief', 'mid rp':'middle relief', 'middle':'middle relief', 'middle rp':'middle relief', 'middle reliever':'middle relief',
      'set up':'setup', 'set-up':'setup', 'su':'setup',
      'cl':'closer'
    };
    if(alias[s]) s = alias[s];
    if(s.startsWith('long')) s = 'long relief';
    else if(s.startsWith('spec')) s = 'specialist';
    else if(s.startsWith('mid')) s = 'middle relief';
    else if(s.startsWith('set')) s = 'setup';
    else if(s.startsWith('clos')) s = 'closer';
    switch(s){
      case 'long relief': return 'Long Relief';
      case 'middle relief': return 'Middle Relief';
      case 'setup': return 'Setup';
      case 'closer': return 'Closer';
      case 'specialist': return 'Specialist';
      default: return s ? (s.charAt(0).toUpperCase()+s.slice(1)) : null;
    }
  }

  // Retrieve roster list for a given team key from storage, with a built-in fallback
  function rosterList(key){
    try{
      const rosters = getROSTERS();
      const list = rosters[key] || null;
      if(Array.isArray(list)) return list;
    }catch(_){ /* ignore */ }
    // Fallback to built-in teams structure when no imported roster is available
    const t = teams[key];
    if(!t || !t.roster) return [];
    const out = [];
    const pushNames = (names, posList)=>{ if(Array.isArray(names)) names.forEach(n=> out.push({ name: n, pos: posList.slice(), bats: null, throws: null })); };
    pushNames(t.roster.catchers, ['C']);
    pushNames(t.roster.infielders, ['1B','2B','3B','SS']);
    pushNames(t.roster.outfielders, ['LF','CF','RF']);
    // Allow pitchers to cover generic pitching roles by default
    pushNames(t.roster.pitchers, ['P','SP','RP']);
    return out;
  }
  // Auto-preload teams/rosters from /data when available
  async function preloadData(){
    // Helper: fetch JSON
    async function tryJSON(url){ try{ const res = await fetch(url, { cache:'no-cache' }); if(!res.ok) return null; return await res.json(); }catch{ return null; } }
    // Helper: fetch text
    async function tryText(url){ try{ const res = await fetch(url, { cache:'no-cache' }); if(!res.ok) return null; const text = await res.text(); return text; }catch{ return null; } }
    function parseTeamsCSV(text){
      const lines = String(text).split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2) return [];
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
      const hidx = (h)=> headers.indexOf(h);
      // tolerate variations/misspelling for aggressiveness column
      const AGG_HEADERS = [
        'base running aggresiveness', // as provided
        'base running aggressiveness',
        'baserunning aggressiveness',
        'run aggressiveness',
        'extra base %'
      ];
      const aggIdx = AGG_HEADERS.map(h=> hidx(h)).find(i=> i>=0);
      const makeKey = (s)=> String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
      const makeInitials = (name)=>{
        const words = String(name||'').trim().split(/\s+/).filter(Boolean);
        if(words.length) return words.map(w=>w[0]).join('').slice(0,3).toUpperCase();
        return String(name||'').replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3) || 'TMS';
      };
      const out=[];
      for(let i=1;i<lines.length;i++){
        const cols = lines[i].split(',').map(c=>c.trim());
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
    function normPosList(list){
      // Default to all field positions (no P) if missing
      const FIELD = ['C','1B','2B','3B','SS','LF','CF','RF'];
      if(!list || !Array.isArray(list) || !list.length) return FIELD.slice();
      return list.map(x=> String(x).toUpperCase().trim()).filter(Boolean);
    }
    function normalizeRosterArray(arr){
      if(!Array.isArray(arr)) return [];
      const normBatHand = (v)=>{ if(v===undefined||v===null) return null; const s=String(v).trim().toUpperCase(); if(!s) return null; if(s==='R'||s==='L'||s==='S') return s; if(/^RIGHT/.test(s)||/^(RH|RHB|RHH)$/.test(s)) return 'R'; if(/^LEFT/.test(s)||/^(LH|LHB|LHH)$/.test(s)) return 'L'; if(/^SWITCH/.test(s)||s==='B'||s==='SHB'||s==='SWH') return 'S'; return s.charAt(0); };
      const normThrowHand = (v)=>{ if(v===undefined||v===null) return null; const s=String(v).trim().toUpperCase(); if(!s) return null; if(s==='R'||s==='L') return s; if(/^RIGHT/.test(s)||s==='RH') return 'R'; if(/^LEFT/.test(s)||s==='LH') return 'L'; const c=s.charAt(0); return (c==='R'||c==='L')?c:null; };
      return arr.map(item=>{
        if(typeof item === 'string') return { name: item, bats: null, throws: null, pos: normPosList(null) };
        const name = item.name || '';
        const bats = normBatHand(item.bats || item.B || null);
        const throws = normThrowHand(item.throws || item.T || null);
        const rawPos = item.pos || item.positions || null;
        let pos = Array.isArray(rawPos) ? rawPos : (typeof rawPos==='string' ? rawPos.split(/[;,\s]+/) : null);
        pos = normPosList(pos);
        const role = normalizePitchRole(item.role || item.pitchRole || item.pitchingRole || item.bullpenRole || null);
        // Parse optional batters faced limit from common keys
        const rawBf = item.bfLimit || item.bf || item.BF || item.bf_limit || item['bf limit'] || item['batters faced limit'] || item['batters_faced_limit'] || item.battersFacedLimit;
        const bfLimit = (function(v){ const n=parseFloat(v); return isNaN(n)? undefined : n; })(rawBf);
        const arm = (function(v){ const n=parseFloat(v); return isNaN(n)? undefined : n; })(item.arm || item.Arm || item.armStrength || item['arm strength'] || item['throwing arm'] || undefined);
        const speed = (function(v){ const n=parseFloat(v); return isNaN(n)? undefined : n; })(item.speed || item.Speed || item.SPD || undefined);
        return Object.assign({ name, bats, throws, pos }
          , (role?{role}:{})
          , (bfLimit!==undefined? { bfLimit }: {})
          , (arm!==undefined?{arm}:{})
          , (speed!==undefined?{speed}:{}) );
      }).filter(p=> p.name);
    }
    function parseRosterCSV(text){
      const lines = (text||'').split(/\r?\n/).filter(l=>l.trim()); if(!lines.length) return [];
      let headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
      const hasHeader = ['name','bats','throws','pos','positions'].some(h=> headers.includes(h));
      const out=[];
      if(hasHeader){
        const idx=(h)=> headers.indexOf(h);
        const ridx = (function(){
          const cands = ['role','pitching role','bullpen role','relief role','pen role'];
          for(const h of cands){ const i = idx(h); if(i>=0) return i; }
          return -1;
        })();
        const aidx = (function(){
          const cands = ['arm','arm strength','arm rating','throwing arm'];
          for(const h of cands){ const i = idx(h); if(i>=0) return i; }
          return -1;
        })();
        // Optional pitcher quality splits (lower is better): vsL / vsR
        const vslIdx = (function(){
          // Include exact headers from provided CSVs
          const cands = [
            'vsl','vs l','vs_left','vs left','vs lhp','rating_l','l rating','left rating',
            'vs l pitcher rating','vs l pitcher','vs left pitcher rating'
          ];
          for(const h of cands){ const i = idx(h); if(i>=0) return i; }
          return -1;
        })();
        const vsrIdx = (function(){
          const cands = [
            'vsr','vs r','vs_right','vs right','vs rhp','rating_r','r rating','right rating',
            'vs r pitcher rating','vs r pitcher','vs right pitcher rating'
          ];
          for(const h of cands){ const i = idx(h); if(i>=0) return i; }
          return -1;
        })();
        // Flexible BF limit header
        const bfidx = (function(){
          const cands = ['bf limit','bf_limit','batters faced limit','batters_faced_limit','bf'];
          for(const h of cands){ const i = idx(h); if(i>=0) return i; }
          return -1;
        })();
        const spdIdx = idx('speed');
        for(let i=1;i<lines.length;i++){
          const cols = lines[i].split(',').map(c=>c.trim());
          const name = idx('name')>=0 ? cols[idx('name')] : cols[0]; if(!name) continue;
          // Support alternate header names: bathand -> bats, throwhand -> throws
          const batsRaw = (idx('bats')>=0 ? (cols[idx('bats')]||null)
                          : (idx('bathand')>=0 ? (cols[idx('bathand')]||null)
                          : (idx('bat')>=0 ? (cols[idx('bat')]||null) : null)));
          const throwsRaw = (idx('throws')>=0 ? (cols[idx('throws')]||null)
                            : (idx('throwhand')>=0 ? (cols[idx('throwhand')]||null)
                            : (idx('throw')>=0 ? (cols[idx('throw')]||null) : null)));
          const bats = (function(v){ if(v===null) return null; const s=String(v).trim().toUpperCase(); if(!s) return null; if(s==='R'||s==='L'||s==='S') return s; if(/^RIGHT/.test(s)||/^(RH|RHB|RHH)$/.test(s)) return 'R'; if(/^LEFT/.test(s)||/^(LH|LHB|LHH)$/.test(s)) return 'L'; if(/^SWITCH/.test(s)||s==='B'||s==='SHB'||s==='SWH') return 'S'; return s.charAt(0); })(batsRaw);
          const throws = (function(v){ if(v===null) return null; const s=String(v).trim().toUpperCase(); if(!s) return null; if(s==='R'||s==='L') return s; if(/^RIGHT/.test(s)||s==='RH') return 'R'; if(/^LEFT/.test(s)||s==='LH') return 'L'; const c=s.charAt(0); return (c==='R'||c==='L')?c:null; })(throwsRaw);
          const posStr = idx('pos')>=0 ? cols[idx('pos')] : (idx('positions')>=0 ? cols[idx('positions')] : '');
          const speed = (typeof spdIdx==='number' && spdIdx>=0 ? (parseFloat(cols[spdIdx]||'')||null) : null);
          const arm = (aidx>=0 ? (parseFloat(cols[aidx]||'')||null) : null);
          const bfLimit = (bfidx>=0 ? (parseFloat(cols[bfidx]||'')||null) : null);
          const vsL = (vslIdx>=0 ? (parseFloat(cols[vslIdx]||'')||null) : null);
          const vsR = (vsrIdx>=0 ? (parseFloat(cols[vsrIdx]||'')||null) : null);
          const pos = posStr ? posStr.replace(/[\[\]]/g,'').split(/[;|,\s]+/).map(s=>s.trim()).filter(Boolean) : null;
          const roleRaw = (ridx>=0 ? cols[ridx] : null);
          const role = normalizePitchRole(roleRaw);
          out.push({ name, bats, throws, pos: normPosList(pos)
            , ...(speed!==null?{speed}:{} )
            , ...(arm!==null?{arm}:{}), ...(bfLimit!==null?{bfLimit}:{})
            , ...(role?{role}:{})
            , ...(vsL!==null?{vsL}:{})
            , ...(vsR!==null?{vsR}:{})
          });
        }
        return out;
      }
      // No header: support formats like
      // name
      // name,pos
      // name,pos,bats
      // name,pos,bats,throws  (handedness after positions)
      for(const line of lines){
        const cols = line.split(',').map(c=>c.trim()).filter(c=>c.length>0);
        if(!cols.length) continue;
        const name = cols[0]; if(!name) continue;
        let bats = null, throws = null, posStr = '';
        const remain = cols.slice(1);
        let i = remain.length - 1;
        const isBats = (v)=> /^[RLS]$/i.test(v||'');
        const isThrows = (v)=> /^[RL]$/i.test(v||'');
        if(i>=0 && isThrows(remain[i])){ throws = remain[i].toUpperCase(); i--; }
        if(i>=0 && isBats(remain[i])){ bats = remain[i].toUpperCase(); i--; }
        if(i>=0){ posStr = remain.slice(0, i+1).join(' '); }
        const pos = posStr ? posStr.replace(/[\[\]]/g,'').split(/[;|,\s]+/).filter(Boolean) : null;
        out.push({ name, bats, throws, pos: normPosList(pos) });
      }
      return out;
    }
    function parseRosterTXT(text){
      const out=[]; const lines = (text||'').split(/\r?\n/);
      for(let raw of lines){
        if(!raw) continue; let line = raw.replace(/#.*/, '').trim(); if(!line) continue;
        let bats=null, throws=null, pos=null;
        // Extract [positions]
        const m = line.match(/\[(.*?)\]/); if(m){ const inside=m[1]; pos = inside.split(/[;,\s]+/).filter(Boolean); line = line.replace(m[0],'').trim(); }
        // Extract B/T like R/R or L/L or S/R
        const bt = line.match(/\b([LRS])\/([LR])\b/i); if(bt){ bats = bt[1].toUpperCase(); throws = bt[2].toUpperCase(); line = line.replace(bt[0],'').trim(); }
        // Remaining is name (trim trailing separators)
        line = line.replace(/[,-]$/,'').trim(); const name = line;
        if(!name) continue;
        out.push({ name, bats, throws, pos: normPosList(pos) });
      }
      return out;
    }
    let teamsLoaded = false;
    // Teams: prefer CSV, fallback to JSON
    const tCsv = await tryText('data/teams.csv');
    if(tCsv){ const arr = parseTeamsCSV(tCsv); if(arr.length){ localStorage.setItem('ibl.teams', JSON.stringify(arr)); teamsLoaded = true; } }
    if(!teamsLoaded){
      const tJson = await tryJSON('data/teams.json');
      if(Array.isArray(tJson) && tJson.length){ localStorage.setItem('ibl.teams', JSON.stringify(tJson)); teamsLoaded = true; }
    }
    // Rosters: attempt to load per-team files in data/rosters/ and MERGE into existing
    try{
      const list = getTEAM_LIST();
      const out = {};
      await Promise.all(list.map(async t=>{
        const nameInfo = teamInfo(t.key) || { name: t.key };
        const candidates = Array.from(new Set([
          String(t.key),
          slugify ? slugify(String(t.key)) : String(t.key),
          String(nameInfo.name||'') || String(t.key),
          slugify ? slugify(String(nameInfo.name||'')) : String(nameInfo.name||'')
        ].filter(Boolean)));
        for(const baseRaw of candidates){
          const base = `data/rosters/${encodeURIComponent(baseRaw)}`;
          const perJson = await tryJSON(`${base}.json`);
          if(Array.isArray(perJson)){ out[t.key] = normalizeRosterArray(perJson); return; }
          const perCsv = await tryText(`${base}.csv`);
          if(perCsv){ const arr = parseRosterCSV(perCsv); if(arr.length){ out[t.key] = arr; return; } }
          const perTxt = await tryText(`${base}.txt`);
          if(perTxt){ const arr = parseRosterTXT(perTxt); if(arr.length){ out[t.key] = arr; return; } }
        }
      }));
      // Merge with any existing rosters instead of wiping
      try{
        const prev = JSON.parse(localStorage.getItem('ibl.rosters')||'{}') || {};
        const merged = Object.assign({}, prev, out);
        localStorage.setItem('ibl.rosters', JSON.stringify(merged));
      }catch(_){ localStorage.setItem('ibl.rosters', JSON.stringify(out)); }
    }catch{ /* ignore */ }
  }

  // Field coordinate system (percentage of container): (0,0) top-left, (100,100) bottom-right
  // Bases form a diamond; all other positions derive from base coordinates for geometric accuracy
  const baseCoords={
    home:{left:50, top:88},
    first:{left:78, top:70},
    second:{left:50, top:52},
    third:{left:22, top:70}
  };
  // Derive realistic defensive positions from bases so everything stays aligned if bases adjust
  function clampPct(v){ return Math.max(3, Math.min(99, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function lerpPt(p1,p2,t){ return { left: lerp(p1.left,p2.left,t), top: lerp(p1.top,p2.top,t) }; }
  function addPt(p,dx,dy){ return { left: p.left + dx, top: p.top + dy }; }
  function computePositionsFromBases(){
    const H = baseCoords.home, F = baseCoords.first, S = baseCoords.second, T = baseCoords.third;
    // Pitcher along the line from Home -> Second at ~47.5% of the way (60.5ft of 127.3ft)
    const pitcher = lerpPt(H, S, 0.475);
  // Catcher further behind home (lowered a bit more for spacing)
    const catcher = addPt(H, 0, 15.0); // moved further back again
  // Middle infielders at midpoints between their adjacent bases
  const second = lerpPt(F, S, 0.5); // roughly between 1B and 2B
  const short = lerpPt(S, T, 0.5);  // roughly between 2B and 3B
  // Corner infielders: step off the bags toward the pitcher (depth),
  // then nudge to the outside of their bases (3B to the left, 1B to the right)
  let first = lerpPt(F, pitcher, 0.18);
  let third = lerpPt(T, pitcher, 0.18);
  first = addPt(first, 14.0, -2.0);  // a bit more right of 1B
  third = addPt(third, -14.0, -2.0); // a bit more left of 3B
    // Outfielders: reasonable fixed anchors; CF extended beyond 2B away from home
    const center = lerpPt(S, addPt(S, S.left-H.left, S.top-H.top), 0.9); // S + 0.9*(S-H)
    const left = { left: 28, top: 28 };
    const right = { left: 72, top: 28 };
    // Clamp to safe bounds
    function c(p){ return { left: clampPct(p.left), top: clampPct(p.top) }; }
    return {
      pitcher: c(pitcher),
      catcher: c(catcher),
      first: c(first),
      second: c(second),
      third: c(third),
      short: c(short),
      left: c(left),
      center: c(center),
      right: c(right)
    };
  }
  let positions = computePositionsFromBases();

  // --- Animation helpers ---
  function getField(){ return document.getElementById('field-container'); }
  function animEnabled(){
    try{ const v = localStorage.getItem('ibl.animations'); return v!==null ? v==='1' : true; }catch(_){ return true; }
  }
  // Debug overlay toggle (BF cap adjustments): default ON unless explicitly disabled
  function bfDebugEnabled(){
    try{ const v = localStorage.getItem('ibl.debug.bf'); return v!==null ? (v==='1') : true; }catch(_){ return true; }
  }
  function ensureAnimLayer(){
    if(!animEnabled()) return null;
    const field = getField(); if(!field) return null;
    let layer = document.getElementById('anim-layer');
    if(!layer){
      layer = document.createElement('div');
      layer.id = 'anim-layer';
      Object.assign(layer.style, { position:'absolute', inset:'0', pointerEvents:'none', zIndex:'5' });
      field.appendChild(layer);
    }
    return layer;
  }
  function clearAnimLayer(delayMs){
    setTimeout(()=>{ const layer = document.getElementById('anim-layer'); if(layer){ layer.innerHTML=''; } }, delayMs||1000);
  }
  function numToCoords(n){
    switch(n){
      case 1: return positions.pitcher;
      case 2: return positions.catcher;
      case 3: return positions.first;
      case 4: return positions.second;
      case 5: return positions.third;
      case 6: return positions.short;
      case 7: return positions.left;
      case 8: return positions.center;
      case 9: return positions.right;
      default: return positions.center;
    }
  }
  function animateBallPath(path){
    const layer = ensureAnimLayer(); if(!layer || !Array.isArray(path) || !path.length) return;
    const ball = document.createElement('div');
    Object.assign(ball.style, { position:'absolute', width:'12px', height:'12px', borderRadius:'50%', background:'#fff', boxShadow:'0 0 12px #fff, 0 0 18px #00eaff', transform:'translate(-50%, -50%)', transition:'left .25s ease, top .25s ease' });
    layer.appendChild(ball);
    // start at first point
    const start = path[0]; ball.style.left = start.left+'%'; ball.style.top = start.top+'%';
    let i=1; function step(){ if(i>=path.length) return; const p = path[i++]; requestAnimationFrame(()=>{ ball.style.left = p.left+'%'; ball.style.top = p.top+'%'; setTimeout(step, 260); }); }
    setTimeout(step, 30);
    clearAnimLayer(1400);
  }
  function animateRunnerGhostPath(seq){
    const layer = ensureAnimLayer(); if(!layer || !Array.isArray(seq) || !seq.length) return;
    const ghost = document.createElement('div');
    Object.assign(ghost.style, { position:'absolute', width:'18px', height:'18px', borderRadius:'50%', background:'#ffd700', border:'2px solid #fff', boxShadow:'0 0 10px #ffd700', transform:'translate(-50%, -50%)', transition:'left .3s ease, top .3s ease' });
    layer.appendChild(ghost);
    const start = seq[0]; ghost.style.left = start.left+'%'; ghost.style.top = start.top+'%';
    let i=1; function step(){ if(i>=seq.length) return; const p = seq[i++]; requestAnimationFrame(()=>{ ghost.style.left = p.left+'%'; ghost.style.top = p.top+'%'; setTimeout(step, 320); }); }
    setTimeout(step, 30);
    clearAnimLayer(1800);
  }
  function baseKeyToCoords(key){ return baseCoords[key] || baseCoords.home; }
  function buildRunnerPath(fromKey, steps){
    const order=['home','first','second','third','home'];
    let idx = order.indexOf(fromKey);
    const pts = [ baseKeyToCoords(fromKey) ];
    while(steps>0){ idx++; steps--; pts.push(baseKeyToCoords(order[idx])); }
    return pts;
  }

  // Image helpers
  function slugify(name){
    if(!name) return '';
    return String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'');
  }
  // Photo URL resolution with PNG/JPG fallback and simple cache
  const __photoCache = {};
  function photoUrl(name){
    const s = slugify(name); if(!s) return '';
    if(__photoCache.hasOwnProperty(s)) return __photoCache[s] || '';
    // Start async probe: prefer PNG, then JPG
    const tryUrls = [ `Player-photos/${s}.png`, `Player-photos/${s}.jpg` ];
    let resolved = '';
    (function probe(i){
      if(i>=tryUrls.length){ __photoCache[s] = resolved; return; }
      const url = tryUrls[i];
      const img = new Image();
      img.onload = ()=>{ __photoCache[s] = url; try{ positionElements(); }catch(_){ } };
      img.onerror = ()=>{ probe(i+1); };
      img.src = url;
    })(0);
    // Return empty for now; when resolved, positionElements() will re-render backgrounds
    return '';
  }
  function cardUrl(name){ const s = slugify(name); return s ? `Player-cards/${s}.png` : ''; }
    // Handedness lookup (bat/throw) from stored rosters with robust name matching
    function getHandedness(name){
      if(!name) return { bat:null, throw:null };
      const norm = (s)=> String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const slug = (s)=> norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
      const targetA = norm(name);
      const targetB = slug(name);
      try{
        const rosters = JSON.parse(localStorage.getItem('ibl.rosters')||'{}');
        for(const team of Object.keys(rosters)){
          const list = rosters[team]||[];
          for(const p of list){
            if(!p) continue;
            const n1 = norm(p.name||p.fullName||'');
            const n2 = slug(p.name||p.fullName||'');
            if((n1 && (n1===targetA)) || (n2 && (n2===targetB))){
              const bat = p.bat ?? p.bats ?? p.B ?? null;
              const thr = p.throw ?? p.throws ?? p.T ?? null;
              return { bat, throw: thr };
            }
          }
        }
      }catch(_){ }
      return { bat:null, throw:null };
    }
    function fallbackCardImage(name, context){
      const base = 'Player-cards';
      const hands = getHandedness(name);
      if(context==='pitcher'){
        const th = (hands.throw||'').toUpperCase();
        if(th==='L') return `${base}/uncarded-lhp.png`;
        if(th==='R') return `${base}/uncarded-rhp.png`;
        return `${base}/uncarded-rhp.png`;
      }
      // batter context
      let bat = (hands.bat||'').toUpperCase();
      if(bat==='S'){
        // Use opposite of current pitcher throw hand
        const pName = state.pitcher;
        const pHands = getHandedness(pName);
        const pThrow = (pHands.throw||'').toUpperCase();
        if(pThrow==='L') bat='R'; else if(pThrow==='R') bat='L'; else bat='R';
      }
      if(bat==='L') return `${base}/uncarded-lhb.png`;
      if(bat==='R') return `${base}/uncarded-rhb.png`;
      return `${base}/uncarded-rhb.png`;
    }
    function resolvePlayerCardImage(name, context){
      const primary = cardUrl(name);
      if(!primary) return fallbackCardImage(name, context);
      return primary;
    }

  const saved = (()=>{ try { return JSON.parse(localStorage.getItem('ibl.selection')||'null'); } catch(_) { return null; } })();
  const setup = (()=>{ try { return JSON.parse(localStorage.getItem('ibl.setup')||'null'); } catch(_) { return null; } })();
  const state={
    home:(saved&&saved.home)||'Yankees',
    away:(saved&&saved.away)||'Tigers',
    score:{},
    outs:0,
    inning:1,
    half:'top', // top: away bats, bottom: home bats
    fielders:{},
    bases:{first:null,second:null,third:null},
    batter:null,
    pitcher:null,
  lineups:{ home:[], away:[] },
    battingIndex:{ home:0, away:0 },
  stats:{ players:{}, teams:{}, pitching:{} },
    resp:{ first:null, second:null, third:null },
    lastPlay:'',
    history: [],
    erSuppress: false
    , reachedByError: {}
    , lineScore: { away: [], home: [] }
    , pitcherStint: { name: null, inning: 1, half: 'top', bf: 0 }
    , gameOver: false
    , winner: null
    , lastBatterByTeam: { home: null, away: null }
    , keyPlays: []
    , _redo: []
    , _pitchersUsedByTeam: { home: [], away: [] }
    , _starterByTeam: { home: null, away: null }
    , _potentialWinningPitcher: { home: null, away: null }
    , _potentialLosingPitcher: null
    , _walkoff: false
    , weather: (function(){ try { return JSON.parse(localStorage.getItem('ibl.gameSettings')||'null')||{ temperature:'Warm', sky:'Clear', precipitation:'None' }; } catch(_) { return { temperature:'Warm', sky:'Clear', precipitation:'None' }; } })()
    , weatherEffectsApplied: false
    , suspended: false
    , suspensionInfo: null
  };
  // Track last auto-scrolled index per side for lineup panels
  const __lineupAutoScroll = { home:-1, away:-1 };

  // Always-on game log: wrap lastPlay with an accessor to append entries automatically
  state._lastPlay = state.lastPlay || '';
  state.gameLog = Array.isArray(state.gameLog) ? state.gameLog : [];
  state._suppressLog = false;
  Object.defineProperty(state, 'lastPlay', {
    configurable: true,
    enumerable: true,
    get(){ return this._lastPlay; },
    set(v){
      this._lastPlay = v;
      if(this._suppressLog) return;
      try{
        if(v && String(v).trim()){
          const rngVal = (typeof this.pendingRng === 'number') ? this.pendingRng : null;
          this.gameLog.push({ ts: Date.now(), inning: this.inning, half: this.half, desc: String(v), rng: rngVal });
        }
      }catch(_){ }
    }
  });

  function battingTeamKey(){ return state.half==='top' ? state.away : state.home; }
  function fieldingTeamKey(){ return state.half==='top' ? state.home : state.away; }

  function buildLineup(teamKey){
    const list = rosterList(teamKey);
    if(list.length){
      // Exclude all pitchers (legacy 'P' and new 'SP'/'RP') from batting lineup pool
      const isPitcher = (p)=> Array.isArray(p.pos) && (p.pos.includes('P') || p.pos.includes('SP') || p.pos.includes('RP'));
      const batters = list.filter(p=> !isPitcher(p)).map(p=>p.name);
      const unique = [];
      for(const n of batters){ if(n && !unique.includes(n)) unique.push(n); if(unique.length===9) break; }
      while(unique.length<9) unique.push('Player '+(unique.length+1));
      return unique.slice(0,9);
    }
  // No roster available: fill with placeholders only
  const unique=[]; while(unique.length<9) unique.push('Player '+(unique.length+1));
  return unique;
  }

  function setScoreboard(){
  // team name labels removed from top panels; names can be shown in scorebug or tooltips if desired
    const hs = state.score[state.home]||0; const as = state.score[state.away]||0;
    const arrow = state.half==='top' ? '▲' : '▼';
    // Update new scorebug scores and abbreviations
    const awayAb = teamAbbr(state.away), homeAb = teamAbbr(state.home);
    if($('pad-away-score')) $('pad-away-score').textContent = as;
    if($('pad-home-score')) $('pad-home-score').textContent = hs;
    if($('pad-away-abbr')) $('pad-away-abbr').textContent = awayAb;
    if($('pad-home-abbr')) $('pad-home-abbr').textContent = homeAb;
    try{
      const aw = document.querySelector('.scorebug .team.side.away');
      const hm = document.querySelector('.scorebug .team.side.home');
      const battingAway = state.half==='top';
      if(aw){ aw.classList.toggle('active', battingAway); }
      if(hm){ hm.classList.toggle('active', !battingAway); }
    }catch(_){ }
  // center-inning display moved to recap bar
  // duplicate into recap bar if present
  if($('inning-arrow-dup')) $('inning-arrow-dup').textContent = arrow;
  if($('inning-number-dup')) $('inning-number-dup').textContent = String(state.inning);
    // Outs dots
  // outs indicator is only on recap bar now
  const outsDup = document.getElementById('outs-indicator-dup');
  if(outsDup){ const dots = outsDup.querySelectorAll('.dot'); dots.forEach((d,i)=>{ if(i < (state.outs||0)) d.classList.add('on'); else d.classList.remove('on'); }); }
    // Bases indicator
  // base indicators only on recap bar now
  const db1=$('base-ind-first-dup'), db2=$('base-ind-second-dup'), db3=$('base-ind-third-dup');
  if(db1) db1.classList.toggle('active', !!state.bases.first);
  if(db2) db2.classList.toggle('active', !!state.bases.second);
  if(db3) db3.classList.toggle('active', !!state.bases.third);
  // Last play inline text
  const lpi = document.getElementById('last-play-inline');
  if(lpi){ lpi.textContent = state.lastPlay || '—'; lpi.title = state.lastPlay || 'Last play'; }
  // edge logos removed from scoreboard; only scorebug logos remain
    // duplicate logos and score into recap bar
    try{
      const plh = document.getElementById('pad-logo-home'); const pla = document.getElementById('pad-logo-away');
      if(plh){ const src = teamInfo(state.home).logo; if(src){ plh.src=src; plh.style.display='inline-block'; } else { plh.removeAttribute('src'); plh.style.display='none'; } }
      if(pla){ const src = teamInfo(state.away).logo; if(src){ pla.src=src; pla.style.display='inline-block'; } else { pla.removeAttribute('src'); pla.style.display='none'; } }
      // pad score now shown per-side in scorebug; no combined score text
    }catch(_){ }
    // Mini box score removed
    try{ renderLineupPanels(); }catch(_){ }
    try{ window.dispatchEvent(new Event('resize')); }catch(_){ }
  }

  // Render top-corner batting orders with handedness and per-player game stats
  function renderLineupPanels(){
    const awayRowsEl = document.getElementById('lineup-away-rows');
    const homeRowsEl = document.getElementById('lineup-home-rows');
    const awayTitleEl = document.getElementById('lineup-away-title');
    const homeTitleEl = document.getElementById('lineup-home-title');
    if(!awayRowsEl || !homeRowsEl) return;
    const awayKey = state.away, homeKey = state.home;
    if(awayTitleEl){ awayTitleEl.textContent = `${teamAbbr(awayKey)}`; }
    if(homeTitleEl){ homeTitleEl.textContent = `${teamAbbr(homeKey)}`; }
    const rosterAway = rosterList(awayKey);
    const rosterHome = rosterList(homeKey);
    const handOf = (team, name)=>{
      const r = team === 'away' ? rosterAway : rosterHome;
      let found = Array.isArray(r) ? r.find(p=> p && p.name===name) : null;
      // Fuzzy: case-insensitive + trim
      if(!found && Array.isArray(r)){
        const normName = (s)=> String(s||'').trim().toLowerCase();
        const target = normName(name);
        found = r.find(p=> normName(p.name)===target);
      }
      // Global fallback scan across all rosters if still not found (in case team key mismatch during import)
      if(!found){
        try{
          const all = getROSTERS();
            outer: for(const k in all){
              const list = all[k]; if(!Array.isArray(list)) continue;
              for(const p of list){ if(p && p.name===name){ found=p; break outer; } }
            }
        }catch(_){ }
      }
      if(!found) return '—';
      // Accept multiple possible properties or embedded patterns just in case
      let raw = found.bats || found.Bats || found.bat || found.b || null;
      if(!raw && found.bt){ // maybe stored as 'L/R'
        const m = String(found.bt).match(/([LRS])/i);
        if(m) raw = m[1].toUpperCase();
      }
      if(!raw && typeof found.note === 'string'){
        const m = found.note.match(/\b([LRS])\/([LR])\b/i); if(m) raw = m[1].toUpperCase();
      }
      if(!raw && found['B/T']){
        const m = String(found['B/T']).match(/([LRS])/i); if(m) raw = m[1].toUpperCase();
      }
      if(!raw) return '—';
      return String(raw).toUpperCase().charAt(0);
    };
    function buildChips(name){
      const p = (name && state.stats && state.stats.players && state.stats.players[name]) ? state.stats.players[name] : null;
      const AB = p ? (p.AB||0) : 0;
      const H = p ? (p.H||0) : 0;
      const BB = p ? (p.BB||0) : 0;
      const K = p ? (p.K||0) : 0;
      const HR = p ? (p.HR||0) : 0;
      const avg = AB>0 ? (H/AB) : 0;
      const tb = p ? (p.TB||0) : 0;
      const slg = AB>0 ? tb/AB : 0;
      const hbp = p ? (p.HBP||0) : 0;
      const sf = p ? (p.SF||0) : 0;
      const obpDen = AB + BB + hbp + sf;
      const obp = obpDen>0 ? ((H + BB + hbp) / obpDen) : 0;
      const ops = obp + slg;
      const fmt3 = (n)=> (isFinite(n)? n:0).toFixed(3).replace(/^0\./,'.');
      // Choose a concise set of chips to fit without horizontal scroll.
      return [
        `<span class="lu-chip">H ${H}</span>`,
        `<span class="lu-chip">AB ${AB}</span>`,
        `<span class="lu-chip">HR ${HR}</span>`,
        `<span class="lu-chip">BB ${BB}</span>`,
        `<span class="lu-chip">K ${K}</span>`,
        `<span class="lu-chip metric">AVG ${fmt3(avg)}</span>`,
        `<span class="lu-chip metric">OPS ${fmt3(ops)}</span>`
      ].join('');
    }
    function windowRows(side){
      const lineup = (state.lineups && state.lineups[side]) ? state.lineups[side] : [];
      const battingIdx = (state.battingIndex && typeof state.battingIndex[side]==='number') ? state.battingIndex[side] : 0;
      const isBattingNow = (state.half==='top' && side==='away') || (state.half==='bottom' && side==='home');
      const out = [];
      if(isBattingNow){
        for(let k=0;k<4;k++){
          const idx = (battingIdx + k) % lineup.length;
          out.push({ idx, num: idx+1, name: lineup[idx], active: k===0 });
        }
      } else {
        // Show next half inning leadoff (current battingIdx for that side) + next 3
        for(let k=0;k<4;k++){
          const idx = (battingIdx + k) % lineup.length;
          out.push({ idx, num: idx+1, name: lineup[idx], active: k===0 });
        }
      }
      return out;
    }
    function renderWindow(side, rowsEl){
      const rows = windowRows(side).map(row=>{
        const hand = row.name ? handOf(side, row.name) : '—';
        return `
          <div class="lu-item${row.active?' active':''}" title="${row.name||''}">
            <div class="lu-head">
              <div class="lu-num">${row.num}</div>
              <div class="lu-name">${row.name||'—'}</div>
              <div class="lu-hand">${hand}</div>
            </div>
            <div class="lu-chips">${row.name? buildChips(row.name): ''}</div>
          </div>`;
      }).join('');
      rowsEl.innerHTML = rows;
    }
    renderWindow('away', awayRowsEl);
    renderWindow('home', homeRowsEl);
    // After layout changes in the scoreboard, force autosize recompute of the field
    try{ window.dispatchEvent(new Event('resize')); }catch(_){ }
  }

  function repositionFloatingCards(){
    try{
      const wrap = document.getElementById('floating-cards');
      if(!wrap) return;
      const batter = document.getElementById('batter-card');
      const pitcher = document.getElementById('pitcher-card');
      const w = window.innerWidth;
      // If too narrow, stack vertically
      if(w < 1100){
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.left = '50%';
        wrap.style.right = 'auto';
        wrap.style.transform = 'translateX(-50%)';
        if(batter) batter.style.width = 'min(360px, 90vw)';
        if(pitcher) pitcher.style.width = 'min(360px, 90vw)';
      } else {
        wrap.style.flexDirection = 'row';
        wrap.style.alignItems = 'stretch';
        wrap.style.left = '10px';
        wrap.style.right = '10px';
        wrap.style.transform = 'none';
        if(batter) batter.style.width = '340px';
        if(pitcher) pitcher.style.width = '340px';
      }
    }catch(_){ }
  }

  function endGame(winnerKey){
    try{
      state.gameOver = true;
      state.winner = winnerKey || ((state.score[state.home]||0) > (state.score[state.away]||0) ? state.home : state.away);
      state.lastPlay = `Game over. ${state.winner} win${state.winner===state.home||state.winner===state.away?'s':''}.`;
      // Award decisions (simplified rules)
      try{
        const loser = (state.winner===state.home) ? state.away : state.home;
        const winSide = (state.winner===state.home) ? 'home' : 'away';
        const loseSide = (state.winner===state.home) ? 'away' : 'home';
        // Winning pitcher: potential assigned on last lead change; fallback to starter
        let wPitch = (state._potentialWinningPitcher && state._potentialWinningPitcher[winSide]) || state._starterByTeam[winSide] || null;
        if(wPitch){ ensurePitcherEntry(wPitch); state.stats.pitching[wPitch].W = (state.stats.pitching[wPitch].W||0) + 1; }
        // Losing pitcher: pitcher on mound when go-ahead was achieved (approx), fallback to last fielding pitcher for loser
        let lPitch = state._potentialLosingPitcher || (state._lastFieldingPitcherByTeam ? state._lastFieldingPitcherByTeam[loser] : null) || null;
        if(lPitch){ ensurePitcherEntry(lPitch); state.stats.pitching[lPitch].L = (state.stats.pitching[lPitch].L||0) + 1; }
        // Save: finishing pitcher for winner if not the same as winning pitcher; skip on walk-off
        const finishing = (state._lastFieldingPitcherByTeam && state._lastFieldingPitcherByTeam[state.winner]) || null;
        if(finishing && wPitch && finishing!==wPitch && !state._walkoff){ ensurePitcherEntry(finishing); state.stats.pitching[finishing].SV = (state.stats.pitching[finishing].SV||0) + 1; }
      }catch(_){ }
      // Persist a final snapshot for the postgame show (and attach Pennant context if active)
      try{
        const finalSnap = snapshot();
        finalSnap.finalizedAt = Date.now();
        // Attach pennant context if exists
        try{
          const ctxRaw = localStorage.getItem('ibl.pennant.context');
          if(ctxRaw){ const ctx = JSON.parse(ctxRaw); if(ctx && ctx.mode==='pennant'){ finalSnap.pennant = ctx; } }
        }catch(_){ }
        localStorage.setItem('ibl.postgame', JSON.stringify(finalSnap));
        // Also persist the final game state so nothing from the last play is lost
        try{ localStorage.setItem('ibl.gameState', JSON.stringify(finalSnap)); }catch(_){ }
        // Also auto-save this game to Saved Games with a default date-time title
        try{
          const d = new Date(finalSnap.finalizedAt);
          const pad = (n)=> String(n).padStart(2,'0');
          const title = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
          const key = 'ibl.savedGames';
          const raw = localStorage.getItem(key); const list = raw ? JSON.parse(raw) : [];
          const data = Object.assign({}, finalSnap, { savedAt: Date.now(), title, notes: '', autoSaved: true });
          // Avoid duplicates if already saved with same finalizedAt
          const idx = list.findIndex(g=> g && g.finalizedAt === finalSnap.finalizedAt);
          if(idx >= 0){ list[idx] = Object.assign({}, list[idx], data); } else { list.push(data); }
          localStorage.setItem(key, JSON.stringify(list));
        }catch(_){ }
        // If this was a Pennant game, update series standing now
        try{
          const ctxRaw = localStorage.getItem('ibl.pennant');
          const seriesCtxRaw = localStorage.getItem('ibl.pennant.context');
          if(ctxRaw && seriesCtxRaw){
            const tourn = JSON.parse(ctxRaw);
            const ctx = JSON.parse(seriesCtxRaw);
            if(tourn && ctx && ctx.mode==='pennant' && tourn.id===ctx.id){
              // Apply win
              const s = tourn.rounds[ctx.ri][ctx.si];
              const hs = finalSnap.score[finalSnap.home]||0, as = finalSnap.score[finalSnap.away]||0;
              if(hs>as){ if(s.a===finalSnap.home) s.winsA+=1; else if(s.b===finalSnap.home) s.winsB+=1; }
              else if(as>hs){ if(s.a===finalSnap.away) s.winsA+=1; else if(s.b===finalSnap.away) s.winsB+=1; }
              // Propagate winners
              const need = Math.ceil(s.bestOf/2);
              if(s.a && s.b && (s.winsA>=need || s.winsB>=need)){
                s.winner = (s.winsA>=need) ? s.a : s.b;
                const nextRound = tourn.rounds[ctx.ri+1];
                if(nextRound){ const slot = Math.floor(ctx.si/2); const target = nextRound[slot]; if((ctx.si % 2)===0) target.a = s.winner; else target.b = s.winner; }
              }
              const last = tourn.rounds[tourn.rounds.length-1][0];
              if(last){ const needLast = Math.ceil(last.bestOf/2); tourn.completed = !!(last.a && last.b && (last.winsA>=needLast || last.winsB>=needLast)); }
              localStorage.setItem('ibl.pennant', JSON.stringify(tourn));
            }
          }
        }catch(_){ }
      }catch(_){ }
    }catch(_){ }
    updateAll();
    // Navigate to postgame screen shortly to allow UI to update
    try{ setTimeout(()=>{ try{ window.location.href = 'postgame.html'; }catch(_){ } }, 300); }catch(_){ }
  }
  function assignDefaultPlayers(){
    // Initialize lineups: prefer saved setup
    if(setup && setup.home && setup.away){
      state.lineups.home = Array.isArray(setup.home.lineup) && setup.home.lineup.length===9 ? setup.home.lineup.slice() : buildLineup(state.home);
      state.lineups.away = Array.isArray(setup.away.lineup) && setup.away.lineup.length===9 ? setup.away.lineup.slice() : buildLineup(state.away);
    } else {
      state.lineups.home = buildLineup(state.home);
      state.lineups.away = buildLineup(state.away);
    }
    // Start game: away bats first
    state.half = 'top';
    state.battingIndex.away = 0;
    state.battingIndex.home = 0;
    setSidesForHalf();
    // Record initial pitcher appearance so starter identity is correct from the first PA
    try{ const fieldTeam0 = fieldingTeamKey(); if(state.pitcher) recordPitcherAppearance(fieldTeam0, state.pitcher); }catch(_){ }
    try{ renderLineupPanels(); }catch(_){ }
    try{ applyWeatherEffectsAtStart(); }catch(_){ }
  }

  // --- Weather & Game Settings Effects ---
  function loadGameSettings(){ try { return JSON.parse(localStorage.getItem('ibl.gameSettings')||'null')||null; } catch(_) { return null; } }
  function applyWeatherEffectsAtStart(){
    if(state.weatherEffectsApplied) return;
    const gs = loadGameSettings(); if(gs) state.weather = gs;
    // Starter baseline fatigue thresholds stored per pitcher; we simulate via a BF cap modifier on their stint record
    // We'll track on pitcherStint an adjBF property if needed
    const temp = (state.weather && state.weather.temperature)||'Warm';
    // We don't know starter until after setSidesForHalf -> pitcher set; apply to both starters if we have setup starters captured
    try{
      const starters = [ state._starterByTeam.home, state._starterByTeam.away ].filter(Boolean);
      const deltaByPitcher = {};
      starters.forEach(p=>{ deltaByPitcher[p]=0; });
      if(temp==='Hot'){ starters.forEach(p=>{ deltaByPitcher[p]-=4; }); }
      else if(temp==='Cool'){ starters.forEach(p=>{ deltaByPitcher[p]+=2; }); }
      // Persist map for later; attach to state
      state._starterBFAdjust = deltaByPitcher;
    }catch(_){ }
    state.weatherEffectsApplied = true;
  }

  // Simple helper giving current BF adjustment for pitcher if starter
  function bfAdjustmentFor(pitcher){
    try{ if(state._starterBFAdjust && state._starterBFAdjust.hasOwnProperty(pitcher)) return state._starterBFAdjust[pitcher]; }catch(_){ }
    return 0;
  }

  // --- BF fatigue helpers ---
  function defaultBFLimitForRole(role){
    const r=(role||'').toLowerCase();
    if(r.includes('closer')) return 4;
    if(r.includes('setup')) return 5;
    if(r.includes('special')) return 4;
    if(r.includes('middle')) return 6;
    if(r.includes('long')) return 9;
    if(r.includes('sp/rp')||r.includes('s/r')) return 18;
    if(r.includes('sp')||r.includes('starter')) return 24;
    return 6; // generic reliever
  }
  function getPitcherBFStateForTeam(teamKey){
    const pName = state.pitcher;
    if(!pName) return null;
    const roster = rosterList(teamKey)||[];
    const pObj = roster.find(p=> p && p.name===pName) || {};
    const baseLimit = (typeof pObj.bfLimit==='number' && !isNaN(pObj.bfLimit)) ? pObj.bfLimit : defaultBFLimitForRole(pObj.role);
    const adj = (state._starterByTeam && (state._starterByTeam[teamKey===state.home?'home':'away']===pName)) ? (bfAdjustmentFor(pName)||0) : 0;
    const stintBF = (state.pitcherStint && state.pitcherStint.name===pName) ? (state.pitcherStint.bf||0) : 0;
    const totalBF = ((state.stats.pitching||{})[pName]||{}).BF||0;
    const adjLimit = Math.max(1, Math.round((baseLimit||6) + (adj||0)));
    const extraAdj = (state._bfAdjByPitcher && state._bfAdjByPitcher[pName]) || 0; // fractional adj beyond base BF count
    return { name:pName, obj:pObj, baseLimit: baseLimit||6, adjLimit, stintBF, totalBF, extraAdj };
  }
  function computeBFDeltaForOutcome(outcome, ctx){
    // We adjust the cap (not the BF stat). Negative adj increases cap; positive adj reduces cap.
    const isStarter = !!ctx?.isStarter;
    let adj = 0;
    if(ctx?.isOut){
      const t=(ctx.outType||'').toUpperCase();
      if(t==='K'){
        // Strikeout +0.5 BF (both starters/relievers) -> increase cap => negative
        adj += -0.5;
      } else {
        // Groundout/Flyout/Lineout +0.25 BF -> increase cap => negative
        adj += -0.25;
      }
    } else {
      const o=(outcome||'').toUpperCase();
      if(o==='BB'||o==='HBP'){
        // Walk/HBP: relievers -1.5, starters -1.0 (reduces cap)
        adj += isStarter? 1.0 : 1.5;
      } else if(o==='HR'){
        // Homerun -2 (reduces cap)
        adj += 2.0;
      } else if(o==='1B' || o==='2B' || o==='3B'){
        // Any hit (1B/2B/3B): relievers -1.5, starters -1.0
        adj += isStarter? 1.0 : 1.5;
      } else if(o==='E'){
        // Error reduces cap by 0.5
        adj += 0.5;
      } else if(o==='FC'){
        // Fielder's choice: no direct penalty; traffic/runs will handle
        adj += 0;
      }
    }
    if(ctx?.runsScored){
      // Run allowed (earned or unearned): relievers -1.5/run, starters -1/run
      adj += (isStarter? 1.0 : 1.5) * ctx.runsScored;
    }
    if((ctx?.consecutiveBaserunners||0) >= 2){
      // 2+ consecutive baserunners: cumulative per-PA while streak continues
      adj += isStarter? 1.0 : 1.5;
    }
    return adj;
  }
  function recordBFAdjustmentForPitcher(pitcherName, deltaAdj){
    if(!pitcherName) return;
    if(!state._bfAdjByPitcher) state._bfAdjByPitcher = {};
    state._bfAdjByPitcher[pitcherName] = (state._bfAdjByPitcher[pitcherName]||0) + (deltaAdj||0);
  }
  function enforceBFLimitIfNeeded(){
    const teamKey = fieldingTeamKey();
    const bf = getPitcherBFStateForTeam(teamKey);
    if(!bf) return;
    // Apply fatigue to the cap, not the BF stat
    // Clamp fatigue so outs cannot increase the cap above the adjusted base
    const effCap = Math.max(1, (bf.adjLimit||1) - Math.max(0, Math.round(bf.extraAdj||0)));
    if((bf.stintBF||0) >= effCap){
      // Try to auto-manage if controllers indicate CPU, else prompt
      let controllers = null;
      try{ controllers = JSON.parse(localStorage.getItem('ibl.controllers')||'null'); }catch(_){ controllers=null; }
      const cpu = controllers ? ((teamKey===state.home? controllers.home:controllers.away) !== 'User') : false;
      openManagerDecisionModal(teamKey, effCap, cpu);
    }
  }
  function effectiveCapFromState(bf){
    if(!bf) return 1;
    // Clamp fatigue so outs cannot increase the cap above the adjusted base
    return Math.max(1, (bf.adjLimit||1) - Math.max(0, Math.round(bf.extraAdj||0)));
  }

  function openManagerDecisionModal(teamKey, effCap, isCPU){
    try{
      const teamObj = (getTeams()||[]).find(t=> t && (t.key===teamKey || slugify(t.name||'')===teamKey));
      const teamName = teamObj ? (teamObj.name||teamKey) : teamKey;
      const s = slugify(teamName);
      const mgrCandidates = [ `Player-cards/${s}-manager.png`, `Player-cards/${s}-manager.jpg`, `Logos/${s}.png` ];
      const repl = pickBullpenReplacement(teamKey);
      const modal = document.createElement('div');
      Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:'1300' });
      const content = document.createElement('div');
      Object.assign(content.style, { background:'rgba(20,24,32,0.9)', color:'#fff', border:'2px solid #00eaff', borderRadius:'18px', width:'min(520px,92vw)', padding:'16px', boxShadow:'0 10px 36px rgba(0,0,0,0.5)' });
      const img = document.createElement('img'); img.alt = `${teamName} manager`;
      Object.assign(img.style, { width:'100%', height:'220px', objectFit:'contain', borderRadius:'12px', background:'#111' });
      // Try candidates; fall back to hide on error
      let ci=0; img.onerror = ()=>{ ci++; if(ci<mgrCandidates.length){ img.src=mgrCandidates[ci]; } else { img.style.display='none'; } };
      img.src = mgrCandidates[ci];
      const pitchName = state.pitcher||'Pitcher';
      const linesCPU = [
        `${pitchName} has reached the limit (${effCap}). We're going to the pen.`,
        `That'll be all for ${pitchName}.`,
        `Time for a fresh arm.`
      ];
      const linesUser = [
        `${pitchName} reached the limit (${effCap}). Make a change.`,
        `Time to get someone up.`,
        `We need a new arm here.`
      ];
      const line = (isCPU? linesCPU:linesUser)[Math.floor(Math.random()*3)];
      const suggestion = repl && repl.name ? `<div style="margin-top:6px;opacity:.95;">Suggestion: <strong>${repl.name}</strong>${repl.role?` <span style='opacity:.8;'>(${repl.role})</span>`:''}</div>` : '';
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${img.outerHTML}
          <div style="font-size:1.05em;">${teamName} Manager</div>
          <div style="font-weight:700;">${line}</div>
          ${suggestion}
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
            ${isCPU? `<button id="mgr-auto" style="padding:8px 12px;border:none;border-radius:10px;background:#00eaff;color:#001222;cursor:pointer;">Make the change</button>`:''}
            <button id="mgr-open" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Open bullpen</button>
            <button id="mgr-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#666;color:#fff;cursor:pointer;">Close</button>
          </div>
        </div>`;
      // Because we inserted img via outerHTML, rewire to first child
      content.querySelector('img')?.addEventListener('error', ()=>{});
      modal.appendChild(content); document.body.appendChild(modal);
      const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
      modal.addEventListener('click',(e)=>{ if(e.target===modal) close(); });
      content.querySelector('#mgr-cancel')?.addEventListener('click', close);
      content.querySelector('#mgr-open')?.addEventListener('click', ()=>{ close(); openPitchChangeModal(); });
      if(isCPU && repl && repl.name){
        content.querySelector('#mgr-auto')?.addEventListener('click', ()=>{ close(); applySubstitution(teamKey, 'pitcher', repl.name); state.lastPlay = `Pitching change: ${repl.name} replaces ${state.pitcher}`; updateAll(); });
      }
    }catch(_){
      // Fallback: show bullpen selection so user can confirm, no auto-change
      const name = state.pitcher||'Pitcher';
      showToast(`${teamAbbr(teamKey)}: ${name} has reached BF cap. Opening bullpen…`, { timeout: 2000 });
      openPitchChangeModal();
    }
  }
  function pickBullpenReplacement(teamKey){
    const inning = state.inning||1;
    const list = rosterList(teamKey)||[];
    const sideKey = (teamKey===state.home) ? 'home' : 'away';
    const used = ((state._pitchersUsedByTeam||{})[sideKey]) || [];
    const lastGameBF = getLastGameBFMap(teamKey);
    const bullpen = list
      .filter(p=> Array.isArray(p.pos) && (p.pos.includes('RP') || p.pos.includes('P')))
      .filter(p=> !(used.includes(p.name) && p.name !== state.pitcher));
    if(!bullpen.length) return null;
    const nextBatters = (function(){
      const side = (state.half==='top')? 'away' : 'home';
      const ord = state.lineups[side]||[]; const idx = state.battingIndex[side]||0;
      const tm = battingTeamKey(); const rlist = rosterList(tm)||[];
      const arr=[]; for(let i=0;i<5 && ord.length;i++){ const nm=ord[(idx+i)%ord.length]; const o=rlist.find(x=>x.name===nm); if(o) arr.push(o); }
      return arr;
    })();
    // Score by matchup rating, rest, role, and remaining cap
    function scorePitcher(p) {
      let score = 0;
      // Deprioritize if threw 3+ BF last game (unless no one else is fresh)
      const bfLast = lastGameBF[p.name] || 0;
      if (bfLast >= 3) score -= 20;
      // Prefer pitchers with lower vsL/vsR against upcoming batters
      let matchupScore = 0;
      nextBatters.forEach(bat => {
        const hand = (bat.bats||'R').toUpperCase().charAt(0);
        if (hand === 'L' && typeof p.vsL === 'number') matchupScore -= p.vsL;
        else if (hand === 'R' && typeof p.vsR === 'number') matchupScore -= p.vsR;
      });
      score += matchupScore;
      // Role fit by inning
      const r=(p.role||'').toLowerCase();
      if(inning>=9 && r.includes('closer')) score+=10;
      if(inning>=7 && inning<=8 && r.includes('setup')) score+=8;
      if(inning>=4 && inning<=7 && r.includes('middle')) score+=6;
      if(inning<=5 && r.includes('long')) score+=5;
      if(r.includes('special')) score+=2;
      // Prefer pitchers with more remaining cap
      if(typeof p.bfLimit==='number') {
        // Estimate fatigue: get current stint BF if available
        let stintBF = 0;
        if(state.pitcherStint && state.pitcherStint.name===p.name) stintBF = state.pitcherStint.bf||0;
        score += Math.max(0, p.bfLimit - stintBF);
      }
      return score;
    }
    // If all eligible have 3+ BF last game, ignore that penalty
    const allHeavy = bullpen.every(p => (lastGameBF[p.name]||0) >= 3);
    const ranked = bullpen.slice().sort((a,b)=> {
      let sa = scorePitcher(a), sb = scorePitcher(b);
      if (allHeavy) {
        // Remove penalty for heavy usage if all are heavy
        sa += (lastGameBF[a.name] >= 3 ? 20 : 0);
        sb += (lastGameBF[b.name] >= 3 ? 20 : 0);
      }
      return sb - sa || a.name.localeCompare(b.name);
    });
    return ranked[0]||null;
  }

  // Determine if precipitation qualifies for rain checks
  function isRainActive(){
    const w = state.weather || {}; const p = w.precipitation||'None';
    return p==='Thunderstorms' || p==='Showers';
  }

  function halfInningRainCheck(){
    if(!isRainActive() || state.gameOver || state.suspended) return;
    // 5% chance (0-4 out of 0-99)
    const roll = Math.floor(Math.random()*100);
    if(roll<=4){
      // Suspend logic
      // Determine if regulation game complete: 5 full innings (innings >5) OR 4.5 with home leading after top 5
      const regulation = (state.inning>5) || (state.inning===5 && state.half==='top' && (state.score[state.home]||0) > (state.score[state.away]||0));
      // If regulation and either tie or any lead? (User rule: If it becomes a regulation game (5 or 4.5 w/ home lead), its result stands if it's a tied score or an earlier inning with a lead for one team.)
      // Interpreting: Once regulation reached, current score stands (final) regardless of tie or lead. If not regulation, game suspended to resume later.
      if(regulation){
        state.lastPlay = 'Game called due to weather after regulation. Final.';
        endGame();
        return;
      }
      // Mark suspended and require pitcher change on resume
      state.suspended = true;
      state.suspensionInfo = {
        inning: state.inning,
        half: state.half,
        bases: JSON.parse(JSON.stringify(state.bases||{})),
        outs: state.outs,
        score: JSON.parse(JSON.stringify(state.score||{})),
        lineups: JSON.parse(JSON.stringify(state.lineups||{})),
        battingIndex: JSON.parse(JSON.stringify(state.battingIndex||{})),
        weather: state.weather,
        note: 'Suspended due to rain. Change both pitchers on resume.'
      };
      try{ localStorage.setItem('ibl.suspendedGame', JSON.stringify(state.suspensionInfo)); }catch(_){ }
      state.lastPlay = 'Game suspended due to weather. Will resume later.';
      updateAll();
  try{ setTimeout(()=>{ showToast('Game suspended due to weather. Change both pitchers on resume.',{timeout:3000}); }, 30); }catch(_){ }
    }
  }


  function setSidesForHalf(){
    const fieldTeam = fieldingTeamKey();
    const batTeam = battingTeamKey();
    // Try to use saved defense/pitcher for the team currently fielding
    const def = (setup && ((fieldTeam===state.home && setup.home) || (fieldTeam===state.away && setup.away))) || null;
    const inGame = loadInGameDefense(fieldTeam);
    if(def && def.defense){
      state.fielders = Object.assign({}, def.defense);
      // Apply any in-game overrides on top (only real player names)
      if(inGame){
        const clean = {}; Object.entries(inGame).forEach(([k,v])=>{ if(v && !isPlaceholder(v)) clean[k]=v; });
        state.fielders = Object.assign({}, state.fielders, clean);
      }
      // Preserve current in-game pitcher if there is one in overrides
      if(inGame && inGame.pitcher && !isPlaceholder(inGame.pitcher)){
        state.pitcher = inGame.pitcher;
      } else {
        state.pitcher = def.pitcher || def.defense.pitcher || state.fielders.pitcher;
      }
    } else {
      // Build defense from roster eligibility if available
      const list = rosterList(fieldTeam);
      const pick = (code, used)=>{ const p = list.find(x=> x.pos.includes(code) && !used.has(x.name)); if(p){ used.add(p.name); return p.name; } return ''; };
      // Specialized starter picker: prefer SP, then legacy P, then RP as last resort
      const pickStarter = (used)=>{
        const take = (pred)=>{ const p = list.find(pred); if(p){ used.add(p.name); return p.name; } return ''; };
        return take(x=> Array.isArray(x.pos) && x.pos.includes('SP') && !used.has(x.name))
            || take(x=> Array.isArray(x.pos) && x.pos.includes('P') && !used.has(x.name))
            || take(x=> Array.isArray(x.pos) && x.pos.includes('RP') && !used.has(x.name))
            || '';
      };
      const used = new Set();
      const map = {
        pitcher: pickStarter(used) || 'Pitcher',
        catcher: pick('C', used) || 'Catcher',
        first: pick('1B', used) || '1B',
        second: pick('2B', used) || '2B',
        third: pick('3B', used) || '3B',
        short: pick('SS', used) || 'SS',
        left: pick('LF', used) || 'LF',
        center: pick('CF', used) || 'CF',
        right: pick('RF', used) || 'RF'
      };
      // If still empty, use generic position placeholders (no built-in MLB names)
      if(Object.values(map).every(v=>!v || v.length<=2)){
        state.fielders={ pitcher:'Pitcher', catcher:'Catcher', first:'1B', second:'2B', third:'3B', short:'SS', left:'LF', center:'CF', right:'RF' };
      } else { state.fielders = map; }
      // Merge in-game overrides if present (only real names)
      if(inGame){
        const clean = {}; Object.entries(inGame).forEach(([k,v])=>{ if(v && !isPlaceholder(v)) clean[k]=v; });
        state.fielders = Object.assign({}, state.fielders, clean);
      }
      // Preserve current in-game pitcher if set
      if(inGame && inGame.pitcher && !isPlaceholder(inGame.pitcher)){
        state.pitcher = inGame.pitcher;
      } else {
        state.pitcher = state.fielders.pitcher;
      }
    }
  // Batter from lineup index
    const idx = state.battingIndex[state.half==='top'?'away':'home'] || 0;
    state.batter = state.lineups[state.half==='top'?'away':'home'][idx];
    // reset runner responsibility markers for new half
    state.resp = {first:null, second:null, third:null};
    state.erSuppress = false;
    // Start/refresh pitcher stint for the new half without resetting BF if the same pitcher continues
    try{
      state._stintByTeam = state._stintByTeam || { home:null, away:null };
      const sideKey = (fieldTeam===state.home) ? 'home' : 'away';
      const saved = state._stintByTeam[sideKey];
      // If this pitcher also finished the last half that this same team fielded, flag it
      const endedByTeam = (state._lastFieldingPitcherByTeam && state._lastFieldingPitcherByTeam[fieldTeam]) || null;
      const continuingSamePitcher = !!(saved && saved.name && state.pitcher && saved.name === state.pitcher);
      if(continuingSamePitcher){
        // Restore existing stint BF and carry into the new half
        state.pitcherStint = Object.assign({}, saved, { inning: state.inning, half: state.half });
        // Cross-inning exception applies when a pitcher spans halves
        state.pitcherStint.priorHalfComplete = !!(endedByTeam && endedByTeam === state.pitcher);
      } else {
        // New stint for a new pitcher (or no saved stint)
        const priorHalfComplete = !!(endedByTeam && state.pitcher && endedByTeam === state.pitcher);
        state.pitcherStint = { name: state.pitcher || null, inning: state.inning, half: state.half, bf: 0, priorHalfComplete };
      }
      // Keep the per-team cache in sync
      state._stintByTeam[sideKey] = state.pitcherStint ? Object.assign({}, state.pitcherStint) : null;
    }catch(_){ }
  }
  const posAbbr={ pitcher:'P', catcher:'C', first:'1B', second:'2B', third:'3B', short:'SS', left:'LF', center:'CF', right:'RF' };
  const posCode = posAbbr; // position key -> eligibility code
  const posNum = { pitcher:1, catcher:2, first:3, second:4, third:5, short:6, left:7, center:8, right:9 };
  const numLabel = { 1:'P', 2:'C', 3:'1B', 4:'2B', 5:'3B', 6:'SS', 7:'LF', 8:'CF', 9:'RF' };
  const PLACEHOLDERS = new Set(['Pitcher','Catcher','1B','2B','3B','SS','LF','CF','RF']);
  function isPlaceholder(val){ return !val || PLACEHOLDERS.has(String(val)); }

  function positionElements(){
    // Ensure positions are recomputed from base coordinates each render for accuracy
    try{ positions = computePositionsFromBases(); }catch(_){ }
    // Ensure anchoring even if external CSS fails
    const field = document.getElementById('field-container');
    if(field){ field.style.position = 'relative'; }
    const layer = document.querySelector('.defense-positions');
    if(layer){
      Object.assign(layer.style, { position:'absolute', left:'0', top:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'1' });
    }
    // Light anti-overlap repulsion for fielders
    const keys = Object.keys(positions);
    const adj = keys.reduce((m,k)=>{ m[k] = { left: positions[k].left, top: positions[k].top }; return m; }, {});
    const clamp = (v)=> Math.max(5, Math.min(95, v));
  for(let iter=0; iter<2; iter++){
      for(let i=0;i<keys.length;i++){
        for(let j=i+1;j<keys.length;j++){
          const a = adj[keys[i]], b = adj[keys[j]];
          const dx = b.left - a.left, dy = b.top - a.top; const d = Math.sqrt(dx*dx + dy*dy) || 0.0001;
          const minD = 7; // percent
          if(d < minD){
            const push = (minD - d) / 2;
            const ux = dx / d, uy = dy / d;
            a.left = clamp(a.left - ux*push); a.top = clamp(a.top - uy*push);
            b.left = clamp(b.left + ux*push); b.top = clamp(b.top + uy*push);
          }
        }
      }
    }
    Object.entries(adj).forEach(([pos,coords])=>{
      const el=$('pos-'+pos); if(!el) return;
      Object.assign(el.style, { position:'absolute', left:coords.left+'%', top:coords.top+'%', display:'block', transform:'translate(-50%, -50%)', zIndex:'2' });
      const name = state.fielders[pos]||'';
      el.title = name || pos.toUpperCase();
      // Set fielder photo background
  const purl = name && !isPlaceholder(name) ? (photoUrl(name) || `Player-photos/${slugify(name)}.png`) : '';
      if(purl){
        el.style.backgroundImage = `url('${purl}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
        // Photo present: do not show initials overlay, only position badge
        el.innerHTML = fielderBadge(posAbbr[pos]);
      } else {
        el.style.backgroundImage = 'none';
        // No photo: show initials overlay plus position badge
        el.innerHTML = badge(initials(name||posAbbr[pos])) + fielderBadge(posAbbr[pos]);
      }
      // Pitcher handedness badge (throws) on pitcher icon
      if(pos==='pitcher' && name && !isPlaceholder(name)){
        try{
          const teamKey = fieldingTeamKey();
          const roster = rosterList(teamKey);
          const found = roster.find(p=> p.name===name);
          const th = found && found.throws ? String(found.throws).toUpperCase().charAt(0) : '';
          if(th){ el.innerHTML += handBadge(th, 'pitcher'); el.title = `${name} — Throws: ${found.throws}`; }
        }catch(_){ }
      }
    });
    // Helper to offset a point slightly away from center to avoid overlapping fielders
    const center = { left: 50, top: 50 };
    function radialOffset(pt, delta){
      const vx = pt.left - center.left;
      const vy = pt.top - center.top;
      const len = Math.sqrt(vx*vx + vy*vy) || 1;
      const nx = vx / len, ny = vy / len;
      return { left: pt.left + nx*delta, top: pt.top + ny*delta };
    }

    Object.entries(baseCoords).forEach(([base,coords])=>{
      const el=$('base-'+base); if(!el) return;
      // Offset runners to the right of the base to avoid overlap with fielders (except batter at home)
      const occupied = base==='home' ? !!state.batter : !!state.bases[base];
      let dst = coords;
      if(occupied && base!=='home'){
        // Offset toward the runner's path: inside the basepath and slightly upfield to avoid 1B/3B corner collisions
        let dx=0, dy=0;
        if(base==='first'){ dx = -2.0; dy = -0.8; }     // inside toward home/second line
        else if(base==='second'){ dy = -1.2; }          // upfield toward CF
        else if(base==='third'){ dx = 2.0; dy = -0.8; } // inside toward home/second line
        dst = { left: clampPct(coords.left + dx), top: clampPct(coords.top + dy) };
      }
      Object.assign(el.style, { position:'absolute', left:dst.left+'%', top:dst.top+'%', display:'block', transform:'translate(-50%, -50%)', zIndex:'3', transition:'left .3s ease, top .3s ease' });
      if(base==='home'){
        const bname = state.batter||'';
        el.title = bname||'Batter'; el.style.opacity='1';
        // Right-click to open batter card
        el.oncontextmenu = (e)=>{ e.preventDefault(); const nm = state.batter; if(nm && !isPlaceholder(nm)) openPlayerCardModal(nm, 'Batter'); };
  const burl = photoUrl(bname) || (bname? `Player-photos/${slugify(bname)}.png` : '');
        if(burl){
          el.style.backgroundImage = `url('${burl}')`;
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
          el.style.backgroundRepeat = 'no-repeat';
          el.innerHTML = '';
        } else { el.style.backgroundImage = 'none'; el.innerHTML = badge(initials(bname||'BAT')); }
        // Batter handedness badge (bats) near the batter icon
        let bh=''; let th=''; let found=null; let pitcherHand='';
        try{
          const teamKey = battingTeamKey();
          const roster = rosterList(teamKey);
          found = roster.find(p=> p.name===bname);
          bh = found && found.bats ? String(found.bats).toUpperCase().charAt(0) : '';
        }catch(_){ }
        try{
          // Determine pitcher hand (throws) from opposing roster to decide switch-hitter side
          const pName = state.pitcher;
          if(pName){
            const fieldKey = fieldingTeamKey();
            const rosterF = rosterList(fieldKey);
            const pObj = rosterF.find(p=> p.name===pName);
            pitcherHand = pObj && pObj.throws ? String(pObj.throws).toUpperCase().charAt(0) : '';
          }
        }catch(_){ }
        // Position batter within batter's box based on handedness:
        // Visual model: home plate center = baseCoords.home. We'll shift a few % left/right.
        if(bh){
          const shiftX = 4.0; // horizontal offset percent
          const shiftY = -1.5; // slight upward to separate from plate
          let side = bh;
          if(bh==='S'){
            // Switch hitter: choose opposite of pitcher hand (if pitcher R -> stand as L, if pitcher L -> stand as R, default R)
            side = (pitcherHand==='R') ? 'L' : (pitcherHand==='L' ? 'R' : 'R');
          }
          let offsetLeft = coords.left;
          if(side==='R'){
            // Right-handed batter stands on left side (from viewer perspective), so shift left
            offsetLeft = clampPct(coords.left - shiftX);
          } else if(side==='L'){
            // Left-handed batter stands on right side, shift right
            offsetLeft = clampPct(coords.left + shiftX);
          }
          el.style.left = offsetLeft+'%';
          el.style.top = clampPct(coords.top + shiftY)+'%';
        }
        if(bh){ el.innerHTML += handBadge(bh, 'batter'); if(found){ el.title = `${bname} — Bats: ${found.bats}`; } }
      } else {
        const occ = state.bases[base];
        el.title = occ ? (`Runner: ${occ}`) : (`${base} base`);
        el.style.opacity = occ ? '1' : '0.45';
        // Right-click to open runner card when base occupied
        el.oncontextmenu = (e)=>{ e.preventDefault(); const nm = state.bases[base]; if(nm && !isPlaceholder(nm)) openPlayerCardModal(nm, base.toUpperCase()); };
        if(occ){
          const ourl = photoUrl(occ) || (occ? `Player-photos/${slugify(occ)}.png` : '');
          if(ourl){
            el.style.backgroundImage = `url('${ourl}')`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat = 'no-repeat';
            el.innerHTML = '';
          } else { el.style.backgroundImage = 'none'; el.innerHTML = badge(initials(occ)); }
        } else {
          el.style.backgroundImage = 'none';
          el.innerHTML = '';
        }
      }
    });
    // Position static base plates overlay to match baseCoords
    const plateHome = document.getElementById('plate-home'); if(plateHome){ plateHome.style.left = baseCoords.home.left+'%'; plateHome.style.top = baseCoords.home.top+'%'; }
    const plateFirst = document.getElementById('plate-first'); if(plateFirst){ plateFirst.style.left = baseCoords.first.left+'%'; plateFirst.style.top = baseCoords.first.top+'%'; }
    const plateSecond = document.getElementById('plate-second'); if(plateSecond){ plateSecond.style.left = baseCoords.second.left+'%'; plateSecond.style.top = baseCoords.second.top+'%'; }
    const plateThird = document.getElementById('plate-third'); if(plateThird){ plateThird.style.left = baseCoords.third.left+'%'; plateThird.style.top = baseCoords.third.top+'%'; }
  const mound = document.getElementById('mound'); if(mound){ mound.style.left = positions.pitcher.left+'%'; mound.style.top = positions.pitcher.top+'%'; }
  }
  function renderCards(){
    const bc=$('batter-card'), pc=$('pitcher-card');
  if(pc){
      // Pitcher card (left of field via layout)
      pc.style.display='block'; pc.style.left=''; pc.style.top='';
      const name = state.pitcher||'';
      const bf = (state && state.stats && state.stats.pitching && name && state.stats.pitching[name] && typeof state.stats.pitching[name].BF==='number') ? state.stats.pitching[name].BF : 0;
      // Compute BF limit context for current pitcher (stint-based effective BF vs adjusted limit)
      let bfInfo = null; let effBF = bf; let limitStr = '';
      try{
        const teamKey = fieldingTeamKey();
        const s = getPitcherBFStateForTeam(teamKey);
        if(s && name){
          bfInfo = s;
          // Show raw stint BF over fatigue-adjusted cap (cap reduced by fatigue), not BF increased
          const effCap = Math.max(1, (s.adjLimit||1) - Math.max(0, Math.round(s.extraAdj||0)));
          effBF = (s.stintBF||0);
          limitStr = `${effBF}/${effCap}`;
        }
      }catch(_){ }
  const url = resolvePlayerCardImage(name,'pitcher');
  const slug = slugify(name||'');
      const ps = (state.stats.pitching && name && state.stats.pitching[name]) ? state.stats.pitching[name] : { BF:0, Outs:0, H:0, ER:0, BB:0, K:0 };
      const outs = ps.Outs||0; const ipWhole = Math.floor(outs/3); const ipRem = outs%3; const ipStr = `${ipWhole}.${ipRem}`;
      const er = ps.ER||0; const ipInnings = outs/3; const eraStr = ipInnings>0 ? (er*9/ipInnings).toFixed(2) : '—';
      const h = ps.H||0; const bb = ps.BB||0; const k = ps.K||0;
      const roleLabel = (bfInfo && bfInfo.obj && bfInfo.obj.role) ? String(bfInfo.obj.role) : '';
      const weatherDelta = (bfInfo ? (bfInfo.adjLimit - (bfInfo.baseLimit||0)) : 0);
  const fatigueAdj = (bfInfo ? Math.max(0, Math.round(bfInfo.extraAdj||0)) : 0);
      let bfTitle = '';
      if(name && bfInfo){
        bfTitle = `Base limit ${bfInfo.baseLimit}` +
          (weatherDelta? `, Weather ${weatherDelta>0?'+':''}${weatherDelta}`:'') +
          (fatigueAdj? `, Fatigue reduces cap by ${fatigueAdj}`:'');
      }
      // Simple risk coloring as pitcher nears/exceeds limit
      let bfColor = '';
      if(bfInfo && bfInfo.adjLimit>0){
  const effCap = Math.max(1, (bfInfo.adjLimit||1) - Math.max(0, Math.round(bfInfo.extraAdj||0)));
        const r = effBF / effCap;
        if(r>=1) bfColor = 'background:rgba(255,82,82,0.9);color:#000;';
        else if(r>=0.8) bfColor = 'background:rgba(255,209,102,0.9);color:#000;';
        else bfColor = 'background:rgba(120,220,120,0.85);color:#000;';
      }
      const dbg = (function(){
        if(!bfDebugEnabled()) return '';
        try{
          const arr = state._bfDebug||[];
          if(!arr.length) return '';
          const rows = arr.filter(x=> x && x.p===name).slice(0,4).map(x=>{
            const tag = x.ctx.isOut? (x.outcome) : (x.outcome);
            const who = x.ctx.isStarter? 'SP' : 'RP';
            return `<div style="display:flex;justify-content:space-between;gap:8px;"><span style="opacity:.9;">${tag} <span style="opacity:.7;">(${who})</span></span><span style="opacity:.95;">${x.preCap} → ${x.postCap} <span style="opacity:.7;">(${x.adj>0?'-':''}${x.adj})</span></span></div>`;
          }).join('');
          return rows ? `<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,0.35);">${rows}</div>` : '';
        }catch(_){ return ''; }
      })();
      pc.innerHTML = `
        <h3 style="margin:0 0 8px;">Pitcher</h3>
  ${url ? `<img src="${url}" alt="${name}" style="width:100%;height:calc(100% - 34px);object-fit:contain;border-radius:14px;" onerror="(function(img){ const orig=img.src; if(orig.indexOf('uncarded-')>-1){ img.onerror=null; img.style.display='none'; return;} if(orig.endsWith('.png') && orig.indexOf('uncarded-')===-1){ img.onerror=null; img.src='Player-cards/${slug}.jpg'; } else { img.onerror=null; img.src=fallbackCardImage('${name.replace(/"/g,'&quot;')}','pitcher'); } })(this);"/>` : ''}
        <div style="position:absolute;left:12px;right:12px;bottom:10px;opacity:.98;z-index:2;background:rgba(0,0,0,0.45);padding:10px 12px;border-radius:12px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);pointer-events:none;">
          <div style="font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>${name||'—'}</span>
            ${roleLabel?`<span style="opacity:.95;">•</span><span style="opacity:.9;">${roleLabel}</span>`:''}
            ${name && bfInfo?`<span style='opacity:.95;'>•</span><span title='${bfTitle}' style="${bfColor};padding:2px 6px;border-radius:10px;">BF ${limitStr}</span>`:(name?`<span style='opacity:.95;'>•</span><span>BF ${bf||0}</span>`:'')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;row-gap:4px;margin-top:4px;font-size:0.95em;">
            <span><strong>IP</strong> ${ipStr}</span>
            <span><strong>H</strong> ${h}</span>
            <span><strong>ER</strong> ${er}</span>
            <span><strong>BB</strong> ${bb}</span>
            <span><strong>K</strong> ${k}</span>
            <span><strong>ERA</strong> ${eraStr}</span>
          </div>
            ${dbg}
        </div>
      `;
    }
  if(bc){
      // Batter card (right of field via layout)
      bc.style.display='block'; bc.style.left=''; bc.style.top='';
  // Width controlled via CSS; no inline width override
      const name = state.batter||'';
  const url = resolvePlayerCardImage(name,'batter');
  const slugB = slugify(name||'');
  const p = name ? (state.stats.players[name]||{AB:0,H:0,BB:0,K:0,R:0,TB:0,SF:0,HBP:0}) : null;
  const atBats = p ? (p.AB||0) : 0;
  const hits = p ? (p.H||0) : 0;
  const bb = p ? (p.BB||0) : 0;
  const twoB = p ? (p['2B']||0) : 0;
  const threeB = p ? (p['3B']||0) : 0;
  const hr = p ? (p.HR||0) : 0;
  const pa = p ? (p.PA||0) : 0;
  // Build broadcast-style line like "2-3 • BB, 2B, HR"
  const abLine = `${hits}-${Math.max(atBats, hits)}`;
  const tags = [];
  if(bb>0) tags.push(bb===1 ? 'Walk' : `${bb} Walks`);
  if(twoB>0) tags.push(twoB===1 ? 'Double' : `${twoB} Doubles`);
  if(threeB>0) tags.push(threeB===1 ? 'Triple' : `${threeB} Triples`);
  if(hr>0) tags.push(hr===1 ? 'Home Run' : `${hr} Home Runs`);
  const lineStr = p ? `${abLine}${tags.length? ' • '+tags.join(', ') : ''}` : '';
      bc.innerHTML = `
        <h3 style="margin:0 0 8px;">Batter</h3>
  ${url ? `<img src="${url}" alt="${name}" style="width:100%;height:calc(100% - 34px);object-fit:contain;border-radius:14px;" onerror="(function(img){ const orig=img.src; if(orig.indexOf('uncarded-')>-1){ img.onerror=null; img.style.display='none'; return;} if(orig.endsWith('.png') && orig.indexOf('uncarded-')===-1){ img.onerror=null; img.src='Player-cards/${slugB}.jpg'; } else { img.onerror=null; img.src=fallbackCardImage('${name.replace(/"/g,'&quot;')}', 'batter'); } })(this);"/>` : ''}
        <div style="position:absolute;left:12px;right:12px;bottom:10px;opacity:.98;z-index:2;background:rgba(0,0,0,0.45);padding:8px 10px;border-radius:12px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);pointer-events:none;">
          <div style="font-weight:700;">${name||'—'}</div>
          <div style="opacity:.98;font-size:1.05em;">${lineStr}</div>
        </div>
      `;
      
    }
  }

  // --- Out handling (button) ---
  // --- Out options ---
  function openOutModal(){
  if(state.gameOver){ showToast('Game is over.'); return; }
    // Start RNG for this play if not already set
    try{ prepareRngAndGlow(); }catch(_){ }
    try{ pushHistory('out'); }catch(_){ }
    const modal = document.createElement('div');
    Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:'1002' });
    const content = document.createElement('div');
    Object.assign(content.style, { background:'rgba(255,255,255,0.22)', border:'2px solid #fff', borderRadius:'20px', backdropFilter:'blur(8px)', padding:'20px', minWidth:'360px', color:'#fff', boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44' });
    const opts = [
      {k:'K', t:'Strikeout'},
      {k:'GO', t:'Groundout'},
      {k:'FO', t:'Flyout'},
      {k:'LO', t:'Lineout'},
      {k:'SF', t:'Sac Fly'},
      {k:'DP', t:'Double Play'}
    ];
    content.innerHTML = `
      <h3 style="margin:0 0 12px;">Record Out</h3>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:10px;">
        ${opts.map(o=>`<button data-k="${o.k}" style="padding:10px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.18);">${o.t}</button>`).join('')}
      </div>
      <div style="margin-top:12px;text-align:right;"><button id="cancel-out" style="padding:8px 12px;border:none;border-radius:10px;background:#334; color:#fff; cursor:pointer;">Cancel</button></div>
    `;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='cancel-out') close(); });
    content.querySelectorAll('button[data-k]').forEach(btn=>{
      btn.addEventListener('click',()=>{ const kind = btn.getAttribute('data-k');
        if(kind==='K'){ applyOut(kind, null); close(); return; }
        close();
        // For groundouts, collect defensive sequence then grounder hardness (HG/RG/SG with optional HG-)
        if(kind==='GO'){
          openDefenseSequenceModal(kind, (seq)=>{
            openGrounderHardnessModal(seq||[], (hardness)=>{ applyOut(kind, seq||null, hardness||null); });
          });
          return;
        }
        // Other outs: just sequence
        openDefenseSequenceModal(kind, (seq)=>{ applyOut(kind, seq||null); });
      });
    });
  }

  function applyOut(kind, sequence, hardness){
    const name = state.batter || 'Batter';
    const preHalf = state.half, preInning = state.inning;
  // batter faced
  try{ const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF += 1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf = (state.pitcherStint.bf||0) + 1; } }catch(_){ } } }catch(_){ }
  // Reset traffic streak on an out and apply fatigue adjustment
  try{
    state._trafficCount = 0;
    const teamKey = fieldingTeamKey();
    const bf = getPitcherBFStateForTeam(teamKey);
    if(bf){
      const preCap = effectiveCapFromState(bf);
      const side = (teamKey===state.home?'home':'away');
      const startedName = (state._starterByTeam && state._starterByTeam[side]) || '';
      const isStarter = (bf.name === startedName);
      const ctx = { isStarter, isOut:true, outType: kind, runsScored:0, consecutiveBaserunners:0 };
      const adj = computeBFDeltaForOutcome(kind, ctx);
      recordBFAdjustmentForPitcher(bf.name, adj);
      const after = getPitcherBFStateForTeam(teamKey);
      const postCap = effectiveCapFromState(after);
      try{
        state._bfDebug = state._bfDebug || [];
        state._bfDebug.unshift({ p: bf.name, outcome: kind, ctx, preCap, adj: Math.round(adj), postCap, time: Date.now() });
        if(state._bfDebug.length>6) state._bfDebug.length=6;
      }catch(_){ }
      enforceBFLimitIfNeeded();
    }
  }catch(_){ }
  let outsAdded = 1;
    switch(kind){
      case 'K': {
        addPA(name); addAB(name); addK(name); // strikeout is AB
        try{ const p=state.pitcher; if(p && state.stats.pitching && state.stats.pitching[p]) state.stats.pitching[p].K += 1; }catch(_){ }
        state.lastPlay = `${name} strikes out`;
        // Pitch to catcher animation
        try{ animateBallPath([ positions.pitcher, positions.catcher ]); }catch(_){ }
        break;
      }
      case 'GO': {
        addPA(name); addAB(name);
        try{ addGB(name); const p=state.pitcher; if(p) addP_GB(p); }catch(_){ }
        {
          const htxt = (hardness && hardness.code) ? (hardness.code==='HG' ? (hardness.minus? ' (Hard HG-)':' (Hard)') : (hardness.code==='SG' ? ' (Slow)' : ' (Routine)')) : '';
          state.lastPlay = `${name} grounds out${formatSeq(sequence)}${htxt}`;
        }
        // Ball to first fielder in sequence
        try{
          const path = [ baseCoords.home ];
          if(sequence && sequence.length){ path.push(numToCoords(sequence[0])); }
          animateBallPath(path);
        }catch(_){ }
  // SG: offer FC if runner on 1st (slow runner scenario) BEFORE recording outs
        if(hardness && hardness.code==='SG' && state.bases.first){
          const hasR2 = !!state.bases.second; const hasR3 = !!state.bases.third;
          const msg = (()=>{
            if(state.bases.first && !hasR2 && !hasR3) return 'Slow grounder: Runner on 1st forced at 2nd; batter safe at 1st?';
            if(state.bases.first && hasR2 && !hasR3) return 'Slow grounder: Force at 2nd (runner from 1st out); runner on 2nd to 3rd; batter safe at 1st?';
            if(state.bases.first && !hasR2 && hasR3) return 'Slow grounder: Runner on 1st forced at 2nd; runner on 3rd scores; batter safe at 1st?';
            if(state.bases.first && hasR2 && hasR3) return 'Slow grounder: Force at 2nd (runner from 1st out); runner on 2nd to 3rd; runner on 3rd scores; batter safe at 1st?';
            return '';
          })();
          openRGFCConfirmModal(msg, ()=>{
            const plan = { r1Out:true, moveR2: hasR2, scoreR3: hasR3 };
            applyRoutineGrounderFCImmediate(plan, 'second');
            state.lastPlay = `${name} reaches on fielder's choice${formatSeq(sequence)} (SG)`;
            { const m = openRunnerAdvanceOnlyModal('FC', {
              includeBatter: true,
              defaults: { first:0, second:0, third:0, batter:0 },
              onApply: (adv, reasons, outs)=>{ applyRunnerAdvancesOnly('FC', adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); },
              onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); }
            }); if(!m){ nextBatter(); concludeResultAndReroll(); } }
          }, ()=>{
            // Declined FC path: open manual decision modal (include batter) so user can pick which runner is out (FC vs batter out vs DP)
            const preBases = JSON.parse(JSON.stringify(state.bases));
            const m = openRunnerAdvanceOnlyModal('Decision', {
              includeBatter:true,
              defaults:{ first:0, second:0, third:0, batter:0 },
              onApply:(adv,reasons,outs)=>{
                const batter = state.batter; const p=state.pitcher;
                try{ if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF += 1; if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } } }catch(_){ }
                addPA(batter); addAB(batter); try{ addGB(batter); const p2=state.pitcher; if(p2) addP_GB(p2); }catch(_){ }
                const batterOut = outs.some(o=> o.runner===batter);
                // Process outs
                outs.forEach(o=>{ if(!o.runner) return; if(o.runner===batter){ recordOut(); return; } const spots=['first','second','third']; const base=spots.find(b=> state.bases[b]===o.runner); if(base){ state.bases[base]=null; state.resp[base]=null; recordOut(); } });
                if(state.outs>=3){ nextBatter(); concludeResultAndReroll(); return; }
                if(!batterOut){
                  // FC path: ensure forced runner on first removed if still there and not explicitly out
                  if(preBases.first && preBases.first!==batter && state.bases.first===preBases.first && !outs.some(o=> o.runner===preBases.first)){
                    // force that runner out
                    state.bases.first=null; state.resp.first=null; recordOut(); if(state.outs>=3){ nextBatter(); concludeResultAndReroll(); return; }
                  }
                  // Batter to first
                  if(state.outs<3){ state.bases.first = batter; state.resp.first = state.pitcher; }
                  // Adjust batter extra steps (if user chose beyond 1B)
                  const adv2 = { first: adv.first||0, second: adv.second||0, third: adv.third||0, batter: adv.batter>1 ? (adv.batter-1) : 0 };
                  applyRunnerAdvancesOnly('FC', adv2, reasons||{}, []);
                  state.lastPlay = `${batter} reaches on fielder's choice (manual)`;
                } else {
                  // Batter out: advance remaining runners per chosen adv (ignore adv.batter)
                  const adv2 = { first: adv.first||0, second: adv.second||0, third: adv.third||0, batter:0 };
                  applyRunnerAdvancesOnly('GO', adv2, reasons||{}, []);
                  state.lastPlay = `${batter} grounds out (manual)`;
                }
                nextBatter(); concludeResultAndReroll();
              },
              onCancel:()=>{ // Treat as routine batter out if cancelled
                recordOut(); if(state.outs<3){ nextBatter(); }
                concludeResultAndReroll();
              }
            }); if(!m){ // No runners & batter only: just record batter out
              recordOut(); if(state.outs<3){ nextBatter(); }
              concludeResultAndReroll();
            }
          }, { onManual: ()=>{
            // Manual path: open runner decisions including batter BEFORE forcing any out so user can pick which runner is out
            state.lastPlay = `${name} ground ball (SG manual)`;
            const m = openRunnerAdvanceOnlyModal('FC', {
              includeBatter:true,
              defaults:{ first:0, second:0, third:0, batter:0 },
              onApply:(adv,reasons,outs)=>{ applyRunnerAdvancesOnly('FC', adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); },
              onCancel:()=>{ nextBatter(); concludeResultAndReroll(); }
            }); if(!m){ nextBatter(); concludeResultAndReroll(); }
          }});
          return; // Defer continuation to modal callbacks
        }
        // BEFORE recording outs: handle Routine Grounder FC suggestion when R1 present
        if(hardness && hardness.code==='RG' && state.bases.first){
          const hasR2 = !!state.bases.second; const hasR3 = !!state.bases.third;
          const firstTouch = (sequence && sequence.length) ? parseInt(sequence[0],10) : null;
          const allowThirdForce = !!(hasR2 && !hasR3 && (firstTouch===5 || firstTouch===2));
          const msg = (()=>{
            if(state.bases.first && !hasR2 && !hasR3) return 'Runner on 1st is forced out at 2nd; batter safe at 1st.';
            if(state.bases.first && hasR2 && !hasR3) return allowThirdForce ? 'Choose force out: 2nd (R1 out) or 3rd (R2 out). Batter safe at 1st.' : 'Force at 2nd (runner from 1st out), runner from 2nd to 3rd; batter safe at 1st.';
            if(state.bases.first && !hasR2 && hasR3) return 'Runner on 1st forced out at 2nd; runner from 3rd scores; batter safe at 1st.';
            if(state.bases.first && hasR2 && hasR3) return 'Force at 2nd (runner from 1st out); runner from 2nd to 3rd; runner from 3rd scores; batter safe at 1st.';
            return '';
          })();
          openRGFCConfirmModal(msg, (target)=>{
            // Apply immediate FC base state and record the out now
            const plan = { r1Out: target!=='third', moveR2: hasR2 && (target!=='third'), scoreR3: hasR3 };
            applyRoutineGrounderFCImmediate(plan, target||'second');
            state.lastPlay = `${name} reaches on fielder's choice${formatSeq(sequence)} (RG${allowThirdForce?`, force at ${target==='third'?'3rd':'2nd'}`:''})`;
            // Then ask for any voluntary movement; include batter now at 1B
            { const m = openRunnerAdvanceOnlyModal('FC', {
              includeBatter: true,
              defaults: { first:0, second:0, third:0, batter:0 },
              onApply: (adv, reasons, outs)=>{ applyRunnerAdvancesOnly('FC', adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); },
              onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); }
            }); if(!m){ nextBatter(); concludeResultAndReroll(); } }
          }, ()=>{
            // Manual decision after declining preset FC suggestion
            const preBases = JSON.parse(JSON.stringify(state.bases));
            const m = openRunnerAdvanceOnlyModal('Decision', {
              includeBatter:true,
              defaults:{ first:0, second:0, third:0, batter:0 },
              onApply:(adv,reasons,outs)=>{
                const batter = state.batter; const p=state.pitcher;
                try{ if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF += 1; if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } } }catch(_){ }
                addPA(batter); addAB(batter); try{ addGB(batter); const p2=state.pitcher; if(p2) addP_GB(p2); }catch(_){ }
                const batterOut = outs.some(o=> o.runner===batter);
                outs.forEach(o=>{ if(!o.runner) return; if(o.runner===batter){ recordOut(); return; } const spots=['first','second','third']; const base=spots.find(b=> state.bases[b]===o.runner); if(base){ state.bases[base]=null; state.resp[base]=null; recordOut(); } });
                if(state.outs>=3){ nextBatter(); concludeResultAndReroll(); return; }
                if(!batterOut){
                  if(preBases.first && preBases.first!==batter && state.bases.first===preBases.first && !outs.some(o=> o.runner===preBases.first)){
                    state.bases.first=null; state.resp.first=null; recordOut(); if(state.outs>=3){ nextBatter(); concludeResultAndReroll(); return; }
                  }
                  if(state.outs<3){ state.bases.first = batter; state.resp.first = state.pitcher; }
                  const adv2 = { first: adv.first||0, second: adv.second||0, third: adv.third||0, batter: adv.batter>1 ? (adv.batter-1) : 0 };
                  applyRunnerAdvancesOnly('FC', adv2, reasons||{}, []);
                  state.lastPlay = `${batter} reaches on fielder's choice (manual)`;
                } else {
                  const adv2 = { first: adv.first||0, second: adv.second||0, third: adv.third||0, batter:0 };
                  applyRunnerAdvancesOnly('GO', adv2, reasons||{}, []);
                  state.lastPlay = `${batter} grounds out (manual)`;
                }
                nextBatter(); concludeResultAndReroll();
              },
              onCancel:()=>{ recordOut(); if(state.outs<3){ nextBatter(); } concludeResultAndReroll(); }
            }); if(!m){ recordOut(); if(state.outs<3){ nextBatter(); } concludeResultAndReroll(); }
          }, { allowThirdForce, onManual: ()=>{
            state.lastPlay = `${name} ground ball (RG manual)`;
            const m = openRunnerAdvanceOnlyModal('FC', {
              includeBatter:true,
              defaults:{ first:0, second:0, third:0, batter:0 },
              onApply:(adv,reasons,outs)=>{ applyRunnerAdvancesOnly('FC', adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); },
              onCancel:()=>{ nextBatter(); concludeResultAndReroll(); }
            }); if(!m){ nextBatter(); concludeResultAndReroll(); }
          }});
          return; // Defer continuation to modal callbacks
        }
        // Defensive decisions before defaulting to batter out
        // 1) Runner on 3rd (RG or HG): offense/defense choices
        if((hardness && (hardness.code==='RG' || hardness.code==='HG')) && state.bases.third && !state.bases.first && !state.bases.second){
          return openR3ChoiceModal(hardness.code, sequence, (alreadyOut)=>{
            // proceed to record out and ask advances
            if(!alreadyOut){ recordOut(); if(state.half!==preHalf || state.inning!==preInning){ return; } }
            const defaults = defaultAdvancesAfterOut(kind, sequence, hardness);
            { const m = openRunnerAdvanceOnlyModal(kind, { defaults, onApply: (adv, reasons)=>{ applyRunnerAdvancesOnly(kind, adv, reasons||{}); nextBatter(); concludeResultAndReroll(); }, onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); } }); if(!m){ nextBatter(); concludeResultAndReroll(); } }
          });
        }
        // 2) RG with only runner on 2nd and first touch SS (6): defense chooses out at 1st (R2->3rd) vs try for out at 3rd (batter safe at 1st; result at 3rd chosen)
        if(hardness && hardness.code==='RG' && !state.bases.first && state.bases.second && !state.bases.third){
          const ft = (sequence && sequence.length) ? parseInt(sequence[0],10) : null;
          if(ft===6){
            return openR2ToSSDefenseChoiceModal(()=>{
              // Take sure out at 1st; R2 to 3rd
              recordOut(); if(state.half!==preHalf || state.inning!==preInning){ return; }
              // default advances (we'll prefill R2->3rd)
              openRunnerAdvanceOnlyModal(kind, { defaults:{ first:0, second:1, third:0, batter:0 }, onApply: (adv, reasons, outs)=>{ applyRunnerAdvancesOnly(kind, adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); }, onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); } });
            }, (homeResult)=>{
              // Try for runner at 3rd; batter safe at 1st
              if(state.bases.third){ /* shouldn't happen in this branch */ }
              // Move batter to 1st
              state.bases.first = state.batter; state.resp.first = state.pitcher;
              // Move R2 to 3rd and possibly OUT depending on homeResult
              state.bases.third = state.bases.second; state.resp.third = state.resp.second; state.bases.second = null; state.resp.second = null;
              if(homeResult==='out'){ // runner out at 3rd
                state.bases.third = null; state.resp.third = null; recordOut(); if(state.half!==preHalf || state.inning!==preInning){ return; }
              }
              state.lastPlay = `${name} reaches first; play at third results in ${homeResult==='out'?'OUT at 3rd':'SAFE at 3rd'}`;
              // Ask further advances (include batter)
              openRunnerAdvanceOnlyModal('FC', { includeBatter:true, defaults:{ first:0, second:0, third:0, batter:0 }, onApply: (adv, reasons, outs)=>{ applyRunnerAdvancesOnly('FC', adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); }, onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); } });
            }, ()=>{
              // Cancel: default to sure out at 1st; R2 to 3rd
              recordOut(); if(state.half!==preHalf || state.inning!==preInning){ return; }
              openRunnerAdvanceOnlyModal(kind, { defaults:{ first:0, second:1, third:0, batter:0 }, onApply: (adv, reasons, outs)=>{ applyRunnerAdvancesOnly(kind, adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); }, onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); } });
            });
          }
        }
        // 3) HG with runners on 1st & 3rd: defensive choice per chart
        if(hardness && hardness.code==='HG' && state.bases.first && !state.bases.second && state.bases.third){
          return openHG_R1R3_DefenseChoiceModal(()=>{
            // (a) Get lead runner: out at 2nd and batter out at 1st; runner on 3rd scores
            // Remove R1 (force at 2nd)
            if(state.bases.first){ state.bases.first=null; state.resp.first=null; recordOut(); if(state.half!==preHalf || state.inning!==preInning){ return; } }
            // Batter out at 1st
            recordOut(); if(state.half!==preHalf || state.inning!==preInning){ return; }
            // Score R3
            if(state.bases.third){ const nm=state.bases.third; const rp=state.resp.third||state.pitcher; state.bases.third=null; state.resp.third=null; scoreRuns(1); addRun(nm); try{ if(rp){ ensurePitcherEntry(rp); state.stats.pitching[rp].R+=1; if(!state.erSuppress) state.stats.pitching[rp].ER+=1; } }catch(_){ } }
            state.lastPlay = `${name} grounds into two; lead runner erased; run scores`;
            nextBatter(); concludeResultAndReroll();
          }, ()=>{
            // (b) Take out at 1st; R3 holds; R1 to 2nd
            recordOut(); if(state.half!==preHalf || state.inning!==preInning){ return; }
            // Move R1->2nd if open
            if(!state.bases.second && state.bases.first){ state.bases.second=state.bases.first; state.resp.second=state.resp.first; state.bases.first=null; state.resp.first=null; }
            state.lastPlay = `${name} out at first; runners hold/advance (R1 to 2nd)`;
            // Ask further advances with conservative defaults
            const defaults = defaultAdvancesAfterOut(kind, sequence, hardness);
            openRunnerAdvanceOnlyModal(kind, { defaults, onApply:(adv,r, outs)=>{ applyRunnerAdvancesOnly(kind, adv, r||{}, outs||[]); nextBatter(); concludeResultAndReroll(); }, onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); } });
          }, ()=>{
            // Cancel defaults to option (b): take the out at 1st; R3 holds; R1 to 2nd
            recordOut(); if(state.half!==preHalf || state.inning!==preInning){ return; }
            if(!state.bases.second && state.bases.first){ state.bases.second=state.bases.first; state.resp.second=state.resp.first; state.bases.first=null; state.resp.first=null; }
            state.lastPlay = `${name} out at first; runners hold/advance (R1 to 2nd)`;
            const defaults = defaultAdvancesAfterOut(kind, sequence, hardness);
            openRunnerAdvanceOnlyModal(kind, { defaults, onApply:(adv,r, outs)=>{ applyRunnerAdvancesOnly(kind, adv, r||{}, outs||[]); nextBatter(); concludeResultAndReroll(); }, onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); } });
          });
        }
        break;
      }
      case 'FO': {
        addPA(name); addAB(name);
        try{ addFB(name); const p=state.pitcher; if(p) addP_FB(p); }catch(_){ }
        state.lastPlay = `${name} flies out${formatSeq(sequence)}`;
        // Ball to outfielder indicated
        try{
          const path = [ baseCoords.home ];
          if(sequence && sequence.length){ path.push(numToCoords(sequence[0])); }
          animateBallPath(path);
        }catch(_){ }
        break;
      }
      case 'LO': {
        addPA(name); addAB(name);
        try{ addFB(name); const p=state.pitcher; if(p) addP_FB(p); }catch(_){ }
        state.lastPlay = `${name} lines out${formatSeq(sequence)}`;
        try{
          const path = [ baseCoords.home ];
          if(sequence && sequence.length){ path.push(numToCoords(sequence[0])); }
          animateBallPath(path);
        }catch(_){ }
        break;
      }
  case 'SF': {
        // sac fly: no AB, 1 RBI if runner on third scores; advance forced runners 1 base if applicable
        // Simple model: if runner on 3rd, they score
    addPA(name); addSF(name);
    try{ addFB(name); const p=state.pitcher; if(p) addP_SF(p); }catch(_){ }
  if(state.bases.third){ const runner=state.bases.third; scoreRuns(1); addRBI(name,1); addRun(runner); try{ const rp = state.resp.third || state.pitcher; if(rp){ ensurePitcherEntry(rp); state.stats.pitching[rp].R += 1; if(!state.erSuppress) state.stats.pitching[rp].ER += 1; } }catch(_){ } state.bases.third = null; state.resp.third = null; }
        state.lastPlay = `${name} sac fly${formatSeq(sequence)}`;
        outsAdded = 1; // still one out
        // Ball to outfielder indicated
        try{
          const path = [ baseCoords.home ];
          if(sequence && sequence.length){ path.push(numToCoords(sequence[0])); }
          animateBallPath(path);
        }catch(_){ }
        break;
      }
      case 'DP': {
        // Double play: two outs; remove runner on first if present; batter out
        outsAdded = 2;
        if(state.bases.first){ state.bases.first = null; }
        addPA(name); addAB(name); addGIDP(name);
        try{ addGB(name); const p=state.pitcher; if(p) addP_GB(p); }catch(_){ }
        state.lastPlay = `${name} grounds into double play${formatSeq(sequence)}`;
        // Ball to first fielder in sequence
        try{
          const path = [ baseCoords.home ];
          if(sequence && sequence.length){ path.push(numToCoords(sequence[0])); }
          animateBallPath(path);
        }catch(_){ }
        break;
      }
      default: return;
    }
    // Apply outs (credit pitcher via recordOut)
    for(let i=0;i<outsAdded;i++){
      recordOut();
      if(state.half!==preHalf || state.inning!==preInning){ return; }
    }
    // After out is recorded and inning not ended
    // For strikeouts, do not prompt runner movement
    if(kind==='K'){
  nextBatter(); concludeResultAndReroll(); return;
    }
    // For other outs, ask for runner advances
    {
      const defaults = defaultAdvancesAfterOut(kind, sequence, hardness);
      const m = openRunnerAdvanceOnlyModal(kind, {
        defaults,
        onApply: (adv, reasons, outs)=>{ applyRunnerAdvancesOnly(kind, adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); },
        onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); }
      });
      if(!m){ nextBatter(); concludeResultAndReroll(); }
    }
  }

  function formatSeq(sequence){
    if(!sequence || !sequence.length) return '';
    const nums = sequence.map(n=> typeof n==='number'? n : parseInt(n,10)).filter(Boolean);
    if(!nums.length) return '';
    if(nums.length===1){ return ` to ${numLabel[nums[0]]} (${nums[0]})`; }
    return ' ' + nums.join('-');
  }

  function openDefenseSequenceModal(kind, onApply){
    const modal = document.createElement('div');
    Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:'1002' });
    const content = document.createElement('div');
    Object.assign(content.style, { background:'rgba(255,255,255,0.22)', border:'2px solid #fff', borderRadius:'20px', backdropFilter:'blur(8px)', padding:'20px', minWidth:'380px', color:'#fff', boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44' });
    const gridNums = [7,8,9,5,6,4,3,1,2];
  const presets = (kind==='DP') ? [[6,4,3],[4,6,3],[5,4,3]] : (kind==='GO' ? [[6,3],[4,3],[5,3]] : ((kind==='FO'||kind==='SF'||kind==='LO') ? [[7],[8],[9]] : []));
    let seq = [];
    function render(){
      content.innerHTML = `
  <h3 style="margin:0 0 8px;">Select ${kind==='DP'?'double play':''}${kind==='GO'?' groundout':''}${(kind==='FO'?' flyout':'')}${(kind==='LO'?' lineout':'')}${kind==='SF'?' sac fly':''} sequence</h3>
        ${presets.length?`<div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;">${presets.map(p=>`<button data-pre="${p.join(',')}" style=\"padding:6px 8px;border:none;border-radius:10px;background:#446;color:#fff;\">${p.join('-')}</button>`).join('')}</div>`:''}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">${gridNums.map(n=>`<button data-num="${n}" style=\"padding:10px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;\">${numLabel[n]}</button>`).join('')}</div>
        <div style="margin-top:10px;">Sequence: <strong>${seq.join('-')||'—'}</strong></div>
        <div style="margin-top:10px;display:flex;justify-content:flex-end;gap:8px;">
          <button id="clear-seq" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;">Clear</button>
          <button id="cancel-def" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;">Cancel</button>
          <button id="apply-def" style="padding:8px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;">Apply</button>
        </div>
      `;
  content.querySelectorAll('button[data-num]').forEach(b=> b.addEventListener('click',()=>{ const n=parseInt(b.getAttribute('data-num'),10); if(kind==='FO'||kind==='SF'||kind==='LO'){ seq=[n]; } else { seq.push(n); } render(); }));
      content.querySelectorAll('button[data-pre]').forEach(b=> b.addEventListener('click',()=>{ seq = b.getAttribute('data-pre').split(',').map(x=>parseInt(x,10)); render(); }));
      content.querySelector('#clear-seq').addEventListener('click',()=>{ seq=[]; render(); });
      content.querySelector('#cancel-def').addEventListener('click',()=>{ close(); });
      content.querySelector('#apply-def').addEventListener('click',()=>{ const picked = seq.slice(); close(); onApply && onApply(picked); });
    }
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.appendChild(content); document.body.appendChild(modal);
    render();
  }
  function openR3ChoiceModal(code, sequence, onContinue){
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1004'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'16px',backdropFilter:'blur(8px)',padding:'16px',minWidth:'420px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
    content.innerHTML = `
      <h3 style="margin:0 0 8px;">Runner on 3rd — ${code}</h3>
      <div style="margin-bottom:8px;opacity:.9;">Defense choice:</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="r3-sure1st" style="padding:8px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">Take out at 1st (run scores)</button>
        <button id="r3-home" style="padding:8px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">Throw home (batter safe at 1st)</button>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="r3-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    content.querySelector('#r3-sure1st').addEventListener('click',()=>{
      // Batter out at 1st; R3 scores
      recordOut();
      const nm = state.bases.third; const rp = state.resp.third||state.pitcher; state.bases.third=null; state.resp.third=null; scoreRuns(1); if(nm) addRun(nm);
      try{ if(rp){ ensurePitcherEntry(rp); state.stats.pitching[rp].R+=1; if(!state.erSuppress) state.stats.pitching[rp].ER+=1; } }catch(_){ }
      state.lastPlay = `${state.batter} out at first; run scores`;
      close(); onContinue && onContinue(true);
    });
    content.querySelector('#r3-home').addEventListener('click',()=>{
      // Try for home: batter safe at 1st
      state.bases.first = state.batter; state.resp.first = state.pitcher;
      state.lastPlay = `${state.batter} safe at first on throw home (call at plate pending manual)`;
      close();
  // Ask runner advances including batter; if no runners, proceed immediately
  { const m = openRunnerAdvanceOnlyModal('FC', { includeBatter:true, defaults:{ first:0, second:0, third:0, batter:0 }, onApply:(adv,r, outs)=>{ applyRunnerAdvancesOnly('FC', adv, r||{}, outs||[]); nextBatter(); concludeResultAndReroll(); }, onCancel:()=>{ nextBatter(); concludeResultAndReroll(); } }); if(!m){ nextBatter(); concludeResultAndReroll(); } }
    });
    content.querySelector('#r3-cancel').addEventListener('click',()=>{ close(); onContinue && onContinue(false); });
    return modal;
  }

  function openR2ToSSDefenseChoiceModal(onSure1st, onPlayAt3rd, onCancel){
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1004'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'16px',backdropFilter:'blur(8px)',padding:'16px',minWidth:'440px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
    content.innerHTML = `
      <h3 style="margin:0 0 8px;">Runner on 2nd — Ball to SS</h3>
      <div style="margin-bottom:8px;opacity:.9;">Defense choice:</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="r2ss-sure1st" style="padding:8px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">Easy out at 1st (R2 to 3rd)</button>
        <button id="r2ss-try3rd" style="padding:8px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">Try for runner at 3rd (batter safe at 1st)</button>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="r2ss-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    content.querySelector('#r2ss-sure1st').addEventListener('click',()=>{ close(); onSure1st && onSure1st(); });
    content.querySelector('#r2ss-try3rd').addEventListener('click',()=>{
      const sub = document.createElement('div');
      Object.assign(sub.style,{marginTop:'10px'});
      sub.innerHTML = `<div style="margin-top:8px;">
        Result at 3rd:
        <label style="margin-left:8px;"><input type="radio" name="r2ss3r" value="out" checked/> Out</label>
        <label style="margin-left:8px;"><input type="radio" name="r2ss3r" value="safe"/> Safe</label>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button id="r2ss-apply3r" style="padding:6px 10px;border:none;border-radius:8px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;">Apply</button>
        </div>
      </div>`;
      content.appendChild(sub);
      content.querySelector('#r2ss-apply3r').addEventListener('click',()=>{ const sel = content.querySelector('input[name="r2ss3r"]:checked').value; close(); onPlayAt3rd && onPlayAt3rd(sel); });
    });
    content.querySelector('#r2ss-cancel').addEventListener('click',()=>{ close(); if(onCancel) onCancel(); });
    return modal;
  }

  function openHG_R1R3_DefenseChoiceModal(onLead, onOne, onCancel){
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1004'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'16px',backdropFilter:'blur(8px)',padding:'16px',minWidth:'440px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
    content.innerHTML = `
      <h3 style="margin:0 0 8px;">HG — Runners on 1st & 3rd</h3>
      <div style="margin-bottom:8px;opacity:.9;">Defense choice:</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button id="hg13-lead" style="padding:8px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">(a) Get lead runner (1st out at 2nd, batter out at 1st)</button>
        <button id="hg13-one" style="padding:8px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">(b) Take out at 1st (R3 holds, R1 to 2nd)</button>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="hg13-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    content.querySelector('#hg13-lead').addEventListener('click',()=>{ close(); onLead && onLead(); });
    content.querySelector('#hg13-one').addEventListener('click',()=>{ close(); onOne && onOne(); });
    content.querySelector('#hg13-cancel').addEventListener('click',()=>{ close(); if(onCancel) onCancel(); });
    return modal;
  }
  function openRGFCConfirmModal(message, onYes, onNo, options){
    const modal = document.createElement('div');
    Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:'1004' });
    const content = document.createElement('div');
    Object.assign(content.style, { background:'rgba(255,255,255,0.22)', border:'2px solid #fff', borderRadius:'16px', backdropFilter:'blur(8px)', padding:'16px', minWidth:'420px', color:'#fff', boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44' });
    const allowThirdForce = !!(options && options.allowThirdForce);
    const manualHandler = options && typeof options.onManual==='function' ? options.onManual : null;
    content.innerHTML = `
      <h3 style=\"margin:0 0 8px;\">Record as Fielder's Choice?</h3>
      <div style=\"opacity:.9;margin-bottom:10px;\">${message||''}</div>
      ${allowThirdForce?`<div style=\"display:flex;gap:8px;align-items:center;margin-bottom:8px;\"><label>Force at</label>
        <label style=\"display:inline-flex;align-items:center;gap:6px;\"><input type=\"radio\" name=\"rgfc-force\" value=\"second\" checked/> 2nd</label>
        <label style=\"display:inline-flex;align-items:center;gap:6px;\"><input type=\"radio\" name=\"rgfc-force\" value=\"third\"/> 3rd</label>
      </div>`:''}
      <div style=\"display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;\">
        ${manualHandler?`<button id=\"rgfc-manual\" style=\"padding:8px 12px;border:none;border-radius:10px;background:#555;color:#fff;cursor:pointer;\" title=\"Manually choose outs/advances\">Manual</button>`:''}
        <button id=\"rgfc-no\" style=\"padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;\">No</button>
        <button id=\"rgfc-yes\" style=\"padding:8px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;\">Yes</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal) { close(); onNo && onNo(); } });
    if(manualHandler){
      const mh = content.querySelector('#rgfc-manual');
      if(mh){ mh.addEventListener('click',()=>{ close(); try{ manualHandler(); }catch(_){ } }); }
    }
    content.querySelector('#rgfc-no').addEventListener('click',()=>{ close(); onNo && onNo(); });
    content.querySelector('#rgfc-yes').addEventListener('click',()=>{ close(); let target='second'; if(allowThirdForce){ const sel = content.querySelector('input[name="rgfc-force"]:checked'); if(sel) target = sel.value; } onYes && onYes(target); });
    return modal;
  }

  function applyRoutineGrounderFCImmediate(plan, forceAt){
    // plan: { r1Out: boolean, moveR2: boolean, scoreR3: boolean }, forceAt: 'second' | 'third'
    // Remove the forced runner: default runner on 1st; if forceAt==='third', remove runner on 2nd instead
    if(forceAt==='third'){
      if(state.bases.second){ state.bases.second = null; state.resp.second = null; recordOut(); }
    } else {
      if(state.bases.first){ state.bases.first = null; state.resp.first = null; recordOut(); }
    }
    // Move runner from second to third if applicable (when force at 2nd)
    if(plan.moveR2 && state.bases.second){ state.bases.third = state.bases.second; state.resp.third = state.resp.second; state.bases.second = null; state.resp.second = null; }
    // Score runner from third if applicable
    if(plan.scoreR3 && state.bases.third){ const nm = state.bases.third; const rp = state.resp.third||state.pitcher; state.bases.third = null; state.resp.third = null; scoreRuns(1); addRun(nm); try{ if(rp){ ensurePitcherEntry(rp); state.stats.pitching[rp].R += 1; if(!state.erSuppress) state.stats.pitching[rp].ER += 1; } }catch(_){ } }
    // Batter to first
    state.bases.first = state.batter; state.resp.first = state.pitcher;
  }
  // Ground ball hardness picker (HG/RG/SG). When HG is selected, allow optional HG- flag.
  function openGrounderHardnessModal(sequence, onApply){
    const modal = document.createElement('div');
    Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:'1003' });
    const content = document.createElement('div');
    Object.assign(content.style, { background:'rgba(255,255,255,0.22)', border:'2px solid #fff', borderRadius:'16px', backdropFilter:'blur(8px)', padding:'16px', minWidth:'360px', color:'#fff', boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44' });
    let sel = 'RG'; // default Routine
    function sideText(){
      try{ const n = (sequence && sequence.length)? sequence[0] : null; if(!n) return ''; const s = (n===3||n===4)?'Right side':(n===5||n===6)?'Left side':'Middle'; return `First touch: ${numLabel[n]} — ${s}`; }catch(_){ return ''; }
    }
    function render(){
      content.innerHTML = `
        <h3 style="margin:0 0 8px;">Grounder details</h3>
        <div style="opacity:.85;margin-bottom:6px;">${sideText()}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <button data-h="HG" style="padding:8px 10px;border:none;border-radius:10px;${sel==='HG'?'background:linear-gradient(90deg,#f59e0b,#fbbf24);color:#0a0f14;':'background:#446;color:#fff;'}">Hard</button>
          <button data-h="SG" style="padding:8px 10px;border:none;border-radius:10px;${sel==='SG'?'background:linear-gradient(90deg,#34d399,#10b981);color:#0a0f14;':'background:#446;color:#fff;'}">Slow</button>
          <button data-h="RG" style="padding:8px 10px;border:none;border-radius:10px;${sel==='RG'?'background:linear-gradient(90deg,#60a5fa,#3b82f6);color:#0a0f14;':'background:#446;color:#fff;'}">Routine</button>
        </div>
        <label id="hgminus-wrap" style="display:${sel==='HG'?'inline-flex':'none'};align-items:center;gap:6px;">
          <input type="checkbox" id="hgminus" style="transform:scale(1.2);"/> HG- (minus)
        </label>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
          <button id="gh-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
          <button id="gh-apply" style="padding:8px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;">Apply</button>
        </div>`;
      content.querySelectorAll('button[data-h]').forEach(b=> b.addEventListener('click',()=>{ sel = b.getAttribute('data-h'); render(); }));
      content.querySelector('#gh-cancel').addEventListener('click',()=>{ close(); onApply && onApply({ code:'RG' }); });
      content.querySelector('#gh-apply').addEventListener('click',()=>{ const minus = (sel==='HG') ? !!content.querySelector('#hgminus').checked : false; const meta = { code: sel, minus }; close(); onApply && onApply(meta); });
    }
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.appendChild(content); document.body.appendChild(modal);
    render();
  }
  function wireButtons(){
    const inPlay=$('in-play-btn'), outBtn=$('out-btn');
  if(inPlay) inPlay.onclick=openInPlayModal;
  if(outBtn) outBtn.onclick=openOutModal;
    const box=$('box-score'); if(box) box.onclick = ()=> openBoxScoreModal();
    const undoBtn=$('undo-btn'); if(undoBtn) undoBtn.onclick = undoLast;
    const redoBtn=$('redo-btn'); if(redoBtn) redoBtn.onclick = redoLast;
    const rngBtn=$('rng-reroll'); if(rngBtn) rngBtn.onclick = rerollRng;
    const settings=$('settings-btn'); if(settings) settings.onclick = openSettingsModal;
    // Substitution handlers for fielders and pitcher card
    const posKeys = Object.keys(positions);
    posKeys.forEach(k=>{ const el = $('pos-'+k); if(el){
      el.style.cursor='pointer';
      // Left click: substitution
      el.addEventListener('click',()=> openSubModal(k));
      // Right click: show player card
      el.addEventListener('contextmenu',(e)=>{ e.preventDefault(); const name = state.fielders[k]; if(name && !isPlaceholder(name)) openPlayerCardModal(name, posAbbr[k]||k); });
    }});
    // Click any occupied base to choose action (move or pinch run)
    ['first','second','third'].forEach(base=>{
      const el = $('base-'+base); if(!el) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click',()=>{ if(state.bases[base]) openRunnerActionModal(base); });
    });
    // Click batter icon to pinch hit
    const bh = $('base-home'); if(bh){
      bh.style.cursor = 'pointer';
      bh.addEventListener('click',()=>{ if(state.batter) openPinchHitModal(); });
    }
    const pc=$('pitcher-card'); if(pc){ pc.style.cursor='pointer'; pc.addEventListener('click',()=> openSubModal('pitcher')); }
  }

  // Helper: single place to end a plate appearance/play and then re-roll RNG for the next one
  function concludeResultAndReroll(){
    updateAll();
    try{ clearRngAndGlow(); }catch(_){ }
    try{ prepareRngAndGlow(); }catch(_){ }
  }

  // Open a quick modal to move exactly one existing runner from a specific base
  function openSingleRunnerMove(from){
    const runner = state.bases[from]; if(!runner) return;
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1001'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'20px',backdropFilter:'blur(8px)',padding:'20px',minWidth:'420px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
    function destChoices(src){
      switch(src){
        case 'third': return [{v:'third',t:'Stay'}, {v:'home',t:'Home'}];
        case 'second': return [{v:'second',t:'Stay'}, {v:'third',t:'Third'}, {v:'home',t:'Home'}];
        case 'first': return [{v:'first',t:'Stay'}, {v:'second',t:'Second'}, {v:'third',t:'Third'}, {v:'home',t:'Home'}];
        default: return [{v:src,t:'Stay'}];
      }
    }
    const reasonOpts = [ {v:'batter', t:'Advanced by batter'}, {v:'held', t:'Held up'}, {v:'error', t:'Error'} ];
    const fielderOptions = (()=>{
      const opts=[]; const keys=['pitcher','catcher','first','second','third','short','left','center','right'];
      keys.forEach(k=>{ const name=state.fielders[k]||''; const num = posNum[k]; const label = `${(posAbbr[k]||k).toUpperCase()} (${num||''})${name&&!isPlaceholder(name)?' — '+name:''}`; opts.push({value:k,label}); });
      return opts;
    })();
    const destOpt = destChoices(from).map(o=>`<option value="${o.v}">${o.t}</option>`).join('');
    const reasonOpt = reasonOpts.map(o=>`<option value="${o.v}">${o.t}</option>`).join('');
    const fOpt = fielderOptions.map(o=>`<option value="${o.value}">${o.label}</option>`).join('');
    content.innerHTML = `
      <h3 style="margin:0 0 8px;">Move Runner — ${from.toUpperCase()}: ${runner}</h3>
      <div style="display:grid;gap:8px;background:rgba(0,0,0,.25);padding:8px 10px;border-radius:10px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <label>Destination <select id="sr-dest" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);color:#fff;">${destOpt}</select></label>
          <label>Reason <select id="sr-reason" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);color:#fff;">${reasonOpt}</select></label>
          <label id="sr-errwrap" style="display:none;">Fielder <select id="sr-errfld" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);color:#fff;">${fOpt}</select></label>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        <button id="sr-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
        <button id="sr-apply" style="padding:8px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;">Apply</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
    const wrap = content.querySelector('#sr-errwrap');
    const reasonSel = content.querySelector('#sr-reason');
    if(reasonSel){ reasonSel.addEventListener('change',()=>{ wrap.style.display = (reasonSel.value==='error') ? 'inline-block' : 'none'; }); }
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='sr-cancel'){ if(modal.parentNode) modal.parentNode.removeChild(modal); } });
    content.querySelector('#sr-apply').addEventListener('click',()=>{
  if(reasonSel && reasonSel.value==='error'){ const fldSel = content.querySelector('#sr-errfld'); if(!fldSel || !fldSel.value){ showToast('Select the fielder for the error.'); return; } }
      const order=['home','first','second','third','home'];
      const dest = content.querySelector('#sr-dest').value;
      const si = order.indexOf(from);
      const di = dest==='home' ? order.lastIndexOf('home') : order.indexOf(dest);
      let steps = 0; if(si>=0 && di>=0){ steps = di - si; if(steps<0) steps=0; }
      const adv = { first:0, second:0, third:0, batter:0 };
      adv[from] = steps;
      const reasons = {};
      const rname = runner; const rsel = reasonSel ? reasonSel.value : 'held';
      if(rsel==='error'){ const fld = content.querySelector('#sr-errfld').value; reasons[rname] = { cause:'error', fielder: fld }; }
      // Apply movement without affecting PA/AB
      applyRunnerAdvancesOnly('MANUAL', adv, reasons);
      if(modal.parentNode) modal.parentNode.removeChild(modal);
      updateAll();
    });
  }

  function openRunnerActionModal(base){
    const runner = state.bases[base]; if(!runner) return;
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1001'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'16px',backdropFilter:'blur(8px)',padding:'16px',minWidth:'320px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
    content.innerHTML = `
      <h3 style="margin:0 0 10px;">Runner — ${base.toUpperCase()}: ${runner}</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button id="ra-move" style="padding:10px 14px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;">Move Runner</button>
        <button id="ra-pr" style="padding:10px 14px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">Pinch Run</button>
        <button id="ra-cancel" style="margin-left:auto;padding:10px 14px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='ra-cancel') close(); });
    content.querySelector('#ra-move').addEventListener('click',()=>{ close(); openSingleRunnerMove(base); });
    content.querySelector('#ra-pr').addEventListener('click',()=>{ close(); openPinchRunModal(base); });
  }

  function benchCandidates(teamKey, excludeNames){
    try{
      const all = rosterList(teamKey).filter(p=> !p.pos.includes('P')).map(p=>p.name);
      const lineup = (state.lineups[teamKey===state.home?'home':'away']||[]);
      const inUse = new Set([...(lineup||[]), ...(excludeNames||[]), state.batter||'', state.bases.first||'', state.bases.second||'', state.bases.third||''].filter(Boolean));
      const uniq = Array.from(new Set(all));
      return uniq.filter(n=> !inUse.has(n));
    }catch(_){ return []; }
  }

  function openPinchHitModal(){
    const teamKey = battingTeamKey();
    const side = (state.half==='top') ? 'away' : 'home';
    const idx = state.battingIndex[side] || 0;
    const current = state.batter;
    const bench = benchCandidates(teamKey, [current]);
  if(!bench.length){ showToast('No bench hitters available to pinch hit.'); return; }
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1005'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'18px',backdropFilter:'blur(8px)',padding:'18px',minWidth:'360px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
    const opts = bench.map(n=> `<option value="${n}">${n}</option>`).join('');
    content.innerHTML = `
      <h3 style="margin:0 0 8px;">Pinch Hit for ${current}</h3>
      <div style="display:grid;gap:8px;">
        <label>New batter <select id="ph-sel" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);color:#fff;">${opts}</select></label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        <button id="ph-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
        <button id="ph-apply" style="padding:8px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;">Apply</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='ph-cancel') close(); });
    content.querySelector('#ph-apply').addEventListener('click',()=>{
      const sel = content.querySelector('#ph-sel'); const name = sel && sel.value; if(!name){ close(); return; }
      const lineup = state.lineups[side] || [];
      if(idx>=0 && idx<lineup.length){ lineup[idx] = name; state.lineups[side] = lineup; state.batter = name; }
      close(); updateAll();
    });
  }

  function openPinchRunModal(base){
    const teamKey = battingTeamKey();
    const side = (state.half==='top') ? 'away' : 'home';
  const runner = state.bases[base]; if(!runner){ showToast('No runner on base.'); return; }
    const lineup = state.lineups[side] || [];
    const idx = lineup.indexOf(runner);
  if(idx < 0){ showToast('Runner not found in lineup; cannot pinch run.'); return; }
    const bench = benchCandidates(teamKey, [runner]);
  if(!bench.length){ showToast('No bench players available to pinch run.'); return; }
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1005'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'18px',backdropFilter:'blur(8px)',padding:'18px',minWidth:'360px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
    const opts = bench.map(n=> `<option value="${n}">${n}</option>`).join('');
    content.innerHTML = `
      <h3 style="margin:0 0 8px;">Pinch Run for ${runner} (${base.toUpperCase()})</h3>
      <div style="display:grid;gap:8px;">
        <label>New runner <select id="pr-sel" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);color:#fff;">${opts}</select></label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        <button id="pr-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
        <button id="pr-apply" style="padding:8px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;">Apply</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='pr-cancel') close(); });
    content.querySelector('#pr-apply').addEventListener('click',()=>{
      const sel = content.querySelector('#pr-sel'); const name = sel && sel.value; if(!name){ close(); return; }
      // Replace in lineup and on base
      lineup[idx] = name; state.lineups[side] = lineup;
      state.bases[base] = name; // keep same resp pitcher
      // Clear any error-reached flag for the old runner in fairness
      try{ if(state.reachedByError && state.reachedByError[runner]) delete state.reachedByError[runner]; }catch(_){ }
      close(); updateAll();
    });
  }

  function openPlayerCardModal(name, label){
    if(!name) return;
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1120'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'20px',backdropFilter:'blur(8px)',padding:'16px',minWidth:'320px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
  const url = resolvePlayerCardImage(name, (label && label.toLowerCase()==='pitcher') ? 'pitcher':'batter');
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;">
        <h3 style="margin:0;">${label?label+': ':''}${name}</h3>
        <button id="pcard-close" style="padding:6px 10px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Close</button>
      </div>
  ${url ? `<img src="${url}" alt="${name}" style="width:100%;max-width:380px;height:auto;object-fit:contain;border-radius:12px;" onerror="(function(img){ const orig=img.src; if(orig.indexOf('uncarded-')>-1){ img.onerror=null; img.style.display='none'; return;} if(orig.endsWith('.png') && orig.indexOf('uncarded-')===-1){ img.onerror=null; img.src='Player-cards/'+slugify('${name.replace(/"/g,'&quot;')}')+'.jpg'; } else { img.onerror=null; img.src=fallbackCardImage('${name.replace(/"/g,'&quot;')}', (label && label.toLowerCase()==='pitcher') ? 'pitcher':'batter'); } })(this);"/>` : `<div style="padding:20px;text-align:center;">No card image found.</div>`}
    `;
    modal.appendChild(content); document.body.appendChild(modal);
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='pcard-close'){ modal.remove(); } });
  }

  function updateAll(){ setScoreboard();
    positionElements(); renderCards(); repositionFloatingCards(); updateStatsDisplay(); updateAvatars();
    // Reflect pending RNG in the UI if present
    try{
      const rngEl = document.getElementById('rng-display');
      if(rngEl){
        if(typeof state.pendingRng === 'number'){
          rngEl.textContent = String(state.pendingRng).padStart(3,'0');
        } else {
          rngEl.textContent = '—';
        }
      }
    }catch(_){ }
  }

  // RNG: generate and show a 0-999 value and glow the corresponding card until the play concludes
  function prepareRngAndGlow(){
    try{
      if(typeof state.pendingRng !== 'number'){
        state.pendingRng = Math.floor(Math.random()*1000);
        const rngEl = document.getElementById('rng-display'); if(rngEl) rngEl.textContent = String(state.pendingRng).padStart(3,'0');
        const bc = document.getElementById('batter-card');
        const pc = document.getElementById('pitcher-card');
        if(state.pendingRng <= 499){
          if(bc) bc.classList.add('glow-batter');
          if(pc) pc.classList.remove('glow-pitcher');
        } else {
          if(pc) pc.classList.add('glow-pitcher');
          if(bc) bc.classList.remove('glow-batter');
        }
      }
    }catch(_){ }
  }

  function clearRngAndGlow(){
    try{
      const bc = document.getElementById('batter-card');
      const pc = document.getElementById('pitcher-card');
      if(bc) bc.classList.remove('glow-batter');
      if(pc) pc.classList.remove('glow-pitcher');
      const rngEl = document.getElementById('rng-display'); if(rngEl) rngEl.textContent = '—';
      delete state.pendingRng;
    }catch(_){ }
  }

  // Manual RNG re-roll on demand without changing state otherwise
  function rerollRng(){
    try{ clearRngAndGlow(); }catch(_){ }
    try{ prepareRngAndGlow(); }catch(_){ }
  }

  // Attach UI buttons if present after init
  function wireExtraButtons(){
    try{
      const boxBtn = document.getElementById('boxscore-btn');
      if(boxBtn && !boxBtn._wired){ boxBtn._wired=true; boxBtn.addEventListener('click', ()=> openBoxScoreModal()); }
    }catch(_){ }
  }

  // Mini box score under the scoreboard
  // mini box score removed

  function openGameLogModal(){
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1210'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(20,28,40,0.95)',border:'2px solid #00eaff',borderRadius:'16px',padding:'16px',color:'#fff',maxWidth:'80vw',maxHeight:'80vh',overflow:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.35)'});
    const rows = (state.gameLog||[]).map((e,i)=>{
      const arrow = e.half==='top'?'▲':'▼';
      const rngTxt = (typeof e.rng === 'number') ? ` (RNG: ${String(e.rng).padStart(3,'0')})` : '';
      return `<div style=\"padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.08);\">${i+1}. ${arrow}${e.inning}: ${e.desc}${rngTxt}</div>`;
    }).join('');
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <h2 style="margin:0;">Game Log</h2>
        <button id="gl-close" style="padding:6px 10px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Close</button>
      </div>
      <div style="margin-top:8px;display:grid;gap:4px;">${rows || '<div style="opacity:.8;">No plays yet.</div>'}</div>
    `;
    modal.appendChild(content); document.body.appendChild(modal);
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='gl-close') modal.remove(); });
  }

  function updateAvatars(){
    try{
      const key = (state.half==='top') ? 'away' : 'home';
      const lineup = Array.isArray(state.lineups[key]) ? state.lineups[key] : [];
      const idx = (state.battingIndex && typeof state.battingIndex[key]==='number') ? state.battingIndex[key] : 0;
      const onDeck = (lineup.length>0) ? lineup[(idx+1) % lineup.length] : '';
      const od = document.getElementById('on-deck');
      if(od){
        if(onDeck){
          const url = photoUrl(onDeck) || (onDeck? `Player-photos/${slugify(onDeck)}.png` : '');
          if(url){ od.style.backgroundImage = `url('${url}')`; od.textContent=''; } else { od.style.backgroundImage='none'; od.textContent = initials(onDeck||''); }
          od.title = `On Deck: ${onDeck}`;
        } else {
          od.style.backgroundImage='none'; od.textContent=''; od.title = 'On Deck';
        }
      }
      // in-the-hole element removed per new UI; no update needed
    }catch(_){ }
  }

  // --- Substitutions ---
  function openSubModal(posKey){
    // Enforce 3 BF minimum for pitcher unless the change is between innings
    if(posKey==='pitcher'){
      try{
        const stint = state.pitcherStint || { name: state.pitcher, inning: state.inning, half: state.half, bf: 0, priorHalfComplete:false };
        const faced = (stint && stint.name===state.pitcher) ? (stint.bf||0) : 0;
        const crossInningException = !!(stint && stint.priorHalfComplete);
        const started = faced > 0; // Only enforce once the pitcher has faced someone this stint
        if(started && faced < 3 && !crossInningException){
          showToast('Pitcher must face at least 3 batters before a mid-inning substitution. You can change at the end of the half-inning.');
          return;
        }
      }catch(_){ }
    }
    const fieldTeam = fieldingTeamKey();
    const code = posCode[posKey];
  if(!code){ showToast('Unknown position: '+posKey); return; }
    // For pitcher substitutions, only allow relievers (RP) or legacy generic P; exclude SP-only
    let roster = [];
    if(posKey==='pitcher'){
      const list = rosterList(fieldTeam);
      const isSP = (p)=> Array.isArray(p.pos) && p.pos.includes('SP');
      const isLegacyP = (p)=> Array.isArray(p.pos) && p.pos.includes('P');
      const isRP = (p)=> Array.isArray(p.pos) && p.pos.includes('RP');
      // Relief eligibility: RP or legacy P; exclude SP-only
      const elig = list.filter(p=> isRP(p) || isLegacyP(p));
      const key = (p)=> (isSP(p)&&isRP(p))?'SP/RP': (isSP(p)?'SP':'') || (isLegacyP(p)?'P':'') || (isRP(p)?'RP':'');
      // Sort for nicer display: SP/RP first, then RP, then P
      const rankType = (p)=> key(p)==='SP/RP'?0 : (isRP(p)?1:2);
      const rankRole = (p)=>{
        const order = ['Long Relief','Specialist','Middle Relief','Setup','Closer'];
        const r = p.role || '';
        const idx = order.indexOf(r);
        return idx>=0? idx : order.length;
      };
      roster = elig.slice().sort((a,b)=> rankType(a)-rankType(b) || rankRole(a)-rankRole(b) || a.name.localeCompare(b.name));
    } else {
      roster = rosterList(fieldTeam).filter(p=> p.pos.includes(code));
    }
  if(!roster.length){ showToast('No eligible players found for '+code+'.'); return; }

    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1100'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'20px',backdropFilter:'blur(8px)',padding:'20px',minWidth:'360px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
    const current = state.fielders[posKey] || '';
    const assigned = invertAssignments(state.fielders);
    // Build per-pitcher prior BF/IP from their last appearance in the current Pennant Race (if active)
    let pennantStats = {};
    try{
      const tournRaw = localStorage.getItem('ibl.pennant');
      const ctxRaw = localStorage.getItem('ibl.pennant.context');
      if(tournRaw && ctxRaw){
        const tourn = JSON.parse(tournRaw), ctx = JSON.parse(ctxRaw);
        if(tourn && ctx && ctx.mode==='pennant' && tourn.id===ctx.id){
          // Track the most recent game each pitcher appeared in for this tournament
          const gamesRaw = localStorage.getItem('ibl.savedGames');
          if(gamesRaw){
            const list = (JSON.parse(gamesRaw)||[]).filter(g=> g && g.pennant && g.pennant.id===tourn.id);
            list.forEach(g=>{
              const when = new Date(g.finalizedAt || g.savedAt || 0).getTime();
              const pit = (g.stats && g.stats.pitching) || {};
              Object.entries(pit).forEach(([name,st])=>{
                const cur = pennantStats[name];
                if(!cur || when > (cur.when||0)){
                  pennantStats[name] = { BF: Number(st.BF||0), Outs: Number(st.Outs||0), when };
                }
              });
            });
          }
        }
      }
    }catch(_){ pennantStats = {}; }
    const options = roster.map(p=>{
      const at = assigned[p.name];
      const extra = at && at!==posKey ? ` (currently ${posAbbr[at]||at})` : '';
      let hand = '';
      const typeTag = (function(){
        const pos = p.pos||[]; const hasSP = pos.includes('SP'); const hasRP = pos.includes('RP'); const hasP = pos.includes('P');
        if(hasSP && hasRP) return 'SP/RP';
        if(hasSP) return 'SP';
        if(hasRP) return 'RP';
        if(hasP) return 'P';
        return '';
      })();
      const roleTag = p.role ? ` — ${p.role}` : '';
      if(posKey==='pitcher'){
        const t = (p.throws||'').toUpperCase();
        const prior = pennantStats[p.name];
        const ip = prior ? (()=>{ const outs=Number(prior.Outs||0); const ipW=Math.floor(outs/3); const rem=outs%3; return `${ipW}${rem?'.'+rem:''}`; })() : null;
        const bf = prior ? Number(prior.BF||0) : null;
        const suffix = (bf!=null || ip!=null) ? ` (${bf||0} BF, ${ip||'0'})` : '';
        hand = t==='R' ? ` (RHP)${suffix}` : t==='L' ? ` (LHP)${suffix}` : (t ? ` (${t})${suffix}` : `${suffix}`);
      }
      return `<option value="${p.name}" ${p.name===current?'selected':''}>${p.name}${typeTag?` [${typeTag}]`:''}${roleTag}${hand}${extra}</option>`;
    }).join('');
    content.innerHTML = `
      <h3 style="margin:0 0 8px;">Substitute at ${posAbbr[posKey]||posKey}</h3>
      <div style="display:grid;gap:8px;">
        <label>Choose player</label>
        <select id="sub-player" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);color:#fff;">${options}</select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        <button id="sub-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
        <button id="sub-apply" style="padding:8px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;">Apply</button>
      </div>
    `;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='sub-cancel') close(); });
    content.querySelector('#sub-apply').addEventListener('click',()=>{
      const sel = content.querySelector('#sub-player');
      const name = sel && sel.value; if(!name){ close(); return; }
      applySubstitution(fieldTeam, posKey, name);
      close();
    });
  }

  function invertAssignments(map){ const inv={}; Object.entries(map||{}).forEach(([k,v])=>{ if(v) inv[v]=k; }); return inv; }
  function applySubstitution(teamKey, posKey, playerName){
    // Current assignments
    const current = Object.assign({}, state.fielders);
    // Disallow pitcher re-entry: if a pitcher has already appeared and is not the current pitcher, block
    if(posKey==='pitcher'){
      const sideKey = (teamKey===state.home) ? 'home' : 'away';
      const used = ((state._pitchersUsedByTeam||{})[sideKey]) || [];
      if(used.includes(playerName) && playerName !== state.pitcher){
  showToast('Pitcher cannot re-enter once removed.');
        return;
      }
    }
    const where = invertAssignments(current)[playerName];
    if(where && where!==posKey){
      // Swap
      const tmp = current[posKey];
      current[posKey] = playerName;
      current[where] = tmp || '';
    } else {
      // Simple assign, remove duplicate elsewhere if any
      Object.keys(current).forEach(k=>{ if(current[k]===playerName) current[k]=''; });
      current[posKey] = playerName;
    }
    // Normalize empties to labels
    Object.keys(current).forEach(k=>{ if(!current[k]) current[k] = k==='pitcher'?'Pitcher':(posAbbr[k]||k).toUpperCase(); });
    state.fielders = current;
    if(posKey==='pitcher'){
      // Enforce 3 BF minimum again as a safety (in case of direct calls)
      try{
        const stint = state.pitcherStint || { name: state.pitcher, inning: state.inning, half: state.half, bf: 0, priorHalfComplete:false };
        const faced = (stint && stint.name===state.pitcher) ? (stint.bf||0) : 0;
        const crossInningException = !!(stint && stint.priorHalfComplete);
        const started = faced > 0;
  if(started && faced < 3 && !crossInningException){ showToast('Pitcher must face at least 3 batters before a mid-inning substitution. You can change at the end of the half-inning.'); return; }
      }catch(_){ }
      state.pitcher = playerName;
      // Reset pitcher stint for the new pitcher (new stint)
      try{
        state.pitcherStint = { name: state.pitcher, inning: state.inning, half: state.half, bf: 0, priorHalfComplete:false };
        // Cache this stint by team for cross-inning persistence
        const sideKey = (teamKey===state.home) ? 'home' : 'away';
        state._stintByTeam = state._stintByTeam || { home:null, away:null };
        state._stintByTeam[sideKey] = Object.assign({}, state.pitcherStint);
      }catch(_){ }
      // Record appearance and lead snapshot
      try{ const fieldTeam = fieldingTeamKey(); recordPitcherAppearance(fieldTeam, state.pitcher); }catch(_){ }
    }
    persistInGameDefense(teamKey, current);
    updateAll();
  }

  function persistInGameDefense(teamKey, assignments){
    try{
      const raw = localStorage.getItem('ibl.inGameDefense');
      const data = raw ? JSON.parse(raw) : {};
      // Store only real player names, skip placeholders
      const clean = {}; Object.entries(assignments||{}).forEach(([k,v])=>{ if(v && !isPlaceholder(v)) clean[k]=v; });
      data[teamKey] = clean;
      localStorage.setItem('ibl.inGameDefense', JSON.stringify(data));
    }catch(_){}
  }
  function loadInGameDefense(teamKey){
    try{
      const raw = localStorage.getItem('ibl.inGameDefense');
      const data = raw ? JSON.parse(raw) : {};
      return (data && data[teamKey]) || null;
    }catch(_){ return null; }
  }

  function recordOut(){
    state.outs += 1;
    try{ const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].Outs += 1; } }catch(_){ }
    if(state.outs >= 3){
      changeHalfInning(); // calls updateAll()
    } else {
      // Show the out immediately even before runner-advance prompts
      try{ updateAll(); }catch(_){ }
    }
  }

  function changeHalfInning(){
    if(state.gameOver) return;
    // Before clearing bases and flipping sides, store last batter for the team that just batted
    try{
      const justBattedSide = (state.half==='top') ? 'away' : 'home';
      state.lastBatterByTeam[justBattedSide] = state.batter || state.lastBatterByTeam[justBattedSide] || null;
    }catch(_){ }
    // Track which pitcher finished the half for the fielding team (for 3-BF cross-inning exception)
    try{
      const fieldTeam = fieldingTeamKey();
      state._lastFieldingPitcherByTeam = state._lastFieldingPitcherByTeam || {};
      state._lastFieldingPitcherByTeam[fieldTeam] = state.pitcher || null;
    }catch(_){ }
    // Record lead change at end of half if applicable
    try{
      const h = state.score[state.home]||0; const a = state.score[state.away]||0;
      const prevHalf = state.half; const prevInning = state.inning;
      const lead = h===a? 'tied' : (h>a? state.home : state.away);
      state._lastLead = state._lastLead || null;
      if(lead!==state._lastLead){
        state.keyPlays = state.keyPlays || [];
        state.keyPlays.push({ ts: Date.now(), inning: prevInning, half: prevHalf, type:'lead-change', team: lead, h, a, desc: (lead==='tied'? `Game tied ${a}-${h}` : `${lead} take the lead ${a}-${h}`) });
        state._lastLead = lead;
      }
    }catch(_){ }
    // Clear bases
    state.bases = {first:null, second:null, third:null};
    state.resp = {first:null, second:null, third:null};
    state.erSuppress = false;
  state.reachedByError = {};
    // Reset outs for new half
    state.outs = 0;
    // Cache current pitching stint for the fielding team before flipping sides
    try{
      const fieldTeam = fieldingTeamKey();
      const sideKey = (fieldTeam===state.home) ? 'home' : 'away';
      state._stintByTeam = state._stintByTeam || { home:null, away:null };
      if(state.pitcherStint && state.pitcherStint.name){
        state._stintByTeam[sideKey] = Object.assign({}, state.pitcherStint);
      }
    }catch(_){ }
    // Before flipping sides, advance the batting order for the team that just batted
    try{
      const justBattedSide = (state.half==='top') ? 'away' : 'home';
      const lineup = state.lineups[justBattedSide] || [];
      if(lineup.length){ state.battingIndex[justBattedSide] = (state.battingIndex[justBattedSide] + 1) % lineup.length; }
    }catch(_){ }
    // Flip half and possibly inning, enforcing end-game rules
    if(state.half==='top'){
      // After top half ends
      // If it's the 9th or later and the home team already leads, skip bottom and end game
      if(state.inning>=9 && (state.score[state.home]||0) > (state.score[state.away]||0)){
        endGame(state.home);
        return;
      }
      state.half='bottom';
    } else {
      // After bottom half ends
      // If 9th or later and someone leads, game over
      if(state.inning>=9 && (state.score[state.home]||0) !== (state.score[state.away]||0)){
        endGame((state.score[state.home]||0) > (state.score[state.away]||0) ? state.home : state.away);
        return;
      }
      state.half='top';
      state.inning += 1;
    }
    // Set sides and next batter
    setSidesForHalf();
    // Extra-innings runner on second from 10th onward at the start of each half
    try{
      if(state.inning>=10){
        const side = (state.half==='top') ? 'away' : 'home';
        const ghost = state.lastBatterByTeam[side] || null;
        if(ghost){ state.bases.second = ghost; state.resp.second = ghost; }
      }
    }catch(_){ }
  // Record appearance for the current pitcher on fielding team
  try{ const fieldTeam2 = fieldingTeamKey(); recordPitcherAppearance(fieldTeam2, state.pitcher); }catch(_){ }
    // Weather: check for possible rain suspension at start of new half
    try{ halfInningRainCheck(); }catch(_){ }
    concludeResultAndReroll();
  }

  function nextBatter(){
    const key = (state.half==='top') ? 'away' : 'home';
    const lineup = state.lineups[key];
    state.battingIndex[key] = (state.battingIndex[key] + 1) % lineup.length;
    state.batter = lineup[state.battingIndex[key]];
  }

  // Modal helpers
  function openInPlayModal(){
  if(state.gameOver){ showToast('Game is over.'); return; }
    // Start RNG for this play if not already set
    try{ prepareRngAndGlow(); }catch(_){ }
    const modal = document.createElement('div');
    modal.className = 'modal';
    Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:'1000' });
    const content = document.createElement('div');
    content.className = 'modal-content';
    Object.assign(content.style, { background:'rgba(255,255,255,0.22)', border:'2px solid #fff', borderRadius:'20px', backdropFilter:'blur(8px)', padding:'20px', minWidth:'320px', color:'#fff', boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44' });
    content.innerHTML = `
      <h3 style="margin:0 0 12px;">Select Play Result</h3>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:10px;">
        ${[
          {k:'1B',t:'Single'},
          {k:'2B',t:'Double'},
          {k:'3B',t:'Triple'},
          {k:'HR',t:'Home Run'},
          {k:'BB',t:'Walk'},
          {k:'HBP',t:'Hit by Pitch'},
          {k:'E',t:'Error'},
          {k:'FC',t:'Fielder\'s Choice'}
        ].map(o=>`<button data-res="${o.k}" style="padding:10px 12px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.18);">${o.t}</button>`).join('')}
      </div>
      <div style="margin:12px 0 8px;font-weight:800;opacity:.9;">Special</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:10px;">
        <button id="sp-ifr" style="padding:10px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">IFR</button>
        <button id="sp-ofr" style="padding:10px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">OFR</button>
        <button id="sp-wppb" style="padding:10px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">WP/PB</button>
        <button id="sp-park" style="padding:10px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">PARK?</button>
        <button id="sp-df" style="padding:10px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">DF</button>
        <button id="sp-wild" style="padding:10px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">WILD PLAY</button>
        <button id="sp-eq" style="padding:10px 12px;border:none;border-radius:10px;background:#446;color:#fff;cursor:pointer;">E?</button>
      </div>
      <div style="margin-top:12px;text-align:right;"><button id="cancel-modal" style="padding:8px 12px;border:none;border-radius:10px;background:#334; color:#fff; cursor:pointer;">Cancel</button></div>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='cancel-modal'){ closeModal(modal); } });
    content.querySelectorAll('button[data-res]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const code = btn.getAttribute('data-res');
        // For hits and error, open runner selection modal after choosing result
        if(['1B','2B','3B','HR','E'].includes(code)){
          closeModal(modal);
          openHitLocationModal(code, (locNum)=>{
            openRunnerModal(code, { locNum });
          });
        } else {
          applyPlay(code);
          closeModal(modal);
        }
      });
    });
    // Special handlers
    const byId = (id)=> content.querySelector(id);
    const closeThen = (fn)=>{ closeModal(modal); setTimeout(fn, 0); };
    const ifr = byId('#sp-ifr'); if(ifr) ifr.onclick = ()=> closeThen(openIFRModal);
    const ofr = byId('#sp-ofr'); if(ofr) ofr.onclick = ()=> closeThen(openOFRModal);
    const wppb = byId('#sp-wppb'); if(wppb) wppb.onclick = ()=> closeThen(openWPPBModal);
    const park = byId('#sp-park'); if(park) park.onclick = ()=> closeThen(openParkModal);
    const df = byId('#sp-df'); if(df) df.onclick = ()=> closeThen(openDFModal);
    const wild = byId('#sp-wild'); if(wild) wild.onclick = ()=> closeThen(openWildPlayModal);
    const eq = byId('#sp-eq'); if(eq) eq.onclick = ()=> closeThen(openErrorQueryModal);
  }

  // Utility to render an RNG pill; does not mutate state.pendingRng
  function renderRngPill(label, value){
    return `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#111a;backdrop-filter:blur(6px);border:1px solid #fff2;color:#fff;">
      <span style="opacity:.8;font-size:12px;">${label}</span>
      <strong style="letter-spacing:.5px;">${value}</strong>
    </div>`;
  }

  // Deterministic RNG derived from the current pendingRng; same within a play
  function stableRoll(range, salt){
    try{
      // Ensure we have a base roll for this play
      if(typeof state.pendingRng !== 'number'){
        prepareRngAndGlow();
      }
      const base = typeof state.pendingRng === 'number' ? state.pendingRng : 0; // 0-999
      // Simple salted LCG-like mixer for deterministic sub-rolls
      let x = base;
      const s = String(salt||'');
      for(let i=0;i<s.length;i++){
        x = (x * 31 + s.charCodeAt(i)) % 1000003; // keep bounded to avoid overflow
      }
      const v = x % Math.max(1, range);
      return v;
    }catch(_){ return 0; }
  }

  function buildModalShell(title){
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    // Inline overlay style to guarantee visibility without external CSS
    Object.assign(modal.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1003'
    });
    const content = document.createElement('div');
    content.className = 'modal-content';
    // Inline content style for the glass effect and large sizing
    Object.assign(content.style, {
      width: '96vw',
      maxWidth: '1200px',
      maxHeight: '92vh',
      padding: '20px',
      background: 'rgba(255,255,255,0.22)',
      border: '2px solid #fff',
      borderRadius: '20px',
      backdropFilter: 'blur(8px)',
      color: '#fff',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44',
      overflow: 'auto'
    });
    modal.appendChild(content);
    document.body.appendChild(modal);
    const close = ()=> closeModal(modal);
    modal.addEventListener('click',(e)=>{ if(e.target===modal) close(); });
    content.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="margin:0;font-size:22px;">${title}</h3>
      <button id="close-x" style="padding:10px 14px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Close</button>
    </div>`;
    content.querySelector('#close-x').onclick = close;
    return { modal, content, close };
  }

  function openIFRModal(){
    const { modal, content, close } = buildModalShell('Infield Range (IFR)');
    // Use deterministic rolls derived from the current pending RNG
    const rngLoc = String(stableRoll(100, 'IFR:loc')).padStart(2,'0'); // 0-99 Location
    const rngRes = String(stableRoll(100, 'IFR:res')).padStart(2,'0'); // 0-99 Result
    content.innerHTML += `
      <div style="display:flex;gap:24px;align-items:stretch;flex-wrap:wrap;">
        <img src="data/IFR.png" alt="IFR" style="flex:2 1 60%;height:70vh;max-height:70vh;max-width:100%;width:auto;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.28);object-fit:contain;background:#0002;align-self:center;"/>
        <div style="flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:16px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${renderRngPill('Location 0-99', rngLoc)}
            ${renderRngPill('Result 0-99', rngRes)}
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="ifr-go" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Groundout</button>
            <button id="ifr-1b" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Single</button>
            <button id="ifr-batter" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:#444c;color:#fff;cursor:pointer;">View Batter</button>
          </div>
        </div>
      </div>`;
    // Style helper if not existing
    // Handlers
    content.querySelector('#ifr-go').onclick = ()=>{ close(); openOutModal('GO'); };
    content.querySelector('#ifr-1b').onclick = ()=>{
      close();
      openHitLocationModal('1B',(locNum)=>{ openRunnerModal('1B',{locNum}); });
    };
    const vb = content.querySelector('#ifr-batter'); if(vb){ vb.onclick = ()=>{ try{ openPlayerCardModal(state.batter,'Batter'); }catch(_){ } }; }
  }

  function openOFRModal(){
    const { modal, content, close } = buildModalShell('Outfield Range (OFR)');
    // Use deterministic rolls derived from the current pending RNG
    const rngLoc = String(stableRoll(100, 'OFR:loc')).padStart(2,'0'); // 0-99 Location
    const rngRes = String(stableRoll(100, 'OFR:res')).padStart(2,'0'); // 0-99 Result
    content.innerHTML += `
      <div style="display:flex;gap:24px;align-items:stretch;flex-wrap:wrap;">
        <img src="data/OFR.png" alt="OFR" style="flex:2 1 60%;height:70vh;max-height:70vh;max-width:100%;width:auto;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.28);object-fit:contain;background:#0002;align-self:center;"/>
        <div style="flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:16px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${renderRngPill('Location 0-99', rngLoc)}
            ${renderRngPill('Result 0-99', rngRes)}
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="ofr-1b" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Single</button>
            <button id="ofr-fo" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Flyout</button>
            <button id="ofr-batter" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:#444c;color:#fff;cursor:pointer;">View Batter</button>
          </div>
        </div>
      </div>`;
    content.querySelector('#ofr-1b').onclick = ()=>{
      close();
      openHitLocationModal('1B',(locNum)=>{ openRunnerModal('1B',{locNum}); });
    };
    content.querySelector('#ofr-fo').onclick = ()=>{ close(); openOutModal('FO'); };
    const vb = content.querySelector('#ofr-batter'); if(vb){ vb.onclick = ()=>{ try{ openPlayerCardModal(state.batter,'Batter'); }catch(_){ } }; }
  }

  function openWPPBModal(){
    const { modal, content, close } = buildModalShell('WP / PB Reference');
    content.innerHTML += `
      <div style="display:flex;gap:24px;align-items:stretch;flex-wrap:wrap;">
        <img src="data/wppb.png" alt="WP/PB" style="flex:2 1 60%;height:70vh;max-height:70vh;max-width:100%;width:auto;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.28);object-fit:contain;background:#0002;align-self:center;"/>
        <div style="flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:18px;">
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="wppb-pitcher" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:#444c;color:#fff;cursor:pointer;">View Pitcher</button>
            <button id="wppb-catcher" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:#444c;color:#fff;cursor:pointer;">View Catcher</button>
          </div>
          <p style="font-size:.75rem;opacity:.7;line-height:1.3;margin:0;">Reference chart for adjudicating potential Wild Pitches and Passed Balls. Use pitcher/catcher defensive ratings and any situational modifiers as needed.</p>
        </div>
      </div>`;
    const vp = content.querySelector('#wppb-pitcher'); if(vp){ vp.onclick = ()=>{ try{ openPlayerCardModal(state.pitcher,'Pitcher'); }catch(_){ } }; }
    const vc = content.querySelector('#wppb-catcher'); if(vc){ vc.onclick = ()=>{ try{ const catcherName = state.fielders && state.fielders.catcher; if(catcherName) openPlayerCardModal(catcherName,'Catcher'); }catch(_){ } }; }
  }

  function openParkModal(){
    const { modal, content, close } = buildModalShell('PARK?');
    // Deterministic 0–99 visual roll
    const rng = String(stableRoll(100, 'PARK')).padStart(2,'0');
    const rows = [
      ['ARI','00-55','56-70','71-84','85-98','99','',''],
      ['ATL','00-49','50-54','55-59','60-63','64-72','73-81','82-99'],
      ['BAL','00-58','59-60','61-62','63-68','69-76','77-84','85-99'],
      ['BOS','00-48','49-68','69-87','88-93','94-95','96','97-99'],
      ['CHA','00-38','39','40','41','42-56','57-70','71-99'],
      ['CHN','00-25','26-32','33-49','50-66','67-99','',''],
      ['CIN','00-25','26-34','35-43','44-57','58-71','72-99',''],
      ['CLE','00-15','16-30','31-45','46-59','60-72','73-99',''],
      ['COL','00-54','55-68','69-81','82-99','','',''],
      ['DET','00-39','40-43','44-46','47-58','59-69','70-79','80-99'],
      ['HOU','00-11','12-15','16-19','20-22','23-42','43-61','62-99'],
      ['KC','00-30','31-48','49-66','67-78','79-84','85-89','90-99'],
      ['LAA','00-18','19-23','24-28','29-31','32-48','49-65','66-99'],
      ['LAN','00-01','02','03-27','28-51','52-99','',''],
      ['MIA','00-39','40-51','52-62','63-69','70-77','78-84','85-99'],
      ['MIL','00','01-04','05-28','29-52','53-99','',''],
      ['MIN','00-36','37-48','49-60','61-65','66-74','75-82','83-99'],
      ['NYA','00-08','09-10','11','12-33','34-55','56-99',''],
      ['NYN','00-04','05','06-29','30-52','53-99','',''],
      ['OAK','00-30','31-43','44-55','56-58','59-69','70-79','80-99'],
      ['PHI','00-30','31-33','34-36','37-42','43-57','58-71','72-99'],
      ['PIT','00-40','41-61','62-81','82-84','85-88','89-92','93-99'],
      ['SD','00-06','07-09','10-12','13-34','35-56','57-99',''],
      ['SEA','00','01','02-26','27-50','51-99','',''],
      ['SF','00-52','53-66','67-80','81-90','91-93','94-95','96-99'],
      ['STL','00-55','56-61','62-67','68-72','73-79','80-86','87-99'],
      ['TB','00-14','15-21','22-41','42-60','61-99','',''],
      ['TEX','00-27','28-32','33-37','38-42','43-57','58-71','72-99'],
      ['TOR','00-17','18-29','30-40','41','42-56','57-70','71-99'],
      ['WAS','00-53','54-59','60-65','66-69','70-77','78-84','85-99']
    ];
    const head = ['Stadium','1B lcf','2B lc','2B rc','3B','SG','RG','HF cf'];
    const tableRows = rows.map((r,idx)=>{
      const cells = r.map((c)=>`<td style="padding:10px 12px;border-bottom:1px solid #fff3;">${c||'—'}</td>`).join('');
      const bg = idx % 2 === 0 ? 'background:rgba(0,0,0,0.15);' : '';
      return `<tr style="${bg}">${cells}</tr>`;
    }).join('');
    const headRow = head.map(h=>`<th style="position:sticky;top:0;background:rgba(10,15,20,0.85);backdrop-filter:blur(6px);padding:10px 12px;text-align:left;border-bottom:2px solid #fff6;">${h}</th>`).join('');
    content.innerHTML += `
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${renderRngPill('RNG 0-99', rng)}
        <div style="opacity:.9;font-size:14px;">Use the 0–99 roll to read the stadium chart below. Close this when done; record the outcome manually.</div>
        <div style="overflow:auto;max-height:75vh;border-radius:12px;box-shadow:inset 0 0 0 1px #fff2;">
          <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:16px;line-height:1.35;">
            <thead><tr>${headRow}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button id="park-close" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Close</button>
        </div>
      </div>`;
    content.querySelector('#park-close').onclick = ()=>{ close(); };
  }

  function openDFModal(){
    const { modal, content, close } = buildModalShell('Deep Fly (DF)');
    // Deterministic rolls derived from current pending RNG
    const rng1 = String(stableRoll(10, 'DF:1')).padStart(1,'0'); // 0-9
    const rng2 = String(stableRoll(100, 'DF:2')).padStart(2,'0'); // 0-99
    content.innerHTML += `
      <div style="display:flex;gap:24px;align-items:stretch;flex-wrap:wrap;">
        <img src="data/DF.png" alt="DF" style="flex:2 1 60%;height:70vh;max-height:70vh;max-width:100%;width:auto;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.28);object-fit:contain;background:#0002;align-self:center;"/>
        <div style="flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:16px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${renderRngPill('RNG 0-9', rng1)}
            ${renderRngPill('RNG 0-99', rng2)}
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="df-fo" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Flyout</button>
            <button id="df-hr" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Home Run</button>
            <button id="df-batter" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:#444c;color:#fff;cursor:pointer;">View Batter</button>
          </div>
        </div>
      </div>`;
    content.querySelector('#df-fo').onclick = ()=>{ close(); openOutModal('FO'); };
    content.querySelector('#df-hr').onclick = ()=>{ close(); applyPlay('HR'); };
    const vb = content.querySelector('#df-batter'); if(vb){ vb.onclick = ()=>{ try{ openPlayerCardModal(state.batter,'Batter'); }catch(_){ } }; }
  }

  function openWildPlayModal(){
    const { modal, content, close } = buildModalShell('WILD PLAY');
    const occupied = !!(state.bases.first || state.bases.second || state.bases.third);
    // Deterministic 0–999 visual roll
    const rng = String(stableRoll(1000, 'WILD:' + (occupied? 'MOB':'EMPTY'))).padStart(3,'0');
    const img = occupied ? 'data/WPMOB.png' : 'data/WP.png';
    content.innerHTML += `
      <div style="display:flex;gap:24px;align-items:stretch;flex-wrap:wrap;">
        <img src="${img}" alt="WILD PLAY" style="flex:2 1 60%;height:70vh;max-height:70vh;max-width:100%;width:auto;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.28);object-fit:contain;background:#0002;align-self:center;"/>
        <div style="flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:16px;">
          ${renderRngPill('RNG 0-999', rng)}
          <div style="opacity:.85;">No direct outcome. Use result chart; this modal just shows the roll.</div>
          <div><button id="wild-close" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Close</button></div>
        </div>
      </div>`;
    content.querySelector('#wild-close').onclick = ()=>{ close(); };
  }

  function openErrorQueryModal(){
    const { modal, content, close } = buildModalShell('E?');
    // Deterministic rolls derived from current pending RNG
    const rng1 = String(stableRoll(10, 'E:1')).padStart(1,'0'); // 0-9
    const rng2 = String(stableRoll(100, 'E:2')).padStart(2,'0'); // 0-99
    // Map 1-9 to fielding positions (1=P,2=C,3=1B,4=2B,5=3B,6=SS,7=LF,8=CF,9=RF)
    const posMap = {1:'pitcher',2:'catcher',3:'first',4:'second',5:'third',6:'short',7:'left',8:'center',9:'right'};
    const primaryDigit = parseInt(rng1,10); // 0-9; treat 0 as no specific fielder
    const fielderKey = posMap[primaryDigit] || null;
    const fielderName = fielderKey ? (state.fielders[fielderKey] || '') : '';
    content.innerHTML += `
      <div style="display:flex;gap:24px;align-items:stretch;flex-wrap:wrap;">
        <img src="data/error.png" alt="E?" style="flex:2 1 60%;height:70vh;max-height:70vh;max-width:100%;width:auto;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.28);object-fit:contain;background:#0002;align-self:center;"/>
        <div style="flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:16px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${renderRngPill('RNG 0-9', rng1)}
            ${renderRngPill('RNG 0-99', rng2)}
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="eq-error" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Error</button>
            <button id="eq-go" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Groundout</button>
            <button id="eq-fo" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.2);">Flyout</button>
            <button id="eq-batter" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:#444c;color:#fff;cursor:pointer;">View Batter</button>
            ${fielderName?`<button id="eq-fielder" style="font-size:18px;padding:14px 16px;border:none;border-radius:12px;background:#444c;color:#fff;cursor:pointer;">${(posMap[primaryDigit]||'').toUpperCase()} Card</button>`:''}
          </div>
          ${fielderName?`<div style="opacity:.8;font-size:14px;">RNG 0-9 indicates potential misplay by: <strong>${fielderName}</strong> (${(posMap[primaryDigit]||'').toUpperCase()})</div>`:`<div style="opacity:.8;font-size:14px;">RNG 0 does not assign a specific fielder.</div>`}
        </div>
      </div>`;
    content.querySelector('#eq-error').onclick = ()=>{
      close();
      openHitLocationModal('E',(locNum)=>{ openRunnerModal('E',{locNum}); });
    };
    content.querySelector('#eq-go').onclick = ()=>{ close(); openOutModal('GO'); };
    content.querySelector('#eq-fo').onclick = ()=>{ close(); openOutModal('FO'); };
    const vb = content.querySelector('#eq-batter'); if(vb){ vb.onclick = ()=>{ try{ openPlayerCardModal(state.batter,'Batter'); }catch(_){ } }; }
    const vf = content.querySelector('#eq-fielder'); if(vf){ vf.onclick = ()=>{ try{ if(fielderName) openPlayerCardModal(fielderName, (posMap[primaryDigit]||'').toUpperCase()); }catch(_){ } }; }
  }
  function closeModal(modal){ if(modal && modal.parentNode) modal.parentNode.removeChild(modal); }

  function openRunnerModal(code, context){
    // Legacy modal replaced: delegate to new style (safe/out) but treat all initial advances as SAFE context.
    try{ pushHistory('advance'); }catch(_){ }
    const defaults = defaultAdvancesFor(code) || {first:0,second:0,third:0,batter:0};
    // Convert defaultAdvancesFor distances into pre-selected base destinations by simulating steps in openRunnerAdvanceOnlyModal.
    // We'll open the newer modal including batter; after user applies, applyRunnerAdvances will be called with context.
    const m = openRunnerAdvanceOnlyModal(code, {
      includeBatter:true,
      defaults,
      context: (context||{}),
      onApply:(adv,reasons,outs)=>{ applyRunnerAdvances(code, adv, context||{}, reasons||{}, outs||[]); },
      onCancel:()=>{}
    });
    if(!m){ /* No runners & batter only => just apply default moves directly */
      applyRunnerAdvances(code, defaults, context||{}, {}, []);
    }
  }

  function defaultAdvancesFor(code){
    switch(code){
      case '1B': return {first:1, second:1, third:1, batter:1};
      case '2B': return {first:2, second:2, third:2, batter:2};
      case '3B': return {first:3, second:3, third:3, batter:3};
      case 'HR': return {first:4, second:4, third:4, batter:4};
      case 'E': return {first:1, second:1, third:1, batter:1};
      case 'BB': return {first:0, second:0, third:0, batter:1};
      case 'HBP': return {first:0, second:0, third:0, batter:1};
      default: return {first:0, second:0, third:0, batter:0};
    }
  }

  // Defaults for post-out advances (no batter moves). For SF, suggest 3B tags.
  function defaultAdvancesAfterOut(kind, sequence, hardness){
    // Defaults for post-out runner movement (batter already out). Provide conservative/side-aware suggestions.
    if(kind==='SF') return { first:0, second:0, third:1, batter:0 };
    if(kind==='GO'){
      const seq = Array.isArray(sequence)? sequence : [];
      const firstTouch = (seq && seq.length) ? parseInt(seq[0],10) : null;
      const rightSide = firstTouch===3 || firstTouch===4; // 3=1B,4=2B
      // Map hardness
      const code = hardness && hardness.code ? hardness.code : 'RG';
      const adv = { first:0, second:0, third:0, batter:0 };
      if(code==='SG'){
        // Slow grounder per chart (no FC chosen):
        const r1 = !!state.bases.first, r2 = !!state.bases.second, r3 = !!state.bases.third;
        if(r1 && !r2 && !r3){ adv.first = 1; }
        else if(!r1 && r2 && !r3){ adv.second = 1; }
        else if(!r1 && !r2 && r3){ adv.third = 1; }
        else if(r1 && r2 && !r3){ adv.first = 1; adv.second = 1; }
        else if(r1 && !r2 && r3){ adv.first = 1; adv.third = 1; }
        else if(!r1 && r2 && r3){ adv.third = 1; adv.second = rightSide ? 1 : 0; }
        else if(r1 && r2 && r3){ adv.first = 1; adv.second = 1; adv.third = 1; }
      } else if(code==='HG' || code==='RG'){
        // Hard/Routine: conservative per chart; R1 holds; R2 advances on right side; R3 holds
        adv.first = 0;
        adv.second = rightSide ? 1 : 0;
        adv.third = 0;
      }
      return adv;
    }
    // FO/DP or others: default hold
    return { first:0, second:0, third:0, batter:0 };
  }

  // Ask only for existing runners (optionally include batter if safe, e.g., FC). Does NOT change PA/AB.
  function openRunnerAdvanceOnlyModal(kind, options){
    const includeBatter = !!(options && options.includeBatter);
    const defaults = (options && options.defaults) || { first:0, second:0, third:0, batter:0 };
    const context = (options && options.context) || {};
    const modal = document.createElement('div');
    Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:'1001' });
    const content = document.createElement('div');
    Object.assign(content.style, { background:'rgba(255,255,255,0.22)', border:'2px solid #fff', borderRadius:'20px', backdropFilter:'blur(8px)', padding:'20px', minWidth:'420px', color:'#fff', boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44' });
    // One-time style injection for selection highlighting (visual feedback)
    if(!document.getElementById('adv-runner-style')){
      const styleEl = document.createElement('style');
      styleEl.id = 'adv-runner-style';
      styleEl.textContent = `
        .runner-card .mode-btn{opacity:.75;transition:background .18s,box-shadow .18s,transform .12s,opacity .18s;}
        .runner-card .mode-btn.active{opacity:1;box-shadow:0 0 0 2px #ffffffaa inset,0 0 8px #00eaffaa;}
        .runner-card .adv-base-btn,.runner-card .adv-reason-btn{transition:background .18s,box-shadow .18s,transform .12s,color .18s;}
        .runner-card .adv-base-btn.sel{background:linear-gradient(90deg,#00eaff,#0078d4)!important;color:#fff!important;border-color:#00eaff!important;box-shadow:0 0 0 2px rgba(255,255,255,0.25) inset,0 0 8px #00eaff;}
        .runner-card .adv-reason-btn.sel{outline:2px solid #fff;box-shadow:0 0 0 2px rgba(255,255,255,0.25) inset,0 0 10px rgba(0,234,255,0.55);}
        .runner-card .adv-reason-btn.out-mode.sel{outline:2px solid #fff;box-shadow:0 0 0 2px rgba(255,120,120,0.35) inset,0 0 10px rgba(255,50,50,0.65);}
        .runner-card .adv-base-btn:hover,.runner-card .adv-reason-btn:hover,.runner-card .mode-btn:hover{transform:translateY(-2px);} 
        .runner-card .stretch-row{display:flex;align-items:center;gap:8px;margin-top:2px;}
        .runner-card .stretch-btn{padding:4px 10px;border-radius:16px;border:1px solid rgba(255,255,255,0.25);background:rgba(0,0,0,0.35);color:#fff;font-weight:600;cursor:pointer;}
        .runner-card .stretch-status{font-size:.75rem;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,0.20);background:rgba(255,255,255,0.12);color:#eaf6ff;}
        .runner-card .stretch-status.attempt{border-color:#22d3ee;background:rgba(34,211,238,.15);color:#dffbff;}
        .runner-card .stretch-status.hold{border-color:#9ca3af;background:rgba(156,163,175,.15);color:#e5e7eb;}
      `;
      document.head.appendChild(styleEl);
    }
    const rows = [];
    if(state.bases.third) rows.push({ key:'third', label:`3B: ${state.bases.third}`, from:'third', name: state.bases.third });
    if(state.bases.second) rows.push({ key:'second', label:`2B: ${state.bases.second}`, from:'second', name: state.bases.second });
    if(state.bases.first) rows.push({ key:'first', label:`1B: ${state.bases.first}`, from:'first', name: state.bases.first });
    // Batter row logic: if batter already placed on 1B (e.g., FC safe) treat from first; else from home (new hit/error before placement)
    if(includeBatter && state.batter){
      // Only treat batter as already at 1B if THAT runner currently occupies first (e.g., after FC). Otherwise start from home even if 1B is occupied by another runner.
      if(state.bases.first && state.bases.first === state.batter){
        rows.push({ key:'batter', label:`Batter (at 1B): ${state.batter}`, from:'first', name: state.batter });
      } else {
        rows.push({ key:'batter', label:`Batter: ${state.batter}`, from:'home', name: state.batter });
      }
    }
    if(rows.length===0){ return null; }
    function forwardBases(from){
      if(from==='third') return ['third','home'];
      if(from==='second') return ['second','third','home'];
      if(from==='first') return ['first','second','third','home'];
      if(from==='home') return ['home','first','second','third','home'];
      return [from];
    }
    // Build new compact cards: header toggle (Out/Safe), base destination buttons, reason buttons
    function baseButtons(r){
      const dests = forwardBases(r.from);
      return `<div class="adv-bases" data-run="${r.key}" style="display:flex;gap:6px;flex-wrap:wrap;">`+
        dests.map(d=>`<button type="button" data-base="${d}" class="adv-base-btn" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#fff;min-width:64px;">${d==='first'?'1B':d==='second'?'2B':d==='third'?'3B':d==='home'?'Home':'Stay'}</button>`).join('')+
        `</div>`; }
    const OUT_REASONS = [
      {v:'caught-stealing', t:'Caught Stealing'},
      {v:'picked-off', t:'Picked Off'},
      {v:'tagged', t:'Tagged Out'},
      {v:'force', t:'Force Out'},
      {v:'double-play', t:'Double Play'}
    ];
    const SAFE_REASONS = [
      {v:'batter', t:'Advanced By Batter'},
      {v:'held', t:'Held Up'},
      {v:'stolen', t:'Stolen Base'},
      {v:'error', t:'Error'},
      {v:'passed-ball', t:'Passed Ball'},
      {v:'wild-pitch', t:'Wild Pitch'}
    ];
    function reasonButtons(r){
      return `<div class="adv-reasons" data-run="${r.key}" style="display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:6px;">`+
        SAFE_REASONS.map(rn=>`<button type="button" data-reason="${rn.v}" class="adv-reason-btn safe-mode" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(0,255,255,0.25);background:rgba(0,160,255,0.15);color:#e5f9ff;font-size:.8rem;">${rn.t}</button>`).join('')+
        OUT_REASONS.map(rn=>`<button type="button" data-reason="${rn.v}" class="adv-reason-btn out-mode" style="display:none;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,100,100,0.35);background:rgba(220,0,0,0.20);color:#ffecec;font-size:.8rem;">${rn.t}</button>`).join('')+
        `</div>`;
    }
    function rowCard(r){
      return `<div class="runner-card" data-run="${r.key}" style="background:rgba(0,0,0,0.30);border:1px solid rgba(255,255,255,0.18);padding:10px 12px;border-radius:12px;display:grid;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="font-weight:700;letter-spacing:.4px;">${r.label}</div>
            <label style="display:flex;align-items:center;gap:4px;font-size:.8rem;opacity:.85;">
              <input type="checkbox" class="not-held-chk" ${r.from==='first'?'':'disabled'} /> Not held
            </label>
          </div>
          <div class="safeout-toggle" style="display:flex;gap:6px;">
            <button type="button" data-mode="safe" class="mode-btn active" style="padding:4px 10px;border-radius:18px;border:1px solid #00eaff88;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;font-weight:600;">Safe</button>
            <button type="button" data-mode="out" class="mode-btn" style="padding:4px 10px;border-radius:18px;border:1px solid rgba(255,80,80,0.55);background:linear-gradient(90deg,#7a0d0d,#d41b1b);color:#fff;font-weight:600;">Out</button>
          </div>
        </div>
        ${baseButtons(r)}
        ${reasonButtons(r)}
        <div class="stretch-row">
          <button type="button" class="stretch-btn" title="Roll vs team aggressiveness to try for an extra base">Stretch?</button>
          <span class="stretch-status" aria-live="polite"></span>
        </div>
        <div class="error-field" style="display:none;">
          <label style="font-size:.7rem;display:flex;gap:4px;align-items:center;">Fielder
            <select data-err-fielder style="padding:4px 6px;border-radius:6px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);color:#fff;">
              <option value="">Select</option>
              ${['pitcher','catcher','first','second','third','short','left','center','right'].map(k=>{
                const nm=state.fielders[k]||''; const num=posNum[k]; const lab=`${(posAbbr[k]||k).toUpperCase()}${num?` (${num})`:''}${nm&&!isPlaceholder(nm)?' — '+nm:''}`; return `<option value="${k}">${lab}</option>`; }).join('')}
            </select>
          </label>
        </div>
      </div>`;
    }
    content.innerHTML = `
      <h3 style="margin:0 0 10px;">Runner Decisions${kind?` (${kind})`:''}${context && context.locNum?` — Hit to ${['','P','C','1B','2B','3B','SS','LF','CF','RF'][context.locNum]||''}`:''}</h3>
      <div style="display:flex;justify-content:flex-start;gap:12px;align-items:center;margin:6px 0 12px 0;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.25);padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);">
          <input type="checkbox" id="infield-in-chk" /> Infield In
        </label>
        <label style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.25);padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);">
          <input type="checkbox" id="hitrun-chk" /> Hit & Run
        </label>
      </div>
      <div style="display:grid;gap:10px;max-height:65vh;overflow:auto;">${rows.map(rowCard).join('')}</div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
        <button id="cancel-runner2" style="padding:8px 14px;border:none;border-radius:12px;background:#334;color:#fff;cursor:pointer;">Cancel</button>
        <button id="apply-runner2" style="padding:10px 18px;border:none;border-radius:12px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;font-weight:600;cursor:pointer;">Apply</button>
      </div>`;
    modal.appendChild(content); document.body.appendChild(modal);
  // Helper: team aggressiveness and player speed/arm lookups
    function teamAggPct(){
      try{
        const teams = JSON.parse(localStorage.getItem('ibl.teams')||'[]');
        if(!Array.isArray(teams) || teams.length===0) return 0;
        // Prefer current state team keys
        const stateKey = (state.half==='top') ? state.away : state.home;
        let t = teams.find(x=> x && x.key===stateKey);
        if(!t){
          // Fallback to selection storage if state key not found
          const sel = JSON.parse(localStorage.getItem('ibl.selection')||'{}')||{};
          const offenseKey = (state.half==='top') ? sel.away : sel.home;
          t = teams.find(x=> x && x.key===offenseKey);
        }
        const pct = t && typeof t.runAgg==='number' ? t.runAgg : 0;
        return Math.max(0, Math.min(100, pct));
      }catch(_){ return 0; }
    }
    async function getPlayerSpeed(name){
      try{
        // rosters may include items as strings or objects; speed may appear on object rows
        const all = JSON.parse(localStorage.getItem('ibl.rosters')||'{}')||{};
        const sel = JSON.parse(localStorage.getItem('ibl.selection')||'{}')||{};
        const offenseKey = (state.half==='top') ? sel.away : sel.home;
        const arr = all[offenseKey];
        if(!Array.isArray(arr)) return null;
        for(const item of arr){ if(item && typeof item==='object' && item.name===name){ const v=item.speed ?? item.Speed ?? item.SPD ?? null; const n=parseFloat(v); if(!isNaN(n)) return n; } }
        return null;
      }catch(_){ return null; }
    }
    async function getPlayerArm(name){
      try{
        const all = JSON.parse(localStorage.getItem('ibl.rosters')||'{}')||{};
        const sel = JSON.parse(localStorage.getItem('ibl.selection')||'{}')||{};
        // Arm belongs to defense; if half is top, defense is home; else away
        const defenseKey = (state.half==='top') ? sel.home : sel.away;
        const arr = all[defenseKey];
        if(!Array.isArray(arr)) return null;
        for(const item of arr){ if(item && typeof item==='object' && item.name===name){ const v=item.arm ?? item.Arm ?? null; const n=parseFloat(v); if(!isNaN(n)) return n; } }
        return null;
      }catch(_){ return null; }
    }
    function applyStretchToCard(card, runner){
      try{
        // Always open the Stretch review modal; prevent rerolls by caching results on the button
        const sBtn = card.querySelector('.stretch-btn');
        openStretchReviewModal(card, runner, sBtn);
      }catch(_){ }
    }

    function openStretchReviewModal(card, runner, sBtn){
      const statusEl = card.querySelector('.stretch-status');
      const pct = teamAggPct();
      const prior = (sBtn && sBtn.dataset && sBtn.dataset.review) ? (function(){ try{ return JSON.parse(sBtn.dataset.review); }catch(_){ return null; } })() : null;
      Promise.resolve(getPlayerSpeed(runner.name)).then(sp=>{
        const order = ['home','first','second','third','home'];
        const baseBtnSel = card.querySelector('.adv-base-btn.sel');
        const current = baseBtnSel ? baseBtnSel.getAttribute('data-base') : runner.from;
        let fromIdx = order.indexOf(current);
        if(fromIdx<0) fromIdx = order.indexOf(runner.from);
        if(fromIdx<0) fromIdx = 0;
        let tryIdx = Math.min(fromIdx+1, order.lastIndexOf('home'));
        let targetBase = order[tryIdx];
        const locNum = context && context.locNum ? String(context.locNum) : null;
        const isOF = locNum && ['7','8','9'].includes(locNum);
        const fielderKey = (function(){ if(!isOF) return null; if(locNum==='7') return 'left'; if(locNum==='8') return 'center'; if(locNum==='9') return 'right'; return null; })();
        const fName = fielderKey ? (state.fielders[fielderKey]||null) : null;
        const defenseKey = (function(){ try{ const sel=JSON.parse(localStorage.getItem('ibl.selection')||'{}')||{}; return (state.half==='top')? sel.home : sel.away; }catch(_){ return null; } })();
        const defenseRosters = (function(){ try{ const all=JSON.parse(localStorage.getItem('ibl.rosters')||'{}')||{}; return defenseKey? all[defenseKey] : null; }catch(_){ return null; } })();
        const ofNames = ['left','center','right'].map(k=> state.fielders[k]).filter(Boolean);
        let ofAvg = null;
        try{
          if(Array.isArray(defenseRosters)){
            let sum=0, cnt=0; for(const nm of ofNames){ const rec = defenseRosters.find(p=> p && typeof p==='object' && p.name===nm); if(rec && typeof rec.arm==='number' && !isNaN(rec.arm)){ sum+=rec.arm; cnt++; } }
            if(cnt>0) ofAvg = sum/cnt;
          }
        }catch(_){ }

        const computeAdj = (arm)=>{
          let adj = (typeof sp==='number'? sp : 0);
          const breakdown = [];
          breakdown.push(`speed ${typeof sp==='number'? sp: 0}`);
          if((state.outs||0)===2 && runner.key!=='batter'){ adj += 1; breakdown.push('+1 two-out'); }
          const notHeld = !!(card.querySelector('.not-held-chk') && card.querySelector('.not-held-chk').checked);
          if(runner.from==='first' && notHeld && (state.outs||0) <= 1){ adj += 1; breakdown.push('+1 not-held'); }
          if(isOF){
            const goingTo = targetBase;
            if(goingTo==='third'){
              if(locNum==='7'){ adj -= 1; breakdown.push('-1 LF to 3B'); }
              else if(locNum==='9'){ adj += 1; breakdown.push('+1 RF to 3B'); }
            }
          }
          const infieldIn = !!(content.querySelector('#infield-in-chk') && content.querySelector('#infield-in-chk').checked);
          if(infieldIn && targetBase==='home'){
            const basesLoaded = !!state.bases.first && !!state.bases.second && !!state.bases.third;
            const pen = (basesLoaded ? 2 : 1); adj -= pen; breakdown.push(`-${pen} infield-in`);
          }
          const hitRun = !!(content.querySelector('#hitrun-chk') && content.querySelector('#hitrun-chk').checked);
          if(hitRun && isOF){ adj += 3; breakdown.push('+3 hit&run'); }
          if(isOF && typeof arm==='number'){
            const baseline = (typeof ofAvg==='number' && isFinite(ofAvg)) ? ofAvg : 5;
            const diff = (arm - baseline);
            adj -= diff;
            breakdown.push(`${diff>=0?'-':''}${diff.toFixed(1)} arm (arm ${arm}${(typeof ofAvg==='number')?`, avg ${ofAvg.toFixed(1)}`:''})`);
          }
          if(!isFinite(adj)) adj = 0;
          const clamped = Math.max(-2, Math.min(9, Math.round(adj)));
          return { adj: clamped, breakdown };
        };

        const buildModal = (review)=>{
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;';
          const box = document.createElement('div');
          box.style.cssText = 'width:min(560px,92vw);max-height:80vh;overflow:auto;background:#0b1520;color:#eaf6ff;border:1px solid rgba(255,255,255,.15);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.5);padding:16px;';
          box.innerHTML = `
            <h3 style="margin:0 0 8px;">Stretch Review — ${runner.name}</h3>
            <div style="font-size:.9rem;opacity:.9;margin-bottom:10px;">From ${runner.from.toUpperCase()} to ${targetBase.toUpperCase()} ${isOF?`(hit to ${{'7':'LF','8':'CF','9':'RF'}[locNum]})`:''}</div>
            <div id="sr-steps" style="display:grid;gap:8px;margin:8px 0 12px;"></div>
            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" id="sr-close" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Close</button>
              <button type="button" id="sr-next" style="padding:8px 12px;border:none;border-radius:10px;background:#0ea5e9;color:#fff;cursor:pointer;">Next</button>
              <button type="button" id="sr-apply" style="padding:8px 12px;border:none;border-radius:10px;background:#10b981;color:#001;cursor:pointer;display:none;">Apply outcome</button>
            </div>`;
          overlay.appendChild(box);
          document.body.appendChild(overlay);
          const stepsEl = box.querySelector('#sr-steps');
          const btnNext = box.querySelector('#sr-next');
          const btnApply = box.querySelector('#sr-apply');
          const btnClose = box.querySelector('#sr-close');

          let step = 0;
          function renderStep(){
            if(step===0){
              stepsEl.innerHTML = `
                <div>Attempt roll: <b>${review.attemptRoll}</b> vs team aggressiveness <b>${review.pct}%</b></div>
                <div>Result: ${review.attempt ? '<b>Attempting</b>' : '<b>Hold — no attempt</b>'}</div>`;
              btnNext.style.display = review.attempt ? 'inline-block' : 'none';
              btnApply.style.display = review.attempt ? 'none' : 'inline-block';
            } else if(step===1){
              stepsEl.innerHTML = `
                <div>Adjusted rating: <b>${review.adj}</b></div>
                <div style="font-size:.85rem;opacity:.9;">${review.breakdown.map(x=>`• ${x}`).join('<br>')}</div>`;
              btnNext.style.display = 'inline-block';
              btnApply.style.display = 'none';
            } else {
              stepsEl.innerHTML = `
                <div>Outcome roll: <b>${review.finalRoll}</b></div>
                <div>Outcome: <b>${review.outcome.toUpperCase()}</b>${review.outcome==='out'?` at ${targetBase.toUpperCase()}`:''}</div>`;
              btnNext.style.display = 'none';
              btnApply.style.display = 'inline-block';
            }
          }
          renderStep();

          function applyToCard(){
            if(!statusEl) return;
            if(!review.attempt){ statusEl.textContent = `Hold — no attempt (${review.attemptRoll}/${review.pct}%)`; statusEl.classList.add('hold'); return; }
            // Apply to runner card selections
            const outcome = review.outcome;
            if(outcome==='out' || outcome==='rundown'){
              const outBtn = card.querySelector('.mode-btn[data-mode="out"]'); if(outBtn) outBtn.click();
              const tbtn = card.querySelector(`.adv-base-btn[data-base="${targetBase}"]`) || card.querySelector('.adv-base-btn.sel');
              if(tbtn){ card.querySelectorAll('.adv-base-btn').forEach(x=>x.classList.remove('sel')); tbtn.classList.add('sel'); }
              const reasonBtn = Array.from(card.querySelectorAll('.adv-reason-btn.out-mode')).find(b=> b.getAttribute('data-reason')==='tagged');
              if(reasonBtn){ card.querySelectorAll('.adv-reason-btn.out-mode').forEach(x=>x.classList.remove('sel')); reasonBtn.classList.add('sel'); }
              statusEl.textContent = (outcome==='rundown')
                ? `Result: Rundown — out at ${targetBase.toUpperCase()} (roll ${review.finalRoll})`
                : `Result: Cut down at ${targetBase.toUpperCase()} (roll ${review.finalRoll})`;
            } else if(outcome==='collision'){
              const tbtn = card.querySelector(`.adv-base-btn[data-base="${targetBase}"]`);
              if(tbtn){ card.querySelectorAll('.adv-base-btn').forEach(x=>x.classList.remove('sel')); tbtn.classList.add('sel'); }
              statusEl.textContent = `Result: Safe after collision (roll ${review.finalRoll})`;
            } else if(outcome==='replay'){
              const tbtn = card.querySelector(`.adv-base-btn[data-base="${targetBase}"]`);
              if(tbtn){ card.querySelectorAll('.adv-base-btn').forEach(x=>x.classList.remove('sel')); tbtn.classList.add('sel'); }
              statusEl.textContent = `Result: Replay confirms safe (roll ${review.finalRoll})`;
            } else {
              const tbtn = card.querySelector(`.adv-base-btn[data-base="${targetBase}"]`);
              if(tbtn){ card.querySelectorAll('.adv-base-btn').forEach(x=>x.classList.remove('sel')); tbtn.classList.add('sel'); }
              if(outcome==='error?'){
                statusEl.textContent = `Result: Safe… possible error (roll ${review.finalRoll})`;
                const err = card.querySelector('.error-field'); if(err) err.style.display = 'block';
                const fSel = card.querySelector('[data-err-fielder]');
                if(fSel && isOF && fielderKey){ fSel.value = fielderKey; }
              } else if(outcome==='close'){
                statusEl.textContent = `Result: Safe on a close play (roll ${review.finalRoll})`;
              } else {
                statusEl.textContent = `Result: Safe (roll ${review.finalRoll})`;
              }
            }
          }

          btnNext.addEventListener('click',()=>{ step++; renderStep(); });
          btnApply.addEventListener('click',()=>{ applyToCard(); document.body.removeChild(overlay); });
          btnClose.addEventListener('click',()=>{ document.body.removeChild(overlay); });
        };

        if(prior){
          // Reopen in view mode; no rerolls
          buildModal(prior);
          return;
        }

        // First-time: compute rolls and store
        const review = { pct, attemptRoll: null, attempt: false, adj: 0, breakdown: [], finalRoll: null, outcome: null };
        // Speed gate immediate hold
        if(typeof sp==='number' && sp<=0){
          review.attemptRoll = 0; review.attempt = false;
          if(sBtn){ sBtn.dataset.done='1'; sBtn.dataset.review = JSON.stringify(review); sBtn.title = 'View Stretch details'; }
          buildModal(review);
          // Also reflect hold inline
          if(statusEl){ statusEl.textContent = 'Hold (speed ≤ 0)'; statusEl.classList.add('hold'); }
          return;
        }

        review.attemptRoll = Math.floor(Math.random()*100)+1;
        review.attempt = review.attemptRoll <= pct;
        if(!review.attempt){
          if(sBtn){ sBtn.dataset.done='1'; sBtn.dataset.review = JSON.stringify(review); sBtn.title = 'View Stretch details'; }
          buildModal(review);
          // Inline hold status too
          if(statusEl){ statusEl.textContent = `Hold — no attempt (${review.attemptRoll}/${pct}%)`; statusEl.classList.add('hold'); }
          return;
        }

        Promise.resolve(fName? getPlayerArm(fName) : null).then(arm=>{
          const { adj, breakdown } = computeAdj(arm);
          review.adj = adj; review.breakdown = breakdown;
          // Final roll and outcome
          const outcomeFrom = (roll, rating)=>{
            const r = rating;
            if(r>=7){ if(roll<=3) return 'collision'; if(roll<=6) return 'error?'; if(roll<=15) return 'safe+'; if(roll<=84) return 'safe'; if(roll<=93) return 'close'; if(roll<=96) return 'replay'; return 'out'; }
            if(r===6){ if(roll<=2) return 'collision'; if(roll<=5) return 'error?'; if(roll<=12) return 'safe+'; if(roll<=80) return 'safe'; if(roll<=92) return 'close'; if(roll<=95) return 'replay'; return 'out'; }
            if(r===5){ if(roll<=2) return 'error?'; if(roll<=9) return 'safe+'; if(roll<=75) return 'safe'; if(roll<=90) return 'close'; if(roll<=93) return 'replay'; if(roll<=96) return 'rundown'; return 'out'; }
            if(r===4){ if(roll<=2) return 'error?'; if(roll<=7) return 'safe+'; if(roll<=70) return 'safe'; if(roll<=88) return 'close'; if(roll<=92) return 'replay'; if(roll<=95) return 'rundown'; return 'out'; }
            if(r===3){ if(roll<=2) return 'error?'; if(roll<=5) return 'safe+'; if(roll<=65) return 'safe'; if(roll<=86) return 'close'; if(roll<=90) return 'replay'; if(roll<=94) return 'rundown'; return 'out'; }
            if(r===2){ if(roll<=2) return 'error?'; if(roll<=4) return 'safe+'; if(roll<=60) return 'safe'; if(roll<=84) return 'close'; if(roll<=88) return 'replay'; if(roll<=93) return 'rundown'; return 'out'; }
            if(r===1){ if(roll<=1) return 'error?'; if(roll<=3) return 'safe+'; if(roll<=55) return 'safe'; if(roll<=82) return 'close'; if(roll<=86) return 'replay'; if(roll<=92) return 'rundown'; return 'out'; }
            if(r===0){ if(roll<=1) return 'error?'; if(roll<=2) return 'safe+'; if(roll<=50) return 'safe'; if(roll<=80) return 'close'; if(roll<=85) return 'replay'; if(roll<=91) return 'rundown'; return 'out'; }
            if(r===-1){ if(roll<=1) return 'error?'; if(roll<=2) return 'safe+'; if(roll<=45) return 'safe'; if(roll<=78) return 'close'; if(roll<=83) return 'replay'; if(roll<=90) return 'rundown'; return 'out'; }
            /* r<=-2 */ { if(roll<=1) return 'error?'; if(roll<=2) return 'safe+'; if(roll<=40) return 'safe'; if(roll<=76) return 'close'; if(roll<=82) return 'replay'; if(roll<=89) return 'rundown'; return 'out'; }
          };
          review.finalRoll = Math.floor(Math.random()*99)+1;
          review.outcome = outcomeFrom(review.finalRoll, review.adj);
          // Save for re-open and apply later
          if(sBtn){ sBtn.dataset.done='1'; sBtn.dataset.review = JSON.stringify(review); sBtn.title = 'View Stretch details'; }
          buildModal(review);
        });
      });
    }
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    // Interactions
    rows.forEach(r=>{
      const card = content.querySelector(`.runner-card[data-run="${r.key}"]`);
      if(!card) return;
      const modeBtns = card.querySelectorAll('.mode-btn');
      modeBtns.forEach(btn=> btn.addEventListener('click',()=>{
        modeBtns.forEach(b=> b.classList.remove('active'));
        btn.classList.add('active');
        const isOut = btn.getAttribute('data-mode')==='out';
        card.querySelectorAll('.adv-reason-btn.safe-mode').forEach(b=> b.style.display = isOut?'none':'block');
        card.querySelectorAll('.adv-reason-btn.out-mode').forEach(b=> b.style.display = isOut?'block':'none');
      }));
      // Select first safe-mode reason by default (Advanced By Batter / or Held if FO stay)
      const safeDefaults = card.querySelectorAll('.adv-reason-btn.safe-mode'); if(safeDefaults[0]) safeDefaults[0].classList.add('sel');
      // Base selection
      card.querySelectorAll('.adv-base-btn').forEach(b=> b.addEventListener('click',()=>{
        card.querySelectorAll('.adv-base-btn').forEach(x=> x.classList.remove('sel'));
        b.classList.add('sel');
      }));
      // Reason selection
      card.querySelectorAll('.adv-reason-btn').forEach(b=> b.addEventListener('click',()=>{
        const group = b.classList.contains('safe-mode') ? '.adv-reason-btn.safe-mode' : '.adv-reason-btn.out-mode';
        card.querySelectorAll(group).forEach(x=> x.classList.remove('sel'));
        b.classList.add('sel');
        if(b.getAttribute('data-reason')==='error'){
          card.querySelector('.error-field').style.display='block';
        } else {
          card.querySelector('.error-field').style.display='none';
        }
      }));
      // Preselect base according to defaults (steps) if provided; otherwise current base
      let steps = defaults[r.key] || 0;
      const order = ['home','first','second','third','home'];
      let targetBase = r.from;
      if(steps>0){
        const si = order.indexOf(r.from);
        if(si>=0){
          let di = si + steps;
          if(di >= order.lastIndexOf('home')) di = order.lastIndexOf('home');
          targetBase = order[di];
        }
      }
      const pre = card.querySelector(`.adv-base-btn[data-base="${targetBase}"]`) || card.querySelector(`.adv-base-btn[data-base="${r.from}"]`);
      if(pre) pre.classList.add('sel');
    });
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='cancel-runner2'){ close(); options && options.onCancel && options.onCancel(); } });
    // Wire per-runner Stretch buttons with inline status
    rows.forEach(r=>{
      const card = content.querySelector(`.runner-card[data-run="${r.key}"]`);
      if(!card) return;
      const sBtn = card.querySelector('.stretch-btn');
      if(sBtn){ sBtn.addEventListener('click', ()=> applyStretchToCard(card, r)); }
    });
    content.querySelector('#apply-runner2').addEventListener('click',()=>{
      const order=['home','first','second','third','home'];
      const adv={ first:0, second:0, third:0, batter:0 };
      const reasonsByRunner={};
      const outs=[];
      let batterSelectedOut = false;
      rows.forEach(r=>{
        const card = content.querySelector(`.runner-card[data-run="${r.key}"]`);
        if(!card) return;
        const isOut = !!card.querySelector('.mode-btn[data-mode="out"].active');
        const baseBtn = card.querySelector('.adv-base-btn.sel');
        const reasonBtn = card.querySelector('.adv-reason-btn.sel');
        const dest = baseBtn ? baseBtn.getAttribute('data-base') : r.from;
        const reason = reasonBtn ? reasonBtn.getAttribute('data-reason') : (isOut ? 'tagged' : 'held');
        if(reason==='error'){
          const fldSel = card.querySelector('[data-err-fielder]');
          const fld = fldSel ? fldSel.value : '';
          if(!fld){ showToast('Select fielder for error'); return; }
          reasonsByRunner[r.name] = { cause:'error', fielder: fld };
        } else if(reason==='stolen'){
          reasonsByRunner[r.name] = { cause:'stolen' };
        } else if(reason==='passed-ball'){
          reasonsByRunner[r.name] = { cause:'pb' };
        } else if(reason==='wild-pitch'){
          reasonsByRunner[r.name] = { cause:'wp' };
        } else if(reason==='caught-stealing'){
          outs.push({ runner:r.name, atBase:dest, reason:'caught-stealing' });
          return; // skip advance calc
        } else if(reason==='picked-off'){
          outs.push({ runner:r.name, atBase:r.from, reason:'picked-off' });
          return;
        } else if(reason==='double-play'){
          outs.push({ runner:r.name, atBase:dest, reason:'double-play' });
          return;
        }
        if(isOut){
          outs.push({ runner:r.name, atBase:dest, reason: (reason==='force'?'force':(reason==='tagged'?'tagged':reason)) });
          if(r.key==='batter') batterSelectedOut = true;
        } else {
          const from = r.from; let si = order.indexOf(from); let di = dest==='home' ? order.lastIndexOf('home') : order.indexOf(dest); let steps = 0; if(si>=0 && di>=0){ steps = di - si; if(steps<0) steps=0; }
          adv[r.key] = Math.max(0, steps);
        }
      });
      // If batter and at least one other runner both selected out (double play intent), proactively record both outs immediately to avoid later overwrites
      try{
        if(batterSelectedOut && outs.length>1){
          const extra = outs.filter(o=> o.runner !== state.batter);
          // Record batter out first
          recordOut();
          // Then record each additional out
          extra.forEach(()=>{ recordOut(); });
          // Mark that outs already counted to prevent double counting downstream (encode flag in adv object)
          adv.__outsAlreadyCounted = true;
        }
      }catch(_){ }
      try{ console.debug('[RunnerModal APPLY]', { adv: JSON.parse(JSON.stringify(adv)), outs: JSON.parse(JSON.stringify(outs)), reasons: JSON.parse(JSON.stringify(reasonsByRunner)) }); }catch(_){ }
      close(); options && options.onApply && options.onApply(adv, reasonsByRunner, outs);
    });
    return modal;
  }

  // Move existing runners only by steps; may score. No PA/AB/BF. Optionally use playKind for credit (e.g., SF RBIs)
  function applyRunnerAdvancesOnly(playKind, adv, reasonsByRunner, outs){
    // Snapshot half/inning to detect inning changes during outs processing
    const snapHalf = state.half; const snapInning = state.inning;
    // Persist error-caused status for runners involved in this movement
    try{ Object.entries(reasonsByRunner||{}).forEach(([name,info])=>{ if(info && info.cause==='error'){ state.reachedByError[name] = true; } }); }catch(_){ }
    // First, process any explicit runner outs before placing advances
    try{
      if(outs && outs.length){ try{ console.debug('[AdvOnly] processing outs', JSON.parse(JSON.stringify(outs))); }catch(_){ } }
      if(adv && adv.__outsAlreadyCounted){ console.debug('[AdvOnly] outs already counted upstream'); }
      (outs||[]).forEach(o=>{
        if(!o || !o.runner) return;
        if(adv && adv.__outsAlreadyCounted) return; // skip since already applied
        // Find which base the runner currently occupies
        const spots = ['first','second','third'];
        let base = spots.find(b=> state.bases[b] === o.runner) || null;
        if(!base){
          // Batter out before placement OR runner name mismatch; still credit the out so it isn't lost
          recordOut();
          try{
            const fragNF = `${o.runner} ${o.reason==='caught-stealing'?'caught stealing': o.reason==='picked-off'?'picked off': o.reason==='double-play'?'out (DP)': o.reason==='force'?'force out': o.reason==='tagged'?'tagged out':'out'}`;
            state.lastPlay = state.lastPlay ? (state.lastPlay + ' | ' + fragNF) : fragNF;
          }catch(_){ }
          return;
        }
        // Clear that base and record an out
        state.bases[base] = null; state.resp[base] = null;
        recordOut();
        // Append a fragment to lastPlay so user sees which runner was out (non-destructive chaining)
        try{
          const frag = `${o.runner} ${o.reason==='caught-stealing'?'caught stealing': o.reason==='picked-off'?'picked off': o.reason==='double-play'?'out (DP)': o.reason==='force'?'force out': o.reason==='tagged'?'tagged out': 'out'}`;
          state.lastPlay = state.lastPlay ? (state.lastPlay + ' | ' + frag) : frag;
        }catch(_){ }
      });
    }catch(_){ }
    const moves = [
      {from:'third', n: (adv.third||0), runner: state.bases.third, rp: state.resp.third},
      {from:'second', n: (adv.second||0), runner: state.bases.second, rp: state.resp.second},
      {from:'first', n: (adv.first||0), runner: state.bases.first, rp: state.resp.first}
    ];
    const extraBatterSteps = adv.batter||0; // used only if batter is currently at first (e.g., FC)
    // Reset bases, we'll re-place
    const before = JSON.parse(JSON.stringify(state.bases));
    state.bases = {first:null, second:null, third:null};
    state.resp = {first:null, second:null, third:null};
  let runs = 0; const scoredNames = []; const scoredResp = []; const scoredWasError = [];
    const order = ['home','first','second','third','home'];
    function place(from, n, name, respPitcher){
      if(!name) return 0;
      let idx = order.indexOf(from);
      while(n>0){ idx++; n--; }
      while(true){
        const dest = order[idx];
        if(dest==='home'){ scoredNames.push(name); scoredResp.push(respPitcher||state.pitcher); scoredWasError.push(!!(reasonsByRunner && reasonsByRunner[name] && reasonsByRunner[name].cause==='error')); return 1; }
        if(!state.bases[dest]){ state.bases[dest] = name; state.resp[dest] = respPitcher||state.pitcher; return 0; }
        // push occupant ahead one base
        const pushed = state.bases[dest]; const pushedRP = state.resp[dest];
        state.bases[dest] = null; state.resp[dest] = null;
        const s = place(dest, 1, pushed, pushedRP);
        if(s){ /* keep placing current */ }
        continue;
      }
    }
    // Place current runners with their chosen steps
    for(const m of moves){ if(m.runner) runs += place(m.from, m.n, m.runner, m.rp)||0; }
    // Handle batter extra steps only if he is currently on first (e.g., FC)
    if(extraBatterSteps>0 && before.first && before.first===state.batter){ runs += place('first', extraBatterSteps, state.batter, state.resp.first||state.pitcher)||0; }
    // Animations
    try{
      if(moves[2].runner && moves[2].n>0){ animateRunnerGhostPath(buildRunnerPath('first', moves[2].n)); }
      if(moves[1].runner && moves[1].n>0){ animateRunnerGhostPath(buildRunnerPath('second', moves[1].n)); }
      if(moves[0].runner && moves[0].n>0){ animateRunnerGhostPath(buildRunnerPath('third', moves[0].n)); }
      if(extraBatterSteps>0){ animateRunnerGhostPath(buildRunnerPath('first', extraBatterSteps)); }
    }catch(_){ }
    // Credit runs to responsible pitchers; ER suppression flag applies globally (heuristic already in state)
    if(runs>0){
      scoreRuns(runs);
      scoredNames.forEach(addRun);
      try{ scoredResp.forEach((rp,i)=>{ if(rp){ ensurePitcherEntry(rp); state.stats.pitching[rp].R += 1; const nm = scoredNames[i]; const unearned = (playKind==='E') || (scoredWasError[i]) || (state.reachedByError && state.reachedByError[nm]===true) || state.erSuppress; if(!unearned){ state.stats.pitching[rp].ER += 1; } } }); }catch(_){ }
      // RBI credit rules for certain outs/plays
      // Sac fly: credit RBI(s)
      if(playKind==='SF' && state.batter){ addRBI(state.batter, runs); }
      // Groundout: credit RBI for runs that scored not due to error (typical RBI groundout)
      if(playKind==='GO' && state.batter){
        let rbiRuns = 0; scoredWasError.forEach((wasErr)=>{ if(!wasErr) rbiRuns += 1; });
        if(rbiRuns>0) addRBI(state.batter, rbiRuns);
      }
      // Clear error flags for runners who scored
      try{ scoredNames.forEach(n=>{ if(state.reachedByError && state.reachedByError[n]) delete state.reachedByError[n]; }); }catch(_){ }
    }
  }

  function applyRunnerAdvances(code, adv, context, reasonsByRunner, outs){
    const snapHalf = state.half; const snapInning = state.inning;
    // Count plate appearance
    addPA(state.batter);
    // pitcher faced
  try{ const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF += 1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf = (state.pitcherStint.bf||0) + 1; } }catch(_){ } } }catch(_){ }
    // Persist error-caused status for runners (including batter) involved in this movement
    try{ Object.entries(reasonsByRunner||{}).forEach(([name,info])=>{ if(info && info.cause==='error'){ state.reachedByError[name] = true; } }); }catch(_){ }
    // Process any explicit outs selected in the modal BEFORE advancing anyone so they cannot score
    const outFragments = [];
    const batterOutSelected = (outs||[]).some(o=> o && o.runner === state.batter);
    try{
      if(outs && outs.length){ try{ console.debug('[HitAdv] outs received', JSON.parse(JSON.stringify(outs))); }catch(_){ } }
      if(adv && adv.__outsAlreadyCounted){ console.debug('[HitAdv] outs already counted upstream'); }
      (outs||[]).forEach(o=>{
        if(!o || !o.runner) return;
        if(adv && adv.__outsAlreadyCounted) return; // skip since already applied
        // Locate runner on base paths (before movement batter is still at home and cannot be out unless UI allowed it; ignore batter out here)
        const spots = ['first','second','third'];
        let base = spots.find(b=> state.bases[b] === o.runner) || null;
        if(!base){
          // Batter out or name mismatch: still count the out so it is not lost
            recordOut();
            const fragMiss = `${o.runner} ${o.reason==='caught-stealing'?'caught stealing': o.reason==='picked-off'?'picked off': o.reason==='double-play'?'out (DP)': o.reason==='force'?'force out': o.reason==='tagged'?'tagged out':'out'}`;
            outFragments.push(fragMiss);
            return;
        }
        state.bases[base] = null; state.resp[base] = null;
        recordOut();
        const frag = `${o.runner} ${o.reason==='caught-stealing'?'caught stealing': o.reason==='picked-off'?'picked off': o.reason==='double-play'?'out (DP)': o.reason==='force'?'force out': o.reason==='tagged'?'tagged out':'out'}`;
        outFragments.push(frag);
      });
    }catch(_){ }
    // If inning ended while processing outs on the bases, stop here and do not award hit placement
    if(state.half!==snapHalf || state.inning!==snapInning){
      // Ensure we don't leave summary empty
      if(outFragments && outFragments.length){ state.lastPlay = outFragments.join(' | '); }
      try{ concludeResultAndReroll(); }catch(_){ updateAll(); }
      return;
    }
    // If inning changed due to outs, abort any further runner placement/animation
    if(state.half!==snapHalf || state.inning!==snapInning){ return; }
    // If batter was selected OUT, treat this play as an out (override hit/walk/error awarding below)
    if(batterOutSelected){
      // Award AB (unless walk/HBP style code which we ignore because batter is out)
      if(['BB','HBP'].includes(code)){ /* ignore walk/HBP stats if user overrode to out */ }
      else if(code==='E'){ addAB(state.batter); /* reaching on error overruled */ }
      else if(code!=='HR'){ addAB(state.batter); }
      // Simple classification as groundball if an infield location (heuristic)
      try{ addGB(state.batter); const p=state.pitcher; if(p) addP_GB(p); }catch(_){ }
      let summary = outFragments.join(' | ');
      state.lastPlay = summary || (state.batter + ' out');
      nextBatter();
      try{ concludeResultAndReroll(); }catch(_){ updateAll(); }
      return; // Do not proceed with advancement/placement logic for a hit
    }
    // Clear and compute based on adv per runner
    const moves = [
      {from:'third', n: adv.third||0, runner: state.bases.third},
      {from:'second', n: adv.second||0, runner: state.bases.second},
      {from:'first', n: adv.first||0, runner: state.bases.first}
    ];
    const batterMove = {from:'home', n: adv.batter||0, runner: state.batter};
  // Reset bases before placing
    state.bases = {first:null, second:null, third:null};
    state.resp = {first:null, second:null, third:null};
  let runs = 0; const scoredNames = []; const scoredResp = []; const scoredWasError = [];
    const order = ['home','first','second','third','home'];
    function place(from, n, name, respPitcher){
      if(!name || n<=0) return 0;
      let idx = order.indexOf(from);
      while(n>0){ idx++; n--; }
      // idx now points to destination in order array
      while(true){
        const dest = order[idx];
        if(dest==='home'){ scoredNames.push(name); scoredResp.push(respPitcher || state.pitcher); scoredWasError.push(!!(reasonsByRunner && reasonsByRunner[name] && reasonsByRunner[name].cause==='error')); return 1; }
        if(!state.bases[dest]){ state.bases[dest] = name; state.resp[dest] = respPitcher || state.pitcher; return 0; }
        // push occupant forward by one if possible
        const pushed = state.bases[dest]; const pushedRP = state.resp[dest];
        state.bases[dest] = null; state.resp[dest] = null;
        const scored = place(dest, 1, pushed, pushedRP); // recursive push one base
        if(scored){ /* occupant scored; continue to try to place current */ }
        // try placing current again at same dest (now vacated)
        continue;
      }
    }
    // Place existing runners from third->second->first
    for(const m of moves){ runs += place(m.from, m.n, m.runner, (m.from==='third'?state.resp.third:m.from==='second'?state.resp.second:state.resp.first)||state.pitcher)||0; }
    // Place batter
    runs += place('home', batterMove.n, batterMove.runner, state.pitcher)||0;
    // Animations: runner paths and ball flight (non-blocking)
    try{
      // Ball from home to selected location if provided
      if(context && context.locNum){ animateBallPath([ baseCoords.home, numToCoords(context.locNum) ]); }
      // Batter movement
      if(batterMove.n>0){ animateRunnerGhostPath(buildRunnerPath('home', batterMove.n)); }
      // Existing runners from bases
      if(moves[2].runner && moves[2].n>0){ animateRunnerGhostPath(buildRunnerPath('first', moves[2].n)); }
      if(moves[1].runner && moves[1].n>0){ animateRunnerGhostPath(buildRunnerPath('second', moves[1].n)); }
      if(moves[0].runner && moves[0].n>0){ animateRunnerGhostPath(buildRunnerPath('third', moves[0].n)); }
    }catch(_){ }
  if(runs>0){ scoreRuns(runs); scoredNames.forEach(addRun); try{ scoredResp.forEach((rp,i)=>{ if(rp){ ensurePitcherEntry(rp); state.stats.pitching[rp].R += 1; const nm = scoredNames[i]; const unearned = (code==='E') || (scoredWasError[i]) || (state.reachedByError && state.reachedByError[nm]===true) || state.erSuppress; if(!unearned){ state.stats.pitching[rp].ER += 1; } } }); }catch(_){ } try{ scoredNames.forEach(n=>{ if(state.reachedByError && state.reachedByError[n]) delete state.reachedByError[n]; }); }catch(_){ } }
    // Stats: credit batter appropriately
    let summary = '';
    const locNum = context && context.locNum;
    const locText = locNum ? (['7','8','9'].includes(String(locNum)) ? ` to ${numLabel[locNum]}` : ` to ${numLabel[locNum]} (infield)`) : '';
    const batter = state.batter;
  if(code==='HR'){ addHit(batter,4); addRun(batter); addRBI(batter, runs); try{ const p=state.pitcher; if(p){ if(!state.stats.pitching[p]) state.stats.pitching[p]={BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0,GB:0,FB:0,SF:0}; state.stats.pitching[p].H+=1; state.stats.pitching[p].HR+=1; /* classify as flyball for HR/FB */ try{ addFB(batter); addP_FB(p); }catch(_){ } } }catch(_){ } summary = `${batter} homers${locText}, ${runs} run${runs===1?'':'s'} score`; }
  else if(code==='1B'){ addHit(batter,1); try{ const p=state.pitcher; if(p){ if(!state.stats.pitching[p]) state.stats.pitching[p]={BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0,GB:0,FB:0,SF:0}; state.stats.pitching[p].H+=1; } }catch(_){ } addRBI(batter,runs); /* if outfield location, count as FB */ try{ if(locNum && ['7','8','9'].includes(String(locNum))){ addFB(batter); const p=state.pitcher; if(p) addP_FB(p); } }catch(_){ } summary = `${batter} singles${locText}, ${runs||0} run${runs===1?'':'s'} score`; }
  else if(code==='2B'){ addHit(batter,2); try{ const p=state.pitcher; if(p){ if(!state.stats.pitching[p]) state.stats.pitching[p]={BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0,GB:0,FB:0,SF:0}; state.stats.pitching[p].H+=1; } }catch(_){ } addRBI(batter,runs); try{ if(locNum && ['7','8','9'].includes(String(locNum))){ addFB(batter); const p=state.pitcher; if(p) addP_FB(p); } }catch(_){ } summary = `${batter} doubles${locText}, ${runs||0} run${runs===1?'':'s'} score`; }
  else if(code==='3B'){ addHit(batter,3); try{ const p=state.pitcher; if(p){ if(!state.stats.pitching[p]) state.stats.pitching[p]={BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0,GB:0,FB:0,SF:0}; state.stats.pitching[p].H+=1; } }catch(_){ } addRBI(batter,runs); try{ if(locNum && ['7','8','9'].includes(String(locNum))){ addFB(batter); const p=state.pitcher; if(p) addP_FB(p); } }catch(_){ } summary = `${batter} triples${locText}, ${runs||0} run${runs===1?'':'s'} score`; }
  else if(code==='E'){ addAB(batter); if((state.outs||0)>=2) state.erSuppress = true; try{ state.reachedByError[batter] = true; }catch(_){ } const fnum = (context && context.locNum) ? context.locNum : null; summary = `${batter} reaches on E${fnum||'?'}${locText}`; }
    // Prepend any out fragments if present
    if(outFragments.length){ summary = outFragments.join(' | ') + (summary ? (' | ' + summary) : ''); }
    state.lastPlay = summary;
    nextBatter();
    try{ concludeResultAndReroll(); }catch(_){ updateAll(); try{ clearRngAndGlow(); }catch(_){ } try{ prepareRngAndGlow(); }catch(_){ } }
  }

  // Hit location picker
  function openHitLocationModal(code, onPicked){
    const modal = document.createElement('div');
    Object.assign(modal.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:'1001' });
    const content = document.createElement('div');
    Object.assign(content.style, { background:'rgba(255,255,255,0.22)', border:'2px solid #fff', borderRadius:'20px', backdropFilter:'blur(8px)', padding:'20px', minWidth:'360px', color:'#fff', boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44' });
    const order = [7,8,9,5,6,4,3,1,2];
    content.innerHTML = `
      <h3 style="margin:0 0 8px;">Hit Location (${code})</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${order.map(n=>`<button data-loc="${n}" style="padding:10px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.18);">${numLabel[n]}</button>`).join('')}
      </div>
      <div style="margin-top:12px;text-align:right;"><button id="cancel-hitloc" style="padding:8px 12px;border:none;border-radius:10px;background:#334; color:#fff; cursor:pointer;">Skip</button></div>
    `;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='cancel-hitloc'){ close(); onPicked && onPicked(null); } });
    content.querySelectorAll('button[data-loc]').forEach(btn=>{
      btn.addEventListener('click',()=>{ const n = parseInt(btn.getAttribute('data-loc'),10); close(); onPicked && onPicked(n); });
    });
  }

  function applyPlay(code){
    try{ pushHistory('play'); }catch(_){ }
    let runs = 0; let rbi = 0; let summary='';
    switch(code){
  case '1B': { addPA(state.batter); const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF+=1; state.stats.pitching[p].H+=1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } }catch(_){ } } addHit(state.batter,1); runs = advanceRunners(1); rbi = runs; summary = `${state.batter} singles, ${runs} run${runs===1?'':'s'} score`; break; }
  case '2B': { addPA(state.batter); const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF+=1; state.stats.pitching[p].H+=1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } }catch(_){ } } addHit(state.batter,2); runs = advanceRunners(2); rbi = runs; summary = `${state.batter} doubles, ${runs} run${runs===1?'':'s'} score`; break; }
  case '3B': { addPA(state.batter); const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF+=1; state.stats.pitching[p].H+=1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } }catch(_){ } } addHit(state.batter,3); runs = advanceRunners(3); rbi = runs; summary = `${state.batter} triples, ${runs} run${runs===1?'':'s'} score`; break; }
  case 'HR': { addPA(state.batter); const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF+=1; state.stats.pitching[p].H+=1; state.stats.pitching[p].HR+=1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } }catch(_){ } } addHit(state.batter,4); runs = advanceRunners(4); rbi = runs; summary = `${state.batter} homers, ${runs} run${runs===1?'':'s'} score`; break; }
  case 'BB': { addPA(state.batter); const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF+=1; state.stats.pitching[p].BB+=1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } }catch(_){ } } addBB(state.batter); const res = walkOrHBP(); runs = res.runs||0; rbi = runs; (res.scored||[]).forEach(addRun); if(runs>0 && p && state.stats.pitching[p]){ state.stats.pitching[p].R += runs; if(!state.erSuppress) state.stats.pitching[p].ER += runs; } summary = `${state.batter} walks${runs?`, ${runs} run${runs===1?'':'s'} score`:''}`; break; }
  case 'HBP': { addPA(state.batter); const p=state.pitcher; if(p && !isPlaceholder(p)){ ensurePitcherEntry(p); state.stats.pitching[p].BF+=1; state.stats.pitching[p].HBP+=1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } }catch(_){ } } addHBP(state.batter); const res = walkOrHBP(); runs = res.runs||0; rbi = runs; (res.scored||[]).forEach(addRun); if(runs>0 && p && state.stats.pitching[p]){ state.stats.pitching[p].R += runs; if(!state.erSuppress) state.stats.pitching[p].ER += runs; } summary = `${state.batter} hit by pitch${runs?`, ${runs} run${runs===1?'':'s'} score`:''}`; break; }
  case 'E': { addPA(state.batter); const p=state.pitcher; if(p && !isPlaceholder(p)){ if(!state.stats.pitching[p]) state.stats.pitching[p]={BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0}; state.stats.pitching[p].BF+=1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } }catch(_){ } } runs = advanceRunners(1); addAB(state.batter); summary = `${state.batter} reaches on error`; break; }
  case 'FC': { addPA(state.batter); const p=state.pitcher; if(p && !isPlaceholder(p)){ if(!state.stats.pitching[p]) state.stats.pitching[p]={BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0}; state.stats.pitching[p].BF+=1; try{ if(state.pitcherStint && state.pitcherStint.name===p){ state.pitcherStint.bf=(state.pitcherStint.bf||0)+1; } }catch(_){ } } fieldersChoice(); addAB(state.batter); summary = `${state.batter} reaches on fielder's choice`; break; }
      default: return;
    }
    if(rbi>0) addRBI(state.batter, rbi);
    state.lastPlay = summary;
    // Track consecutive baserunners traffic and fatigue impact immediately
    try{
      const onBaseEvent = ['1B','2B','3B','HR','BB','HBP','E','FC'].includes(code);
      state._trafficCount = onBaseEvent ? ((state._trafficCount||0)+1) : 0;
      const teamKey = fieldingTeamKey();
      const bf = getPitcherBFStateForTeam(teamKey);
      if(bf){
        const preCap = effectiveCapFromState(bf);
        const side = (teamKey===state.home?'home':'away');
        const startedName = (state._starterByTeam && state._starterByTeam[side]) || '';
        const isStarter = (bf.name === startedName);
        const ctx = { isStarter, isOut:false, runsScored: runs||0, consecutiveBaserunners: state._trafficCount||0 };
        const adj = computeBFDeltaForOutcome(code, ctx);
        recordBFAdjustmentForPitcher(bf.name, adj);
        const after = getPitcherBFStateForTeam(teamKey);
        const postCap = effectiveCapFromState(after);
        try{
          state._bfDebug = state._bfDebug || [];
          state._bfDebug.unshift({ p: bf.name, outcome: code, ctx, preCap, adj: Math.round(adj), postCap, time: Date.now() });
          if(state._bfDebug.length>6) state._bfDebug.length=6;
        }catch(_){ }
        enforceBFLimitIfNeeded();
      }
    }catch(_){ }
    // New batter after applying fatigue/cap
    nextBatter();
    updateAll();
    try{ clearRngAndGlow(); }catch(_){ }
    try{ prepareRngAndGlow(); }catch(_){ }
  }

  function initials(name){ if(!name) return ''; const parts = name.split(/\s+/); let s = parts[0]?.[0]||''; if(parts.length>1) s += parts[1]?.[0]||''; return s.toUpperCase(); }
  function badge(text){ return `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-weight:800;color:#fff;font-size:12px;letter-spacing:.5px;">${text||''}</span>`; }
  function fielderBadge(abbr){ return `<span style="position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);font-weight:800;color:#fff;font-size:12px;letter-spacing:.5px;opacity:.95;">${abbr||''}</span>`; }
  function handBadge(letter, kind){
    const common = 'position:absolute;display:inline-block;font-weight:900;color:#0a0f14;font-size:11px;line-height:1;padding:4px 6px;border-radius:10px;background:linear-gradient(90deg,#fbbf24,#f59e0b);box-shadow:0 2px 8px rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.65);';
    if(kind==='pitcher'){
      return `<span style="${common} top:-12px; right:-12px;">${letter||''}</span>`;
    }
    // batter
    return `<span style="${common} bottom:-10px; right:-10px;">${letter||''}</span>`;
  }

  function fieldersChoice(){
    try{ pushHistory('fc'); }catch(_){ }
    // Simple fielder's choice: Batter to first, lead runner out if any; otherwise treat as ground out to first.
    const leadBase = state.bases.third ? 'third' : (state.bases.second ? 'second' : (state.bases.first ? 'first' : null));
    if(leadBase){
      // Do not mutate outs here. Place batter at first, remove lead runner placeholder, then defer outs to modal's outs list.
      state.bases[leadBase] = null; // runner will be marked out via modal outs for proper credit
      // Force advances behind if applicable (simplified one base)
      if(leadBase==='third'){}
      if(state.bases.second && !state.bases.third) { state.bases.third = state.bases.second; state.resp.third = state.resp.second; state.bases.second = null; state.resp.second = null; }
      if(state.bases.first && !state.bases.second) { state.bases.second = state.bases.first; state.resp.second = state.resp.first; state.bases.first = null; state.resp.first = null; }
      // Batter to first
      state.bases.first = state.batter; state.resp.first = state.pitcher;
      state.lastPlay = `${state.batter} reaches on fielder's choice`;
      // Prompt for outs/advances; user must mark the lead runner out explicitly (we won't auto-record here to avoid double-count)
      { const m = openRunnerAdvanceOnlyModal('FC', {
        includeBatter: true,
        onApply: (adv, reasons, outs)=>{ applyRunnerAdvancesOnly('FC', adv, reasons||{}, outs||[]); nextBatter(); concludeResultAndReroll(); },
        onCancel: ()=>{ nextBatter(); concludeResultAndReroll(); }
      }); if(!m){ nextBatter(); concludeResultAndReroll(); } }
    } else {
      // No runners, it's just a ground out
      recordOut();
      state.lastPlay = `${state.batter} grounds out`;
      nextBatter(); concludeResultAndReroll();
    }
  }

  function walkOrHBP(){
    // Force runners only
    let forcedRun = 0; const scored=[];
    const runnerOnThird = state.bases.third;
    if(state.bases.first){
      if(state.bases.second){
        if(state.bases.third){
          // bases loaded -> run scores
          scoreRuns(1); forcedRun = 1; if(runnerOnThird) addRun(runnerOnThird), scored.push(runnerOnThird);
        }
        if(!state.bases.third){ state.bases.third = state.bases.second; }
      }
      if(!state.bases.second){ state.bases.second = state.bases.first; }
    }
    // batter to first
    state.bases.first = state.batter;
    return { runs: forcedRun, scored };
  }

  function advanceRunners(bases){
    // bases: 1,2,3,4 (HR)
    const order = ['third','second','first'];
    let runs = 0;
    const scoredNames = [];
    // Move existing runners
    for(const b of order){
      const runner = state.bases[b];
      const rp = state.resp[b];
      if(!runner) continue;
      state.bases[b] = null;
      state.resp[b] = null;
      const target = nextBase(b, bases);
      if(target==='home'){ runs += 1; try{ if(rp){ if(!state.stats.pitching[rp]) state.stats.pitching[rp]={BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0}; state.stats.pitching[rp].R += 1; } }catch(_){ } scoredNames.push(runner); }
      else { state.bases[target] = runner; state.resp[target] = rp || state.pitcher; }
    }
    // Batter
    if(bases>=4){ runs += 1; scoredNames.push(state.batter); } else {
      const dest = bases===3 ? 'third' : bases===2 ? 'second' : 'first';
      // If destination occupied, cascade one base (simplified)
      if(dest==='second' && state.bases.second && !state.bases.third){ state.bases.third = state.bases.second; state.resp.third = state.resp.second; state.bases.second = null; state.resp.second = null; }
      if(dest==='first' && state.bases.first && !state.bases.second){ state.bases.second = state.bases.first; state.resp.second = state.resp.first; state.bases.first = null; state.resp.first = null; }
      state.bases[dest] = state.batter; state.resp[dest] = state.pitcher;
    }
    if(runs>0) scoreRuns(runs);
    try{ scoredNames.forEach(addRun); }catch(_){ }
    return runs;
  }

  function nextBase(from, n){
    const order=['home','first','second','third','home'];
    let idx = order.indexOf(from);
    while(n>0){ idx++; n--; }
    if(idx>=order.length) idx = order.length-1;
    return order[idx];
  }

  function scoreRuns(n){
    const teamKey = battingTeamKey();
    const h0 = state.score[state.home]||0, a0 = state.score[state.away]||0;
    const leaderBefore = (h0===a0) ? 'tied' : ((h0>a0)? state.home : state.away);
    state.score[teamKey] = (state.score[teamKey]||0) + n;
    // Log key play: scoring event
    try{
      state.keyPlays = state.keyPlays || [];
      state.keyPlays.push({ ts: Date.now(), inning: state.inning, half: state.half, type: 'score', team: teamKey, runs: n, desc: `${teamKey} score ${n}` });
    }catch(_){ }
    // Update inning-by-inning line score
    try{
      const side = (state.half==='top') ? 'away' : 'home';
      const arr = state.lineScore[side] || (state.lineScore[side] = []);
      const idx = Math.max(0, (state.inning||1) - 1);
      while(arr.length <= idx) arr.push(0);
      arr[idx] += n;
    }catch(_){ }
    // Lead-change and blown save detection
    try{
      const h1 = state.score[state.home]||0, a1 = state.score[state.away]||0;
      const leaderAfter = (h1===a1) ? 'tied' : ((h1>a1)? state.home : state.away);
      // If batting team took the lead (new leader equals batting team and changed), set potential W/L and check BS
      if(leaderAfter !== leaderBefore && leaderAfter !== 'tied' && leaderAfter===teamKey){
        // Potential winning pitcher for batting team is their last fielding pitcher
        const side = (teamKey===state.home)? 'home':'away';
        const lastFld = state._lastFieldingPitcherByTeam ? state._lastFieldingPitcherByTeam[teamKey] : null;
        state._potentialWinningPitcher = state._potentialWinningPitcher || { home:null, away:null };
        state._potentialWinningPitcher[side] = lastFld || state._starterByTeam[side] || lastFld;
        // Potential losing pitcher is current opposing pitcher
        state._potentialLosingPitcher = state.pitcher || null;
        // Blown save: if current opposing pitcher entered with a lead and now tie/behind occurs in this scoring, charge BS once
        try{
          const p = state.pitcher;
          if(p && state.pitcherStint && state.pitcherStint.name===p && !state.pitcherStint.bsCharged){
            const startLead = Number(state.pitcherStint.startLead||0);
            if(startLead>0){
              ensurePitcherEntry(p);
              state.stats.pitching[p].BS = (state.stats.pitching[p].BS||0) + 1;
              state.pitcherStint.bsCharged = true;
            }
          }
        }catch(_){ }
      }
      state._lastLead = leaderAfter;
    }catch(_){ }
    // Walk-off check: bottom of 9th or later, if home goes ahead mid-inning, game ends immediately
    try{
      if(!state.gameOver && state.inning>=9 && state.half==='bottom'){
        const h = state.score[state.home]||0; const a = state.score[state.away]||0;
        if(h>a){
          try{ state.keyPlays.push({ ts: Date.now(), inning: state.inning, half: state.half, type:'walkoff', team: state.home, runs: n, desc: `${state.home} walk-off` }); state._walkoff = true; }catch(_){ }
          endGame(state.home); return;
        }
      }
    }catch(_){ }
    // Credit runs to players currently scoring where possible (simplified):
    // Detailed credit happens where we know the names (applyRunnerAdvances, walkOrHBP, SF)
  }
  // --- History (Undo), Save/Load ---
  function snapshot(){
    return JSON.parse(JSON.stringify({
      home: state.home,
      away: state.away,
      score: state.score,
      outs: state.outs,
      inning: state.inning,
      half: state.half,
      fielders: state.fielders,
      bases: state.bases,
      batter: state.batter,
      pitcher: state.pitcher,
      lineups: state.lineups,
      battingIndex: state.battingIndex,
      stats: state.stats,
      resp: state.resp,
      lastPlay: state.lastPlay,
      gameLog: state.gameLog,
      lineScore: state.lineScore,
      erSuppress: state.erSuppress,
      pitcherStint: state.pitcherStint,
      reachedByError: state.reachedByError,
      pendingRng: state.pendingRng,
      gameOver: state.gameOver,
      winner: state.winner,
      lastBatterByTeam: state.lastBatterByTeam,
      keyPlays: state.keyPlays
    }));
  }
  function restore(snap){
    if(!snap) return;
    const copy = JSON.parse(JSON.stringify(snap));
    // Avoid logging the act of restore
    state._suppressLog = true;
    try{ Object.assign(state, copy); } finally { state._suppressLog = false; }
  }
  function pushHistory(){ try{ state.history.push(snapshot()); if(state.history.length>50) state.history.shift(); state._redo = []; }catch(_){ } }
  function undoLast(){ const prev = state.history.pop(); if(!prev){ showToast('Nothing to undo'); return; } try{ state._redo = state._redo || []; state._redo.push(snapshot()); if(state._redo.length>50) state._redo.shift(); }catch(_){ } restore(prev); updateAll(); }
  function redoLast(){ const next = (state._redo||[]).pop(); if(!next){ showToast('Nothing to redo'); return; } try{ state.history.push(snapshot()); if(state.history.length>50) state.history.shift(); }catch(_){ } restore(next); updateAll(); }
  function saveGame(){ try{ localStorage.setItem('ibl.gameState', JSON.stringify(snapshot())); state.lastPlay='Game saved'; updateAll(); }catch(_){ showToast('Save failed'); } }
  function loadGame(){ try{ const raw = localStorage.getItem('ibl.gameState'); if(!raw){ showToast('No saved game'); return; } const snap = JSON.parse(raw); restore(snap); state.lastPlay='Game loaded'; updateAll(); }catch(_){ showToast('Load failed'); } }

  function formatIPOuts(outs){ outs=outs||0; const ip = Math.floor(outs/3); const rem = outs%3; return `${ip}${rem?'.'+rem:''}`; }

  function openPitchChangeModal(){
    const teamKey = fieldingTeamKey();
    // Relief change: show only RP or legacy generic P; exclude SP-only
    const list = rosterList(teamKey);
    const sideKey = (teamKey===state.home) ? 'home' : 'away';
    const used = ((state._pitchersUsedByTeam||{})[sideKey]) || [];
    const isSP = (p)=> Array.isArray(p.pos) && p.pos.includes('SP');
    const isLegacyP = (p)=> Array.isArray(p.pos) && p.pos.includes('P');
    const isRP = (p)=> Array.isArray(p.pos) && p.pos.includes('RP');
    let roster = list.filter(p=> (isRP(p) || isLegacyP(p)) && !(used.includes(p.name) && p.name !== state.pitcher));
    const rankType = (p)=> (isSP(p)&&isRP(p))?0 : (isRP(p)?1:2);
    const rankRole = (p)=>{ const order = ['Long Relief','Specialist','Middle Relief','Setup','Closer']; const r=p.role||''; const i=order.indexOf(r); return i>=0?i:order.length; };
    roster = roster.slice().sort((a,b)=> rankType(a)-rankType(b) || rankRole(a)-rankRole(b) || a.name.localeCompare(b.name));
  if(!roster.length){ showToast('No pitchers available.'); return; }
    const lastGameBF = getLastGameBFMap(teamKey);
    const recommended = pickBullpenReplacement(teamKey);
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'radial-gradient(1200px 800px at 50% 50%, rgba(0,234,255,0.25), rgba(0,0,0,0.7))',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1150'});
    const content = document.createElement('div');
    Object.assign(content.style,{
      background:'linear-gradient(180deg, rgba(4,22,35,0.98), rgba(10,18,28,0.96))',
      border:'1px solid #0af', borderImage:'linear-gradient(90deg,#00eaff,#0078d4) 1',
      borderRadius:'18px', backdropFilter:'blur(10px)', padding:'18px',
      minWidth:'820px', maxWidth:'1080px', maxHeight:'86vh', overflow:'auto', color:'#fff',
      boxShadow:'0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(0,234,255,0.15)'
    });
    const tinfo = teamInfo(teamKey);
    const tLogo = tinfo.logo ? `<img src="${tinfo.logo}" onerror="this.style.display='none'" alt="" style="width:28px;height:28px;object-fit:contain;border-radius:6px;box-shadow:0 0 10px rgba(0,234,255,.25);"/>` : '';
    function roleTag(p){ return p.role ? ` — ${p.role}` : ''; }
    function typeTag(p){ const pos=p.pos||[]; const t=(pos.includes('SP')&&pos.includes('RP'))?'SP/RP':(pos.includes('SP')?'SP':(pos.includes('RP')?'RP':(pos.includes('P')?'P':''))); return t?` [${t}]`:''; }
    function handTag(p){ const t=(p.throws||'').toUpperCase(); return t==='R'? 'RHP' : (t==='L'? 'LHP' : (t||'')); }
    function fmtBF(v){ return (typeof v==='number' && isFinite(v))? String(v) : '—'; }
    const recHtml = recommended && recommended.name ? (function(){
      const p = recommended; const pic = photoUrl(p.name) || `Player-photos/${slugify(p.name)}.png`;
      return `
      <div style="padding:12px;border:1px solid rgba(0,234,255,.8);border-radius:12px;background:linear-gradient(180deg,rgba(0,234,255,0.12),rgba(0,0,0,0.15));display:flex;justify-content:space-between;align-items:center;gap:14px;box-shadow:inset 0 0 40px rgba(0,234,255,.08);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:56px;height:56px;border-radius:10px;overflow:hidden;background:#0a1a28;border:1px solid rgba(255,255,255,.15);">
            ${pic? `<img src="${pic}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="if(this.dataset.tried!=='1'){this.dataset.tried='1'; this.src=this.src.replace('.png','.jpg');} else { this.replaceWith(Object.assign(document.createElement('div'),{style:'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#7dd9ff;font-weight:800;'})); }"/>` : `<div style='width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#7dd9ff;font-weight:800;'>${(p.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>`}
          </div>
          <div>
            <div style="font-weight:800;letter-spacing:.2px;">Recommended: ${p.name}${typeTag(p)}${roleTag(p)} <span style="opacity:.85;font-weight:600;">(${handTag(p)})</span></div>
            <div style="font-size:.9rem;opacity:.95;">Last game: ${fmtBF(lastGameBF[p.name]||0)} BF • vsL ${p.vsL??'—'} • vsR ${p.vsR??'—'}${typeof p.bfLimit==='number'?` • BF cap ${p.bfLimit}`:''}</div>
          </div>
        </div>
        <div>
          <button class="pc-pick" data-name="${p.name}" style="padding:10px 14px;border:none;border-radius:10px;background:linear-gradient(90deg,#0078d4,#00eaff);color:#001222;cursor:pointer;font-weight:800;box-shadow:0 0 16px rgba(0,234,255,.35);">Select</button>
        </div>
      </div>`;
    })() : '';
    const cards = roster.map(p=>{
      const isCurrent = p.name===state.pitcher;
      const lgBF = lastGameBF[p.name]||0;
      const pic = photoUrl(p.name) || `Player-photos/${slugify(p.name)}.png`;
      return `
        <div style="border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px;background:linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03));display:flex;justify-content:space-between;align-items:center;gap:12px;box-shadow:inset 0 0 22px rgba(255,255,255,0.04);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:46px;height:46px;border-radius:10px;overflow:hidden;background:#0a1a28;border:1px solid rgba(255,255,255,.12);">
              ${pic? `<img src="${pic}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="if(this.dataset.tried!=='1'){this.dataset.tried='1'; this.src=this.src.replace('.png','.jpg');} else { this.replaceWith(Object.assign(document.createElement('div'),{style:'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#7dd9ff;font-weight:800;'})); }"/>` : `<div style='width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#7dd9ff;font-weight:800;'>${(p.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>`}
            </div>
            <div>
              <div style="font-weight:800;">${p.name}${typeTag(p)}${roleTag(p)} <span style="opacity:.85;font-weight:600;">(${handTag(p)})</span> ${recommended&&recommended.name===p.name?'<span style=\"margin-left:6px;padding:2px 6px;border-radius:8px;background:#00eaff;color:#001222;font-size:.75rem;font-weight:800;\">REC</span>':''}</div>
              <div style="font-size:.9rem;opacity:.95;display:flex;gap:10px;flex-wrap:wrap;">
                <span>vsL ${p.vsL??'—'}</span>
                <span>vsR ${p.vsR??'—'}</span>
                ${typeof p.bfLimit==='number'?`<span>BF cap ${p.bfLimit}</span>`:''}
                <span>Last game ${lgBF} BF</span>
              </div>
            </div>
          </div>
          <div>
            ${isCurrent? '<button disabled style="padding:8px 12px;border:none;border-radius:10px;background:#555;color:#ccc;cursor:not-allowed;">Current</button>' : `<button class=\"pc-pick\" data-name=\"${p.name}\" style=\"padding:9px 12px;border:none;border-radius:10px;background:#145;color:#fff;cursor:pointer;box-shadow:0 0 10px rgba(0,0,0,.35);\">Select</button>`}
          </div>
        </div>`;
    }).join('');
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${tLogo}
          <h3 style="margin:0;">${tinfo.name || teamKey} Bullpen</h3>
        </div>
        <button id="pc-cancel" style="padding:8px 12px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Close</button>
      </div>
      ${recHtml}
      <div style="display:grid;gap:10px;margin-top:12px;">${cards}</div>
    `;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='pc-cancel') close(); });
    // Wire all select buttons
    content.querySelectorAll('.pc-pick').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const name = btn.getAttribute('data-name');
        if(!name || name===state.pitcher) return;
        pushHistory('pitch-change');
        applySubstitution(teamKey, 'pitcher', name);
        state.lastPlay = `Pitching change: ${name} now pitching`;
        ensurePitcherEntry(name);
        updateAll();
        close();
      });
    });
  }
  function init(){
    // Ensure score keys
    state.score[state.home] = state.score[state.home]||0;
    state.score[state.away] = state.score[state.away]||0;
    // Wire animations toggle UI if present
    try{
      const cb = document.getElementById('toggle-animations');
      if(cb){
        const on = animEnabled();
        cb.checked = on;
        cb.addEventListener('change',()=>{
          try{ localStorage.setItem('ibl.animations', cb.checked ? '1' : '0'); }catch(_){}
        });
      }
    }catch(_){ }
    setScoreboard(); assignDefaultPlayers(); positionElements(); renderCards(); wireButtons(); updateStatsDisplay();
    // Auto-roll RNG at game start so a number is ready immediately
    try{ prepareRngAndGlow(); }catch(_){ }
    try{ repositionFloatingCards(); }catch(_){ }
  }
  try{ window.addEventListener('resize', ()=>{ try{ repositionFloatingCards(); }catch(_){ } }); }catch(_){ }

  // Settings modal: Save/Load/Back to Menu/Animations toggle
  function openSettingsModal(){
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1250'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(255,255,255,0.22)',border:'2px solid #fff',borderRadius:'20px',backdropFilter:'blur(8px)',padding:'18px',minWidth:'360px',color:'#fff',boxShadow:'0 8px 32px rgba(0,0,0,0.18), 0 0 32px 8px #00eaff44'});
  const isAnim = animEnabled();
  const isBfDbg = bfDebugEnabled();
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;">
        <h3 style="margin:0;">Settings</h3>
        <button id="set-close" style="padding:6px 10px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Close</button>
      </div>
      <div style="display:grid;gap:10px;">
  <label style="display:flex;align-items:center;gap:8px;"><input id="set-anim" type="checkbox" ${isAnim?'checked':''}/> Enable animations</label>
  <label style="display:flex;align-items:center;gap:8px;"><input id="set-bfdbg" type="checkbox" ${isBfDbg?'checked':''}/> Show BF cap debug overlay</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="set-save" class="btn" type="button">Save Game</button>
          <button id="set-load" class="btn" type="button">Load Game</button>
          <button id="set-menu" class="btn" type="button">Back to Menu</button>
          <button id="set-clear-bfdbg" class="btn" type="button" title="Clear BF cap debug log for all pitchers">Clear BF debug log</button>
        </div>
        <div style="margin-top:6px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.18);font-size:.75rem;opacity:.8;">
          Data import moved to the <button id="go-import" style="background:none;border:none;color:#7dd9ff;cursor:pointer;text-decoration:underline;padding:0;">Import Data</button> screen.
        </div>
      </div>
    `;
    modal.appendChild(content); document.body.appendChild(modal);
    const close=()=>{ if(modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener('click',(e)=>{ if(e.target===modal || e.target.id==='set-close') close(); });
    const anim = content.querySelector('#set-anim');
    if(anim){ anim.addEventListener('change',()=>{ try{ localStorage.setItem('ibl.animations', anim.checked ? '1':'0'); }catch(_){ } }); }
  const bfdbg = content.querySelector('#set-bfdbg');
  if(bfdbg){ bfdbg.addEventListener('change',()=>{ try{ localStorage.setItem('ibl.debug.bf', bfdbg.checked ? '1':'0'); }catch(_){ } updateAll(); }); }
    const s = content.querySelector('#set-save'); if(s) s.addEventListener('click',()=>{ saveGame(); });
    const l = content.querySelector('#set-load'); if(l) l.addEventListener('click',()=>{ loadGame(); });
    const m = content.querySelector('#set-menu'); if(m) m.addEventListener('click',()=>{ window.location.href='index.html'; });
  const clr = content.querySelector('#set-clear-bfdbg'); if(clr){ clr.addEventListener('click',()=>{ try{ state._bfDebug = []; updateAll(); }catch(_){ } }); }

  // Link to dedicated import screen
  const impBtn = content.querySelector('#go-import');
  if(impBtn){ impBtn.addEventListener('click',()=>{ window.location.href='import.html'; }); }
    const readText = (file)=> new Promise((res,rej)=>{ const fr=new FileReader(); fr.onerror=()=>rej(new Error('read failed')); fr.onload=()=>res(String(fr.result||'')); fr.readAsText(file); });
    const ext = (name)=>{ const m=String(name||'').match(/\.([^.]+)$/); return m? m[1].toLowerCase():''; };
    const parseTeamsCSVLocal = (text)=>{
      const lines = String(text||'').split(/\r?\n/).filter(l=>l.trim()); if(lines.length<1) return [];
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
      const h=(k)=> headers.indexOf(k);
      const makeKey=(s)=> String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
      const makeInitials=(name)=>{ const words=String(name||'').trim().split(/\s+/).filter(Boolean); return words.length? words.map(w=>w[0]).join('').slice(0,3).toUpperCase() : (String(name||'').replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3)||'TMS'); };
      const out=[]; const hasHeader=['name','key','initials','logo'].some(x=>headers.includes(x));
      const start = hasHeader? 1:0;
      for(let i=start;i<lines.length;i++){
        const cols = lines[i].split(',').map(c=>c.trim());
        const name = hasHeader? (h('name')>=0? cols[h('name')]: cols[0]) : cols[0];
        if(!name) continue;
        const key = hasHeader? (h('key')>=0? (cols[h('key')]||''): '') : '';
        const initials = hasHeader? (h('initials')>=0? (cols[h('initials')]||''): '') : '';
        const logo = hasHeader? (h('logo')>=0? (cols[h('logo')]||''): '') : '';
        out.push({ key: key||makeKey(name), name, initials: initials||makeInitials(name), logo });
      }
      return out;
    };
    const normPosListLocal = (list)=>{ const FIELD=['C','1B','2B','3B','SS','LF','CF','RF']; if(!list||!Array.isArray(list)||!list.length) return FIELD.slice(); return list.map(x=>String(x).toUpperCase().trim()).filter(Boolean); };
    const normBat = (v)=>{ if(v===undefined||v===null) return null; const s=String(v).trim().toUpperCase(); if(!s) return null; if(s==='R'||s==='L'||s==='S') return s; if(/^RIGHT/.test(s)||/^(RH|RHB|RHH)$/.test(s)) return 'R'; if(/^LEFT/.test(s)||/^(LH|LHB|LHH)$/.test(s)) return 'L'; if(/^SWITCH/.test(s)||s==='B'||s==='SHB'||s==='SWH') return 'S'; return s.charAt(0); };
    const normThrow = (v)=>{ if(v===undefined||v===null) return null; const s=String(v).trim().toUpperCase(); if(!s) return null; if(s==='R'||s==='L') return s; if(/^RIGHT/.test(s)||s==='RH') return 'R'; if(/^LEFT/.test(s)||s==='LH') return 'L'; const c=s.charAt(0); return (c==='R'||c==='L')?c:null; };
    const normalizeRosterArrayLocal = (arr)=>{ if(!Array.isArray(arr)) return []; return arr.map(item=>{ if(typeof item==='string') return { name:item, bats:null, throws:null, pos:normPosListLocal(null) }; const name=item.name||''; const bats=normBat(item.bats||item.B||null); const throws=normThrow(item.throws||item.T||null); const rawPos=item.pos||item.positions||null; let pos=Array.isArray(rawPos)? rawPos : (typeof rawPos==='string'? rawPos.split(/[;,\s]+/): null); pos=normPosListLocal(pos); return { name,bats,throws,pos }; }).filter(p=>p.name); };
    const parseRosterCSVLocal = (text)=>{
      const lines = String(text||'').split(/\r?\n/).filter(l=>l.trim()); if(!lines.length) return [];
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
      const hasHeader = ['name','bats','throws','pos','positions','bathand','throwhand'].some(h=> headers.includes(h));
      const idx=(h)=> headers.indexOf(h);
      const out=[]; const start = hasHeader? 1:0;
      for(let i=start;i<lines.length;i++){
        const cols = lines[i].split(',').map(c=>c.trim()); if(!cols.length) continue;
        const name = hasHeader? (idx('name')>=0 ? cols[idx('name')] : cols[0]) : cols[0]; if(!name) continue;
        const batsRaw = hasHeader? (idx('bats')>=0? cols[idx('bats')] : (idx('bathand')>=0? cols[idx('bathand')] : null)) : null;
        const throwsRaw = hasHeader? (idx('throws')>=0? cols[idx('throws')] : (idx('throwhand')>=0? cols[idx('throwhand')] : null)) : null;
        const posStr = hasHeader? (idx('pos')>=0? cols[idx('pos')] : (idx('positions')>=0? cols[idx('positions')] : '')) : (cols[1]||'');
        const bats = normBat(batsRaw); const throws = normThrow(throwsRaw);
        const pos = posStr? posStr.replace(/[\[\]]/g,'').split(/[;|,\s]+/).map(s=>s.trim()).filter(Boolean) : null;
        out.push({ name, bats, throws, pos: normPosListLocal(pos) });
      }
      return out;
    };
    const parseRosterTXTLocal = (text)=>{ const out=[]; const lines=String(text||'').split(/\r?\n/); for(let raw of lines){ if(!raw) continue; let line=raw.replace(/#.*/,'').trim(); if(!line) continue; let bats=null, throws=null, pos=null; const m=line.match(/\[(.*?)\]/); if(m){ const inside=m[1]; pos=inside.split(/[;,\s]+/).filter(Boolean); line=line.replace(m[0],'').trim(); } const bt=line.match(/\b([LRS])\/([LR])\b/i); if(bt){ bats=bt[1].toUpperCase(); throws=bt[2].toUpperCase(); line=line.replace(bt[0],'').trim(); } line=line.replace(/[,-]$/,'').trim(); const name=line; if(!name) continue; out.push({ name, bats, throws, pos: normPosListLocal(pos) }); } return out; };

    // Enable/disable import buttons based on file selection
    // Import UI removed (centralized in import.html)
  }

  // --- Stats helpers and UI ---
  function ensurePlayer(name){
    if(!name) return { AB:0,H:0,BB:0,R:0,RBI:0,HR:0,K:0,SF:0,HBP:0,TB:0, '2B':0,'3B':0,GIDP:0, PA:0, GB:0, FB:0 };
    if(!state.stats.players[name]) state.stats.players[name] = { AB:0,H:0,BB:0,R:0,RBI:0,HR:0,K:0,SF:0,HBP:0,TB:0, '2B':0,'3B':0,GIDP:0, PA:0, GB:0, FB:0 };
    // Try to map player to team once
    if(!state.stats.teams[name]){
      const inHome = (state.lineups.home||[]).includes(name);
      const inAway = (state.lineups.away||[]).includes(name);
      state.stats.teams[name] = inHome ? state.home : (inAway ? state.away : battingTeamKey());
    }
    return state.stats.players[name];
  }
  function ensurePitcherEntry(name){
    if(!name) return;
    if(!state.stats.pitching) state.stats.pitching={};
    if(!state.stats.pitching[name]) state.stats.pitching[name] = { BF:0, Outs:0, H:0, R:0, ER:0, BB:0, K:0, HR:0, HBP:0, GB:0, FB:0, SF:0, W:0, L:0, SV:0, BS:0, G:0, GS:0 };
    if(!state.stats.teams[name]){
      state.stats.teams[name] = fieldingTeamKey();
    }
  }
  // Track a pitcher's appearance; increment G on first use, set GS for team starter, and capture stint lead snapshot for BS check
  function recordPitcherAppearance(teamKey, pitcherName){
    if(!pitcherName || !teamKey) return;
    ensurePitcherEntry(pitcherName);
    const side = (teamKey===state.home) ? 'home' : 'away';
    state._pitchersUsedByTeam = state._pitchersUsedByTeam || { home: [], away: [] };
    const used = state._pitchersUsedByTeam[side] || (state._pitchersUsedByTeam[side]=[]);
    if(!used.includes(pitcherName)){
      used.push(pitcherName);
      // G appearance
      try{ state.stats.pitching[pitcherName].G = (state.stats.pitching[pitcherName].G||0) + 1; }catch(_){ }
      // If this is the first pitcher for the team in the game, credit GS
      if(used.length===1){
        try{ state.stats.pitching[pitcherName].GS = (state.stats.pitching[pitcherName].GS||0) + 1; }catch(_){ }
        state._starterByTeam[side] = pitcherName;
      }
    }
    // Capture stint lead at entry for BS detection
    try{
      const fieldIsHome = (teamKey===state.home);
      const h = state.score[state.home]||0; const a = state.score[state.away]||0;
      const lead = fieldIsHome ? (h - a) : (a - h);
      state.pitcherStint = state.pitcherStint || { name:pitcherName, inning: state.inning, half: state.half, bf: 0 };
      state.pitcherStint.startLead = lead;
      state.pitcherStint.bsCharged = false;
    }catch(_){ }
  }
  function addGB(name){ const p=ensurePlayer(name); p.GB=(p.GB||0)+1; }
  function addFB(name){ const p=ensurePlayer(name); p.FB=(p.FB||0)+1; }
  function addP_GB(name){ if(!name) return; ensurePitcherEntry(name); state.stats.pitching[name].GB = (state.stats.pitching[name].GB||0)+1; }
  function addP_FB(name){ if(!name) return; ensurePitcherEntry(name); state.stats.pitching[name].FB = (state.stats.pitching[name].FB||0)+1; }
  function addP_SF(name){ if(!name) return; ensurePitcherEntry(name); state.stats.pitching[name].SF = (state.stats.pitching[name].SF||0)+1; }
  function addPA(name){ ensurePlayer(name).PA += 1; }
  function addAB(name){ ensurePlayer(name).AB += 1; }
  function addHit(name, bases){ const p=ensurePlayer(name); p.AB+=1; p.H+=1; p.TB += (bases||1); if(bases===2) p['2B']+=1; if(bases===3) p['3B']+=1; if(bases===4){ p.HR+=1; } }
  function addBB(name){ const p=ensurePlayer(name); p.BB+=1; }
  function addHBP(name){ const p=ensurePlayer(name); p.HBP+=1; }
  function addK(name){ const p=ensurePlayer(name); p.K+=1; }
  function addSF(name){ const p=ensurePlayer(name); p.SF+=1; }
  function addGIDP(name){ const p=ensurePlayer(name); p.GIDP+=1; }
  function addRun(name){ const p=ensurePlayer(name); p.R+=1; }
  function addRBI(name, n){ const p=ensurePlayer(name); p.RBI += (n||0); }
  function fmt3(x){ if(!isFinite(x)) return '.000'; const v = Math.max(0, x)||0; return v.toFixed(3).replace(/^0/, ''); }
  function computeRates(p){ const ab=p.AB||0, h=p.H||0, bb=p.BB||0, hbp=p.HBP||0, sf=p.SF||0, tb=p.TB||0; const denomOBP = ab+bb+hbp+sf; const avg = ab>0? h/ab : 0; const obp = denomOBP>0? (h+bb+hbp)/denomOBP : 0; const slg = ab>0? tb/ab : 0; const ops = obp+slg; return { avg, obp, slg, ops } }

  function updateStatsDisplay(){
    const el = document.getElementById('stats-display'); if(!el) return; el.innerHTML = '';
  }

  // --- Box Score Modal ---
  function openBoxScoreModal(){
    const modal = document.createElement('div');
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'1200'});
    const content = document.createElement('div');
    Object.assign(content.style,{background:'rgba(20,28,40,0.95)',border:'2px solid #00eaff',borderRadius:'16px',padding:'16px',color:'#fff',maxWidth:'90vw',maxHeight:'85vh',overflow:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.35)'});
    const all = state.stats.players;
    const toRows=(names)=> names.map(n=>{ const p=all[n]||{AB:0,H:0,BB:0,R:0,RBI:0,HR:0,K:0,SF:0,HBP:0,TB:0,'2B':0,'3B':0,PA:0}; const r=computeRates(p); return `<tr><td style="padding:4px 8px;">${n}</td><td>${p.AB}</td><td>${p.R}</td><td>${p.H}</td><td>${p.RBI}</td><td>${p.BB}</td><td>${p.K}</td><td>${p['2B']}</td><td>${p['3B']}</td><td>${p.HR}</td><td>${fmt3(r.avg)}</td><td>${fmt3(r.obp)}</td><td>${fmt3(r.slg)}</td><td>${fmt3(r.obp+r.slg)}</td></tr>`; }).join('');
    const uniq = (arr)=> Array.from(new Set(arr.filter(Boolean)));
    const homeList = uniq([...(state.lineups.home||[])]);
    const awayList = uniq([...(state.lineups.away||[])]);
    const otherNames = Object.keys(all).filter(n=> !homeList.includes(n) && !awayList.includes(n));
    function teamBatters(teamKey){ return Object.keys(state.stats.players).filter(n=> state.stats.teams[n]===teamKey); }
    function sumBatting(names){
      const acc={AB:0,H:0,BB:0,R:0,RBI:0,HR:0,K:0,SF:0,HBP:0,TB:0,'2B':0,'3B':0,PA:0};
      names.forEach(n=>{ const p=state.stats.players[n]; if(!p) return; Object.keys(acc).forEach(k=>{ acc[k]+= (p[k]||0); }); });
      return acc;
    }
    const table = (title, names, teamKey)=> `
      <h3 style="margin:10px 0 6px;">${title}</h3>
      <table style="border-collapse:collapse;min-width:720px;">
        <thead><tr>
          <th style="text-align:left;padding:4px 8px;">Player</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>K</th><th>2B</th><th>3B</th><th>HR</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th>
        </tr></thead>
        <tbody>${toRows(names)}</tbody>
        ${teamKey ? (function(){ const list=teamBatters(teamKey); const t=sumBatting(list); const r=computeRates(t); return `<tfoot><tr style=\"font-weight:700;background:rgba(255,255,255,0.06)\"><td style=\"padding:4px 8px;\">Totals</td><td>${t.AB}</td><td>${t.R}</td><td>${t.H}</td><td>${t.RBI}</td><td>${t.BB}</td><td>${t.K}</td><td>${t['2B']}</td><td>${t['3B']}</td><td>${t.HR}</td><td>${fmt3(r.avg)}</td><td>${fmt3(r.obp)}</td><td>${fmt3(r.slg)}</td><td>${fmt3(r.obp+r.slg)}</td></tr></tfoot>`; })() : ''}
      </table>`;
    // Pitching tables
    const pitchAll = state.stats.pitching || {};
  function fmtERA(er, outs){ if(!outs || outs<=0) return '—'; const era = (er*27)/outs; return era.toFixed(2); }
  const toPitchRows=(names)=> names.map(n=>{ const p=pitchAll[n]||{BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0}; return `<tr><td style=\"padding:4px 8px;\">${n}</td><td>${formatIPOuts(p.Outs)}</td><td>${fmtERA(p.ER, p.Outs)}</td><td>${p.BF}</td><td>${p.H}</td><td>${p.R}</td><td>${p.ER}</td><td>${p.BB}</td><td>${p.K}</td><td>${p.HR}</td><td>${p.HBP}</td></tr>`; }).join('');
    function pitchHasStats(p){ return !!(p && (p.BF||p.Outs||p.H||p.R||p.ER||p.BB||p.K||p.HR||p.HBP)); }
    function teamPitchers(teamKey){ return Object.keys(pitchAll).filter(n=> state.stats.teams[n]===teamKey && pitchHasStats(pitchAll[n])); }
    function sumPitching(names){ const acc={BF:0,Outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,HBP:0}; names.forEach(n=>{ const p=pitchAll[n]; if(!p) return; Object.keys(acc).forEach(k=>{ acc[k]+= (p[k]||0); }); }); return acc; }
    const pTable=(title, teamKey)=> {
      const names = teamPitchers(teamKey);
      const totals = sumPitching(names);
      return `
      <h3 style="margin:14px 0 6px;">${title} — Pitching</h3>
      <table style="border-collapse:collapse;min-width:760px;">
        <thead><tr>
          <th style="text-align:left;padding:4px 8px;">Pitcher</th><th>IP</th><th>ERA</th><th>BF</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>HBP</th>
        </tr></thead>
        <tbody>${toPitchRows(names)}</tbody>
        <tfoot><tr style="font-weight:700;background:rgba(255,255,255,0.06)"><td style="padding:4px 8px;">Totals</td><td>${formatIPOuts(totals.Outs)}</td><td>${fmtERA(totals.ER, totals.Outs)}</td><td>${totals.BF}</td><td>${totals.H}</td><td>${totals.R}</td><td>${totals.ER}</td><td>${totals.BB}</td><td>${totals.K}</td><td>${totals.HR}</td><td>${totals.HBP}</td></tr></tfoot>
      </table>`;
    }
    function renderBox(){
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <h2 style="margin:0;">Box Score</h2>
          <div style="display:flex;gap:8px;">
            <button id="game-log-btn" style="padding:6px 10px;border:none;border-radius:10px;background:#145;color:#fff;cursor:pointer;">Game Log</button>
            <button id="box-close" style="padding:6px 10px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Close</button>
          </div>
        </div>
        <div style="display:grid;gap:12px;">
      ${table(teamInfo(state.away).name || 'Away', awayList, state.away)}
      ${pTable(teamInfo(state.away).name || 'Away', state.away)}
      ${table(teamInfo(state.home).name || 'Home', homeList, state.home)}
      ${pTable(teamInfo(state.home).name || 'Home', state.home)}
            ${otherNames.length? table('Other', otherNames): ''}
        </div>`;
    }
    function renderLog(){
      const rows = (state.gameLog||[]).map((e,i)=>{
        const arrow = e.half==='top'?'▲':'▼';
        const rngTxt = (typeof e.rng === 'number') ? ` (RNG: ${String(e.rng).padStart(3,'0')})` : '';
        return `<div style=\"padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.08);\">${i+1}. ${arrow}${e.inning}: ${e.desc}${rngTxt}</div>`;
      }).join('');
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <h2 style="margin:0;">Game Log</h2>
          <div style="display:flex;gap:8px;">
            <button id="box-score-btn" style="padding:6px 10px;border:none;border-radius:10px;background:#145;color:#fff;cursor:pointer;">Box Score</button>
            <button id="box-close" style="padding:6px 10px;border:none;border-radius:10px;background:#334;color:#fff;cursor:pointer;">Close</button>
          </div>
        </div>
        <div style="margin-top:8px;display:grid;gap:4px;">${rows || '<div style="opacity:.8;">No plays yet.</div>'}</div>`;
    }
    function show(mode){
      content.innerHTML = mode==='log'? renderLog() : renderBox();
    }
    show('box');
    modal.appendChild(content); document.body.appendChild(modal);
    modal.addEventListener('click',(e)=>{
      if(e.target===modal || e.target.id==='box-close') modal.remove();
      else if(e.target && e.target.id==='game-log-btn') show('log');
      else if(e.target && e.target.id==='box-score-btn') show('box');
    });
  }

  // Expose some functions for inline or external access if needed
  try{ window.openBoxScoreModal = openBoxScoreModal; }catch(_){ }
  try{ window.openGameLogModal = openGameLogModal; }catch(_){ }
  try{ window.openSettingsModal = openSettingsModal; }catch(_){ }
  try{ window.undoLast = undoLast; }catch(_){ }
  try{ window.redoLast = redoLast; }catch(_){ }
  try{ window.rerollRng = rerollRng; }catch(_){ }
  try{ window.saveGame = saveGame; }catch(_){ }
  try{ window.loadGame = loadGame; }catch(_){ }

  if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{ if(document.getElementById('game-screen')){ preloadData().finally(()=> { init(); wireExtraButtons(); }); } });
  } else { if(document.getElementById('game-screen')) init(); }
})();
