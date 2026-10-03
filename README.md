# $SEGFAULT terminal

**The AI that roasts your code until it crashes.** A single-page web app with a terminal-style chat bot that works **without any paid API key**:

| Mode | What it does | Data |
|---|---|---|
| **Repo roast** `/roast owner/repo` (or just paste a GitHub URL) | Deterministic **Crash Score 0–100**, a roast built from a template library keyed on real signals, and **one concrete fix** | Public GitHub REST API: repo metadata, languages, file tree (names + sizes only, file contents are never read) |
| **Debug** `/debug <trace>` (or just paste a stack trace) | Detects 30+ classic errors (segfault, NPE, `undefined`, KeyError, IndexError, CORS, ECONNREFUSED, OOM, ImportError, Rust borrow errors, Go nil pointer, ...), shows the crash site, likely cause, fix and a roast line | Rule engine (`lib/debug.js`) |
| **Q&A** about $SEGFAULT | Intent matching over a small knowledge base built from `../concept.md` (what, how, tokenomics, CA, roadmap, safety, how to buy, ...). Honest: live on pump.fun, official CA only, no promises, not financial advice | `lib/kb.js` |
| **Optional LLM** | If `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set, unmatched free-form questions go to the LLM (with the KB and honesty rules as system prompt). Without a key, everything stays rule-based | `lib/llm.js` |

Extras: shareable **roast card PNG** (1200×630, rendered server-side), live **Hall of Shame** leaderboard (`data/roasts.json`), **Share on X** button (prefilled, < 250 chars, tags @SegfaultDevBot), `/r/<id>` share links with OG/Twitter-card meta, command history (↑/↓), easter eggs (`sudo`, `rm -rf /`, `:wq`, `exit vim`, `git push --force`, `npm install`, `hello world`, `ping`, `coffee`, ...).

## Run locally

```bash
cd app
npm install
npm start            # http://localhost:8080   (PORT=3000 npm start to change)
./run.sh             # same, but in the background (pid in data/server.pid, log in data/server.log)
node test/smoke.js http://localhost:8080 torvalds/linux expressjs/express   # e2e smoke test
```

Requirements: Node.js ≥ 18.17 (uses built-in `fetch`). Dependencies: `express` and `@resvg/resvg-js` (prebuilt binary for the PNG cards, no native build step). Fonts for the card (DejaVu Sans Mono, free license) are bundled in `fonts/`.

### Environment variables (all optional)

| Var | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `8080` / `0.0.0.0` | listen address |
| `GITHUB_TOKEN` | – | raises GitHub limit from 60 to 5,000 req/h (a fine-grained token with **no** scopes is enough for public data) |
| `CACHE_TTL_HOURS` | `6` | how long fetched repo data is cached |
| `DATA_DIR` | `./data` | where `roasts.json` (Hall of Shame) and `github-cache.json` live |
| `PUBLIC_URL` | – | e.g. `https://segfault.example` – adds a `/r/<id>` link (with card preview) to the X share text |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | – / `claude-haiku-4-5` | optional free-form answers |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | – / `gpt-4o-mini` | optional free-form answers |

## How the Crash Score works (`lib/roast.js`)

`score = 30 + penalties − bonuses`, clamped to 0–100. Same data → same score → same roast (template choice is a hash of the repo name).

Penalties (real signals): empty repo (=100), committed `.env` (+14), committed `node_modules` (+20), no README (+18), no tests (+15, only claimed when the full tree was scanned), no CI (+10), no license (+8), archived (+12), last push > 5y (+25) / > 2y (+18) / > 1y (+12), README < 400 bytes (+9), README bigger than the code (+6), no `.gitignore` (+6), files ≥ 10 MB (+8), `.DS_Store` (+4), ≥ 3 committed binaries (+5), `package.json` without lockfile (+5), > 1000 open issues+PRs (+12) / > 200 (+6), high issue/star ratio (+6), 0 stars & 0 forks (+5), no description (+4), no topics (+2), name like `final`/`copy`/`v2` (+3), fork (+3), ≥ 8 languages (+4), < 5 files (+6), zero bytes of detected code (+10). Tests/CI penalties only apply when there is code.
Bonuses: ≥ 10k stars (−12), ≥ 1k stars (−6), pushed in the last 14 days (−4), tests + CI (−6), CONTRIBUTING (−2), SECURITY.md (−1).

