(function(){
  'use strict';
  const $ = (id)=> document.getElementById(id);

  function getTeams(){ try{ const t = JSON.parse(localStorage.getItem('ibl.teams')||'[]'); return Array.isArray(t)?t:[]; }catch{ return []; } }
  function getSaved(){ try{ const raw = localStorage.getItem('ibl.savedGames'); return raw? JSON.parse(raw): []; }catch{ return []; } }

  function slugify(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function fmt(n, d=2){ if(n==null || Number.isNaN(n)) return '—'; const x = Number(n); if(!isFinite(x)) return '—'; return x.toFixed(d); }
  function sum(a,b){ return (a||0)+(b||0); }
  function safeDiv(n,d){ const nn=Number(n)||0; const dd=Number(d)||0; return dd>0 ? nn/dd : null; }

  function getTeamsWithFallback(){
    const t = getTeams();
    if(Array.isArray(t) && t.length>0) return t;
    return DEFAULT_TEAMS;
  }

  function resolveTeamFromStat(st, g, name){
    // Prefer a canonical TeamKey if the stat object provides it
    const teamsList = getTeamsWithFallback();
    const stKeyRaw = st && (st.TeamKey || st.teamKey);
    let teamKey = stKeyRaw ? slugify(stKeyRaw) : '';
    let teamName = (st && (st.Team || st.team)) || '';

    // If we only have a key, map to a known display name
    if(teamKey && !teamName){
      const t = teamsList.find(tt => slugify(tt.key||tt.name)===teamKey);
      if(t) teamName = t.name || t.key || teamKey;
    }

    // Try saved stats.teams map (engine writes this for both hitters and pitchers)
    if(!teamKey){
      try{
        const mapKeyRaw = g && g.stats && g.stats.teams && g.stats.teams[name];
        if(mapKeyRaw) teamKey = slugify(mapKeyRaw);
      }catch{}
    }

    // If key is missing, try to infer from lineups or fall back to name slug
    if(!teamKey){
      let guessedKey = '';
      try{
        if(g && g.lineups){
          const home = Array.isArray(g.lineups.home)? g.lineups.home : [];
          const away = Array.isArray(g.lineups.away)? g.lineups.away : [];
          if(home.includes(name)) guessedKey = slugify(g.home && (g.home.key||g.home.name||g.home));
          else if(away.includes(name)) guessedKey = slugify(g.away && (g.away.key||g.away.name||g.away));
        }
      }catch{}
      teamKey = guessedKey || slugify(teamName);
    }

    // Ensure we have some display name
    if(!teamName){
      const t = teamsList.find(tt => slugify(tt.key||tt.name)===teamKey);
      teamName = (t && (t.name||t.key)) || (st && (st.Team||st.team)) || teamKey;
    }
    return { teamName, teamKey };
  }

  // Derived batting metrics
  function battingDerived(r){
    // Fallbacks
    const _2B=r['2B']||0, _3B=r['3B']||0, HR=r.HR||0;
    const H=r.H||0;
    const AB0=r.AB||0, BB0=r.BB||0, HBP0=r.HBP||0, SF0=r.SF||0;
    const PA = r.PA!=null ? r.PA : (AB0 + BB0 + HBP0 + SF0);
    const TB = r.TB!=null ? r.TB : (Math.max(0, H - _2B - _3B - HR) + 2*_2B + 3*_3B + 4*HR);
    const IBB=r.IBB||0, R=r.R||0, RBI=r.RBI||0, SB=r.SB||0;
    const AB=AB0, BB=BB0, HBP=HBP0, SF=SF0;
    const oneB = Math.max(0, H - _2B - _3B - HR);
    const AVG = safeDiv(H, AB);
    const OBP = safeDiv((H + BB + HBP), (AB + BB - IBB + SF + HBP));
    const SLG = safeDiv(TB, AB);
    const ISO = (SLG!=null && AVG!=null) ? Math.max(0, SLG-AVG) : null;
  // BABIP: (H − HR) / (AB − K − HR + SF)
  const BABIP = safeDiv((H - HR), (AB - (r.K||0) - HR + SF));
    const wOBA = safeDiv(0.699*BB + 0.730*HBP + 0.879*oneB + 1.239*_2B + 1.576*_3B + 2.034*HR, (AB + BB - IBB + SF + HBP));
    const BBpct = PA>0 ? (BB/PA*100) : null;
    const Kpct  = PA>0 ? ((r.K||0)/PA*100) : null;
    return Object.assign(r, { PA, TB, AVG, OBP, SLG, ISO, BABIP, wOBA, BBpct, Kpct, R, RBI, SB, GB:r.GB||0, FB:r.FB||0 });
  }

  // Derived pitching metrics
  function toOuts(p){ if(p.Outs!=null) return Number(p.Outs)||0; if(p.IP!=null){ const ip=Number(p.IP)||0; const whole=Math.trunc(ip); const frac=Math.round((ip-whole)*10); return whole*3 + (frac===1?1:frac===2?2:0);} return 0; }
  function pitchingDerived(r){
    const outs = toOuts(r); const IP = outs/3; const BF = r.BF||0; const H=r.H||0, ER=r.ER||0, R=r.R||0, BB=r.BB||0, K=r.K||0, HBP=r.HBP||0, HR=r.HR||0, G=r.G||0, GS=r.GS||0, W=r.W||0, L=r.L||0, SV=r.SV||0;
    const ERA = IP>0 ? (ER*9/IP) : null;
    const FIP = IP>0 ? (((HR*13) + (3*(BB+HBP)) - (2*K)) / IP + 3.166) : null;
    const K9 = IP>0 ? (K*9/IP) : null;
    const BB9 = IP>0 ? (BB*9/IP) : null;
    const HR9 = IP>0 ? (HR*9/IP) : null;
    const WHIP = IP>0 ? ((BB + H) / IP) : null;
    // Basic rate estimates; as percentages
    const SOpct = BF>0 ? (K/BF*100) : null;
    const BBpct = BF>0 ? (BB/BF*100) : null;
  const GB = r.GB||0, FB = r.FB||0, SF = r.SF||0; // SF captured on pitcher
  // Use batting-side BABIP identity for pitchers too: (H − HR) / (AB − K − HR + SF)
  // Estimate AB against as BF − BB − HBP − SF (ignoring SH if not tracked)
  const ABa = Math.max(0, BF - BB - HBP - SF);
  const babipDen = Math.max(0, ABa - K - HR + SF);
  const BABIP = babipDen>0 ? (H - HR) / babipDen : null;
  const GBpct = (GB+FB)>0 ? (GB/(GB+FB)*100) : null;
  const HRFBpct = FB>0 ? (HR/FB*100) : null;
    const AVG = ABa>0 ? (H/ABa) : null;
    return Object.assign(r, { IP, BF, ERA, FIP, K9, BB9, HR9, BABIP, GBpct, HRFBpct, SOpct, BBpct, AVG, WHIP, W,L,SV,G,GS,H,R,ER,HR,BB,HBP,SO:K });
  }

  // Aggregation across saved games
  function aggregate(){
    const saves = getSaved();
    const batting = new Map(); // key: name|team
    const pitching = new Map();
    const gameScores = new Map(); // key: name|team -> { sum: number, count: number }

    for(const g of saves){
      if(!g || !g.stats) continue;
      const teamHome = g.home, teamAway = g.away;
      // Players batting
      const pbat = g.stats.players || {};
      for(const [name, st] of Object.entries(pbat)){
        const { teamName: team, teamKey } = resolveTeamFromStat(st, g, name);
        const key = `${name}|${team}`;
  const cur = batting.get(key) || { Name:name, Team:team, G:0, PA:0, AB:0, H:0, BB:0, K:0, HBP:0, SF:0, R:0, RBI:0, SB:0, '2B':0, '3B':0, HR:0, TB:0, GB:0, FB:0 };
        cur.G += 1; // count appearance in this saved game
        cur.PA = sum(cur.PA, st.PA);
        cur.AB = sum(cur.AB, st.AB);
        cur.H  = sum(cur.H,  st.H);
        cur.BB = sum(cur.BB, st.BB);
        cur.K  = sum(cur.K,  st.K);
        cur.HBP= sum(cur.HBP,st.HBP);
        cur.SF = sum(cur.SF, st.SF);
        cur.R  = sum(cur.R,  st.R);
        cur.RBI= sum(cur.RBI,st.RBI);
        cur.SB = sum(cur.SB, st.SB);
        cur['2B'] = sum(cur['2B'], st['2B']);
        cur['3B'] = sum(cur['3B'], st['3B']);
        cur.HR    = sum(cur.HR, st.HR);
  cur.TB    = sum(cur.TB, st.TB);
  cur.GB    = sum(cur.GB, st.GB);
  cur.FB    = sum(cur.FB, st.FB);
          cur.TeamKey = teamKey;
        batting.set(key, cur);
      }
      // Pitching
      const ppit = g.stats.pitching || {};
      for(const [name, st] of Object.entries(ppit)){
        const { teamName: team, teamKey } = resolveTeamFromStat(st, g, name);
        const key = `${name}|${team}`;
  const cur = pitching.get(key) || { Name:name, Team:team, W:0,L:0,SV:0,G:0,GS:0, Outs:0, BF:0, H:0, R:0, ER:0, HR:0, BB:0, HBP:0, K:0, GB:0, FB:0, SF:0 };
        cur.W  = sum(cur.W,  st.W);
        cur.L  = sum(cur.L,  st.L);
        cur.SV = sum(cur.SV, st.SV);
        cur.G  = sum(cur.G,  st.G||1); // count appearance if missing
        cur.GS = sum(cur.GS, st.GS);
        cur.Outs = sum(cur.Outs, st.Outs);
        cur.BF = sum(cur.BF, st.BF);
        cur.H  = sum(cur.H,  st.H);
        cur.R  = sum(cur.R,  st.R);
        cur.ER = sum(cur.ER, st.ER);
        cur.HR = sum(cur.HR, st.HR);
        cur.BB = sum(cur.BB, st.BB);
        cur.HBP= sum(cur.HBP,st.HBP);
  cur.K  = sum(cur.K,  st.K);
  cur.GB = sum(cur.GB, st.GB);
  cur.FB = sum(cur.FB, st.FB);
  cur.SF = sum(cur.SF, st.SF);
          cur.TeamKey = teamKey;
        pitching.set(key, cur);

        // Track Game Score per appearance for averaging
        const outs = Number(st.Outs||0), K = Number(st.K||0), BB = Number(st.BB||0), H = Number(st.H||0), R = Number(st.R||0), HR = Number(st.HR||0);
        const gsc = 40 + (2*outs) + K - (2*BB) - (2*H) - (3*R) - (6*HR);
        const gs = gameScores.get(key) || { sum:0, count:0 };
        gs.sum += gsc; gs.count += 1; gameScores.set(key, gs);
      }
    }

    const batRows = Array.from(batting.values()).map(battingDerived);
    const pitRows = Array.from(pitching.values()).map(pitchingDerived).map(r=>{
      const key = `${r.Name}|${r.Team}`;
      const gs = gameScores.get(key);
      if(gs && gs.count>0){ r.GSc = Math.round(gs.sum/gs.count); }
      return r;
    });
    return { batRows, pitRows };
  }

  // Table renderers
  const BAT_COLS = [
    { k:'Name', t:'Name' }, { k:'Team', t:'Team' }, { k:'G', t:'G', num:true, d:0 }, { k:'PA', t:'PA', num:true, d:0 }, { k:'AB', t:'AB', num:true, d:0 },
    { k:'AVG', t:'AVG', num:true, d:3 }, { k:'OBP', t:'OBP', num:true, d:3 }, { k:'SLG', t:'SLG', num:true, d:3 },
    { k:'2B', t:'2B', num:true, d:0 }, { k:'3B', t:'3B', num:true, d:0 }, { k:'HR', t:'HR', num:true, d:0 }, { k:'R', t:'R', num:true, d:0 }, { k:'RBI', t:'RBI', num:true, d:0 }, { k:'SB', t:'SB', num:true, d:0 },
    { k:'H', t:'H', num:true, d:0 }, { k:'BB', t:'BB', num:true, d:0 }, { k:'K', t:'K', num:true, d:0 }, { k:'HBP', t:'HBP', num:true, d:0 },
    { k:'BBpct', t:'BB%', num:true, d:1 }, { k:'Kpct', t:'K%', num:true, d:1 }, { k:'ISO', t:'ISO', num:true, d:3 }, { k:'BABIP', t:'BABIP', num:true, d:3 }, { k:'wOBA', t:'wOBA', num:true, d:3 }
  ];

  const PIT_COLS = [
    { k:'Name', t:'Name' }, { k:'Team', t:'Team' }, { k:'W', t:'W', num:true, d:0 }, { k:'L', t:'L', num:true, d:0 }, { k:'SV', t:'SV', num:true, d:0 }, { k:'G', t:'G', num:true, d:0 }, { k:'GS', t:'GS', num:true, d:0 },
    { k:'IP', t:'IP', num:true, d:2 }, { k:'BF', t:'BF', num:true, d:0 }, { k:'ERA', t:'ERA', num:true, d:2 }, { k:'FIP', t:'FIP', num:true, d:2 }, { k:'GSc', t:'GSc', num:true, d:0 },
    { k:'K9', t:'K/9', num:true, d:2 }, { k:'BB9', t:'BB/9', num:true, d:2 }, { k:'HR9', t:'HR/9', num:true, d:2 }, { k:'BABIP', t:'BABIP', num:true, d:3 },
    { k:'GBpct', t:'GB%', num:true, d:3 }, { k:'HRFBpct', t:'HR/FB%', num:true, d:3 }, { k:'H', t:'H', num:true, d:0 }, { k:'R', t:'R', num:true, d:0 },
    { k:'ER', t:'ER', num:true, d:0 }, { k:'HR', t:'HR', num:true, d:0 }, { k:'BB', t:'BB', num:true, d:0 }, { k:'HBP', t:'HBP', num:true, d:0 }, { k:'SO', t:'SO', num:true, d:0 },
    { k:'SOpct', t:'SO%', num:true, d:1 }, { k:'BBpct', t:'BB%', num:true, d:1 }, { k:'AVG', t:'AVG', num:true, d:3 }, { k:'WHIP', t:'WHIP', num:true, d:3 }
  ];

  function renderTable(cols, rows){
    const thead = `<thead><tr>${cols.map(c=>{
      const isSorted = sort && sort.k===c.k; const sortedClass = isSorted ? (sort.dir>0? 'sorted asc' : 'sorted desc') : '';
      const hasFilter = !!filters[c.k]; const filtClass = hasFilter ? 'filtered' : '';
      const alignClass = (c.k==='Name' || c.k==='Team') ? 'left' : 'center';
      const indicator = `${isSorted? (sort.dir>0?' ▲':' ▼'):''}${hasFilter?' ⦿':''}`;
      return `<th data-k="${c.k}" class="${[sortedClass,filtClass,alignClass].filter(Boolean).join(' ')}" title="Left-click to sort; Right-click to filter">${c.t}${indicator}</th>`;
    }).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map(r=> `<tr>${cols.map(c=>{
      const v = r[c.k];
      const isNum = c.num;
      let cell;
      if(c.k==='Name'){
        const team = r.Team;
        const name = String(v||'');
        cell = `<button class="link-btn" data-player="${encodeURIComponent(name)}" data-team="${encodeURIComponent(team||'')}">${name}</button>`;
      } else {
        const txt = (typeof v === 'number') ? fmt(v, c.d==null?(isNum?2:2):c.d) : (v??'');
        cell = txt;
      }
      const alignClass = (c.k==='Name' || c.k==='Team') ? 'left' : 'center';
      return `<td class="${[isNum?'num':'', alignClass].filter(Boolean).join(' ')}">${cell}</td>`;
    }).join('')}</tr>`).join('')}</tbody>`;
    return `<table>${thead}${tbody}</table>`;
  }

  // Sorting and filtering
  let sort = { k:'Team', dir:1 };
  let filters = {};

  function applySort(cols, arr){
    const k = sort.k; const dir = sort.dir;
    const col = cols.find(c=>c.k===k);
    const getter = (row)=> row[k];
    arr.sort((a,b)=>{
      const va = getter(a), vb = getter(b);
      if(col && col.num){ const na = (va==null? -Infinity : Number(va)); const nb = (vb==null? -Infinity : Number(vb)); return (na-nb)*dir; }
      const sa = String(va||''); const sb = String(vb||'');
      return sa.localeCompare(sb) * dir;
    });
    return arr;
  }

  function applyFilters(cols, arr){
    const out = arr.filter(r=>{
      for(const [k, f] of Object.entries(filters)){
        if(!f || f.v==null || f.v==='') continue;
        const val = r[k];
        if(f.type==='text'){
          const s = String(val||'').toLowerCase();
          const needle = String(f.v).toLowerCase();
          const op = f.op || 'contains';
          if(op==='equals'){ if(!(s===needle)) return false; }
          else if(op==='starts'){ if(!(s.startsWith(needle))) return false; }
          else if(op==='ends'){ if(!(s.endsWith(needle))) return false; }
          else if(op==='not'){ if(s.includes(needle)) return false; }
          else { if(!s.includes(needle)) return false; }
        } else if(f.type==='num'){
          const op = f.op||'>='; const num = Number(f.v);
          const x = Number(val);
          if(Number.isNaN(num)) continue;
          if(op==='>='){ if(!(x>=num)) return false; }
          if(op==='<='){ if(!(x<=num)) return false; }
          if(op==='>'){ if(!(x>num)) return false; }
          if(op==='<'){ if(!(x<num)) return false; }
          if(op==='='){ if(!(x===num)) return false; }
        }
      }
      return true;
    });
    return out;
  }

  function renderFilters(cols){
    const wrap = $('filters');
    wrap.innerHTML = `<div style="display:flex;justify-content:flex-end;gap:8px;align-items:center;width:100%">
      <button id="reset-filters" class="btn secondary" style="padding:6px 10px;">Reset Filters</button>
    </div>`;
    const btn = document.getElementById('reset-filters');
    if(btn){ btn.onclick = ()=>{ filters = {}; update(); }; }
  }

  // Team selection (slug key)
  let currentTeamKey = 'mlb';
  let currentTeamKeyAlt = null;
  // Default MLB teams (30) if user hasn't configured teams yet
  const DEFAULT_TEAMS = [
    { key:'yankees', name:'New York Yankees', initials:'NYY', logo:'Logos/yankees.png' },
    { key:'red-sox', name:'Boston Red Sox', initials:'BOS', logo:'Logos/red-sox.png' },
    { key:'orioles', name:'Baltimore Orioles', initials:'BAL', logo:'Logos/orioles.png' },
    { key:'blue-jays', name:'Toronto Blue Jays', initials:'TOR', logo:'Logos/blue-jays.png' },
    { key:'rays', name:'Tampa Bay Rays', initials:'TB', logo:'Logos/rays.png' },
    { key:'guardians', name:'Cleveland Guardians', initials:'CLE', logo:'Logos/guardians.png' },
    { key:'tigers', name:'Detroit Tigers', initials:'DET', logo:'Logos/tigers.png' },
    { key:'twins', name:'Minnesota Twins', initials:'MIN', logo:'Logos/twins.png' },
    { key:'white-sox', name:'Chicago White Sox', initials:'CWS', logo:'Logos/white-sox.png' },
    { key:'royals', name:'Kansas City Royals', initials:'KC', logo:'Logos/royals.png' },
    { key:'astros', name:'Houston Astros', initials:'HOU', logo:'Logos/astros.png' },
    { key:'angels', name:'Los Angeles Angels', initials:'LAA', logo:'Logos/angels.png' },
    { key:'athletics', name:'Oakland Athletics', initials:'OAK', logo:'Logos/athletics.png' },
    { key:'mariners', name:'Seattle Mariners', initials:'SEA', logo:'Logos/mariners.png' },
    { key:'rangers', name:'Texas Rangers', initials:'TEX', logo:'Logos/rangers.png' },
    { key:'braves', name:'Atlanta Braves', initials:'ATL', logo:'Logos/braves.png' },
    { key:'marlins', name:'Miami Marlins', initials:'MIA', logo:'Logos/marlins.png' },
    { key:'mets', name:'New York Mets', initials:'NYM', logo:'Logos/mets.png' },
    { key:'phillies', name:'Philadelphia Phillies', initials:'PHI', logo:'Logos/phillies.png' },
    { key:'nationals', name:'Washington Nationals', initials:'WSH', logo:'Logos/nationals.png' },
    { key:'cubs', name:'Chicago Cubs', initials:'CHC', logo:'Logos/cubs.png' },
    { key:'reds', name:'Cincinnati Reds', initials:'CIN', logo:'Logos/reds.png' },
    { key:'brewers', name:'Milwaukee Brewers', initials:'MIL', logo:'Logos/brewers.png' },
    { key:'pirates', name:'Pittsburgh Pirates', initials:'PIT', logo:'Logos/pirates.png' },
    { key:'cardinals', name:'St. Louis Cardinals', initials:'STL', logo:'Logos/cardinals.png' },
    { key:'diamondbacks', name:'Arizona Diamondbacks', initials:'ARI', logo:'Logos/diamondbacks.png' },
    { key:'rockies', name:'Colorado Rockies', initials:'COL', logo:'Logos/rockies.png' },
    { key:'dodgers', name:'Los Angeles Dodgers', initials:'LAD', logo:'Logos/dodgers.png' },
    { key:'padres', name:'San Diego Padres', initials:'SD', logo:'Logos/padres.png' },
    { key:'giants', name:'San Francisco Giants', initials:'SF', logo:'Logos/giants.png' },
  ];

  function getTeamsWithFallback(){
    const t = getTeams();
    if(Array.isArray(t) && t.length>0) return t;
    return DEFAULT_TEAMS;
  }

  function renderTeams(){
    const teams = getTeamsWithFallback();
    const wrap = $('team-buttons');
    // MLB league button first
     const mlbBtn = `<button class="team-btn league ${currentTeamKey==='mlb'?'active':''}" data-team-key="mlb" data-team-alt=""><span style="display:inline-flex;align-items:center;gap:10px;"><img src="Logos/mlb.png" alt="MLB" style="width:28px;height:28px;object-fit:contain;"/> Major League Baseball</span></button>`;
    const teamBtns = teams.map(t=>{
      const logo = t.logo || `Logos/${slugify(t.key||t.name)}.png`;
      const title = t.name || t.key;
      const key = slugify(t.key || title);
      const alt = slugify(title);
      const active = (currentTeamKey===key || currentTeamKey===alt) ? 'active' : '';
      return `<button class="team-btn logo ${active}" data-team-key="${key}" data-team-alt="${alt}" title="${title}"><img src="${logo}" alt="${title}" onerror="this.style.visibility='hidden'"/></button>`;
    }).join('');
    wrap.innerHTML = mlbBtn + teamBtns;
    wrap.querySelectorAll('.team-btn').forEach(b=>{
      b.addEventListener('click', ()=>{ currentTeamKey = b.getAttribute('data-team-key')||'mlb'; currentTeamKeyAlt = b.getAttribute('data-team-alt')||null; renderTeams(); update(); });
    });
  }

  // Tab switching
  let currentTab = 'batting';
  function renderTabs(){
    const tb = $('tab-batting'), tp = $('tab-pitching');
    tb.classList.toggle('active', currentTab==='batting');
    tp.classList.toggle('active', currentTab==='pitching');
    tb.onclick = ()=>{ currentTab='batting'; update(); };
    tp.onclick = ()=>{ currentTab='pitching'; update(); };
  }

  let cache = null;
  function update(){
    if(!cache) cache = aggregate();
    renderTabs();
    const cols = currentTab==='batting' ? BAT_COLS : PIT_COLS;
    renderFilters(cols);
    const rowsAll = currentTab==='batting' ? cache.batRows : cache.pitRows;
    const rowsTeam = currentTeamKey==='mlb' ? rowsAll : rowsAll.filter(r=>{
      const tSlug = slugify(r.Team||r.team||'');
      const k = r.TeamKey || '';
      const kSlug = slugify(k);
      return (
        tSlug===currentTeamKey || k===currentTeamKey || kSlug===currentTeamKey ||
        (currentTeamKeyAlt && (tSlug===currentTeamKeyAlt || k===currentTeamKeyAlt || kSlug===currentTeamKeyAlt))
      );
    });
    const filtered = applyFilters(cols, rowsTeam);
    const sorted = applySort(cols, filtered);
    $('table-wrap').innerHTML = renderTable(cols, sorted);
    // sort handlers (left-click) and filter prompts (right-click)
    $('table-wrap').querySelectorAll('th').forEach(th=>{
      const k = th.getAttribute('data-k');
      th.addEventListener('click', ()=>{
        if(sort.k===k){ sort.dir*=-1; } else { sort.k = k; sort.dir=1; }
        update();
      });
      th.addEventListener('contextmenu', (e)=>{
        e.preventDefault();
        const col = cols.find(c=> c.k===k);
        if(!col) return;
        openFilterModal(col, k);
      });
    });
    // name click handlers
    $('table-wrap').querySelectorAll('button.link-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const name = decodeURIComponent(btn.getAttribute('data-player')||'');
        const team = decodeURIComponent(btn.getAttribute('data-team')||'');
        openPlayerModal(name, team);
      });
    });
  }

  // ---- Filter Modal Logic ----
  const filterState = { colKey:null, colTitle:'', isNum:false };
  function openFilterModal(col, key){
    filterState.colKey = key; filterState.colTitle = col.t; filterState.isNum = !!col.num;
    const modal = $('filter-modal'); if(!modal) return;
    const title = $('filter-title'); if(title) title.textContent = `Filter: ${col.t}`;
    const colName = $('filter-col-name'); if(colName) colName.textContent = col.t;
    const secNum = $('filter-num'); const secText = $('filter-text');
    if(secNum && secText){
      secNum.style.display = col.num ? 'flex' : 'none';
      secText.style.display = col.num ? 'none' : 'flex';
    }
    const cur = filters[key];
    if(col.num){
      const opSel = $('filter-op-num'); const valInp = $('filter-val-num');
      if(opSel) opSel.value = (cur && cur.op) ? cur.op : '>=';
      if(valInp) valInp.value = cur && cur.v!=null ? cur.v : '';
      if(valInp) setTimeout(()=> valInp.focus(), 0);
    } else {
      const opSel = $('filter-op-text'); const valInp = $('filter-val-text');
      if(opSel) opSel.value = (cur && cur.op) ? cur.op : 'contains';
      if(valInp) valInp.value = cur && cur.v!=null ? cur.v : '';
      if(valInp) setTimeout(()=> valInp.focus(), 0);
    }
    // Show modal & lock scroll
    const prevOverflow = document.body.style.overflow || '';
    document.body.dataset.fPrevOverflow = prevOverflow;
    document.body.style.overflow = 'hidden';
    modal.style.display = 'flex';
  }
  function closeFilterModal(){
    const modal = $('filter-modal'); if(!modal) return;
    modal.style.display = 'none';
    const po = document.body.dataset.fPrevOverflow || '';
    document.body.style.overflow = po;
    delete document.body.dataset.fPrevOverflow;
  }
  // Wire static modal buttons once
  (function wireFilterModal(){
    const modal = document.getElementById('filter-modal');
    if(!modal) return; // in case HTML not present
    const card = document.getElementById('filter-card');
    const btnClose = document.getElementById('filter-close');
    const btnApply = document.getElementById('filter-apply');
    const btnClear = document.getElementById('filter-clear');
    if(btnClose) btnClose.onclick = ()=> closeFilterModal();
    if(btnClear) btnClear.onclick = ()=>{ if(filterState.colKey){ delete filters[filterState.colKey]; update(); } closeFilterModal(); };
    if(btnApply) btnApply.onclick = ()=>{
      const key = filterState.colKey; if(!key){ closeFilterModal(); return; }
      if(filterState.isNum){
        const op = $('filter-op-num')?.value || '>=';
        const val = $('filter-val-num')?.value || '';
        if(String(val).trim()===''){ delete filters[key]; } else { filters[key] = { type:'num', op, v: Number(val) }; }
      } else {
        const op = $('filter-op-text')?.value || 'contains';
        const val = $('filter-val-text')?.value || '';
        if(String(val).trim()===''){ delete filters[key]; } else { filters[key] = { type:'text', op, v: val }; }
      }
      update();
      closeFilterModal();
    };
    // Close when clicking backdrop
    modal.addEventListener('click', (e)=>{ if(e.target===modal) closeFilterModal(); });
    // Keyboard shortcuts inside modal
    modal.addEventListener('keydown', (e)=>{
      if(e.key==='Escape'){ e.preventDefault(); closeFilterModal(); }
      if(e.key==='Enter'){ e.preventDefault(); btnApply?.click(); }
    });
  })();

  // --- Player Modal ---
  function getROSTERS(){ try { const r = JSON.parse(localStorage.getItem('ibl.rosters')||'{}'); return r && typeof r==='object' ? r : {}; } catch { return {}; } }
  function getHandedness(name){
    const norm = (s)=> String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const slug = (s)=> norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    const targetA = norm(name);
    const targetB = slug(name);
    try{
      const rosters = getROSTERS();
      for(const t of Object.keys(rosters)){
        const list = rosters[t]||[];
        for(const p of list){
          if(!p) continue;
          const n1 = norm(p.name||p.fullName||'');
          const n2 = slug(p.name||p.fullName||'');
          if((n1 && n1===targetA) || (n2 && n2===targetB)){
            const bat = (p.bat ?? p.bats ?? p.B ?? '').toString().toUpperCase() || null;
            const thr = (p.throw ?? p.throws ?? p.T ?? '').toString().toUpperCase() || null;
            return { bat, thr };
          }
        }
      }
    }catch{}
    return { bat:null, thr:null };
  }
  function playerPhotoUrls(name){
    // Generate robust filename permutations for a player photo/card
    // Examples generated for "George Valera":
    //   george-valera.*, george_valera.*, georgevalera.*
    // Also try without suffixes like Jr., Sr., II, III, IV
    const raw = String(name||"").trim();
    const noDiacritics = raw.normalize && raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || raw;
    const stripped = noDiacritics.replace(/\b,(\s*)?(jr\.?|sr\.?|ii|iii|iv|v)\b/i, '').replace(/\b(jr\.?|sr\.?|ii|iii|iv|v)\b/i, '').trim();
    const parts = stripped.split(/\s+/);
    const firstLast = parts.join(' ');
    const lastFirst = parts.length>=2 ? `${parts[parts.length-1]} ${parts.slice(0,-1).join(' ')}` : firstLast;

    const variants = Array.from(new Set([
      firstLast,
      lastFirst,
    ].filter(Boolean)));

    const toCandidates = (s)=>{
      const slug = slugify(s);
      const unders = slug.replace(/-/g, '_');
      const nospc = slug.replace(/-/g, '');
      return [slug, unders, nospc];
    };

    const uniqStems = Array.from(new Set(variants.flatMap(toCandidates)));
    const exts = ['png','jpg','jpeg','webp'];
    const files = [];
    for(const stem of uniqStems){
      for(const ext of exts){ files.push(`Player-photos/${stem}.${ext}`); }
      for(const ext of exts){ files.push(`Player-cards/${stem}.${ext}`); }
    }
    return files;
  }
  function fallbackPlayerImage(name, preferBat){
    // Prefer batter silhouette when batting logs exist; else pitcher silhouette
    const hands = getHandedness(name);
    const base = 'Player-cards';
    if(!preferBat){
      const th = (hands.thr||hands.throw||'').toUpperCase();
      if(th==='L') return `${base}/uncarded-lhp.png`;
      return `${base}/uncarded-rhp.png`;
    }
    let bat = (hands.bat||'').toUpperCase();
    if(bat==='S' || !bat){
      // No pitcher context here; default to RHB silhouette for switch/unknown
      bat = 'R';
    }
    return bat==='L' ? `${base}/uncarded-lhb.png` : `${base}/uncarded-rhb.png`;
  }
  function logoUrlFromTeam(team){ const s = slugify(team||''); return `Logos/${s}.png`; }
  function resolveTeamLogo(team){
    const teams = getTeamsWithFallback();
    const slug = slugify(team||'');
    const m = teams.find(t=> slugify(t.name||t.key)===slug || slugify(t.key||'')===slug);
    if(m && m.logo) return m.logo;
    return `Logos/${slug}.png`;
  }
  function ipFromOuts(outs){ const ip = Math.floor((outs||0)/3); const rem = (outs||0)%3; return `${ip}${rem?'.'+rem:''}`; }
  function collectPlayerGameLogs(name){
    const games = getSaved();
    const logs = [];
    for(const g of games){
      if(!g || !g.stats) continue;
      const bat = g.stats.players && g.stats.players[name];
      const pit = g.stats.pitching && g.stats.pitching[name];
      if(!bat && !pit) continue;
      // Resolve team reliably using stats.teams map first, then lineups as fallback
      const st = bat || pit || {};
      const resolved = resolveTeamFromStat(st, g, name) || { teamName:'', teamKey:'' };
      const homeKey = (g.home && (g.home.key||g.home.name||g.home)) || '';
      const awayKey = (g.away && (g.away.key||g.away.name||g.away)) || '';
      const homeKeySlug = slugify(homeKey);
      const awayKeySlug = slugify(awayKey);
      const myKeySlug = slugify(resolved.teamKey || resolved.teamName);
      let isHome = null;
      if(myKeySlug){
        if(myKeySlug===homeKeySlug) isHome = true; else if(myKeySlug===awayKeySlug) isHome = false;
      }
      if(isHome===null){
        try{
          const hn = Array.isArray(g.lineups && g.lineups.home)? g.lineups.home : [];
          const an = Array.isArray(g.lineups && g.lineups.away)? g.lineups.away : [];
          if(hn.includes(name)) isHome = true; else if(an.includes(name)) isHome = false;
        }catch(_){ isHome = null; }
      }
      // Display names for teams
      const homeName = (typeof g.home==='string') ? g.home : (g.home && (g.home.name||g.home.key||''));
      const awayName = (typeof g.away==='string') ? g.away : (g.away && (g.away.name||g.away.key||''));
      const team = (isHome===true) ? homeName : (isHome===false ? awayName : (resolved.teamName||homeName||awayName||''));
      const opp  = (isHome===true) ? awayName : (isHome===false ? homeName : (myKeySlug===homeKeySlug? awayName : homeName));
      const date = g.finalizedAt ? new Date(g.finalizedAt) : (g.savedAt ? new Date(g.savedAt) : null);
      logs.push({ g, date, team, opp, bat: bat||null, pit: pit||null, isHome });
    }
    // newest first
    logs.sort((a,b)=> (b.date?b.date.getTime():0) - (a.date?a.date.getTime():0));
    return logs;
  }
  function renderPlayerModalContent(name, team){
    const hands = getHandedness(name);
    const logs = collectPlayerGameLogs(name);
    // Presence flags
    const hasBat = logs.some(l=> !!l.bat);
    const hasPit = logs.some(l=> !!l.pit);
    // Aggregate simple pitching metrics across all games (only if present)
    let outs=0, ER=0, K=0, BB=0, HR=0;
    if(hasPit){ logs.forEach(l=>{ const p=l.pit||{}; outs+=Number(p.Outs||0); ER+=Number(p.ER||0); K+=Number(p.K||0); BB+=Number(p.BB||0); HR+=Number(p.HR||0); }); }
    const IP = hasPit ? (outs/3) : 0;
    const ERA = hasPit && IP>0 ? (ER*9/IP) : null; const K9 = hasPit && IP>0 ? (K*9/IP) : null; const BB9 = hasPit && IP>0 ? (BB*9/IP) : null; const HR9 = hasPit && IP>0 ? (HR*9/IP) : null;
    // Aggregate batting metrics across all games (only if present)
    let AB=0, H=0, BBt=0, HBP=0, SF=0, HRb=0, RBI=0;
    if(hasBat){ logs.forEach(l=>{ const b=l.bat||{}; AB+=Number(b.AB||0); H+=Number(b.H||0); BBt+=Number(b.BB||0); HBP+=Number(b.HBP||0); SF+=Number(b.SF||0); HRb+=Number(b.HR||0); RBI+=Number(b.RBI||0); }); }
    const AVG = hasBat && AB>0 ? (H/AB) : null;
    const OPS = (function(){
      if(!hasBat || AB<=0) return null;
      // Estimate TB via singles+XBH if available; if not, rough OPS with BB/HBP only
      // Pull 2B/3B if present in any log
      let D2=0,D3=0; logs.forEach(l=>{ const b=l.bat||{}; D2+=Number(b['2B']||0); D3+=Number(b['3B']||0); });
      const singles = Math.max(0, H - D2 - D3 - HRb);
      const TB = singles + 2*D2 + 3*D3 + 4*HRb;
      const SLG = AB>0 ? (TB/AB) : null;
      const OBPden = AB + BBt + HBP + SF;
      const OBP = OBPden>0 ? ((H + BBt + HBP) / OBPden) : null;
      if(OBP==null || SLG==null) return null;
      return OBP + SLG;
    })();
  const displayTeam = team || (logs.find(l=> l.team && String(l.team).trim().length>0)?.team) || '';
  const logo = resolveTeamLogo(displayTeam);
    const header = `
      <div class="pm-hero">
        <div class="pm-hero-left">
          <div class="pm-hero-logo"><img id="pm-team-logo" src="${logo}" alt="${displayTeam}" onerror="this.style.display='none'"/></div>
          <div>
            <div class="pm-name">${name}</div>
            <div class="pm-sub"><span style="display:inline-flex;align-items:center;gap:6px;"><img src="${logo}" alt="${displayTeam}" onerror="this.style.display='none'" style="width:14px;height:14px;object-fit:contain;vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))"/>${displayTeam||''}</span> • ${hands.bat||'?'} / ${hands.thr||'?'} </div>
            <div class="pm-badges">
              ${hasBat?`
                <div class="pm-badge"><div class="label">AVG</div><div class="val">${AVG==null?'—':fmt(AVG,3)}</div></div>
                <div class="pm-badge"><div class="label">HR</div><div class="val">${HRb||0}</div></div>
                <div class="pm-badge"><div class="label">RBI</div><div class="val">${RBI||0}</div></div>
                <div class="pm-badge"><div class="label">OPS</div><div class="val">${OPS==null?'—':fmt(OPS,3)}</div></div>
              `:''}
              ${hasPit?`
                <div class="pm-badge"><div class="label">IP</div><div class="val">${fmt(IP||0,2)}</div></div>
                <div class="pm-badge"><div class="label">ERA</div><div class="val">${ERA==null?'—':fmt(ERA,2)}</div></div>
                <div class="pm-badge"><div class="label">K/9</div><div class="val">${K9==null?'—':fmt(K9,2)}</div></div>
                <div class="pm-badge"><div class="label">BB/9</div><div class="val">${BB9==null?'—':fmt(BB9,2)}</div></div>
                <div class="pm-badge"><div class="label">HR/9</div><div class="val">${HR9==null?'—':fmt(HR9,2)}</div></div>
              `:''}
            </div>
          </div>
        </div>
        <img id="pm-photo" class="pm-photo" alt="${name}"/>
      </div>`;
    // Helpers to resolve score and names robustly
    function teamNameOf(t){ return (typeof t==='string') ? t : (t && (t.name||t.key||t.team||t.id)) || ''; }
    function resolveScore(g){
      if(!g) return null;
      const homeN = teamNameOf(g.home), awayN = teamNameOf(g.away);
      const tryObjs = [g.score, g.finalScore, g.final, g.totals, g.results];
      for(const obj of tryObjs){
        if(obj && typeof obj==='object'){
          // direct home/away keys
          if(typeof obj.home==='number' && typeof obj.away==='number') return { hs: obj.home, as: obj.away };
          // keyed by team names
          if(homeN && awayN && typeof obj[homeN]==='number' && typeof obj[awayN]==='number') return { hs: obj[homeN], as: obj[awayN] };
          // keyed by initials
          if(g.home && g.home.initials && g.away && g.away.initials && typeof obj[g.home.initials]==='number' && typeof obj[g.away.initials]==='number') return { hs: obj[g.home.initials], as: obj[g.away.initials] };
        }
      }
      // linescore arrays
      const ls = g.linescore || g.lineScore || null;
      if(ls){
        const hArr = Array.isArray(ls.home) ? ls.home : (Array.isArray(ls.h)? ls.h : null);
        const aArr = Array.isArray(ls.away) ? ls.away : (Array.isArray(ls.a)? ls.a : null);
        if(hArr && aArr) return { hs: hArr.reduce((s,n)=>s+(Number(n)||0),0), as: aArr.reduce((s,n)=>s+(Number(n)||0),0) };
        const ht = Number(ls.homeTotal||ls.ht||ls.totalHome||ls.Home||ls.H)||NaN;
        const at = Number(ls.awayTotal||ls.at||ls.totalAway||ls.Away||ls.A)||NaN;
        if(!Number.isNaN(ht) && !Number.isNaN(at)) return { hs: ht, as: at };
      }
      if(typeof g.homeScore==='number' && typeof g.awayScore==='number') return { hs: g.homeScore, as: g.awayScore };
      return null;
    }
    // Aggregated batting totals across logs for Totals row
    const tAgg = logs.reduce((a,l)=>{
      const b = l.bat||{};
      a.AB += Number(b.AB||0);
      a.R  += Number(b.R||0);
      a.H  += Number(b.H||0);
      a.D2 += Number(b['2B']||0);
      a.D3 += Number(b['3B']||0);
      a.HR += Number(b.HR||0);
      a.RBI+= Number(b.RBI||0);
      a.BB += Number(b.BB||0);
      a.HBP+= Number(b.HBP||0);
      a.SO += Number(b.K||0);
      a.SB += Number(b.SB||0);
      a.CS += Number(b.CS||0);
      a.SF += Number(b.SF||0);
      return a;
    }, { AB:0,R:0,H:0,D2:0,D3:0,HR:0,RBI:0,BB:0,HBP:0,SO:0,SB:0,CS:0,SF:0 });
    const tSingles = Math.max(0, tAgg.H - tAgg.D2 - tAgg.D3 - tAgg.HR);
    const tTB = tSingles + 2*tAgg.D2 + 3*tAgg.D3 + 4*tAgg.HR;
    const tAVG = tAgg.AB>0 ? (tAgg.H/tAgg.AB) : null;
    const tOBPden = tAgg.AB + tAgg.BB + tAgg.HBP + tAgg.SF;
    const tOBP = tOBPden>0 ? ((tAgg.H + tAgg.BB + tAgg.HBP) / tOBPden) : null;
    const tSLG = tAgg.AB>0 ? (tTB/tAgg.AB) : null;
    const tOPS = (tOBP!=null && tSLG!=null) ? (tOBP + tSLG) : null;

  const rows = logs.filter(l=> l.bat).map(l=>{
      const d = l.date ? `${l.date.getFullYear()}-${String(l.date.getMonth()+1).padStart(2,'0')}-${String(l.date.getDate()).padStart(2,'0')}` : '';
  const bat = l.bat||{};
  const opp = l.opp || '';
  const oppLogo = opp ? `<img src="${resolveTeamLogo(opp)}" alt="${opp}" onerror="this.style.display='none'" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))"/>` : '';
      // Result (W/L and score with player's team first)
      let result = '';
      try{
        const g = l.g || l; // saved game object from collectPlayerGameLogs
        const homeN = teamNameOf(g.home);
        const awayN = teamNameOf(g.away);
        const score = resolveScore(g);
        if(score){
          let isHome = (l.isHome!=null) ? !!l.isHome : null;
          if(isHome===null){
            if(l.team){
              const t = String(l.team||'');
              if(t===homeN) isHome = true; else if(t===awayN) isHome = false;
            }
          }
          if(isHome===null && g.lineups){
            const hn = Array.isArray(g.lineups.home)? g.lineups.home : [];
            const an = Array.isArray(g.lineups.away)? g.lineups.away : [];
            if(hn.includes(name)) isHome = true; else if(an.includes(name)) isHome = false;
          }
          if(isHome!==null){
            const myRuns = isHome ? score.hs : score.as;
            const oppRuns = isHome ? score.as : score.hs;
            const letter = myRuns>oppRuns ? 'W' : (myRuns<oppRuns ? 'L' : 'T');
            result = `${letter} ${myRuns}-${oppRuns}`;
          }
        }
      }catch(_){ }
      const AB = Number(bat.AB||0), H = Number(bat.H||0), R = Number(bat.R||0), D2 = Number(bat['2B']||0), D3 = Number(bat['3B']||0), HR = Number(bat.HR||0), RBI = Number(bat.RBI||0), BB = Number(bat.BB||0), HBP = Number(bat.HBP||0), SO = Number(bat.K||0), SB = Number(bat.SB||0), CS = Number(bat.CS||0), SF = Number(bat.SF||0);
      const singles = Math.max(0, H - D2 - D3 - HR);
      const TB = singles + 2*D2 + 3*D3 + 4*HR;
      const AVG = AB>0 ? (H/AB) : null;
      const OBPden = AB + BB + HBP + SF;
      const OBP = OBPden>0 ? ((H + BB + HBP) / OBPden) : null;
      const SLG = AB>0 ? (TB/AB) : null;
      const OPS = (OBP!=null && SLG!=null) ? (OBP + SLG) : null;
      return `<tr>
        <td>${d}</td>
  <td><span style="display:inline-flex;align-items:center;gap:6px;">${oppLogo}${opp}</span></td>
        <td>${result||''}</td>
        <td class="num">${AB}</td>
        <td class="num">${R||0}</td>
        <td class="num">${H||0}</td>
        <td class="num">${D2||0}</td>
        <td class="num">${D3||0}</td>
        <td class="num">${HR||0}</td>
        <td class="num">${RBI||0}</td>
        <td class="num">${BB||0}</td>
        <td class="num">${HBP||0}</td>
        <td class="num">${SO||0}</td>
        <td class="num">${SB||0}</td>
        <td class="num">${CS||0}</td>
        <td class="num">${AVG==null?'—':fmt(AVG,3)}</td>
        <td class="num">${OBP==null?'—':fmt(OBP,3)}</td>
        <td class="num">${SLG==null?'—':fmt(SLG,3)}</td>
        <td class="num">${OPS==null?'—':fmt(OPS,3)}</td>
      </tr>`;
    }).join('');
  const totalsRow = logs.some(l=>l.bat) ? `<tr style="font-weight:700;background:#0003;">
      <td></td>
      <td>Totals</td>
      <td></td>
      <td class="num">${tAgg.AB}</td>
      <td class="num">${tAgg.R}</td>
      <td class="num">${tAgg.H}</td>
      <td class="num">${tAgg.D2}</td>
      <td class="num">${tAgg.D3}</td>
      <td class="num">${tAgg.HR}</td>
      <td class="num">${tAgg.RBI}</td>
      <td class="num">${tAgg.BB}</td>
      <td class="num">${tAgg.HBP}</td>
      <td class="num">${tAgg.SO}</td>
      <td class="num">${tAgg.SB}</td>
      <td class="num">${tAgg.CS}</td>
      <td class="num">${tAVG==null?'—':fmt(tAVG,3)}</td>
      <td class="num">${tOBP==null?'—':fmt(tOBP,3)}</td>
      <td class="num">${tSLG==null?'—':fmt(tSLG,3)}</td>
      <td class="num">${tOPS==null?'—':fmt(tOPS,3)}</td>
    </tr>` : '';
  const batTable = logs.some(l=>l.bat) ? `<table style="width:100%;border-collapse:separate;border-spacing:0 6px;">
      <thead><tr>
        <th>Date</th>
        <th>OPP</th>
        <th>Result</th>
        <th>AB</th><th>R</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>BB</th><th>HBP</th><th>SO</th><th>SB</th><th>CS</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th>
      </tr></thead>
      <tbody>${rows ? (totalsRow + rows) : '<tr><td colspan="19" class="muted">No logs</td></tr>'}</tbody>
    </table>` : '';

    // Pitching game score calculation
    function gameScore(p){
      const outs = Number(p.Outs||0);
      const K = Number(p.K||0);
      const BB = Number(p.BB||0);
      const H = Number(p.H||0);
      const R = Number(p.R||0);
      const HR = Number(p.HR||0);
      return 40 + (2*outs) + K - (2*BB) - (2*H) - (3*R) - (6*HR);
    }
    // Build pitching logs table if present
    const pitLogs = logs.filter(l=> l.pit);
    // Pitching totals aggregation
    const pTot = pitLogs.reduce((a,l)=>{
      const p=l.pit||{};
      a.outs += Number(p.Outs||0);
      a.H += Number(p.H||0);
      a.R += Number(p.R||0);
      a.ER += Number(p.ER||0);
      a.HR += Number(p.HR||0);
      a.BB += Number(p.BB||0);
      a.K += Number(p.K||0);
      a.GB += Number(p.GB||0);
      a.FB += Number(p.FB||0);
      a.BF += Number(p.BF||0);
      a.W  += Number(p.W||0);
      a.L  += Number(p.L||0);
      a.SV += Number(p.SV||0);
      const gsc = (function(){ return 40 + (2*Number(p.Outs||0)) + Number(p.K||0) - 2*Number(p.BB||0) - 2*Number(p.H||0) - 3*Number(p.R||0) - 6*Number(p.HR||0); })();
      a.gscTotal += gsc; a.gCount += 1;
      return a;
    }, { outs:0,H:0,R:0,ER:0,HR:0,BB:0,K:0,GB:0,FB:0,BF:0,W:0,L:0,SV:0,gscTotal:0,gCount:0 });
    const pitRows = pitLogs.map(l=>{
      const p = l.pit || {};
      const ip = ipFromOuts(p.Outs||0);
      const era = (p.Outs>0 && p.Outs!==0) ? ((Number(p.ER||0)*9) / (Number(p.Outs||0)/3)) : null;
      const gsc = gameScore(p);
      const dec = Number(p.W||0)>0 ? 'W' : Number(p.L||0)>0 ? 'L' : Number(p.SV||0)>0 ? 'SV' : '';
      const d = l.date ? `${l.date.getFullYear()}-${String(l.date.getMonth()+1).padStart(2,'0')}-${String(l.date.getDate()).padStart(2,'0')}` : '';
      const opp = l.opp || '';
      const oppLogo = opp ? `<img src="${resolveTeamLogo(opp)}" alt="${opp}" onerror="this.style.display='none'" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))"/>` : '';
      // Result (W/L/T and score with player's team first)
      let result = '';
      try{
        const g = l.g || l;
        const homeN = teamNameOf(g.home);
        const awayN = teamNameOf(g.away);
        const score = resolveScore(g);
        if(score){
          let isHome = (l.isHome!=null) ? !!l.isHome : null;
          if(isHome===null){
            if(l.team){
              const t = String(l.team||'');
              if(t===homeN) isHome = true; else if(t===awayN) isHome = false;
            }
          }
          if(isHome===null && g.lineups){
            const hn = Array.isArray(g.lineups.home)? g.lineups.home : [];
            const an = Array.isArray(g.lineups.away)? g.lineups.away : [];
            if(hn.includes(name)) isHome = true; else if(an.includes(name)) isHome = false;
          }
          if(isHome!==null){
            const myRuns = isHome ? score.hs : score.as;
            const oppRuns = isHome ? score.as : score.hs;
            const letter = myRuns>oppRuns ? 'W' : (myRuns<oppRuns ? 'L' : 'T');
            result = `${letter} ${myRuns}-${oppRuns}`;
          }
        }
      }catch(_){ }
      return `<tr>
        <td>${d}</td>
        <td><span style="display:inline-flex;align-items:center;gap:6px;">${oppLogo}${opp}</span></td>
        <td>${result||''}</td>
        <td class="num">${ip}</td>
        <td class="num">${p.H||0}</td>
        <td class="num">${p.R||0}</td>
        <td class="num">${p.ER||0}</td>
        <td class="num">${p.HR||0}</td>
        <td class="num">${p.BB||0}</td>
        <td class="num">${p.K||0}</td>
        <td class="num">${p.GB||0}</td>
        <td class="num">${p.FB||0}</td>
        <td class="num">${p.BF||0}</td>
        <td class="num">${gsc}</td>
        <td>${dec}</td>
        <td class="num">${era==null?'—':fmt(era,2)}</td>
      </tr>`;
    }).join('');
    const totIP = ipFromOuts(pTot.outs);
    const totERA = pTot.outs>0 ? ((pTot.ER*9) / (pTot.outs/3)) : null;
    const avgGSC = pTot.gCount>0 ? Math.round(pTot.gscTotal / pTot.gCount) : null;
    const totDec = `${pTot.W}-${pTot.L}-${pTot.SV}`;
    const pitTotalsRow = pitLogs.length ? `<tr style=\"font-weight:700;background:#0003;\">\
      <td></td>\
      <td>Totals</td>\
      <td></td>\
      <td class=\"num\">${totIP}</td>\
      <td class=\"num\">${pTot.H}</td>\
      <td class=\"num\">${pTot.R}</td>\
      <td class=\"num\">${pTot.ER}</td>\
      <td class=\"num\">${pTot.HR}</td>\
      <td class=\"num\">${pTot.BB}</td>\
      <td class=\"num\">${pTot.K}</td>\
      <td class=\"num\">${pTot.GB}</td>\
      <td class=\"num\">${pTot.FB}</td>\
      <td class=\"num\">${pTot.BF}</td>\
      <td class=\"num\">${avgGSC==null?'—':avgGSC}</td>\
      <td>${totDec}</td>\
      <td class=\"num\">${totERA==null?'—':fmt(totERA,2)}</td>\
    </tr>` : '';
  const pitTable = logs.some(l=>l.pit) ? `<table style=\"width:100%;border-collapse:separate;border-spacing:0 6px;\">\
      <thead><tr>
        <th>Date</th><th>OPP</th><th>Result</th>
        <th>IP</th><th>H</th><th>R</th><th>ER</th><th>HR</th><th>BB</th><th>K</th><th>GB</th><th>FB</th><th>TBF</th><th>GSC</th><th>Dec</th><th>ERA</th>
      </tr></thead>
      <tbody>${pitRows ? (pitTotalsRow + pitRows) : '<tr><td colspan=\"16\" class=\"muted\">No pitching logs</td></tr>'}</tbody>\
    </table>` : '';

  const both = hasBat && hasPit;
  const tabs = both ? `<div class="pm-tabs"><button id="pm-tab-bat" class="pm-tab active">Batting</button><button id="pm-tab-pit" class="pm-tab">Pitching</button></div>` : '';
  const secBat = hasBat ? `<div id="pm-sec-bat" class="pm-section ${hasBat?'active':''}">${batTable}</div>` : '';
  const secPit = hasPit ? `<div id="pm-sec-pit" class="pm-section ${!hasBat?'active':''}">${pitTable}</div>` : '';
  return header + tabs + secBat + secPit;
  }
  function trySetImage(el, urls, label){
    (function next(i){
      if(i>=urls.length){
        try{ console.warn('Image load failed for', label||el?.id||'img', 'candidates:', urls); }catch(_){ }
        // Leave element visible; just no src
        return;
      }
      const u = urls[i];
      try{ console.debug('Trying image', label||el?.id||'img', '→', u); }catch(_){ }
      el.onload = ()=>{};
      el.onerror = ()=> next(i+1);
      el.src = u;
    })(0);
  }
  function svgDataUrl(svg){ return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }
  function defaultPlayerSVG(preferBat){
    const body = preferBat ? '#2bd4ff' : '#f59e0b';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <rect width="120" height="120" rx="16" fill="#0b1623"/>
      <circle cx="60" cy="42" r="20" fill="#20344a" stroke="${body}" stroke-width="2"/>
      <rect x="30" y="70" width="60" height="34" rx="10" fill="#20344a" stroke="${body}" stroke-width="2"/>
    </svg>`;
    return svgDataUrl(svg);
  }
  function defaultLogoSVG(){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
      <rect width="56" height="56" rx="12" fill="#0b1623"/>
      <circle cx="28" cy="28" r="18" fill="#20344a" stroke="#93c5fd" stroke-width="2"/>
      <circle cx="28" cy="28" r="3" fill="#93c5fd"/>
    </svg>`;
    return svgDataUrl(svg);
  }
  function openPlayerModal(name, team){
    const modal = document.getElementById('player-modal');
    const content = document.getElementById('pm-content');
    const title = document.getElementById('pm-title');
    title.textContent = name;
    content.innerHTML = renderPlayerModalContent(name, team);
    const img = document.getElementById('pm-photo');
    // Build image candidates with richer permutations, team-specific silhouettes, and inline SVG fallback
    try{
      const logs = collectPlayerGameLogs(name);
      const preferBat = logs.some(l=> !!l.bat) || !logs.some(l=> !!l.pit);
      // Team slug (from explicit team arg or inferred from logs)
      const teamName = (team && team.trim()) || (logs.find(l=> l.team)?.team) || '';
      const teamSlug = slugify(teamName);
      const hand = getHandedness(name);
      const handSuffix = preferBat ? ((hand.bat||'').toUpperCase()==='L' ? 'lhb' : 'rhb')
                                   : ((hand.thr||hand.throw||'').toUpperCase()==='L' ? 'lhp' : 'rhp');

      const base = playerPhotoUrls(name);
      const teamSilhouettes = teamSlug ? [
        `Player-cards/uncarded-${teamSlug}-${handSuffix}.png`,
        `Player-cards/uncarded-${teamSlug}.png`,
      ] : [];
      const genericSilhouette = [ fallbackPlayerImage(name, preferBat) ];
      const logoFallback = teamSlug ? [ `Logos/${teamSlug}.png`, `Logos/${teamSlug}.jpg`, `Logos/${teamSlug}.webp` ] : [];

      const finalSvg = defaultPlayerSVG(preferBat);
      const candidates = base.concat(teamSilhouettes).concat(genericSilhouette).concat(logoFallback).concat([finalSvg]);
      trySetImage(img, candidates, 'player-photo');
    }catch(_){
      trySetImage(img, playerPhotoUrls(name).concat([defaultPlayerSVG(true)]), 'player-photo');
    }
    const teamLogoEl = document.getElementById('pm-team-logo');
    if(teamLogoEl){
      const t = (team && team.trim().length>0) ? team : (content.querySelector('.pm-sub')?.textContent?.trim().split('•')[0]||'');
      const slug = slugify(String(t).replace(/[^A-Za-z0-9\- ]+/g,'').trim());
      const candidates = [`Logos/${slug}.png`,`Logos/${slug}.jpg`,`Logos/${slug}.jpeg`,`Logos/${slug}.webp`, defaultLogoSVG()];
      trySetImage(teamLogoEl, candidates, 'team-logo');
    }
    // Tabs behavior (if both sections exist)
    const tBat = document.getElementById('pm-tab-bat');
    const tPit = document.getElementById('pm-tab-pit');
    const sBat = document.getElementById('pm-sec-bat');
    const sPit = document.getElementById('pm-sec-pit');
    if(tBat && tPit && sBat && sPit){
      tBat.addEventListener('click', ()=>{
        tBat.classList.add('active'); tPit.classList.remove('active');
        sBat.classList.add('active'); sPit.classList.remove('active');
      });
      tPit.addEventListener('click', ()=>{
        tPit.classList.add('active'); tBat.classList.remove('active');
        sPit.classList.add('active'); sBat.classList.remove('active');
      });
    }
    // Lock background scroll and scroll modal to top
    const prevOverflow = document.body.style.overflow || '';
    const prevScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    document.body.dataset.pmPrevOverflow = prevOverflow;
    document.body.dataset.pmPrevScroll = String(prevScroll);
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    modal.style.display = 'flex';
    const card = document.getElementById('player-modal-card');
    if(card){ card.scrollTop = 0; }
    const closeModal = ()=>{
      modal.style.display = 'none';
      const po = document.body.dataset.pmPrevOverflow || '';
      const ps = Number(document.body.dataset.pmPrevScroll||0);
      document.body.style.overflow = po;
      delete document.body.dataset.pmPrevOverflow;
      delete document.body.dataset.pmPrevScroll;
      window.scrollTo(0, ps);
    };
    document.getElementById('pm-close').onclick = closeModal;
    modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });
  }

  // Boot
  renderTeams();
  update();
})();
