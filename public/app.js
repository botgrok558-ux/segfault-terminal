(() => {
  const out = document.getElementById('out');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const statusEl = document.getElementById('status');
  const hist = []; let hi = -1;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/https:\/\/(pump\.fun|x\.com)\/[\w\/.-]*[\w\/]/g, u => `<a href="${u}" target="_blank" rel="noopener" style="text-decoration:underline">${u}</a>`);
  const scoreColor = s => s >= 80 ? '#ff4d6d' : s >= 60 ? '#ff7a45' : s >= 40 ? '#ff9f1c' : s >= 20 ? '#ffd166' : '#4ade80';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const scroll = () => { out.scrollTop = out.scrollHeight; };

  function line(html, cls = '') {
    const d = document.createElement('div');
    d.className = 'ln ' + cls; d.innerHTML = html; out.appendChild(d); scroll(); return d;
  }
  async function typeLines(lines, cls = '') {
    for (const l of lines) { line(fmt(l), cls); await sleep(Math.min(90, 20 + l.length / 3)); }
  }
  function busy(on) { statusEl.textContent = on ? '● thinking' : '● online'; statusEl.classList.toggle('busy', on); }

  const SAMPLE_TRACE = `TypeError: Cannot read properties of undefined (reading 'map')
    at TodoList (/app/src/components/TodoList.jsx:14:23)
    at renderWithHooks (/app/node_modules/react-dom/cjs/react-dom.development.js:16305:18)
    at mountIndeterminateComponent (/app/node_modules/react-dom/cjs/react-dom.development.js:20074:13)`;

  function renderRoast(data) {
    const r = data.roast;
    const block = document.createElement('div');
    block.className = 'block';
    const ev = r.evidence.map(([k, v]) => `<div>${esc(k)}: <b>${esc(v)}</b></div>`).join('');
    const cacheNote = r.cache === 'hit' ? 'served from cache' : r.cache === 'stale' ? 'served from stale cache (GitHub rate limit hit)' : 'fresh from the GitHub API';
    block.innerHTML = `
      <div class="roast-head">
        <div>
          <div class="m">// repo</div>
          <div class="repo-name"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.repo)}</a></div>
          <div class="opener">${esc(r.opener)}</div>
        </div>
        <div class="score">
          <div class="m">CRASH SCORE</div>
          <div class="num" style="color:${scoreColor(r.score)}"><span class="cnt">0</span><span class="m" style="font-size:18px">/100</span></div>
          <div class="gauge"><div></div></div>
          <div class="verdict">${esc(r.verdict)}</div>
        </div>
      </div>
      <div class="roast-text"><span class="b">segfault&gt;</span> ${fmt(r.roast)}</div>
      <div class="evidence">${ev}</div>
      <div class="fix"><b>fix&gt;</b> ${fmt(r.fix)}</div>
      <div class="actions">
        <a href="${data.cardUrl}?download=1" download>⬇ Download roast card</a>
        <a class="x" href="${esc(r.shareUrl)}" target="_blank" rel="noopener">Share on 𝕏</a>
        <button data-copy="${esc(location.origin + '/r/' + r.id)}">Copy link</button>
        <button data-cmd="/shame">Hall of Shame</button>
      </div>
      <img class="card-prev" alt="Roast card for ${esc(r.repo)}" src="${data.cardUrl}" loading="lazy">
      <div class="cachenote">data: ${cacheNote} · fetched ${esc(new Date(r.dataFetchedAt || r.createdAt).toLocaleString())}</div>`;
    out.appendChild(block);
    // animate score
    const cnt = block.querySelector('.cnt');
    const gauge = block.querySelector('.gauge div');
    requestAnimationFrame(() => { gauge.style.width = r.score + '%'; });
    const t0 = performance.now();
    const tick = t => { const p = Math.min(1, (t - t0) / 900); cnt.textContent = Math.round(r.score * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    block.querySelector('img').addEventListener('load', scroll);
    scroll();
  }

  function renderDebug(d) {
    const b = document.createElement('div');
    b.className = 'block';
    b.innerHTML = `
      <h4>${d.matched ? 'diagnosis' : 'no rule matched'}</h4>
      <div><span class="r">● ${esc(d.name)}</span>${d.lang ? ` <span class="m">[${esc(d.lang)}]</span>` : ''}</div>
      ${d.location ? `<div class="m">crash site: <span class="w">${esc(d.location)}</span></div>` : ''}
      <div style="margin-top:8px"><span class="w">cause&gt;</span> ${fmt(d.cause)}</div>
      <div class="fix" style="margin-top:6px"><b>fix&gt;</b> ${fmt(d.fix)}</div>
      <div style="margin-top:8px"><span class="b">segfault&gt;</span> ${fmt(d.roast)}</div>
      ${d.also && d.also.length ? `<div class="m" style="margin-top:6px">also matched: ${d.also.map(esc).join(', ')}</div>` : ''}`;
    out.appendChild(b); scroll();
  }

  function renderShame(data) {
    if (!data.shame.length) return typeLines(['Hall of Shame is empty. Roast something: /roast owner/repo']);
    const b = document.createElement('div'); b.className = 'block';
    b.innerHTML = `<h4>hall of shame · top ${data.shame.length}</h4>` + data.shame.map((r, i) =>
      `<div class="ln">${String(i + 1).padStart(2, ' ')}. <span style="color:${scoreColor(r.score)}">${String(r.score).padStart(3, ' ')}</span>  <a href="#" data-load="${esc(r.id)}" style="text-decoration:underline">${esc(r.repo)}</a> <span class="m">· ${esc(r.verdict)}</span></div>`).join('') +
      `<div class="m" style="margin-top:6px">${data.stats.roastsServed} roasts served · ${data.stats.reposRoasted} repos · avg score ${data.stats.avgScore ?? '-'}</div>`;
    out.appendChild(b); scroll();
  }

  async function render(res) {
    if (res.type === 'clear') { out.innerHTML = ''; return; }
    if (res.type === 'roast') { renderRoast(res); loadBoard(res.roast.id); return; }
    if (res.type === 'debug') return renderDebug(res.debug);
    if (res.type === 'shame') return renderShame(res);
    const cls = res.type === 'error' ? 'r' : res.cls === 'warn' ? 'w' : res.cls === 'egg' ? 'egg' : '';
    const lines = res.lines || [];
    if (lines.length) lines[0] = lines[0];
    line('<span class="b">segfault&gt;</span>', '');
    await typeLines(lines, cls);
    if (res.actions && res.actions.length) {
      const a = document.createElement('div'); a.className = 'actions';
      a.innerHTML = res.actions.map(x => x.copy ? `<button data-copy="${esc(x.copy)}">${esc(x.label)}</button>` : `<a href="${esc(x.href)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join('');
      out.appendChild(a); scroll();
    }
    if (res.source && res.source.startsWith('llm')) line('<span class="m">(free-form answer via LLM)</span>');
  }

  async function send(msg) {
    msg = msg.trim(); if (!msg) return;
    hist.unshift(msg); hi = -1;
    const shown = msg.length > 600 ? msg.slice(0, 600) + ' …' : msg;
    line(`<span class="p">you@segfault:~$</span> ${esc(shown)}`, 'you');
    const isRoast = /^\/(roast|r)\s|github\.com\/|^[\w-]+\/[\w.-]+$|^roast\s/i.test(msg);
    const wait = line(isRoast ? '<span class="m">[fetching repo from api.github.com: metadata, languages, file tree]</span><span class="spin"></span>' : '<span class="m">[processing]</span><span class="spin"></span>');
    busy(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: msg }) });
      const data = await r.json();
      wait.remove();
      await render(data);
    } catch (e) {
      wait.remove();
      line('Segmentation fault (core dumped): could not reach the server. Is it running?', 'r');
    } finally { busy(false); }
  }

  form.addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; autosize(); send(v); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    else if (e.key === 'ArrowUp' && !input.value.includes('\n') && hist.length) { e.preventDefault(); hi = Math.min(hi + 1, hist.length - 1); input.value = hist[hi]; }
    else if (e.key === 'ArrowDown' && !input.value.includes('\n')) { e.preventDefault(); hi = Math.max(hi - 1, -1); input.value = hi < 0 ? '' : hist[hi]; }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
  });
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; };
  input.addEventListener('input', autosize);

  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-cmd]');
    if (c) { e.preventDefault(); const cmd = c.dataset.cmd === '__debug_sample' ? '/debug ' + SAMPLE_TRACE : c.dataset.cmd; document.getElementById('terminal').scrollIntoView({ block: 'nearest' }); send(cmd); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) { const old = cp.textContent; try { await navigator.clipboard.writeText(cp.dataset.copy); cp.textContent = 'Copied ✓'; setTimeout(() => { cp.textContent = old; }, 1800); } catch { prompt('Copy:', cp.dataset.copy); } return; }
    const ld = e.target.closest('[data-load]');
    if (ld) { e.preventDefault(); loadRoast(ld.dataset.load); }
  });

  async function loadRoast(id) {
    const r = await fetch('/api/roast/' + encodeURIComponent(id));
    if (!r.ok) return line('That roast has been garbage-collected.', 'w');
    document.getElementById('terminal').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const data = await r.json();
    line(`<span class="p">you@segfault:~$</span> cat roasts/${esc(data.roast.repo)}`, 'you');
    renderRoast(data);
  }

  // ---- Hall of Shame board ----
  const board = document.getElementById('board');
  const stats = document.getElementById('stats');
  let lastIds = '';
  async function loadBoard(highlight) {
    try {
      const r = await fetch('/api/shame?limit=10'); const d = await r.json();
      stats.innerHTML = `<span>roasts served <b>${d.stats.roastsServed}</b></span><span>repos <b>${d.stats.reposRoasted}</b></span><span>avg Crash Score <b>${d.stats.avgScore ?? '-'}</b></span>`;
      const ids = d.shame.map(x => x.id + x.score).join();
      if (ids === lastIds) return; lastIds = ids;
      if (!d.shame.length) return;
      board.innerHTML = d.shame.map((x, i) => `
        <div class="row${x.id === highlight ? ' new' : ''}">
          <div class="rank">#${i + 1}</div>
          <div class="rn">${esc(x.repo)}<small>${esc(x.verdict)}</small></div>
          <div class="sc"><b style="color:${scoreColor(x.score)}">${x.score}</b><div class="bar"><div style="width:${x.score}%"></div></div></div>
          <div class="q">${fmt(x.roast)}</div>
          <button data-load="${esc(x.id)}">view</button>
        </div>`).join('');
    } catch {}
  }
  loadBoard(); setInterval(loadBoard, 15000);

  // ---- boot ----
  (async () => {
    const boot = [
      ['<span class="m">SEGFAULT BIOS v0.0.1 · memory check ............ </span><span class="r">FAILED</span> <span class="m">(as expected)</span>', 0],
      ['<span class="m">loading roast engine ........................ </span><span class="g">OK</span>', 0],
      ['<span class="m">connecting to api.github.com ................ </span><span class="g">OK</span>', 0],
    ];
    for (const [h] of boot) { line(h); await sleep(110); }
    line('<span class="b">segfault&gt;</span> I roast public GitHub repos with real data, debug stack traces and answer questions about <b class="gradtext">$SEGFAULT</b>.');
    line('<span class="b">segfault&gt;</span> Paste a repo like <code>torvalds/linux</code> or a full GitHub URL. Type <code>/help</code> for commands.');
    if (window.__ROAST_ID) loadRoast(window.__ROAST_ID);
    const q = new URLSearchParams(location.search).get('q');
    if (q) send(q);
  })();
})();