Huge repos (> 300 MB, e.g. `torvalds/linux`) are scanned top-level only; tests are then reported as "not checked" instead of guessing.

The **fix** is the most urgent fixable signal (archived → successor note, secrets → node_modules → README → tests → CI → license → ...), language-aware (vitest / pytest / `go test` / `cargo test` / JUnit ...).

## GitHub rate limits

Unauthenticated: **60 requests/hour per IP**. One uncached roast = 3 requests (repo, tree, languages).
- Results are cached on disk for 6 h (`data/github-cache.json`), concurrent requests for the same repo are de-duplicated.
- `X-RateLimit-*` headers are tracked; when the quota is gone the bot stops calling GitHub, serves stale cache if it has one, and otherwise answers with a friendly "quota resets in ~N min" message.
- If the quota runs out mid-roast, the roast is marked **partial** (shown in the evidence) and only cached for 10 min.
- Per-IP limit on `/api/chat`: 30 requests/minute (running the smoke test twice within a minute will trip it, by design).
- On a shared host IP (many cloud providers), the 60/h is shared with everyone else on that IP → set `GITHUB_TOKEN` in production.

## API

- `POST /api/chat {message}` → `{type: roast|debug|text|error|shame|clear, ...}`
- `GET /api/roast/:id`, `GET /api/card/:id.png[?download=1]`, `GET /api/shame`, `GET /api/status`, `GET /r/:id` (share page with OG image), `GET /healthz`

## Deploy for free (not done – instructions only)

The app is a plain Node web service. Note: free tiers usually have an **ephemeral filesystem**, so the Hall of Shame resets on redeploy/restart unless you attach a disk/volume (set `DATA_DIR` to it).

- **Render** (free web service): New → Web Service → connect the repo, root dir `app`, build `npm install`, start `npm start`. Add `GITHUB_TOKEN` as env var. Free instances sleep after inactivity (cold start ~30–60 s).
- **Railway**: New Project → Deploy from GitHub → root `app`; it detects Node and runs `npm start`. Add a Volume mounted at `/data` and set `DATA_DIR=/data` to keep the leaderboard. (Railway's free offering is a trial credit.)
- **Fly.io**: `cd app && fly launch` (Node detected, internal port 8080), `fly volumes create data --size 1` + mount at `/data`, `fly secrets set GITHUB_TOKEN=...`. Check Fly's current pricing first.
- **Vercel**: possible but not ideal – it's serverless, so you would need to move the routes into `api/` functions and swap the JSON file for a KV/DB store. Prefer Render/Railway/Fly for this app as-is.

## Project layout

```
app/
  server.js          Express server + routes
  lib/github.js      GitHub REST client, tree analysis, rate-limit + cache
  lib/roast.js       Crash Score + roast/fix template library
  lib/debug.js       stack-trace rules
  lib/kb.js          $SEGFAULT knowledge base + intent matching
  lib/bot.js         command router, easter eggs, share text
  lib/llm.js         optional OpenAI/Anthropic fallback
  lib/card.js        SVG -> PNG roast card (resvg)
  lib/store.js       JSON persistence (cache, roasts, Hall of Shame)
  public/            index.html, styles.css, app.js, logo
  fonts/             DejaVu Sans Mono (card rendering)
  test/smoke.js      end-to-end test against a running server
  screenshots/       headless Chrome screenshots + sample roast card
```

## Safety & honesty

- Only public data; file **contents are never fetched**, so secrets in a committed `.env` are never read (only the file name is flagged).
- Roasts target code, never people. Repo text is never executed or used as instructions.
- The coin is **live on pump.fun** (Solana). The bot only ever states the official CA `CYEus7v4ygJAHjB3DVRNyxFXYBtMKeALD2nTf8wzpump` (https://pump.fun/coin/CYEus7v4ygJAHjB3DVRNyxFXYBtMKeALD2nTf8wzpump), never predicts prices, never asks for keys/seed phrases. Not financial advice.
