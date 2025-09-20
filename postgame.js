(function(){
  'use strict';
  function slugify(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function byId(id){ return document.getElementById(id); }
  function fmt(n){ return new Intl.NumberFormat().format(n||0); }
  function tryImg(el, urls){
    (function next(i){ if(i>=urls.length){ el.style.display='none'; return; } const u=urls[i]; el.onload=()=>{}; el.onerror=()=>next(i+1); el.src=u; })(0);
  }
  function logoUrls(team){ const s=slugify(team); return [ `Logos/${s}.png`, `logos/${s}.png`, `Team-logos/${s}.png`, `Player-cards/${s}.png` ]; }
  function playerPhotoUrls(name){ const s=slugify(name); return [ `Player-photos/${s}.png`, `Player-photos/${s}.jpg`, `Player-photos/${s}.jpeg`, `Player-photos/${s}.webp`, `Player-cards/${s}.png`, `Player-cards/${s}.jpg` ]; }
  function playerCardUrls(name){ const s=slugify(name); return [ `Player-cards/${s}.png`, `Player-cards/${s}.jpg` ]; }
  function managerUrls(team){ const s=slugify(team); return [ `Player-cards/${s}-manager.png`, `Player-cards/${s}-manager.jpg` ]; }
  function toOuts(stat){
    if(!stat) return 0;
    if(stat.Outs!=null) return Number(stat.Outs)||0;
    if(stat.IP!=null){
      const ip = Number(stat.IP)||0; const whole = Math.trunc(ip); const frac = Math.round((ip - whole)*10);
      return whole*3 + (frac===1?1:frac===2?2:0);
    }
    return 0;
  }

  function loadSnap(){ try{ const raw = localStorage.getItem('ibl.postgame'); if(!raw) return null; return JSON.parse(raw); }catch(_){ return null; } }
  const snap = loadSnap();
  if(!snap){ byId('seg').innerHTML = '<div>Missing postgame data.</div>'; return; }

  const state = snap; // same shape as game state snapshot
  const home = state.home, away = state.away;
  const hs = (state.score && state.score[home])||0, as = (state.score && state.score[away])||0;
  const lastInning = state.inning || Math.max((state.lineScore.away||[]).length, (state.lineScore.home||[]).length) || 9;

  // Helper: resolve a player's team using stats.teams mapping first, then lineup membership
  function teamForName(name){
    try{
      const map = state.stats && state.stats.teams || {};
      const mapped = map[name];
      if(mapped){ return mapped; }
    }catch(_){ }
    if((state.lineups.home||[]).includes(name)) return home;
    if((state.lineups.away||[]).includes(name)) return away;
    return null;
  }
  // Build combined player lists (hitters and pitchers) with reliable team mapping
  const players = Object.entries(state.stats && state.stats.players || {}).map(([name,st])=>({ name, t: teamForName(name), role:'h', st }));
  const pitchers = Object.entries(state.stats && state.stats.pitching || {}).map(([name,st])=>({ name, t: teamForName(name), role:'p', st }));

  function hitterPotg(p){ const s=p.st||{}; const oneB = Math.max(0,(s.H||0) - (s['2B']||0) - (s['3B']||0) - (s.HR||0)); const sb = s.SB||0; const gidp = s.GIDP||0; return 2*(s.HR||0) + 1.5*(s['3B']||0) + 1.2*(s['2B']||0) + 1*oneB + 1*(s.BB||0) + 1.5*sb + 2*(s.R||0) + 2*(s.RBI||0) - 0.5*(s.K||0) - 0.5*gidp; }
  function pitcherPotg(p){ const s=p.st||{}; const ip = (toOuts(s)||0)/3; return 6*(s.W||0) + 4*(s.SV||0) + 3*ip + 2*(s.K||0) - 2*(s.BB||0) - 4*(s.ER||0) - 2*(s.H||0); }
  function potgScore(p){ return p.role==='p' ? pitcherPotg(p) : hitterPotg(p); }

  function topPerformerForTeam(team){
    const arr = players.concat(pitchers).filter(x=>x.t===team);
    arr.sort((a,b)=> potgScore(b)-potgScore(a));
    return arr[0]||null;
  }
  const tpHome = topPerformerForTeam(home), tpAway = topPerformerForTeam(away);

  function bestOverall(){ const arr = players.concat(pitchers); arr.sort((a,b)=> potgScore(b)-potgScore(a)); return arr[0]||null; }
  const potg = bestOverall();

  function hitterLine(s){ const parts=[]; if(s.HR) parts.push(`${s.HR} HR`); if(s['3B']) parts.push(`${s['3B']} 3B`); if(s['2B']) parts.push(`${s['2B']} 2B`); const oneB=Math.max(0,(s.H||0)-(s['2B']||0)-(s['3B']||0)-(s.HR||0)); if(oneB) parts.push(`${oneB} 1B`); if(s.BB) parts.push(`${s.BB} BB`); if(s.SB) parts.push(`${s.SB} SB`); if(s.R) parts.push(`${s.R} R`); if(s.RBI) parts.push(`${s.RBI} RBI`); if(s.K) parts.push(`${s.K} K`); return parts.join(', ')||'—'; }
  function pitcherLine(s){
    const outs = toOuts(s);
    const whole = Math.floor(outs/3); const rem = outs%3; const ipStr = `${whole}${rem?'.'+rem:''}`;
    const parts=[ `${ipStr} IP` ]; if(s.K) parts.push(`${s.K} K`); if(s.BB) parts.push(`${s.BB} BB`); if(s.H) parts.push(`${s.H} H`); if(s.ER!=null) parts.push(`${s.ER} ER`);
    return parts.join(', ');
  }

  // Shared tables for batting and pitching (used on multiple slides)
  function ipStringFromOuts(outs){ const whole=Math.floor(outs/3); const rem=outs%3; return `${whole}${rem?'.'+rem:''}`; }
  function buildBattingTable(team){
    const hitters = players.filter(p=>p.t===team);
    // show: AB, R, H, 2B, 3B, HR, RBI, BB, K, SB
    const cols = [ ['AB','AB'], ['R','R'], ['H','H'], ['2B','2B'], ['3B','3B'], ['HR','HR'], ['RBI','RBI'], ['BB','BB'], ['K','K'], ['SB','SB'] ];
    const head = cols.map(c=>`<th style=\"padding:4px 6px;border-bottom:1px solid #ffffff22;text-align:center;\">${c[0]}</th>`).join('');
    const rows = hitters.map(h=>{
      const s=h.st||{}; return `<tr>
          <td style=\"padding:4px 6px;border-bottom:1px solid #ffffff22;\">${h.name}</td>
          ${cols.map(([lab,key])=>`<td style=\\"padding:4px 6px;border-bottom:1px solid #ffffff22;text-align:center;\\\">${s[key]??''}</td>`).join('')}
        </tr>`;
    }).join('') || '<tr><td colspan="11" style="padding:6px 8px;text-align:center;opacity:.7;">No batting stats</td></tr>';
    return `<table style=\"width:100%;border-collapse:collapse;background:#0002;border:1px solid #ffffff22;border-radius:10px;overflow:hidden;font-size:12px;\">
      <thead><tr><th style=\"padding:4px 6px;border-bottom:1px solid #ffffff22;text-align:left;\">${team} Batting</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
  function buildPitchingTable(team){
    const ps = pitchers.filter(p=>p.t===team);
    // show: IP, H, R, ER, BB, K, HR, BF, W, L, SV
    const cols = [ ['IP','IP'], ['H','H'], ['R','R'], ['ER','ER'], ['BB','BB'], ['K','K'], ['HR','HR'], ['BF','BF'], ['W','W'], ['L','L'], ['SV','SV'] ];
    const head = cols.map(c=>`<th style=\"padding:4px 6px;border-bottom:1px solid #ffffff22;text-align:center;\">${c[0]}</th>`).join('');
    const rows = ps.map(p=>{ const s=p.st||{}; const outs=toOuts(s); const ip=ipStringFromOuts(outs); return `<tr>
        <td style=\"padding:4px 6px;border-bottom:1px solid #ffffff22;\">${p.name}</td>
        ${cols.map(([lab,key])=>{ let val=s[key]; if(key==='IP') val=ip; return `<td style=\\"padding:4px 6px;border-bottom:1px solid #ffffff22;text-align:center;\\\">${val??''}</td>`; }).join('')}
      </tr>`; }).join('') || '<tr><td colspan="12" style="padding:6px 8px;text-align:center;opacity:.7;">No pitching stats</td></tr>';
    return `<table style=\"width:100%;border-collapse:collapse;background:#0002;border:1px solid #ffffff22;border-radius:10px;overflow:hidden;font-size:12px;\">
      <thead><tr><th style=\"padding:4px 6px;border-bottom:1px solid #ffffff22;text-align:left;\">${team} Pitching</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // Headline templates
  const hitterHeads = [
    "{name}'s {hr} power fuels {team}",
    "{name} piles up {rbi} RBI as {team} topple {opp}",
    "{name} ignites offense with {hits} hits for {team}",
    "{name} homers {hr}x; {team} win tight one",
    "{name} stuffs stat sheet in {team} victory",
    "{name} delivers late; {team} edge {opp}",
    "{team} ride {name}'s {xbh} to win",
    "{name} reaches {times} times; {team} surge past {opp}",
    "{name} sets tone early; {team} never trail",
    "{name}'s clutch bat lifts {team}",
    "{name} goes deep and drives {team} to W",
    "{name} sparks crooked inning; {team} prevail",
    "{name} rains XBH; {team} celebrate",
    "{name} torches {opp} with {r} runs and {rbi} RBI",
    "{name} powers {team} behind multi-hit day",
    "{name} breaks it open; {team} grab momentum",
    "{name} tags {opp} pitching; {team} roll",
    "{name}'s big swing turns tide for {team}",
    "{name} manufactures runs as {team} outlast {opp}",
    "{name} presses advantage; {team} finish the job",
    "{name} shines at the plate; {team} claim it",
    "{name} keys rally; {team} steal one",
    "{name} barrels everything; {team} win thriller",
    "{name} stacks bases; {team} capitalize",
    "{name} stays hot; {team} take series opener",
    "{name} sprays line drives; {team} set the pace",
    "{name} sparks five-run frame; {team} roar back",
    "{name} turns on heat; {team} overwhelm {opp}",
    "{name} keeps rally alive; {team} grind out W",
    "{name} punishes mistakes; {team} cruise",
    "{name} stacks quality ABs; {team} break through",
    "{name} catalyzes comeback; {team} flip script",
    "{name} puts on clinic; {team} knock off {opp}",
    "{name} goes gap-to-gap; {team} pour it on",
    "{name} feasts with RISP; {team} capitalize",
    "{name} ignites crowd; {team} seize control",
    "{name} finds barrels; {team} keep pressure on",
    "{name} stays locked in; {team} close strong",
    "{name} answers bell late; {team} walk it off",
    "{name} breaks slump in a big way; {team} celebrate",
    "{name} plates go-ahead run; {team} hold firm",
    "{name} stacks extra-base hits; {team} outslug {opp}",
    "{name} manufactures insurance; {team} slam door",
    "{name} reaches four times; {team} pile on",
    "{name} is a sparkplug; {team} keep rolling",
    "{name} delivers dagger; {team} bury {opp}"
  ];
  const pitcherHeads = [
    "{name} fans {k} as {team} tame {opp}",
    "{name} twirls {ip} strong; {team} cruise",
    "{name} slams door with {sv} save; {team} hold on",
    "{name} dominates zone; {team} ride pitching",
    "{name} mows {opp} with {k} K in {ip} IP",
    "{name} weaves out of traffic; {team} survive",
    "{name} shoves; {team} bullpen finishes",
    "{name} paints corners, blanks {opp}",
    "{name} sets tone on mound; {team} complete win",
    "{name} bends not breaks; {team} outlast {opp}",
    "{name} deals; {team} ride arms to victory",
    "{name} dominates late; {team} clamp down",
    "{name} spins gem; {team} celebrate",
    "{name} leads staff; {team} keep {opp} quiet",
    "{name} silences bats; {team} triumph",
    "{name} bulldogs through {ip}; {team} rewarded",
    "{name} is nails; {team} take it",
    "{name} dials up punchouts; {team} win",
    "{name} locks in; {team} secure it",
    "{name} anchors effort; {team} get past {opp}",
    "{name} carves lineup; {team} prevail",
    "{name} shortens game; {team} edge {opp}",
    "{name} thrives under pressure; {team} close it",
    "{name} suffocates rally; {team} ride the zeroes",
    "{name} commands tempo; {team} take control",
    "{name} owns edges; {team} dictate pace",
    "{name} attacks zone early; {team} in command",
    "{name} strands traffic; {team} slam the door",
    "{name} posts zeros; {team} make it stand",
    "{name} chains whiffs; {team} starve {opp}",
    "{name} saves the day; {team} hang on",
    "{name} rides fastball; {team} never flinch",
    "{name} spins sliders; {team} stifle {opp}",
    "{name} scatters hits; {team} take the rubber match",
    "{name} resets tone after hiccup; {team} surge",
    "{name} closes with authority; {team} celebrate",
    "{name} navigates jam; {team} tilt momentum",
    "{name} sequences beautifully; {team} bottle up bats",
    "{name} mixes speeds; {team} pull away",
    "{name} bullpens the blueprint; {team} execute"
  ];

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function buildHeadline(p){
    if(!p) return 'Player of the Game';
    const opp = p.t===home?away:home;
    if(p.role==='h'){
      const s=p.st||{}; const hr=s.HR||0; const rbi=s.RBI||0; const hits=s.H||0; const xbh=(s['2B']||0)+(s['3B']||0)+(s.HR||0); const times=(hits+(s.BB||0)+(s.HBP||0))||0; const r=s.R||0;
      let t = pick(hitterHeads);
      t = t.replace('{name}', p.name).replace('{team}', p.t).replace('{opp}', opp)
           .replace('{hr}', String(hr)).replace('{rbi}', String(rbi)).replace('{hits}', String(hits))
           .replace('{xbh}', String(xbh)).replace('{times}', String(times)).replace('{r}', String(r));
      return t;
    } else {
      const s=p.st||{}; const outs = toOuts(s); const ip = `${Math.floor(outs/3)}${outs%3?'.'+(outs%3):''}`; const k=s.K||0; const sv=s.SV||0;
      let t = pick(pitcherHeads);
      t = t.replace('{name}', p.name).replace('{team}', p.t).replace('{opp}', opp)
           .replace('{ip}', ip).replace('{k}', String(k)).replace('{sv}', String(sv));
      return t;
    }
  }

  // Key moment detection based on lineScore lead changes late
  function keyMoment(){
    const la = state.lineScore.away||[]; const lh = state.lineScore.home||[];
    let a=0,h=0; const moments=[];
    for(let inn=1; inn<=Math.max(la.length, lh.length, lastInning); inn++){
      const topRuns = la[inn-1]||0; if(topRuns>0){ const before={a,h}; a+=topRuns; if(a>h){ moments.push({ inn, half:'top', team:away, before, after:{a,h}, runs:topRuns }); } else { moments.push({ inn, half:'top', team:away, before, after:{a,h}, runs:topRuns, type:'add' }); } }
      const botRuns = lh[inn-1]||0; if(botRuns>0){ const before={a,h}; h+=botRuns; if(h>a){ moments.push({ inn, half:'bottom', team:home, before, after:{a,h}, runs:botRuns }); } else { moments.push({ inn, half:'bottom', team:home, before, after:{a,h}, runs:botRuns, type:'add' }); } }
    }
    // Prefer lead changes 7th inning or later, otherwise biggest run swing
    const late = moments.filter(m=> (m.half==='top' || m.half==='bottom') && m.inn>=7 && m.before && ((m.team===home && (m.before.h||0) <= (m.before.a||0) && (m.after&&m.after.h) > (m.after&&m.after.a)) || (m.team===away && (m.before.a||0) <= (m.before.h||0) && (m.after&&m.after.a) > (m.after&&m.after.h))));
    const pickLate = late[0] || null;
    const big = moments.sort((x,y)=> (y.runs||0)-(x.runs||0))[0] || null;
    return pickLate || big || null;
  }
  const km = keyMoment();

  function setMeta(){ const arrow = 'FINAL'; byId('meta').textContent = `${away} ${fmt(as)} - ${fmt(hs)} ${home} • ${arrow}`; }
  setMeta();

  const segments = [];

  // Segment 1: Final score + team logos + each team's top performer
  segments.push(function renderFinal(){
    const seg = byId('seg');
    // Build linescore (box) for immediate display on first slide (without save UI)
    const la = state.lineScore.away||[]; const lh = state.lineScore.home||[];
    const inn = Math.max(la.length, lh.length, lastInning);
    const hdr = Array.from({length:inn}, (_,i)=> `<th style="padding:4px 6px;border-bottom:1px solid #ffffff22;">${i+1}</th>`).join('');
    const row = (label, arr, total)=> `<tr><td style="padding:4px 6px;border-bottom:1px solid #ffffff22;">${label}</td>${Array.from({length:inn}, (_,i)=>`<td style=\"padding:4px 6px;border-bottom:1px solid #ffffff22;text-align:center;\">${arr[i]??''}</td>`).join('')}<td style="padding:4px 6px;border-bottom:1px solid #ffffff22;font-weight:700;text-align:center;">${total}</td></tr>`;
    const linescore = `
      <table style="width:100%;margin-top:20px;border-collapse:collapse;background:#0003;border:1px solid #ffffff22;border-radius:12px;overflow:hidden;font-size:13px;">
        <thead><tr><th style="padding:4px 6px;border-bottom:1px solid #ffffff22;text-align:left;">Team</th>${hdr}<th style="padding:4px 6px;border-bottom:1px solid #ffffff22;">R</th></tr></thead>
        <tbody>
          ${row(away, la, as)}
          ${row(home, lh, hs)}
        </tbody>
      </table>`;
    // Build batting & pitching tables (now using shared helpers)
    const battingPitching = `<div style=\"display:grid;gap:14px;margin-top:22px;\">${buildBattingTable(away)}${buildPitchingTable(away)}${buildBattingTable(home)}${buildPitchingTable(home)}</div>`;
  const htmlBase = `
      <div class="teams">
        <div class="logo"><img id="logo-away" alt="${away} logo" /></div>
        <div class="score">${fmt(as)} - ${fmt(hs)}</div>
        <div class="logo"><img id="logo-home" alt="${home} logo" /></div>
      </div>
      <div class="performers">
        ${[tpAway,tpHome].map(p=> p? `<div class=\"perf\">
          <img id=\"perf-${slugify(p.name)}\" class=\"avatar\" alt=\"${p.name}\" />
          <div class=\"meta\">
            <div><strong>${p.name}</strong> • <span style=\"opacity:.85;\">${p.t}</span></div>
            <div class=\"sub\">${p.role==='p'? pitcherLine(p.st) : hitterLine(p.st)}</div>
          </div>
        </div>` : '<div class=\"perf\">No data</div>').join('')}
      </div>
      ${linescore}`;
    const html = htmlBase + `\n${battingPitching}`;
    seg.innerHTML = html;
    try{ tryImg(byId('logo-away'), logoUrls(away)); tryImg(byId('logo-home'), logoUrls(home)); }catch(_){ }
    try{ if(tpAway) tryImg(byId('perf-'+slugify(tpAway.name)), playerPhotoUrls(tpAway.name)); if(tpHome) tryImg(byId('perf-'+slugify(tpHome.name)), playerPhotoUrls(tpHome.name)); }catch(_){ }
  });

  // Segment 2: Player of the Game with tailored headline
  segments.push(function renderPotg(){
    const seg = byId('seg');
    const headline = buildHeadline(potg);
    const line = potg? (potg.role==='p'? pitcherLine(potg.st) : hitterLine(potg.st)) : '';
    const html = `
      <div class="headline">${headline}</div>
      <div class="perf" style="max-width:680px;">
        <img id="potg-img" class="avatar large" alt="${potg?potg.name:''}" />
        <div class="meta">
          <div><strong>${potg?potg.name:'—'}</strong> • <span style="opacity:.85;">${potg?potg.t:''}</span></div>
          <div class="sub">${line}</div>
        </div>
      </div>`;
    seg.innerHTML = html;
    if(potg){ try{ tryImg(byId('potg-img'), playerPhotoUrls(potg.name)); }catch(_){ } }
  });

  // Segment 3: Key moment
  segments.push(function renderKey(){
    const seg = byId('seg');
    const plays = Array.isArray(state.keyPlays)? state.keyPlays : [];
    let highlight = km;
    if(!highlight){
      // prefer explicit key plays
      const lc = plays.find(p=>p.type==='lead-change' && p.inning>=7) || plays.find(p=>p.type==='walkoff') || plays[plays.length-1];
      if(lc){ highlight = { inn: lc.inning, half: lc.half, team: lc.team, runs: lc.runs||0, after:{ a: state.score[away]||0, h: state.score[home]||0 } }; }
    }
    if(!highlight){ seg.innerHTML = '<div class="sub">No single defining moment detected.</div>'; return; }
    const inn = highlight.inn; const half = highlight.half; const team = highlight.team; const runs = highlight.runs||0;
    const opp = team===home?away:home; const scoreText = `${fmt(state.score[away]||0)} - ${fmt(state.score[home]||0)}`;
    const title = `${team} seize momentum in the ${half} of the ${inn}${inn===1?'st':inn===2?'nd':inn===3?'rd':'th'}`;
    const detail = `${team} put up ${runs||'key'} to swing it vs ${opp}, now ${scoreText}.`;
    // Key plays list
    const list = plays.slice(-6).map(p=>{
      const s = p.type==='walkoff' ? 'Walk-off' : (p.type==='lead-change' ? 'Lead change' : 'Score');
      return `<li><strong>${s}</strong> • ${p.half} ${p.inning} — ${p.desc||''}</li>`;
    }).join('');
    seg.innerHTML = `<div>
      <div class="headline" style="font-size:26px;">${title}</div>
      <div class="sub" style="margin-bottom:8px;">${detail}</div>
      ${list? `<ul style="margin:6px 0 0 18px;">${list}</ul>`:''}
    </div>`;
  });

  // Segment 4: Losing team press conference
  segments.push(function renderLosePC(){
    const seg = byId('seg');
    const loser = hs>as? away : home; const winner = loser===home? away : home;
    const backLogo = loser===home? home : home; // backdrop uses home team's logo as requested
    const quotes = [
      "We were a pitch or swing away; we'll own it and get better.",
      "The big inning hurt us. We didn't execute when it mattered.",
      "We created chances but couldn't cash in—credit to their staff.",
      "Our bullpen battled, but we needed that shutdown frame.",
      "We didn't control the zone late; that's on us.",
      "We had the matchup we wanted; they beat us to the spot.",
      "Too many free passes and extra bases—can't win like that.",
      "We fought; one swing flipped it. Tough, but we'll respond.",
      "We pressed after the lead changed; need to stay within ourselves.",
      "Timely hitting wasn't there tonight; it will come."
    ];
    const desc = `${loser} manager on loss to ${winner}`;
    seg.innerHTML = `
      <div class="press">
        <div class="manager"><img id="mgr-lose" alt="${loser} manager" /></div>
        <div class="backdrop" id="bd-lose">
          <div class="quote"><h3>${desc}</h3><p>${quotes[Math.floor(Math.random()*quotes.length)]}</p></div>
        </div>
      </div>`;
    try{ const bd = byId('bd-lose'); bd.style.setProperty('--logo', ''); bd.style.backgroundImage=''; bd.style.position='relative'; bd.style.overflow='hidden'; bd.querySelector(':scope').style=''; }catch(_){ }
    try{ const s=slugify(home); byId('bd-lose').style.setProperty('backgroundImage', `url('Logos/${s}.png')`); byId('bd-lose').style.backgroundImage = `url('Logos/${slugify(home)}.png')`; byId('bd-lose').style.backgroundRepeat='repeat'; byId('bd-lose').style.backgroundSize='160px auto'; byId('bd-lose').style.opacity=''; }catch(_){ }
    try{ tryImg(byId('mgr-lose'), managerUrls(loser)); }catch(_){ }
  });

  // Segment 5: Winning team press conference
  segments.push(function renderWinPC(){
    const seg = byId('seg');
    const winner = hs>as? home : away; const loser = winner===home? away : home;
    const quotes = [
      "Loved our compete level and how we controlled the big moments.",
      "We passed the baton offensively and trusted our arms.",
      "The guys stayed present—big swings and big pitches when needed.",
      "Proud of the way we answered; that was a team win.",
      "We executed the plan late and finished the job.",
      "Our depth showed up; different guys made plays.",
      "We took the free bases and made them pay.",
      "Great tempo on the mound; defense fed off it.",
      "We were relentless—quality at-bats all night.",
      "We embraced the moment and closed it out."
    ];
    const desc = `${winner} manager after win over ${loser}`;
    seg.innerHTML = `
      <div class="press">
        <div class="manager"><img id="mgr-win" alt="${winner} manager" /></div>
        <div class="backdrop" id="bd-win">
          <div class="quote"><h3>${desc}</h3><p>${quotes[Math.floor(Math.random()*quotes.length)]}</p></div>
        </div>
      </div>`;
    try{ const s=slugify(home); byId('bd-win').style.setProperty('backgroundImage', `url('Logos/${s}.png')`); byId('bd-win').style.backgroundImage = `url('Logos/${slugify(home)}.png')`; byId('bd-win').style.backgroundRepeat='repeat'; byId('bd-win').style.backgroundSize='160px auto'; }catch(_){ }
    try{ tryImg(byId('mgr-win'), managerUrls(winner)); }catch(_){ }
  });

  // Segment 6: Box Score (last) + Save Game (prefilled; respects auto-save)
  segments.push(function renderBox(){
    const seg = byId('seg');
    const la = state.lineScore.away||[]; const lh = state.lineScore.home||[];
    const inn = Math.max(la.length, lh.length, lastInning);
    const hdr = Array.from({length:inn}, (_,i)=> `<th style="padding:6px 8px;border-bottom:1px solid #ffffff22;">${i+1}</th>`).join('');
    const row = (label, arr, total)=> `<tr><td style="padding:6px 8px;border-bottom:1px solid #ffffff22;">${label}</td>${Array.from({length:inn}, (_,i)=>`<td style=\"padding:6px 8px;border-bottom:1px solid #ffffff22;text-align:center;\">${arr[i]??''}</td>`).join('')}<td style="padding:6px 8px;border-bottom:1px solid #ffffff22;font-weight:700;text-align:center;">${total}</td></tr>`;
    const tbl = `
      <table style="width:100%; border-collapse:collapse; background:#0003; border:1px solid #ffffff22; border-radius:12px; overflow:hidden;">
        <thead><tr><th style="padding:6px 8px;border-bottom:1px solid #ffffff22;text-align:left;">Team</th>${hdr}<th style="padding:6px 8px;border-bottom:1px solid #ffffff22;">R</th></tr></thead>
        <tbody>
          ${row(away, la, as)}
          ${row(home, lh, hs)}
        </tbody>
      </table>`;
    const saveHtml = `
      <div style="margin-top:14px; display:grid; gap:8px;">
        <div style="font-weight:800;">Save this game for later</div>
        <input id="sg-title" placeholder="Title" style="padding:10px 12px;border-radius:10px;border:1px solid #ffffff33;background:#0f1c2b;color:#fff;" />
        <textarea id="sg-notes" placeholder="Notes / description" rows="3" style="padding:10px 12px;border-radius:10px;border:1px solid #ffffff33;background:#0f1c2b;color:#fff;"></textarea>
        <div id="sg-info" class="sub" style="opacity:.85;"></div>
        <button id="sg-save" class="btn" style="justify-self:start;">Save Game</button>
        <div id="sg-msg" class="sub" style="min-height:20px;"></div>
      </div>`;
  // Add pitching stats below the linescore in the final box score slide
  const pitchingStats = `<div style=\"display:grid;gap:12px;margin-top:14px;\">${buildPitchingTable(away)}${buildPitchingTable(home)}</div>`;
  seg.innerHTML = `${tbl}${pitchingStats}${saveHtml}`;
    try{
      const key = 'ibl.savedGames';
      const raw = localStorage.getItem(key); const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(g=> g && g.finalizedAt && state.finalizedAt && g.finalizedAt === state.finalizedAt);
      const pad = (n)=> String(n).padStart(2,'0');
      const dt = new Date(state.finalizedAt || Date.now());
      const defaultTitle = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      if(idx>=0){
        const existing = list[idx] || {};
        byId('sg-title').value = existing.title || defaultTitle;
        byId('sg-notes').value = existing.notes || '';
        byId('sg-info').textContent = `Auto-saved as "${byId('sg-title').value}". You can rename or add notes and save again.`;
      } else {
        byId('sg-title').value = defaultTitle;
        byId('sg-info').textContent = 'This game will be saved with the date/time title unless you change it.';
      }
      byId('sg-save').onclick = ()=>{
        try{
          const title = (byId('sg-title').value||'').trim() || defaultTitle;
          const notes = (byId('sg-notes').value||'').trim();
          const data = Object.assign({}, state, { savedAt: Date.now(), title, notes, autoSaved: false });
          const freshRaw = localStorage.getItem(key); const fresh = freshRaw ? JSON.parse(freshRaw) : [];
          const j = fresh.findIndex(g=> g && g.finalizedAt && state.finalizedAt && g.finalizedAt === state.finalizedAt);
          if(j>=0){ fresh[j] = Object.assign({}, fresh[j], data); } else { fresh.push(data); }
          localStorage.setItem(key, JSON.stringify(fresh));
          byId('sg-msg').textContent = 'Saved! Find it in the Saved Games menu.';
        }catch(err){ byId('sg-msg').textContent = 'Save failed.'; }
      };
    }catch(_){ }
  });

  let idx=0;
  function render(){ if(idx<0) idx=0; if(idx>=segments.length) idx=segments.length-1; segments[idx](); byId('back').style.display = idx>0? 'inline-flex':'none'; byId('next').textContent = idx<segments.length-1? 'Next ▶' : 'Finish'; }
  byId('back').onclick = ()=>{ idx--; render(); };
  byId('next').onclick = ()=>{ if(idx<segments.length-1){ idx++; render(); } else { window.location.href = 'game.html'; } };

  render();
})();
