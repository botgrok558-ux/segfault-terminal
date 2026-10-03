// End-to-end smoke test against a running server: node test/smoke.js [baseUrl] [repo...]
const BASE = process.argv[2] && process.argv[2].startsWith('http') ? process.argv[2] : 'http://localhost:8080';
const repos = process.argv.slice(process.argv[2] && process.argv[2].startsWith('http') ? 3 : 2);
const chat = async m => (await fetch(BASE + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: m }) })).json();
let fail = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) fail++; };

(async () => {
  const qa = [['what is $SEGFAULT?', 'kb:what'], ["what's the CA?", 'kb:ca'], ['is it safe?', 'kb:safe'], ['how do I buy it?', 'kb:buy'], ['wen moon?', 'kb:price']];
  for (const [q, src] of qa) { const r = await chat(q); check(r.source === src, `Q&A "${q}" -> ${r.source}`); console.log('      ' + r.lines.join('\n      ')); }
  const CA = 'CYEus7v4ygJAHjB3DVRNyxFXYBtMKeALD2nTf8wzpump';
  for (const q of ['what is the CA', 'where to buy']) { const r = await chat(q); const t = r.lines.join(' '); check(t.includes(CA) && t.includes('https://pump.fun/coin/' + CA), `"${q}" answers with the CA + pump.fun link`); }
  const traces = {
    segfault: 'Program received signal SIGSEGV, Segmentation fault.\n0x0000555555555149 in main () at main.c:6',
    'js-undefined': "TypeError: Cannot read properties of undefined (reading 'map')\n    at TodoList (/app/src/TodoList.jsx:14:23)",
    'py-keyerror': 'Traceback (most recent call last):\n  File "app.py", line 12, in <module>\n    print(cfg["token"])\nKeyError: \'token\'',
    cors: "Access to fetch at 'http://localhost:3000/api' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
    econnrefused: 'Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1555:16)',
    'rust-borrow': 'error[E0502]: cannot borrow `v` as mutable because it is also borrowed as immutable\n --> src/main.rs:4:5',
    npe: 'Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()" because "s" is null\n\tat com.acme.Main.main(Main.java:5)',
    oom: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory',
    'py-import': "ModuleNotFoundError: No module named 'numpy'",
  };
  for (const [id, t] of Object.entries(traces)) { const r = await chat(t); check(r.type === 'debug' && r.debug.id === id, `debug ${id} -> ${r.debug && r.debug.id} @ ${r.debug && r.debug.location}`); }
  for (const egg of ['sudo rm -rf /', 'rm -rf /', ':wq', 'exit vim', '/help']) { const r = await chat(egg); check(r.type === 'text' && r.lines.length > 0, `command "${egg}" -> ${r.lines[0]}`); }
  for (const repo of repos) {
    const r = await chat('/roast ' + repo);
    if (r.type !== 'roast') { check(false, `roast ${repo}: ${(r.lines || []).join(' ')}`); continue; }
    const x = r.roast;
    check(true, `roast ${x.repo}  score=${x.score} (${x.verdict}) cache=${x.cache}`);
    console.log(`      roast: ${x.roast}\n      fix:   ${x.fix}\n      signals: ${x.signals.map(s => s.key + '+' + s.pts).join(', ')} | bonuses: ${x.bonuses.map(s => s.key + s.pts).join(', ')}\n      evidence: ${x.evidence.map(e => e.join('=')).join('; ')}\n      share (${x.share.length} chars): ${x.share.text.replace(/\n/g, ' / ')}\n      card: ${BASE}${r.cardUrl}`);
    const png = await fetch(BASE + r.cardUrl);
    check(png.ok && png.headers.get('content-type') === 'image/png', `card PNG ${r.cardUrl} (${(await png.arrayBuffer()).byteLength} bytes)`);
  }
  const s = await (await fetch(BASE + '/api/shame')).json();
  console.log('Hall of Shame:', s.shame.map(x => `${x.repo}=${x.score}`).join(', '), s.stats);
  process.exit(fail ? 1 : 0);
})();
