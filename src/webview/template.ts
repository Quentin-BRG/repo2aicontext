import { getNonce } from "../utils/security";

export function getWebviewContent(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';"/>
<style nonce="${nonce}">
  :root{
    --bg:var(--vscode-editor-background);
    --fg:var(--vscode-editor-foreground);
    --muted:var(--vscode-descriptionForeground);
    --hover:var(--vscode-list-hoverBackground);
    --accent:var(--vscode-button-background);
    --accent-fg:var(--vscode-button-foreground);
    --border:var(--vscode-editorWidget-border);
    --badge-bg:var(--vscode-badge-background);
    --badge-fg:var(--vscode-badge-foreground);
    --panel-bg:color-mix(in srgb, var(--bg) 85%, black 15%);
  }
  *{box-sizing:border-box}
  body{background:var(--bg);color:var(--fg);font-family:var(--vscode-font-family,system-ui,sans-serif);margin:0;padding:0;min-height:100vh}
  header{display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:2}
  header h1{font-size:13px;margin:0;font-weight:600}
  header .spacer{flex:1}
  header button{background:var(--accent);color:var(--accent-fg);border:none;border-radius:6px;padding:.4rem .7rem;font-weight:600;cursor:pointer}
  header button:disabled{opacity:.6;cursor:default}

  .toolbar{display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;align-items:center;padding:.65rem 1rem;border-bottom:1px solid var(--border);min-height:56px}
  .toggle{display:flex;align-items:center;gap:.5rem;font-size:12px}
  .totals{justify-self:center;display:flex;gap:.8rem;align-items:center;text-align:center;white-space:nowrap}
  .chip{background:var(--badge-bg);color:var(--badge-fg);border-radius:999px;padding:.15rem .5rem}
  .tok-badge{background:var(--badge-bg);color:var(--badge-fg);border-radius:6px;padding:.05rem .4rem;font-size:11px}
  .tok-badge.muted{opacity:.7}

  /* Emphasized totals as stat cards */
  .stat-card{ display:flex; align-items:center; gap:.6rem; background: var(--panel-bg); border:1px solid var(--border); border-radius:10px; padding:.4rem .7rem; box-shadow: 0 1px 6px rgba(0,0,0,.08); }
  .stat-card::before{ font-size:14px; }
  .stat-card.files::before{ content:'🗂️'; }
  .stat-card.tokens::before{ content:'🔢'; }
  .stat-label{ font-size:10px; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); }
  .stat-value{ font-weight:700; font-size:18px; letter-spacing:.2px; line-height:1; }
  /* ensure IDs match new size */
  #selCount, #selTokens{ font-weight:700; font-size:18px; padding:0 }

  /* Emphasize totals */
  #selCount, #selTokens{ font-weight:700; font-size:16px; padding:.25rem .65rem }

  .pane{padding:.25rem 0 1rem 0}
  ul.tree{list-style:none;margin:0;padding:0 1rem}
  ul.tree ul{list-style:none;margin:0;padding-left:1.25rem;border-left:1px dashed var(--border)}
  li.node{line-height:1.6;padding:.1rem .25rem;border-radius:6px;position:relative}
  li.node:hover{background:var(--hover)}
  .row{display:flex;align-items:center;gap:.4rem}
  .arrow,.ghost{width:1rem;display:inline-flex;justify-content:center;cursor:pointer;user-select:none}
  .name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .muted{color:var(--muted)}
  input[type="checkbox"]{margin:0 .25rem 0 0}

  footer{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--border);padding:.5rem 1rem;color:var(--muted);font-size:11px;display:flex;gap:1rem;align-items:center}

  .loading { position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(0.5px); z-index: 10; }
  .box { background: var(--bg); border: 1px solid var(--border); padding: .75rem 1rem;
    border-radius: 8px; min-width: 360px; box-shadow: 0 2px 16px rgba(0,0,0,.15); }
  .lrow { display:flex; gap:.5rem; align-items:center; margin-bottom:.5rem; }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .progress { width: 100%; height: 6px; background: var(--border); border-radius: 999px; overflow: hidden; }
  .bar { height: 100%; width: 0%; background: var(--accent); transition: width .08s linear; }
  .meta { display:flex; align-items:center; gap:.5rem; margin-top:.5rem; }
  .pct { font-size: 11px; color: var(--muted); }
  .path { font-size: 11px; color: var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1 }
  .cancel { background: transparent; border: 1px solid var(--border); color: var(--fg); border-radius: 6px; padding: .25rem .6rem; cursor: pointer; }
  .notice { padding:.25rem .5rem; border:1px solid var(--border); border-radius:6px; font-size:11px; color:var(--muted); margin: .5rem 1rem; }

  /* Collapsible notice group for skipped folders */
  .notice-group { margin: .5rem 1rem; }
  .toggle-notice { background: transparent; border: 1px solid var(--border); color: var(--fg); border-radius: 6px; padding: .2rem .5rem; cursor: pointer; font-size: 11px; }
  .notice-list { margin-top: .5rem; padding-left: .25rem; display: none; }
  .notice-list .notice { margin: .25rem 0; }

  .popover {
    position: fixed;
    display: none;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: .4rem .6rem;
    box-shadow: 0 6px 24px rgba(0,0,0,.25);
    font-size: 11px;
    color: var(--muted);
    z-index: 20;
    max-width: 320px;
    white-space: nowrap;
  }

  /* Settings panel */
  .settings{margin: .5rem 1rem 1rem 1rem; border:1px solid var(--border); border-radius:8px; overflow:hidden}
  .settings-header{font-weight:600; font-size:12px; padding:.5rem .75rem; background:var(--panel-bg); border-bottom:1px solid var(--border)}
  .settings-body{padding:.5rem .75rem; display:flex; flex-direction:column; gap:.75rem}
  .settings-row{display:flex; flex-direction:column; gap:.35rem}
  .settings-row label{font-size:12px; color:var(--muted)}
  .settings-inputs{display:flex; align-items:center; gap:.5rem}
  .settings-inputs input{width:230px; padding:.2rem .35rem; background:var(--panel-bg); color:var(--fg); border:1px solid var(--border); border-radius:6px}
  .chips{display:flex; flex-wrap:wrap; gap:.25rem}
