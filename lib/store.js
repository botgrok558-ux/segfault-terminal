// Tiny JSON-file persistence (no native deps). Writes are atomic (tmp + rename).
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

function load(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); }
  catch { return fallback; }
}
function save(name, obj) {
  const file = path.join(DATA_DIR, name);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

// ---- GitHub response cache --------------------------------------------------
const CACHE_FILE = 'github-cache.json';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_HOURS || 6) * 3600e3;
let cache = load(CACHE_FILE, {});

function cacheGet(key) {
  const hit = cache[key];
  if (!hit) return null;
  if (Date.now() - hit.t > CACHE_TTL_MS) return { stale: true, value: hit.v, t: hit.t };
  return { stale: false, value: hit.v, t: hit.t };
}
function cacheSet(key, value) {
  cache[key] = { t: Date.now(), v: value };
  // keep the cache bounded
  const keys = Object.keys(cache);
  if (keys.length > 500) {
    keys.sort((a, b) => cache[a].t - cache[b].t).slice(0, keys.length - 500).forEach(k => delete cache[k]);
  }
  save(CACHE_FILE, cache);
}

// ---- Roasts + Hall of Shame -------------------------------------------------
const ROASTS_FILE = 'roasts.json';
let roasts = load(ROASTS_FILE, {}); // id -> roast record

function saveRoast(r) {
  roasts[r.id] = r;
  save(ROASTS_FILE, roasts);
}
function getRoast(id) { return roasts[id] || null; }

// One entry per repo (latest roast wins), sorted by Crash Score desc.
function hallOfShame(limit = 10) {
  const byRepo = {};
  for (const r of Object.values(roasts)) {
    const k = r.repo.toLowerCase();
    if (!byRepo[k] || byRepo[k].createdAt < r.createdAt) byRepo[k] = r;
  }
  return Object.values(byRepo)
    .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(r => ({ id: r.id, repo: r.repo, score: r.score, verdict: r.verdict, roast: r.roast, createdAt: r.createdAt, url: r.url }));
}
function stats() {
  const all = Object.values(roasts);
  return {
    roastsServed: all.length,
    reposRoasted: new Set(all.map(r => r.repo.toLowerCase())).size,
    avgScore: all.length ? Math.round(all.reduce((s, r) => s + r.score, 0) / all.length) : null,
  };
}

module.exports = { cacheGet, cacheSet, saveRoast, getRoast, hallOfShame, stats, DATA_DIR };
