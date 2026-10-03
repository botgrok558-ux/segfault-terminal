// Fetches REAL public data from the GitHub REST API (unauthenticated by default).
// - 3 API calls per uncached repo: /repos/:o/:r, /languages, /git/trees/:branch
// - results cached on disk (default 6h); stale cache is served when rate limited
// - tracks X-RateLimit-* headers and refuses to hammer the API once exhausted
const { cacheGet, cacheSet } = require('./store');

const API = 'https://api.github.com';
const UA = 'segfault-terminal/1.0 (+https://x.com/SegfaultDevBot)';
const TOKEN = process.env.GITHUB_TOKEN || ''; // optional, raises limit 60 -> 5000/h

const rate = { limit: TOKEN ? 5000 : 60, remaining: null, resetAt: null };

class GhError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

function parseRepo(input) {
  if (!input) return null;
  let s = String(input).trim().replace(/^<|>$/g, '');
  s = s.replace(/^git@github\.com:/i, '');
  s = s.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '');
  s = s.replace(/[?#].*$/, '');
  const parts = s.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  const ok = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) && /^[A-Za-z0-9._-]{1,100}$/.test(repo);
  return ok ? { owner, repo } : null;
}

async function gh(path) {
  if (rate.remaining === 0 && rate.resetAt && Date.now() < rate.resetAt) {
    throw new GhError('RATE_LIMIT', 'GitHub rate limit exhausted', { resetAt: rate.resetAt });
  }
  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  let res;
  try {
    res = await fetch(API + path, { headers, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    throw new GhError('NETWORK', 'Could not reach GitHub: ' + (e.name === 'TimeoutError' ? 'timeout' : e.message));
  }
  const rem = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  const lim = res.headers.get('x-ratelimit-limit');
  if (rem !== null) rate.remaining = Number(rem);
  if (reset) rate.resetAt = Number(reset) * 1000;
  if (lim) rate.limit = Number(lim);

  if (res.ok) return res.json();
  let body = {};
  try { body = await res.json(); } catch {}
  if ((res.status === 403 || res.status === 429) && (rate.remaining === 0 || /rate limit/i.test(body.message || ''))) {
    rate.remaining = 0;
    const retryAfter = Number(res.headers.get('retry-after'));
    if (retryAfter) rate.resetAt = Date.now() + retryAfter * 1000;
    throw new GhError('RATE_LIMIT', 'GitHub rate limit exhausted', { resetAt: rate.resetAt });
  }
  if (res.status === 404) throw new GhError('NOT_FOUND', 'Repo not found (or private)');
  if (res.status === 409) throw new GhError('EMPTY', 'Repository is empty');
  if (res.status === 451) throw new GhError('BLOCKED', 'Repository unavailable for legal reasons');
  throw new GhError('HTTP', `GitHub API error ${res.status}: ${body.message || res.statusText}`);
}

const DAY = 86400e3;
const daysSince = iso => (iso ? Math.floor((Date.now() - Date.parse(iso)) / DAY) : null);

const TEST_RE = /(^|\/)(tests?|__tests__|specs?|testing|test_?suite|e2e|cypress|selftests)(\/|$)|(^|\/)(tests?|specs?)\.([cm]?[jt]sx?|py|sh|go|rb|php)$|(^|\/)test_[^/]+\.py$|[^/]+_test\.(py|go|rs|exs?|cc|cpp|c)$|\.(test|spec)\.[cm]?[jt]sx?$|Tests?\.(java|kt|cs|swift)$|_spec\.rb$|(^|\/)(conftest\.py|pytest\.ini|tox\.ini|phpunit\.xml(\.dist)?|karma\.conf\.js|\.mocharc(\.\w+)?|(jest|vitest|playwright)\.config\.[cm]?[jt]s)$/i;
const CI_FILES = ['.travis.yml', '.gitlab-ci.yml', 'jenkinsfile', 'azure-pipelines.yml', '.drone.yml', 'bitbucket-pipelines.yml', 'appveyor.yml', '.appveyor.yml', 'cirrus.yml', '.cirrus.yml', 'buildkite.yml'];
const BIN_RE = /\.(exe|dll|so|dylib|zip|tar|gz|tgz|7z|rar|jar|war|class|o|obj|pyc|apk|dmg|iso|bin|msi)$/i;
const LOCKFILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock', 'npm-shrinkwrap.json'];

function analyzeTree(tree, recursive) {
  const entries = tree.tree || [];
  const blobs = entries.filter(e => e.type === 'blob');
  const top = entries.filter(e => !e.path.includes('/'));
  const topNames = top.map(e => e.path);
  const lowerTop = new Map(top.map(e => [e.path.toLowerCase(), e]));
  const complete = recursive && !tree.truncated; // we saw every file

  const readme = top.find(e => e.type === 'blob' && /^readme(\.|$)/i.test(e.path));
  const testHits = entries.filter(e => TEST_RE.test(e.path));
  const hasGithubDir = lowerTop.has('.github');
  const workflows = entries.filter(e => e.type === 'blob' && /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(e.path));
  const ciTop = top.find(e => CI_FILES.includes(e.path.toLowerCase()) || e.path === '.circleci' || e.path === '.buildkite');
  let hasCI;
  if (workflows.length || ciTop) hasCI = true;
  else if (!hasGithubDir) hasCI = false;       // no CI file at root and no .github dir at all
  else hasCI = recursive ? false : null;       // .github exists but we did not look inside

  let hasTests;
  if (testHits.length) hasTests = true;
  else hasTests = complete ? false : null;     // only claim "no tests" if we saw the whole tree

  const nodeModules = entries.filter(e => /(^|\/)node_modules(\/|$)/.test(e.path));
  const envFiles = entries.filter(e => e.type === 'blob' && /(^|\/)\.env(\.(local|production|prod|dev|development))?$/i.test(e.path));
  const dsStore = entries.filter(e => /(^|\/)\.DS_Store$/.test(e.path));
  const huge = blobs.filter(e => e.size >= 10 * 1024 * 1024).sort((a, b) => b.size - a.size);
  const binaries = blobs.filter(e => BIN_RE.test(e.path) && !/(^|\/)node_modules\//.test(e.path));
  const pkg = lowerTop.has('package.json');
  const lock = LOCKFILES.some(f => lowerTop.has(f));
  const maxDepth = entries.reduce((m, e) => Math.max(m, e.path.split('/').length), 0);

  return {
    recursive, truncated: !!tree.truncated, complete,
    entryCount: entries.length,
    fileCount: blobs.length,
    topLevel: topNames.slice(0, 60),
    hasReadme: !!readme, readmeName: readme ? readme.path : null, readmeSize: readme ? readme.size : 0,
    hasTests, testHitCount: testHits.length,
    hasCI, ciName: workflows.length ? `${workflows.length} GitHub workflow(s)` : ciTop ? ciTop.path : null,
    hasGitignore: lowerTop.has('.gitignore'),
    nodeModulesCommitted: nodeModules.length > 0, nodeModulesEntries: nodeModules.length,
    envFiles: envFiles.map(e => e.path).slice(0, 5),
    dsStoreCount: dsStore.length,
    hugeFiles: huge.slice(0, 3).map(e => ({ path: e.path, size: e.size })),
    hugeFileCount: huge.length,
    binaryCount: binaries.length, binarySample: binaries.slice(0, 3).map(e => e.path),
    hasDockerfile: lowerTop.has('dockerfile') || lowerTop.has('docker-compose.yml') || lowerTop.has('compose.yml'),
    hasContributing: lowerTop.has('contributing.md') || entries.some(e => /^(\.github|docs)\/contributing\.md$/i.test(e.path)),
    hasSecurity: lowerTop.has('security.md') || entries.some(e => /^\.github\/security\.md$/i.test(e.path)),
    hasChangelog: [...lowerTop.keys()].some(k => /^(changelog|changes|history)(\.|$)/.test(k)),
    packageJson: pkg, lockfile: lock,
    python: lowerTop.has('requirements.txt') || lowerTop.has('pyproject.toml') || lowerTop.has('setup.py'),
    maxDepth,
  };
}

const inflight = new Map();

async function fetchRepoFacts(owner, repo) {
  const key = `facts:${owner}/${repo}`.toLowerCase();
  const cached = cacheGet(key);
  // partial scans (quota ran out mid-fetch) are only trusted for 10 minutes
  const partialExpired = cached && cached.value.partial && cached.value.partial.length && Date.now() - cached.t > 600e3;
  if (cached && !cached.stale && !partialExpired) return { facts: cached.value, cache: 'hit' };
  const nf = cacheGet('404:' + key);
  if (nf && Date.now() - nf.t < 600e3) throw new GhError('NOT_FOUND', 'Repo not found (or private)');
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const facts = await fetchFresh(owner, repo);
      cacheSet(key, facts);
      return { facts, cache: 'miss' };
    } catch (e) {
      if (cached && (e.code === 'RATE_LIMIT' || e.code === 'NETWORK')) return { facts: cached.value, cache: 'stale' };
      if (e.code === 'NOT_FOUND') cacheSet('404:' + key, true); // negative cache: don't burn quota on typos
      throw e;
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}

async function fetchFresh(owner, repo) {
  const m = await gh(`/repos/${owner}/${repo}`);
  const partial = [];
  // Huge repos (> ~300 MB) would return a multi-MB truncated tree: only scan the top level.
  const recursive = (m.size || 0) < 300000;
  let tree = null, empty = false;
  try {
    const t = await gh(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(m.default_branch)}${recursive ? '?recursive=1' : ''}`);
    tree = analyzeTree(t, recursive);
  } catch (e) {
    if (e.code === 'EMPTY' || e.code === 'NOT_FOUND') empty = true;
    else if (e.code === 'RATE_LIMIT') partial.push('tree');
    else throw e;
  }
  // languages are nice-to-have: degrade gracefully if the quota ran out mid-roast
  let languages = {};
  try { languages = await gh(`/repos/${owner}/${repo}/languages`); }
  catch (e) { if (e.code === 'RATE_LIMIT') partial.push('languages'); }
  const codeBytes = Object.values(languages).reduce((a, b) => a + b, 0);
  return {
    fullName: m.full_name,
    url: m.html_url,
    owner: m.owner && m.owner.login,
    ownerType: m.owner && m.owner.type,
    name: m.name,
    description: m.description || '',
    homepage: m.homepage || '',
    stars: m.stargazers_count, forks: m.forks_count, watchers: m.subscribers_count,
    openIssues: m.open_issues_count, // GitHub counts open issues + open PRs here
    hasIssues: m.has_issues,
    defaultBranch: m.default_branch,
    createdAt: m.created_at, pushedAt: m.pushed_at,
    ageDays: daysSince(m.created_at), daysSincePush: daysSince(m.pushed_at),
    license: m.license ? { spdx: m.license.spdx_id, name: m.license.name } : null,
    topics: m.topics || [],
    archived: !!m.archived, isFork: !!m.fork, parent: m.parent ? m.parent.full_name : null,
    sizeKB: m.size,
    language: m.language,
    languages, codeBytes,
    empty: empty || m.size === 0 && !tree,
    tree,
    partial,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { parseRepo, fetchRepoFacts, rate, GhError };
