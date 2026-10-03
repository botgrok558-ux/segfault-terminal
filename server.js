// $SEGFAULT terminal - Express server
const path = require('path');
const fs = require('fs');
const express = require('express');
const bot = require('./lib/bot');
const store = require('./lib/store');
const { renderCard } = require('./lib/card');
const { rate } = require('./lib/github');
const llm = require('./lib/llm');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple in-memory per-IP limiter (protects the 60 req/h GitHub quota)
const hits = new Map();
function limiter(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ type: 'error', code: 'SLOW_DOWN', lines: ['Slow down. Even I need a moment between roasts. Try again in a minute.'] });
    arr.push(now); hits.set(key, arr); next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

app.post('/api/chat', limiter(30, 60e3), async (req, res) => {
  try {
    const out = await bot.handle(req.body && req.body.message);
    res.json(out);
  } catch (e) {
    console.error('chat error', e);
    res.status(500).json({ type: 'error', lines: ['Segmentation fault (core dumped). The bot crashed for real this time. Try again.'] });
  }
});

app.get('/api/roast/:id', (req, res) => {
  const r = store.getRoast(req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json({ type: 'roast', roast: r, cardUrl: `/api/card/${r.id}.png` });
});

const cardCache = new Map();
app.get('/api/card/:id.png', (req, res) => {
  const r = store.getRoast(req.params.id);
  if (!r) return res.status(404).send('not found');
  let png = cardCache.get(r.id);
  if (!png) { png = renderCard(r); cardCache.set(r.id, png); if (cardCache.size > 200) cardCache.delete(cardCache.keys().next().value); }
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=86400');
  if ('download' in req.query) res.set('Content-Disposition', `attachment; filename="segfault-roast-${r.repo.replace(/[^\w.-]+/g, '_')}.png"`);
  res.send(png);
});

app.get('/api/shame', (req, res) => res.json({ shame: store.hallOfShame(Number(req.query.limit) || 10), stats: store.stats() }));
app.get('/api/status', (req, res) => res.json({ ok: true, github: rate, llm: llm.provider, stats: store.stats() }));
app.get('/healthz', (req, res) => res.send('ok'));

// Share page with OG/Twitter card meta so links unfurl with the roast card image
const INDEX = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
app.get('/r/:id', (req, res) => {
  const r = store.getRoast(req.params.id);
  if (!r) return res.redirect('/');
  const base = `${req.protocol}://${req.get('host')}`;
  const meta = `<meta property="og:title" content="${esc(r.repo)}: Crash Score ${r.score}/100 | $SEGFAULT">
<meta property="og:description" content="${esc(r.roast.slice(0, 190))}">
<meta property="og:image" content="${base}/api/card/${r.id}.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${base}/api/card/${r.id}.png">
<script>window.__ROAST_ID=${JSON.stringify(r.id)}</script>`;
  res.send(INDEX.replace('<!--OG-->', meta));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '1h' }));

app.listen(PORT, HOST, () => {
  console.log(`$SEGFAULT terminal listening on http://localhost:${PORT}  (LLM: ${llm.provider || 'off, rule-based only'}; GitHub token: ${process.env.GITHUB_TOKEN ? 'yes' : 'no, 60 req/h'})`);
});