</style>
</head>
<body>
  <header>
    <h1>📸 Repo2AIContext</h1>
    <div class="spacer"></div>
    <button id="cap" disabled>Capture</button>
  </header>

  <div class="toolbar">
    <label class="toggle"><input type="checkbox" id="selectAll"> Select all</label>
    <div class="totals">
      <div class="stat-card files">
        <div class="stat-body">
          <div class="stat-label">Files</div>
          <div class="stat-value" id="selCount">0</div>
        </div>
      </div>
      <div class="stat-card tokens">
        <div class="stat-body">
          <div class="stat-label">Tokens</div>
          <div class="stat-value" id="selTokens">0</div>
        </div>
      </div>
    </div>
  </div>

  <div id="notices"></div>

  <div class="pane">
    <ul class="tree" id="tree"></ul>
  </div>

  <footer>
    <span class="muted">~1 token ≈ 4 chars. Values reflect truncation & binary skips.</span>
    <span class="spacer"></span>
    <span id="status" class="muted">Auto-refresh: ON</span>
  </footer>

  <div class="loading" id="loading">
    <div class="box">
      <div class="lrow">
        <div class="spinner"></div>
        <div class="pct" id="phase">Counting…</div>
        <div class="pct" id="pct">0%</div>
      </div>
      <div class="progress"><div class="bar" id="bar"></div></div>
      <div class="meta">
        <div class="path" id="rel">Preparing…</div>
        <button class="cancel" id="cancelBtn">Cancel</button>
      </div>
    </div>
  </div>

  <div class="popover" id="popover"></div>

