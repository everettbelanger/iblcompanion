(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>[...document.querySelectorAll(s)];

  function getTeams(){ try { return JSON.parse(localStorage.getItem('ibl.teams')||'[]'); } catch { return []; } }
  function setTeams(arr){ localStorage.setItem('ibl.teams', JSON.stringify(arr)); }

  function download(filename, text, type){
    const blob = new Blob([text], { type: type||'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  function toCSV(arr){
    const header = 'key,name,initials,logo,base running aggresiveness';
    const rows = arr.map(t=>{
      const run = (typeof t.runAgg==='number' && isFinite(t.runAgg)) ? String(t.runAgg) : '';
      const cols = [t.key, t.name, t.initials, t.logo||'', run];
      return cols.map(v=>{
        const s=(v==null?'':String(v));
        return s.includes(',') ? '"'+s.replace(/"/g,'""')+'"' : s;
      }).join(',');
    });
    return [header, ...rows].join('\r\n');
  }

  function addRow(team){
    const tr = document.createElement('tr'); tr.className='rowbg';
    tr.innerHTML = `
      <td><input value="${team?.key||''}" placeholder="e.g., Yankees" title="Key: letters/numbers only; used to match roster filenames (e.g., data/rosters/Yankees.csv)" /></td>
      <td><input value="${team?.name||''}" placeholder="e.g., New York Yankees" title="Full team name as shown in the UI" /></td>
      <td><input value="${team?.initials||''}" placeholder="e.g., NYY" title="2–3 letter code (displayed on menu logos)" /></td>
      <td><input value="${team?.logo||''}" placeholder="e.g., Logos/yankees.png or https://..." title="Square logo path or URL. Local images go under Logos/" /></td>
      <td><input type="number" min="0" max="100" step="1" value="${(typeof team?.runAgg==='number' && isFinite(team.runAgg))? team.runAgg : ''}" placeholder="0–100" title="Baserunning aggressiveness % (0–100)" /></td>
      <td><button class="btn secondary" title="Remove this team">Remove</button></td>
    `;
    tr.querySelector('button').onclick = ()=>{ tr.remove(); };
    $('#team-rows').appendChild(tr);
  }

  function save(){
    const rows = $$('#team-rows tr');
    const data = rows.map(tr=>{
      const inputs = [...tr.querySelectorAll('input')];
      const key = inputs[0]?.value.trim();
      const name = inputs[1]?.value.trim();
      const initials = inputs[2]?.value.trim();
      const logo = inputs[3]?.value.trim();
      const runAgg = (function(v){ const n=parseFloat((v||'').trim()); return isFinite(n)? n : undefined; })(inputs[4]?.value);
      return Object.assign({ key, name, initials, logo }, (runAgg!==undefined? { runAgg } : {}));
    }).filter(t=>t.key && t.name && t.initials);
    setTeams(data); alert('Teams saved to localStorage (ibl.teams).');
  }

  function parseCSV(text){
    const lines = String(text||'').split(/\r?\n/).filter(Boolean);
    if(!lines.length) return [];
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const hasHeader = ['key','name','initials','logo'].some(h=> headers.includes(h));
    const idx = (h)=> headers.indexOf(h);
    const AGG_HEADERS = ['base running aggresiveness','base running aggressiveness','baserunning aggressiveness','run aggressiveness','extra base %'];
    const aggIdx = AGG_HEADERS.map(h=> idx(h)).find(i=> i>=0);
    const out = [];
    const start = hasHeader ? 1 : 0;
    for(let i=start;i<lines.length;i++){
      const cols = lines[i].split(',').map(c=>c.trim()); if(!cols.length) continue;
      const key = hasHeader ? (idx('key')>=0 ? cols[idx('key')] : (cols[0]||'')) : (cols[0]||'');
      const name = hasHeader ? (idx('name')>=0 ? cols[idx('name')] : (cols[1]||'')) : (cols[1]||'');
      const initials = hasHeader ? (idx('initials')>=0 ? cols[idx('initials')] : (cols[2]||'')) : (cols[2]||'');
      const logo = hasHeader ? (idx('logo')>=0 ? (cols[idx('logo')]||'') : (cols[3]||'')) : (cols[3]||'');
      const runAgg = (typeof aggIdx==='number' && aggIdx>=0) ? (parseFloat(cols[aggIdx]||'')||undefined) : undefined;
      if(!key || !name || !initials) continue;
      out.push(Object.assign({ key, name, initials, logo }, (runAgg!==undefined? { runAgg } : {})));
    }
    return out;
  }

  function importCSV(file){
    const reader = new FileReader();
    reader.onload = ()=>{
      const data = parseCSV(reader.result||'');
      $('#team-rows').innerHTML='';
      data.forEach(t=> addRow(t));
      // Auto-save after import
      save();
    };
    reader.readAsText(file);
  }

  function importJSON(file){
    const reader = new FileReader();
    reader.onload = ()=>{
      try {
        const arr = JSON.parse(reader.result||'[]');
        if(!Array.isArray(arr)) throw new Error('JSON must be an array');
        $('#team-rows').innerHTML='';
        arr.forEach(t=> addRow(t));
        // Auto-save after import
        save();
      } catch(e){ alert('Invalid JSON: '+e.message); }
    };
    reader.readAsText(file);
  }

  function loadExisting(){
    const arr = getTeams();
    $('#team-rows').innerHTML='';
    arr.forEach(t=> addRow(t));
  }

  function init(){
    $('#back').onclick = ()=> history.back();
    $('#save-teams').onclick = save;
    $('#add-team').onclick = ()=> addRow({});
    $('#teams-csv').addEventListener('change', (e)=>{ const f=e.target.files[0]; if(f) importCSV(f); });
    $('#teams-json').addEventListener('change', (e)=>{ const f=e.target.files[0]; if(f) importJSON(f); });
    $('#export-csv').onclick = ()=> { const data=getTeams(); download('teams.csv', toCSV(data), 'text/csv'); };
    $('#export-json').onclick = ()=> { const data=getTeams(); download('teams.json', JSON.stringify(data, null, 2), 'application/json'); };
    loadExisting();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
