(function(){
  const $ = (id)=> document.getElementById(id);
  function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function getTeams(){ try{ const t = JSON.parse(localStorage.getItem('ibl.teams')||'[]'); return Array.isArray(t)?t:[]; }catch{ return []; } }
  function readPennant(){ try{ return JSON.parse(localStorage.getItem('ibl.pennant')||'null')||null; }catch{ return null; } }
  function writePennant(obj){ try{ localStorage.setItem('ibl.pennant', JSON.stringify(obj)); }catch(_){} }

  function renderTeamList(n){
    const teams = getTeams();
    const wrap = $('team-list'); if(!wrap) return;
    wrap.innerHTML = teams.map((t,i)=>{
      const id = `tm-${i}`;
      return `<label><input type="checkbox" data-key="${t.key}" id="${id}"/> <img src="${t.logo||''}" alt="" onerror="this.style.display='none'" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;"/> ${t.name}</label>`;
    }).join('');
    // Enforce at most n selected
    wrap.addEventListener('change',()=>{
      const boxes = Array.from(wrap.querySelectorAll('input[type=checkbox]'));
      const sel = boxes.filter(b=>b.checked);
      if(sel.length>n){ boxes.find(b=>b===event.target).checked=false; }
    });
  }

  function bracketForTeams(teamKeys){
    // Seed straight or randomized; handle non-powers-of-two by giving byes to top seeds
    const len = teamKeys.length;
    const nextPow2 = 1<<Math.ceil(Math.log2(len));
    const byes = nextPow2 - len; // number of byes
    const seeds = teamKeys.slice();
    const mode = $('seed-mode').value;
    if(mode==='random'){
      for(let i=seeds.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [seeds[i],seeds[j]]=[seeds[j],seeds[i]]; }
    }
    // Insert byes as nulls for top seeds (they auto-advance)
    const withByes = seeds.slice();
    for(let i=0;i<byes;i++) withByes.splice((i*2)+1, 0, null);
    // Pair into first round
    const round1 = [];
    for(let i=0;i<withByes.length;i+=2){ round1.push([withByes[i]||null, withByes[i+1]||null]); }
    return [ round1 ];
  }

  function seriesStateObj(teamA, teamB, bestOf){
    return { a:teamA, b:teamB, winsA:0, winsB:0, bestOf, games:[] };
  }
  function advanceFromRound(round){
    const next=[];
    for(const s of round){ next.push( (s && s.winner) ? s.winner : null ); }
    return next;
  }

  function buildBracket(selections, bestOf){
    // Build series objects for round 1, then derive further rounds as placeholders
    const rounds = bracketForTeams(selections);
    const r0 = rounds[0].map(([a,b])=> ({ type:'series', ...seriesStateObj(a,b,bestOf) }));
    const allRounds = [ r0 ];
    // Continue until single champion
    while(allRounds[allRounds.length-1].length>1){
      const prev = allRounds[allRounds.length-1];
      const placeholders = [];
      for(let i=0;i<prev.length;i+=2){ placeholders.push({ type:'series', ...seriesStateObj(null, null, bestOf) }); }
      allRounds.push(placeholders);
    }
    return allRounds;
  }

  function renderBracket(state){
    const root = $('bracket'); if(!root) return;
    if(!state || !state.rounds || !state.rounds.length){ root.innerHTML = '<div style="opacity:.7;">Create a bracket to preview.</div>'; return; }
    root.innerHTML = '';
    state.rounds.forEach((round,ri)=>{
      const col = document.createElement('div'); col.className='col';
      round.forEach((s,si)=>{
        const teamName = (k)=>{ if(!k) return '(bye)'; const t=(getTeams().find(t=>t.key===k)); return t? t.name : k; };
        const done = (s.winsA>=Math.ceil(s.bestOf/2) || s.winsB>=Math.ceil(s.bestOf/2));
        const title = done ? `${teamName(s.winsA>=Math.ceil(s.bestOf/2)?s.a:s.b)} wins ${Math.max(s.winsA,s.winsB)}-${Math.min(s.winsA,s.winsB)}` : `Series ${si+1}`;
        const html = `
          <div class="series" data-ri="${ri}" data-si="${si}">
            <h4>${title}</h4>
            <div><span class="seed">A</span>${teamName(s.a)} <strong>${s.winsA}</strong></div>
            <div><span class="seed">B</span>${teamName(s.b)} <strong>${s.winsB}</strong></div>
            <div style="opacity:.8;font-size:.85rem;">Best of ${s.bestOf}</div>
          </div>`;
        col.insertAdjacentHTML('beforeend', html);
      });
      root.appendChild(col);
    });
    // Controls
    $('play-next').disabled = !findNextGame(state);
    $('save-series').disabled = !state.completed;
  }

  function findNextGame(state){
    // Find the earliest series that is not yet decided and has two teams
    for(let ri=0; ri<state.rounds.length; ri++){
      const round = state.rounds[ri];
      for(let si=0; si<round.length; si++){
        const s = round[si];
        if(!s) continue;
        const need = Math.ceil(s.bestOf/2);
        if(s.a && s.b && s.winsA < need && s.winsB < need){
          return { ri, si };
        }
      }
    }
    return null;
  }

  function propagateWinners(state){
    // After any series completes, push winner into the next round placeholders
    for(let ri=0; ri<state.rounds.length-1; ri++){
      const round = state.rounds[ri];
      for(let si=0; si<round.length; si++){
        const s = round[si];
        const need = Math.ceil(s.bestOf/2);
        if((s.a && s.b) && (s.winsA>=need || s.winsB>=need)){
          const winner = (s.winsA>=need) ? s.a : s.b;
          s.winner = winner;
          const nextRound = state.rounds[ri+1];
          const slot = Math.floor(si/2);
          const target = nextRound[slot];
          if(si % 2 === 0) target.a = winner; else target.b = winner;
        }
      }
    }
    // Mark completed
    const last = state.rounds[state.rounds.length-1][0];
    const need = Math.ceil(last.bestOf/2);
    state.completed = !!(last && last.a && last.b && (last.winsA>=need || last.winsB>=need));
  }

  function startNextGame(state){
    const next = findNextGame(state); if(!next) return;
    const s = state.rounds[next.ri][next.si];
    // Store tournament context so the base game flow knows to attribute stats/win to this series
    const ctx = { mode:'pennant', id: state.id, name: state.name||('Pennant '+state.created), ri: next.ri, si: next.si };
    try{ localStorage.setItem('ibl.pennant.context', JSON.stringify(ctx)); }catch(_){ }
    // Also set the standard selection and go to lineup
    localStorage.setItem('ibl.selection', JSON.stringify({ home: s.a, away: s.b }));
    window.location.href = 'lineup.html';
  }

  function applyGameResultToSeries(state, game){
    const ctx = readPennant(); if(!ctx) return state;
    // Find series indicated in game.meta if present
    try{
      const meta = game && game.pennant; if(!meta) return state;
      const s = state.rounds[meta.ri][meta.si];
      const home = game.home, away = game.away; const hs = game.score[home]||0, as = game.score[away]||0;
      if(hs>as){ if(s.a===home) s.winsA+=1; else if(s.b===home) s.winsB+=1; }
      else if(as>hs){ if(s.a===away) s.winsA+=1; else if(s.b===away) s.winsB+=1; }
    }catch(_){ }
    propagateWinners(state);
    writePennant(state);
    return state;
  }

  async function init(){
    const saved = readPennant();
    if(saved){ renderBracket(saved); }
    const teamCountSel = $('team-count');
    const seedModeSel = $('seed-mode');
    const seriesLenSel = $('series-length');
    renderTeamList(parseInt(teamCountSel.value,10));
    teamCountSel.addEventListener('change', ()=> renderTeamList(parseInt(teamCountSel.value,10)) );
    $('back').addEventListener('click', ()=>{ window.location.href='index.html'; });
    $('create').addEventListener('click', ()=>{
      const n = parseInt(teamCountSel.value,10);
      const boxes = Array.from(document.querySelectorAll('#team-list input[type=checkbox]'));
      const picked = boxes.filter(b=>b.checked).map(b=>b.getAttribute('data-key'));
      if(picked.length < 4){ alert('Pick at least 4 teams.'); return; }
      if(picked.length > 30){ alert('Pick at most 30 teams.'); return; }
      const bestOf = parseInt(seriesLenSel.value,10);
      const rounds = buildBracket(picked, bestOf);
      const state = { id: 'pn-'+Date.now(), name: '', created: Date.now(), bestOf, rounds, completed:false };
      writePennant(state);
      renderBracket(state);
    });
    $('play-next').addEventListener('click', ()=>{
      const st = readPennant(); if(!st){ alert('No bracket.'); return; }
      startNextGame(st);
    });
    $('save-series').addEventListener('click', ()=>{
      const st = readPennant(); if(!st || !st.completed){ alert('No completed tournament to save.'); return; }
      const name = prompt('Name this Pennant Race (for Stats Central merge):', st.name || 'Pennant Race');
      if(name==null) return;
      st.name = name; writePennant(st);
      alert('Saved. Completed series will be merged into Stats Central when you publish.');
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