<script nonce="${nonce}">
(function(){
  const vscode = acquireVsCodeApi();
  let currentTree = [];
  let isLoading = true;
  const hide = true; // Intelligent filter is always active
  const selected = new Set(vscode.getState()?.selected || []);

  const capBtn = document.getElementById('cap');
  const treeEl = document.getElementById('tree');
  const selectAll = document.getElementById('selectAll');
  const selCount = document.getElementById('selCount');
  const selTokensEl = document.getElementById('selTokens');
  const loadingEl = document.getElementById('loading');
  const bar = document.getElementById('bar');
  const pctEl = document.getElementById('pct');
  const phaseEl = document.getElementById('phase');
  const relEl = document.getElementById('rel');
  const cancelBtn = document.getElementById('cancelBtn');
  const notices = document.getElementById('notices');
  const pop = document.getElementById('popover');

  let cfgNames = [];
  let cfgExts = [];

  const isVisible = n => !hide || n.important;
  const filtered = (nodes) => nodes
    .filter(isVisible)
    .map(n => n.type==='file' ? n : ({...n, children: filtered(n.children||[])}))
    .filter(n => n.type==='file' || (n.children && n.children.length));

  function flatten(nodes){
    const out=[]; (function walk(ns){ ns.forEach(n=>{ if(n.type==='file') out.push(n); else walk(n.children||[]); }); })(nodes);
    return out;
  }

  function showPopoverFor(el, html){
    pop.innerHTML = html;
    const r = el.getBoundingClientRect();
    const px = Math.min(window.innerWidth - 10, r.left + r.width / 2 + 6);
    const py = r.bottom + 8;
    pop.style.left = px + 'px';
    pop.style.top = py + 'px';
    pop.style.display = 'block';
  }
  function hidePopover(){ pop.style.display = 'none'; }

  function render(){
    const tree = filtered(currentTree);
    treeEl.innerHTML = '';
    if (tree.length === 0 && !isLoading) {
      const msg = document.createElement('div');
      msg.className = 'muted';
      msg.style.padding = '1rem';
      msg.textContent = 'No files to show. Ensure a workspace folder is open.';
      treeEl.appendChild(msg);
    } else {
      tree.forEach(n => treeEl.appendChild(renderNode(n)));
      updateDirStates();
    }
    updateTotals(); updateCaptureEnabled();
    renderSettings();
  }

  // Collapsible Skipped Folders notices
  const generalNotices = [];
  const skippedNotices = [];
  let skippedOpen = false;
  function renderSettings(){
    let settings = document.getElementById('settings');
    if (!settings) {
      settings = document.createElement('section');
      settings.id = 'settings';
      settings.className = 'settings';
      const anchor = document.querySelector('footer');
      anchor.insertAdjacentElement('beforebegin', settings);
    }

    settings.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'settings-header';
    header.textContent = 'Settings';
    settings.appendChild(header);

    const body = document.createElement('div');
    body.className = 'settings-body';

    // Names row
    const namesRow = document.createElement('div');
    namesRow.className = 'settings-row';
    const namesLabel = document.createElement('label');
    namesLabel.textContent = 'Blacklist names (files or folders)';
    const namesInputs = document.createElement('div');
    namesInputs.className = 'settings-inputs';
    const blNameInput = document.createElement('input'); blNameInput.id='blNameInput'; blNameInput.placeholder = 'e.g. .env, dist, build';
    const addNameBtn = document.createElement('button'); addNameBtn.id='addNameBtn'; addNameBtn.className='cancel'; addNameBtn.textContent = 'Add';
    namesInputs.appendChild(blNameInput); namesInputs.appendChild(addNameBtn);
    const namesChips = document.createElement('div'); namesChips.className='chips';
    cfgNames.forEach((n)=>{
      const chip = document.createElement('span'); chip.className='chip'; chip.textContent = n;
      const btn = document.createElement('button'); btn.className='cancel'; btn.textContent='✕'; btn.style.padding='.05rem .35rem'; btn.style.fontSize='10px';
      btn.addEventListener('click', ()=> vscode.postMessage({ command:'config-remove-name', value:n }));
      chip.appendChild(btn); namesChips.appendChild(chip);
    });
    namesRow.appendChild(namesLabel); namesRow.appendChild(namesInputs); namesRow.appendChild(namesChips);

    // Extensions row
    const extsRow = document.createElement('div');
    extsRow.className = 'settings-row';
    const extsLabel = document.createElement('label');
    extsLabel.textContent = 'Blacklist extensions';
    const extsInputs = document.createElement('div');
    extsInputs.className = 'settings-inputs';
    const blExtInput = document.createElement('input'); blExtInput.id='blExtInput'; blExtInput.placeholder = 'e.g. log, .map, lock';
    const addExtBtn = document.createElement('button'); addExtBtn.id='addExtBtn'; addExtBtn.className='cancel'; addExtBtn.textContent='Add';
    extsInputs.appendChild(blExtInput); extsInputs.appendChild(addExtBtn);
    const extsChips = document.createElement('div'); extsChips.className='chips';
    cfgExts.forEach((e)=>{
      const chip = document.createElement('span'); chip.className='chip'; chip.textContent = e;
      const btn = document.createElement('button'); btn.className='cancel'; btn.textContent='✕'; btn.style.padding='.05rem .35rem'; btn.style.fontSize='10px';
      btn.addEventListener('click', ()=> vscode.postMessage({ command:'config-remove-ext', value:e }));
      chip.appendChild(btn); extsChips.appendChild(chip);
    });
    extsRow.appendChild(extsLabel); extsRow.appendChild(extsInputs); extsRow.appendChild(extsChips);

    body.appendChild(namesRow);
    body.appendChild(extsRow);
    settings.appendChild(body);

    // Wire up events
    function normExt(v){ v=String(v||'').trim(); if(!v) return ''; v=v.toLowerCase(); if(!v.startsWith('.')) v='.'+v; return v; }
    addNameBtn.addEventListener('click', ()=>{ const v = String(blNameInput.value||'').trim(); if(!v) return; vscode.postMessage({ command:'config-add-name', value:v }); blNameInput.value=''; });
    addExtBtn.addEventListener('click', ()=>{ const v = normExt(blExtInput.value); if(!v) return; vscode.postMessage({ command:'config-add-ext', value:v }); blExtInput.value=''; });
    blNameInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addNameBtn.click(); } });
    blExtInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addExtBtn.click(); } });
  }


  function renderNotices(){
    notices.innerHTML = '';
    // General notices
    if (generalNotices.length){
      generalNotices.forEach((m)=>{
        const div = document.createElement('div');
        div.className = 'notice';
        div.textContent = m;
        notices.appendChild(div);
      });
    }
    // Skipped folders grouped + collapsible
    if (skippedNotices.length){
      const group = document.createElement('div');
      group.className = 'notice-group';
      const btn = document.createElement('button');
      btn.className = 'toggle-notice';
      btn.id = 'toggleSkipped';
      const count = skippedNotices.length;
      btn.textContent = (skippedOpen ? 'Hide' : 'Show') + ' skipped folders (' + count + ')';
      btn.addEventListener('click', ()=>{ skippedOpen = !skippedOpen; renderNotices(); });
      group.appendChild(btn);
      const list = document.createElement('div');
      list.id = 'skippedList';
      list.className = 'notice-list';
      list.style.display = skippedOpen ? 'block' : 'none';
      skippedNotices.forEach((m)=>{
        const div = document.createElement('div');
        div.className = 'notice';
        div.textContent = m;
        list.appendChild(div);
      });
      group.appendChild(list);
      notices.appendChild(group);
    }
  }

  function renderNode(node){
    const li = document.createElement('li'); li.className='node';
    const row = document.createElement('div'); row.className='row';
    const arrow = document.createElement('span'); arrow.className = node.type==='dir' ? 'arrow' : 'ghost'; arrow.textContent = node.type==='dir' ? '▶' : '';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.path=node.path; cb.dataset.type=node.type;
    if (node.type==='file') cb.checked = selected.has(node.path);
    const name = document.createElement('span'); name.className='name'; name.textContent = node.name + (node.type==='dir' ? '/' : '');

    row.appendChild(arrow); row.appendChild(cb); row.appendChild(name);

    // TOKENS BADGE (files & folders)
    const badge = document.createElement('span'); badge.className = 'tok-badge';
    if (node.type === 'file') {
      if (node.skipped) {
        badge.textContent = 'binary'; badge.classList.add('muted');
      } else {
        const t = node.tokens||0, c = node.chars||0;
        badge.textContent = '~' + dotFormat(t) + ' tok';
        badge.addEventListener('mouseenter', () => {
          const trunc = node.truncated ? ' · truncated' : '';
          showPopoverFor(badge, '<strong>~' + dotFormat(t) + ' tok</strong> · ' + dotFormat(c) + ' chars' + trunc);
        });
        badge.addEventListener('mouseleave', hidePopover);
      }
    } else {
      const t = node.aggTokens||0, c = node.aggChars||0;
      badge.textContent = '~' + dotFormat(t) + ' tok';
      badge.addEventListener('mouseenter', () => {
        const trunc = node.aggTruncated ? ' · ' + dotFormat(node.aggTruncated) + ' trunc' : '';
        const skipped = node.aggSkipped ? ' · ' + dotFormat(node.aggSkipped) + ' bin' : '';
        showPopoverFor(badge, '<strong>~' + dotFormat(t) + ' tok</strong> · ' + dotFormat(c) + ' chars · ' + dotFormat(node.aggFiles||0) + ' files' + trunc + skipped);
      });
      badge.addEventListener('mouseleave', hidePopover);
    }
    row.appendChild(badge);

    li.appendChild(row);

    if (node.type==='dir' && node.children && node.children.length){
      const ul = document.createElement('ul');
      node.children.forEach(c => ul.appendChild(renderNode(c)));
      ul.style.display = 'none';
      arrow.onclick = () => { const open = ul.style.display === 'none'; ul.style.display = open ? 'block' : 'none'; arrow.textContent = open ? '▼' : '▶'; };
      li.appendChild(ul);
      cb.addEventListener('change', () => { setAllDescendants(ul, cb.checked); updateAncestors(li); persist(); updateTotals(); updateCaptureEnabled(); });
    } else if (node.type==='file') {
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(node.path); else selected.delete(node.path);
        updateAncestors(li); persist(); updateTotals(); updateCaptureEnabled();
      });
    }
    return li;
  }

  function setAllDescendants(container, checked){
    container.querySelectorAll('input[type="checkbox"][data-type="file"]').forEach((f)=>{
      f.checked = checked; const p = f.getAttribute('data-path'); if (checked) selected.add(p); else selected.delete(p);
    });
    container.querySelectorAll('li.node > .row > input[type="checkbox"][data-type="dir"]').forEach((d)=>{ d.indeterminate = false; d.checked = checked; });
  }
  function updateAncestors(li){
    let p = li.parentElement;
    while (p && p.classList.contains('tree') === false){
      const pli = p.parentElement; if (!pli) break;
      const dcb = pli.querySelector(':scope > .row > input[type="checkbox"][data-type="dir"]');
      if (dcb){
        const kids = pli.querySelectorAll(':scope > ul input[type="checkbox"][data-type="file"]');
        const total = kids.length; let checked = 0; kids.forEach((k)=>{ if (k.checked) checked++; });
        dcb.indeterminate = checked>0 && checked<total;
        dcb.checked = checked===total && total>0;
      }
      p = pli.parentElement;
    }
  }
  function updateDirStates(){
    document.querySelectorAll('li.node').forEach((li)=>{
      const dcb = li.querySelector(':scope > .row > input[type="checkbox"][data-type="dir"]');
      if (dcb){
        const kids = li.querySelectorAll(':scope > ul input[type="checkbox"][data-type="file"]');
        const total = kids.length; let checked = 0; kids.forEach(k=>{ if (k.checked) checked++; });
        dcb.indeterminate = checked>0 && checked<total;
        dcb.checked = checked===total && total>0;
      }
    });
  }
  function persist(){ vscode.setState({ selected: Array.from(selected) }); }

  // Thousand separator using dots (e.g., 1000 -> 1.000)
  const dotFormat = (n)=>{
    try{ return Number(n||0).toLocaleString(undefined, { useGrouping:true }).replace(/,/g,'.'); }catch{ return String(n||0); }
  };

  // Totals UI: files + tokens cards (hover shows chars)
  function updateTotals(){
    let files=0, chars=0, tokens=0;
    const idx = new Map(); (function index(nodes){ nodes.forEach(n=>{ if(n.type==='file'){ idx.set(n.path,n); } else index(n.children||[]); }); })(currentTree);
    selected.forEach((p)=>{ const n=idx.get(p); if(!n||n.skipped) return; files++; chars+=(n.chars||0); tokens+=(n.tokens||0); });
    selCount.textContent = dotFormat(files);
    selTokensEl.textContent = dotFormat(tokens);
    const tokensHover = () => { showPopoverFor(selTokensEl, '<strong>~' + dotFormat(tokens) + ' tok</strong> · ' + dotFormat(chars) + ' chars'); };
    selTokensEl.onmouseenter = tokensHover;
    selTokensEl.onmouseleave = hidePopover;
  }
  function updateCaptureEnabled(){ capBtn.disabled = selected.size === 0; }

  selectAll.addEventListener('change', () => {
    const allFiles = (function flatten(nodes){ const out=[]; nodes.forEach(n=>{ if(n.type==='file') out.push(n); else out.push(...flatten(n.children||[])); }); return out; })(filtered(currentTree));
    if (selectAll.checked){ allFiles.forEach(f=>selected.add(f.path)); } else { allFiles.forEach(f=>selected.delete(f.path)); }
    render();
  });
  capBtn.addEventListener('click', () => vscode.postMessage({ command:'capture', selected: Array.from(selected) }));
  cancelBtn.addEventListener('click', () => vscode.postMessage({ command:'cancel-scan' }));

  // settings inputs now created dynamically inside renderSettings()

  window.addEventListener('scroll', hidePopover, true);
  window.addEventListener('click', (e)=>{ if (!pop.contains(e.target)) hidePopover(); }, true);

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg?.type === 'loading') {
      isLoading = !!msg.value;
      loadingEl.style.display = isLoading ? 'flex' : 'none';
      if (isLoading){ bar.style.width='0%'; pctEl.textContent='0%'; phaseEl.textContent='Counting…'; relEl.textContent='Preparing…'; }
      if (isLoading){
        // reset notices data & UI at the start of a scan
        notices.textContent = '';
        generalNotices.length = 0; skippedNotices.length = 0; skippedOpen = false;
      }
    } else if (msg?.type === 'progress') {
      const { phase='scan', current=0, total=0, rel='' } = msg;
      phaseEl.textContent = phase === 'count' ? 'Counting…' : 'Scanning…';
      if (total > 0) {
        const pct = Math.min(100, Math.floor(current * 100 / total));
        bar.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      } else {
        const pct = (current % 100);
        bar.style.width = pct + '%';
        pctEl.textContent = '';
      }
      if (rel) relEl.textContent = rel;
    } else if (msg?.type === 'notice') {
      const message = msg.message || '';
      if (/^Skipping (large )?folder:/i.test(message)) {
        skippedNotices.push(message);
      } else {
        generalNotices.push(message);
      }
      renderNotices();
    } else if (msg?.type === 'refresh' && Array.isArray(msg.tree)) {
      currentTree = msg.tree;
      const valid = new Set((function flatten(nodes){ const out=[]; nodes.forEach(n=>{ if(n.type==='file') out.push(n.path); else out.push(...flatten(n.children||[])); }); return out; })(currentTree));
      Array.from(selected).forEach(p=>{ if(!valid.has(p)) selected.delete(p); });
      render();
    } else if (msg?.type === 'config') {
      cfgNames = Array.isArray(msg.blacklistNames) ? msg.blacklistNames : [];
      cfgExts = Array.isArray(msg.blacklistExtensions) ? msg.blacklistExtensions : [];
      // Re-render settings (and UI) to reflect latest blacklist
      render();
    }
  });

  loadingEl.style.display = 'flex';
  vscode.postMessage({ command: 'webview-ready' });
  vscode.postMessage({ command: 'request-config' });
  render();
})();
</script>
</body>
</html>`;
}
