(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>[...document.querySelectorAll(s)];
  const selection = (()=>{ try { return JSON.parse(localStorage.getItem('ibl.selection')||'null'); } catch(_) { return null; } })();
  if(!selection){ window.location.href='index.html'; return; }

  const POS = ['P','C','1B','2B','3B','SS','LF','CF','RF'];
  const posOptions = POS.map(p=>`<option value="${p}">${p}</option>`).join('');

  function getRosters(){ try { return JSON.parse(localStorage.getItem('ibl.rosters')||'{}'); } catch { return {}; } }
  function setRosters(data){ localStorage.setItem('ibl.rosters', JSON.stringify(data)); }
  function download(filename, text, type){
    const blob = new Blob([text], { type: type||'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  function teamNameFromKey(key){
    try{
      const teams = JSON.parse(localStorage.getItem('ibl.teams')||'[]');
      const t = Array.isArray(teams) ? teams.find(x=>x.key===key) : null;
      return t?.name || key;
    }catch{ return key; }
  }

  function renderTeam(side){
    const key = side==='away' ? selection.away : selection.home;
    const nameEl = $(`#${side}-name`); if(nameEl) nameEl.textContent = side==='away' ? `Away: ${teamNameFromKey(key)}` : `Home: ${teamNameFromKey(key)}`;
    const rowsEl = $(`#${side}-rows`); rowsEl.innerHTML='';
    const rosters = getRosters(); const list = rosters[key] || [];
    list.forEach((p, idx)=> rowsEl.appendChild(rowEl(side, idx, p.name, p.pos)));    
  }

  function rowEl(side, idx, name='', pos=[]) {
    const tr = document.createElement('tr'); tr.className='row';
    const nameTd = document.createElement('td'); const nameIn = document.createElement('input'); nameIn.value = name; nameTd.appendChild(nameIn);
    const posTd = document.createElement('td');
    const sel = document.createElement('select'); sel.multiple = true; sel.size = 5; sel.innerHTML = posOptions; POS.forEach(p=>{ const o=[...sel.options].find(x=>x.value===p); if(o) o.selected = pos.includes(p); });
    posTd.appendChild(sel);
    const actTd = document.createElement('td'); const delBtn=document.createElement('button'); delBtn.className='btn secondary'; delBtn.textContent='Delete'; actTd.appendChild(delBtn);
    tr.appendChild(nameTd); tr.appendChild(posTd); tr.appendChild(actTd);
    delBtn.onclick = ()=>{ tr.remove(); saveSide(side); };
    nameIn.onchange = ()=> saveSide(side);
    sel.onchange = ()=> saveSide(side);
    return tr;
  }

  function saveSide(side){
    const key = side==='away' ? selection.away : selection.home;
    const rows = $$("#"+side+"-rows tr");
    const list = rows.map(tr=>{
      const name = tr.querySelector('input').value.trim();
      const posSel = tr.querySelector('select');
      const pos = [...posSel.options].filter(o=>o.selected).map(o=>o.value);
      return { name, pos };
    }).filter(p=>p.name);
    const all = getRosters(); all[key] = list; setRosters(all);
  }

  function addRow(side){
    const rowsEl = $(`#${side}-rows`);
    rowsEl.appendChild(rowEl(side, rowsEl.children.length, '', []));
  }

  function parseCSV(text){
    // CSV: name,positions (e.g., "Aaron Judge,RF CF LF")
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const out = [];
    for(const line of lines){
      const [name, positions] = line.split(',');
      if(!name) continue;
      const pos = (positions||'').split(/[\s\/|]+/).map(s=>s.trim().toUpperCase()).filter(s=>POS.includes(s));
      out.push({ name: name.trim(), pos });
    }
    return out;
  }

  function importCSV(side, file){
    const reader = new FileReader();
    reader.onload = ()=>{
      const data = parseCSV(reader.result || '');
      const key = side==='away' ? selection.away : selection.home;
      const all = getRosters(); all[key] = data; setRosters(all); renderTeam(side);
    };
    reader.readAsText(file);
  }

  function init(){
    $('#back').onclick = ()=> history.back();
    $('#save-rosters').onclick = ()=> { saveSide('away'); saveSide('home'); alert('Rosters saved.'); };
    $('#import-rosters-json').onclick = ()=>{
      const input = document.createElement('input'); input.type='file'; input.accept='.json';
      input.onchange = (e)=>{
        const f = e.target.files[0]; if(!f) return;
        const reader = new FileReader();
        reader.onload = ()=>{
          try{
            const data = JSON.parse(reader.result||'{}');
            if(typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected an object keyed by team');
            setRosters(data); renderTeam('away'); renderTeam('home'); alert('Rosters imported.');
          }catch(err){ alert('Invalid JSON: '+err.message); }
        };
        reader.readAsText(f);
      };
      input.click();
    };
    $('#export-rosters-json').onclick = ()=>{ download('rosters.json', JSON.stringify(getRosters(), null, 2), 'application/json'); };
    $('#away-add').onclick = ()=> addRow('away');
    $('#home-add').onclick = ()=> addRow('home');
    $('#away-csv').addEventListener('change', (e)=>{ const f=e.target.files[0]; if(f) importCSV('away', f); });
    $('#home-csv').addEventListener('change', (e)=>{ const f=e.target.files[0]; if(f) importCSV('home', f); });
    renderTeam('away'); renderTeam('home');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
