// Deterministic Crash Score + roast generator. Every line below is keyed on a
// REAL signal from the fetched GitHub data; numbers are interpolated, never invented.
const BAD_TOKENS = new Set(['final','copy','backup','old','tmp','temp','untitled','asdf','test','new','fixed','working','latest','draft','wip','foo','bar','stuff','misc']);
const badName = name => String(name).toLowerCase().split(/[-_.\s]+/).some(t => BAD_TOKENS.has(t) || /^v\d+$/.test(t) || /^final\d*$/.test(t));

// ---------- helpers ----------
const n = x => Number(x || 0).toLocaleString('en-US');
const bytes = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? (b / 1024).toFixed(1) + ' KB' : b + ' bytes';
const files = c => `${n(c)} file${c === 1 ? '' : 's'}`;
const span = d => d === 1 ? '1 day' : d >= 730 ? (d / 365).toFixed(1) + ' years' : d >= 60 ? Math.round(d / 30) + ' months' : d + ' days';
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = (arr, seed) => arr[hash(seed) % arr.length];
const topLang = f => {
  const e = Object.entries(f.languages || {}).sort((a, b) => b[1] - a[1]);
  if (!e.length) return null;
  return { name: e[0][0], pct: Math.round(100 * e[0][1] / (f.codeBytes || 1)) };
};
const lang = f => (f.language || (topLang(f) || {}).name || '').toLowerCase();

// ---------- language-aware fixes ----------
function testFix(f) {
  const l = lang(f);
  if (/typescript|javascript/.test(l)) return 'Add one real test: `npm i -D vitest`, create `src/index.test.js` with a single `expect()` for your main export, add `"test": "vitest run"` to package.json.';
  if (l === 'python') return 'Add `tests/test_smoke.py` with one `assert` against your main function, then `pip install pytest && pytest`. One test is infinitely more than zero.';
  if (l === 'go') return 'Create `main_test.go` with one `func TestXxx(t *testing.T)` and run `go test ./...`. Go literally ships the test runner for you.';
  if (l === 'rust') return 'Add a `#[cfg(test)] mod tests { #[test] fn it_works() { ... } }` block and run `cargo test`. The borrow checker can\'t test logic for you.';
  if (/java|kotlin/.test(l)) return 'Add JUnit 5 (`org.junit.jupiter`) and one test under `src/test/java` for your core class, then `./gradlew test` / `mvn test`.';
  if (/c\+\+|^c$/.test(l)) return 'Add a `tests/` target (e.g. GoogleTest or a tiny assert-based `test_main.c`) and wire it into `make test` / `ctest`.';
  return 'Add a `tests/` folder with one smoke test for the most important code path and document how to run it in the README.';
}
function ciFix(f) {
  const l = lang(f);
  const cmd = /typescript|javascript/.test(l) ? 'npm ci && npm test' : l === 'python' ? 'pip install -e . && pytest' : l === 'go' ? 'go vet ./... && go test ./...' : l === 'rust' ? 'cargo clippy && cargo test' : /^c$|c\+\+/.test(l) ? 'make && make check' : /java|kotlin/.test(l) ? './gradlew build' : l === 'ruby' ? 'bundle exec rake' : 'your build + test command';
  return `Add \`.github/workflows/ci.yml\` that runs \`${cmd}\` on every push and PR (actions/checkout + a setup action). Free for public repos.`;
}

// ---------- signal library ----------
// pts: Crash Score contribution. fixP: lower = more urgent fix. lines: roast variants.
const SIGNALS = [
  {
    key: 'empty', test: f => f.empty, pts: 80, fixP: 0,
    lines: [
      f => `${f.fullName} is an empty repository. Not a single commit. This isn't a codebase, it's a placeholder with ambitions.`,
      f => `I opened ${f.fullName} and found nothing. Zero files. The only thing that can't crash is code that doesn't exist. Respect.`,
      f => `An empty repo. Schrödinger's project: simultaneously revolutionary and nonexistent until you push something.`,
    ],
    fix: () => 'Push a first commit: README.md (what + how to run), a .gitignore for your language and a LICENSE. `git add . && git commit -m "init" && git push`.',
  },
  {
    key: 'envCommitted', test: f => f.tree && f.tree.envFiles.length > 0, pts: 14, fixP: 1,
    lines: [
      f => `You committed \`${f.tree.envFiles[0]}\` to a public repo. I didn't open it (I have manners), but every scraper bot on the internet did.`,
      f => `\`${f.tree.envFiles[0]}\` is sitting in the repo tree. Bold strategy: storing your secrets in the one place designed to never forget them.`,
      f => `Found \`${f.tree.envFiles[0]}\` in git. "It's just dev keys" is what everyone says right before the cloud bill arrives.`,
    ],
    fix: f => `Rotate anything that was ever in \`${f.tree.envFiles[0]}\`, then \`git rm --cached ${f.tree.envFiles[0]}\`, add it to .gitignore and commit a \`.env.example\` with dummy values.`,
  },
  {
    key: 'nodeModules', test: f => f.tree && f.tree.nodeModulesCommitted, pts: 20, fixP: 2,
    lines: [
      f => `node_modules is committed (${n(f.tree.nodeModulesEntries)} entries). Your repo isn't a project, it's a mirror of npm with a README.`,
      f => `You checked in node_modules. ${n(f.tree.nodeModulesEntries)} entries of other people's code, version-controlled by you, forever. That folder has its own zip code now.`,
      f => `node_modules in git: ${n(f.tree.nodeModulesEntries)} entries. git clone now doubles as a stress test for my SSD.`,
    ],
    fix: () => 'Add `node_modules/` to .gitignore, run `git rm -r --cached node_modules && git commit -m "untrack node_modules"`, and rely on `npm ci` + your lockfile.',
  },
  {
    key: 'noReadme', test: f => f.tree && !f.tree.hasReadme, pts: 18, fixP: 3,
    lines: [
      f => `No README. Visitors to ${f.fullName} have to reverse-engineer what this does, which is ironic for a repo that probably doesn't do it yet.`,
      f => `Zero README. The documentation strategy is "read the code", and the code's strategy is "good luck".`,
      f => `No README at all. Even a segfault leaves a core dump. You left nothing.`,
      f => `There's no README, so I assume the project description is a vibe and the install guide is a prayer.`,
    ],
    fix: f => `Add a README.md with 3 sections: what ${f.name} does (1 sentence), how to install/run it (copy-pasteable commands), and one usage example.`,
  },
  {
    key: 'noTests', test: f => f.tree && f.tree.hasTests === false && f.codeBytes > 0, pts: 15, fixP: 4,
    lines: [
      f => `${files(f.tree.fileCount)} and not one test. You're not shipping software, you're shipping hope.`,
      f => `I scanned all ${files(f.tree.fileCount)} for tests and found exactly the same number of tests as there are bugs you know about: zero.`,
      f => `No tests anywhere. Your QA process is "the users will tell me".`,
      f => `Not a single test file. Every deploy is a surprise party, and the surprise is a stack trace.`,
      f => `Testing strategy detected: production. ${files(f.tree.fileCount)}, 0 tests, infinite confidence.`,
    ],
    fix: f => testFix(f),
  },
  {
    key: 'noCI', test: f => f.tree && f.tree.hasCI === false && f.codeBytes > 0, pts: 10, fixP: 5,
    lines: [
      f => `No CI config in the repo. "Works on my machine" is the entire release pipeline.`,
      f => `No CI. Every merge is reviewed by the strictest system there is: your users, at 3am.`,
      f => `There's no CI. The build is green the same way Schrödinger's cat is alive.`,
      f => `Zero pipelines. The only thing continuously integrated here is technical debt.`,
    ],
    fix: f => ciFix(f),
  },
  {
    key: 'noLicense', test: f => !f.empty && !f.license, pts: 8, fixP: 6,
    lines: [
      f => `No license. Legally, nobody is allowed to use this. Practically, nobody was going to anyway.`,
      f => `No LICENSE file, so technically ${f.fullName} is "all rights reserved". Guarding it like it's the Coca-Cola recipe.`,
      f => `Unlicensed. You open-sourced the code but not the permission to use it. Peak open-source theater.`,
    ],
    fix: () => 'Add a LICENSE: on GitHub click "Add file -> Create new file", name it LICENSE and pick a template (MIT if you just want people to use it). Takes 30 seconds.',
  },
  {
    key: 'archived', test: f => f.archived, pts: 12, fixP: 0.5,
    lines: [
      f => `This repo is archived. I'm roasting a corpse, and honestly it still has more structure than some living projects.`,
      f => `Archived. Read-only. The repo equivalent of a "gone fishing" sign that's been up since ${f.pushedAt.slice(0, 4)}.`,
    ],
    fix: f => `Archived repos should say why: add a note at the top of the README pointing to a successor or explaining that ${f.name} is unmaintained.`,
  },
  {
    key: 'fossil', test: f => !f.archived && f.daysSincePush > 1825, pts: 25, fixP: 18,
    lines: [
      f => `Last push: ${span(f.daysSincePush)} ago. This code is old enough to have its own legacy-system migration project.`,
      f => `Nobody has pushed to this in ${span(f.daysSincePush)}. Carbon dating puts the last commit in ${f.pushedAt.slice(0, 4)}.`,
      f => `${span(f.daysSincePush)} since the last push. This isn't abandoned, it's a fossil. Archaeologists will study its commit messages.`,
    ],
    fix: f => `Either archive it (Settings -> Archive) so people know, or bump dependencies and add a "Status: maintained/unmaintained" line to the README. ${span(f.daysSincePush)} of silence helps nobody.`,
  },
  {
    key: 'stale2y', test: f => !f.archived && f.daysSincePush > 730 && f.daysSincePush <= 1825, pts: 18, fixP: 18,
    lines: [
      f => `Last push ${span(f.daysSincePush)} ago. The only thing maintained here is the silence.`,
      f => `${span(f.daysSincePush)} without a push. The last push was in ${f.pushedAt.slice(0, 4)} and the repo is collecting dust bunnies.`,
      f => `No commits for ${span(f.daysSincePush)}. Even my core dumps get more attention than this.`,
    ],
    fix: f => `After ${span(f.daysSincePush)} of no pushes: run your package manager's audit/outdated command, bump deps, and state the maintenance status in the README (or archive it).`,
  },
  {
    key: 'stale1y', test: f => !f.archived && f.daysSincePush > 365 && f.daysSincePush <= 730, pts: 12, fixP: 18,
    lines: [
      f => `Last push ${span(f.daysSincePush)} ago. The repo isn't dead, it's just "taking a break" like your gym membership.`,
      f => `Over a year since the last push (${f.daysSincePush} days). The code is resting. Possibly in peace.`,
    ],
    fix: () => 'Over a year without a push: run a dependency update (e.g. Dependabot via `.github/dependabot.yml`) so at least the security fixes keep flowing.',
  },
  {
    key: 'tinyReadme', test: f => f.tree && f.tree.hasReadme && f.tree.readmeSize < 400, pts: 9, fixP: 8,
    lines: [
      f => `The README is ${bytes(f.tree.readmeSize)}. That's not documentation, that's a fortune cookie.`,
      f => `${bytes(f.tree.readmeSize)} of README. I've seen longer error messages. I AM a longer error message.`,
      f => `A ${bytes(f.tree.readmeSize)} README for ${files(f.tree.fileCount)}. The ratio of explanation to code is giving "figure it out yourself".`,
    ],
    fix: f => `Grow the ${bytes(f.tree.readmeSize)} README into something useful: one-line purpose, install command, a usage example and how to run tests.`,
  },
  {
    key: 'docsDriven', test: f => f.tree && f.tree.hasReadme && f.codeBytes > 0 && f.tree.readmeSize > f.codeBytes, pts: 6, fixP: 30,
    lines: [
      f => `The README (${bytes(f.tree.readmeSize)}) is bigger than all the code combined (${bytes(f.codeBytes)}). Documentation-driven development, final boss edition.`,
      f => `More README (${bytes(f.tree.readmeSize)}) than code (${bytes(f.codeBytes)}). You wrote the movie script before building the camera.`,
    ],
    fix: () => 'Your README out-weighs the code: move the roadmap/ideas into GitHub Issues and keep the README to what actually works today.',
  },
  {
    key: 'noGitignore', test: f => f.tree && !f.tree.hasGitignore && f.tree.fileCount > 3, pts: 6, fixP: 7,
    lines: [
      f => `No .gitignore. Every build artifact, editor temp file and secret is just one \`git add .\` away from immortality.`,
      f => `No .gitignore detected. You're running \`git add .\` with no seatbelt.`,
    ],
    fix: f => `Add a .gitignore from github/gitignore for ${f.language || 'your language'} (e.g. \`curl -o .gitignore https://raw.githubusercontent.com/github/gitignore/main/${(f.language || 'Node').replace(/\s/g, '')}.gitignore\`).`,
  },
  {
    key: 'hugeFiles', test: f => f.tree && f.tree.hugeFileCount > 0, pts: 8, fixP: 9,
    lines: [
      f => `\`${f.tree.hugeFiles[0].path}\` is ${bytes(f.tree.hugeFiles[0].size)} and lives in git. Git is a version control system, not a storage unit.`,
      f => `Found ${f.tree.hugeFileCount} file(s) over 10 MB, biggest: \`${f.tree.hugeFiles[0].path}\` (${bytes(f.tree.hugeFiles[0].size)}). Every clone is a cardio session.`,
    ],
    fix: f => `Move \`${f.tree.hugeFiles[0].path}\` (${bytes(f.tree.hugeFiles[0].size)}) out of git: use Git LFS (\`git lfs track\`) or a release asset, and purge history with \`git filter-repo\` if clone size matters.`,
  },
  {
    key: 'dsStore', test: f => f.tree && f.tree.dsStoreCount > 0, pts: 4, fixP: 12,
    lines: [
      f => `${f.tree.dsStoreCount} .DS_Store file(s) committed. Thanks, now we all know you use a Mac.`,
      f => `.DS_Store in the repo (${f.tree.dsStoreCount}x). Finder metadata, version-controlled. Truly nothing is private anymore.`,
    ],
    fix: () => 'Run `find . -name .DS_Store -print0 | xargs -0 git rm --cached` and add `.DS_Store` to .gitignore (or your global gitignore).',
  },
  {
    key: 'binaries', test: f => f.tree && f.tree.binaryCount >= 3, pts: 5, fixP: 11,
    lines: [
      f => `${f.tree.binaryCount} binary/archive files committed (e.g. \`${f.tree.binarySample[0]}\`). Source control, now with extra not-source.`,
      f => `I count ${f.tree.binaryCount} compiled/archived blobs in git, like \`${f.tree.binarySample[0]}\`. Diffs on those must be thrilling.`,
    ],
    fix: f => `Stop committing build outputs like \`${f.tree.binarySample[0]}\`: add them to .gitignore and publish binaries as GitHub Release assets instead.`,
  },
  {
    key: 'noLockfile', test: f => f.tree && f.tree.packageJson && !f.tree.lockfile, pts: 5, fixP: 10,
    lines: [
      () => `package.json but no lockfile. Every \`npm install\` is a surprise party, and the surprise is a breaking change.`,
      () => `No lockfile next to package.json. Your dependency tree is chosen fresh daily, like a farmers market of bugs.`,
    ],
    fix: () => 'Commit a lockfile: run `npm install` once and commit `package-lock.json`, then use `npm ci` in CI for reproducible installs.',
  },
  {
    key: 'issuePileHuge', test: f => f.openIssues > 1000, pts: 12, fixP: 25,
    lines: [
      f => `${n(f.openIssues)} open issues + PRs. That's not a backlog, that's a geological layer.`,
      f => `${n(f.openIssues)} open issues and PRs. The issue tracker has more unresolved drama than a reality TV show.`,
    ],
    fix: f => `With ${n(f.openIssues)} open issues/PRs: add issue templates, a "needs-triage" label and a stale-bot (actions/stale) so the queue reflects reality.`,
  },
  {
    key: 'issuePile', test: f => f.openIssues > 200 && f.openIssues <= 1000, pts: 6, fixP: 25,
    lines: [
      f => `${n(f.openIssues)} open issues + PRs. Somewhere in there is a bug report still waiting for "will look into it".`,
      f => `${n(f.openIssues)} things open. The issue tracker is less a to-do list, more a cry for help.`,
    ],
    fix: f => `${n(f.openIssues)} open issues/PRs: do a triage session, close duplicates, label "good first issue" and let actions/stale handle the zombies.`,
  },
  {
    key: 'issueRatio', test: f => f.openIssues >= 20 && f.openIssues <= 200 && f.stars > 0 && f.openIssues / f.stars > 0.3, pts: 6, fixP: 26,
    lines: [
      f => `${n(f.openIssues)} open issues/PRs for ${n(f.stars)} stars. More people are reporting bugs than liking it. Bold.`,
    ],
    fix: f => `Your open-issue/star ratio is ${(f.openIssues / f.stars).toFixed(2)}: close or label the stale ones and pin a roadmap issue so contributors know what matters.`,
  },
  {
    key: 'lonely', test: f => !f.empty && f.stars === 0 && f.forks === 0, pts: 5, fixP: 40,
    lines: [
      f => `0 stars, 0 forks. Not even you starred it. Self-love starts at home.`,
      f => `Zero stars, zero forks. ${f.fullName} is the quiet kid in the back of GitHub.`,
    ],
    fix: f => `0 stars usually means 0 context: add a description, a screenshot/GIF and topics so ${f.name} is discoverable.`,
  },
  {
    key: 'noDescription', test: f => !f.empty && !f.description, pts: 4, fixP: 14,
    lines: [
      () => `No repo description. The "About" box is as empty as the test folder.`,
      () => `The repo has no description. Mysterious. Edgy. Unclickable.`,
    ],
    fix: () => 'Add a one-line description in the repo\'s "About" settings (gear icon on the repo page). It is the first thing anyone reads.',
  },
  {
    key: 'noTopics', test: f => !f.empty && (!f.topics || !f.topics.length) && f.stars < 1000, pts: 2, fixP: 35,
    lines: [() => `Zero topics. Even GitHub search doesn't know what this is.`],
    fix: () => 'Add 3-5 topics (About -> gear icon) so people searching GitHub can actually find the repo.',
  },
  {
    key: 'badName', test: f => badName(f.name), pts: 3, fixP: 50,
    lines: [
      f => `A repo named "${f.name}". Nothing says "production-ready" like a name that sounds like a file on your desktop.`,
      f => `"${f.name}". Naming things is one of the two hard problems, and you chose violence.`,
    ],
    fix: f => `Consider renaming "${f.name}" to describe what it does (Settings -> Repository name). GitHub redirects the old URL.`,
  },
  {
    key: 'fork', test: f => f.isFork, pts: 3, fixP: 45,
    lines: [f => `It's a fork of ${f.parent || 'someone else\'s repo'}. You didn't write the bugs, you adopted them.`],
    fix: f => `If this fork diverged from ${f.parent || 'upstream'}, say so in the README; if not, open a PR upstream instead of maintaining a copy.`,
  },
  {
    key: 'languageZoo', test: f => Object.keys(f.languages || {}).length >= 8, pts: 4, fixP: 60,
    lines: [f => `${Object.keys(f.languages).length} languages in one repo. This isn't a codebase, it's the Tower of Babel with a Makefile.`],
    fix: () => 'Document the role of each language in the README (or a docs/ARCHITECTURE.md) so newcomers know where to start.',
  },
  {
    key: 'noCode', test: f => f.tree && f.tree.fileCount > 0 && !f.codeBytes, pts: 10, fixP: 13,
    lines: [
      f => `GitHub detected zero bytes of code in ${files(f.tree.fileCount)}. It's not a software project, it's a text file with ambitions.`,
      f => `No programming language detected. Can't have bugs if you don't have code. Galaxy brain.`,
    ],
    fix: f => `Push the actual code (or rename/describe ${f.name} as docs-only in the About box) so people know what they're looking at.`,
  },
  {
    key: 'tinyRepo', test: f => f.tree && f.tree.fileCount > 0 && f.tree.fileCount < 5, pts: 6, fixP: 15,
    lines: [f => `${files(f.tree.fileCount)} total. That's not a repo, that's a gist with delusions of grandeur.`],
    fix: f => `With only ${files(f.tree.fileCount)}, add the basics that make it reusable: README with usage, LICENSE and a .gitignore.`,
  },
];

// Things that LOWER the Crash Score (real signals of a healthy project)
const BONUSES = [
  { key: 'mega', test: f => f.stars >= 10000, pts: -12 },
  { key: 'popular', test: f => f.stars >= 1000 && f.stars < 10000, pts: -6 },
  { key: 'fresh', test: f => f.daysSincePush !== null && f.daysSincePush <= 14 && !f.archived, pts: -4 },
  { key: 'testsAndCI', test: f => f.tree && f.tree.hasTests && f.tree.hasCI, pts: -6 },
  { key: 'contributing', test: f => f.tree && f.tree.hasContributing, pts: -2 },
  { key: 'security', test: f => f.tree && f.tree.hasSecurity, pts: -1 },
];

const BASE = 30;

// Lines for when there's little bad to say (healthy repos)
const PRAISE = [
  f => `${n(f.stars)} stars, last push ${f.daysSincePush === 0 ? 'today' : span(f.daysSincePush) + ' ago'}${f.tree && f.tree.hasTests ? ', tests present' : ''}. I came to roast and I'm leaving with impostor syndrome.`,
  f => `I looked for something to roast in ${f.fullName} and segfaulted myself. ${n(f.stars)} stars and ${n(f.forks)} forks can't all be wrong.`,
  f => `${n(f.forks)} forks. Half the internet has copied this code. The other half is waiting for the next release.`,
  f => `Honestly? ${f.fullName} is in decent shape. My roast module returned NULL. Filing a bug against myself.`,
];
const OPENERS = {
  0: ['Clean exit (code 0).', 'Process exited normally. Suspicious.', 'No crash detected. Yet.'],
  1: ['Warning: unused variable "quality".', 'Compiled with warnings.', 'Minor leaks detected.'],
  2: ['Undefined behavior detected.', 'Stack smashing detected.', 'Something is very wrong in here.'],
  3: ['Memory leak in progress.', 'Kernel panic: not syncing.', 'Out of memory, out of excuses.'],
  4: ['Segmentation fault (core dumped).', 'SIGSEGV received.', 'Fatal error: repo integrity not found.'],
};
const VERDICTS = ['Runs clean (suspiciously)', 'Compiled with warnings', 'Undefined behavior', 'Memory leak', 'Segmentation fault (core dumped)'];
const band = s => s < 20 ? 0 : s < 40 ? 1 : s < 60 ? 2 : s < 80 ? 3 : 4;

function roastRepo(f) {
  const seed = f.fullName.toLowerCase();
  const hits = SIGNALS.filter(s => { try { return !!s.test(f); } catch { return false; } });
  const bonus = BONUSES.filter(b => { try { return !!b.test(f); } catch { return false; } });
  let score = f.empty ? 100 : BASE + hits.reduce((a, s) => a + s.pts, 0) + bonus.reduce((a, b) => a + b.pts, 0);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const b = band(score);

  // Roast = up to 2 lines from the heaviest real signals (or a praise line).
  const ranked = [...hits].sort((a, z) => z.pts - a.pts || a.fixP - z.fixP);
  const lines = ranked.slice(0, 2).map(s => pick(s.lines, seed + s.key)(f));
  if (!lines.length || (score < 25 && lines.length < 2)) lines.push(pick(PRAISE, seed + 'praise')(f));
  const opener = pick(OPENERS[b], seed + 'open');
  const roast = lines.join(' ');

  // One concrete fix: the most urgent fixable signal
  const fixSig = [...hits].sort((a, z) => a.fixP - z.fixP)[0];
  let fix;
  if (fixSig) fix = fixSig.fix(f);
  else if (f.tree && !f.tree.hasSecurity) fix = 'Add a SECURITY.md telling people how to report vulnerabilities privately (GitHub: Security tab -> "Set up a security policy").';
  else if (f.tree && !f.tree.hasContributing) fix = 'Add a CONTRIBUTING.md (setup, test command, PR rules) so new contributors don\'t have to guess.';
  else fix = 'Enable Dependabot (`.github/dependabot.yml`) so dependency and security updates arrive as PRs automatically.';

  // Evidence = the real data the roast is based on (shown to the user, used on the card)
  const t = f.tree || {};
  const tl = topLang(f);
  const evidence = [
    ['stars', n(f.stars)], ['forks', n(f.forks)], ['open issues+PRs', n(f.openIssues)],
    ['last push', f.daysSincePush === null ? '?' : f.daysSincePush === 0 ? 'today' : `${span(f.daysSincePush)} ago`],
    ['license', f.license ? (f.license.spdx && f.license.spdx !== 'NOASSERTION' ? f.license.spdx : f.license.name) : 'none'],
    ['top language', tl ? `${tl.name} (${tl.pct}%)` : 'n/a'],
    ['README', t.hasReadme ? bytes(t.readmeSize) : f.tree ? 'missing' : 'n/a'],
    ['tests', t.hasTests === true ? 'found' : t.hasTests === false ? 'none' : 'not checked (top-level scan)'],
    ['CI', t.hasCI === true ? (t.ciName || 'yes') : t.hasCI === false ? 'none' : 'unknown'],
    ['files scanned', f.tree ? `${n(t.fileCount)}${t.recursive ? (t.truncated ? ' (tree truncated)' : '') : ' (top level only, huge repo)'}` : '0'],
  ];
  if (f.archived) evidence.push(['archived', 'yes']);
  if (f.partial && f.partial.length) evidence.push(['partial scan', `GitHub quota ran out: no ${f.partial.join(' / ')}`]);

  return {
    repo: f.fullName, url: f.url, score, verdict: VERDICTS[b], band: b,
    opener, roast, fix,
    signals: hits.map(s => ({ key: s.key, pts: s.pts })),
    bonuses: bonus.map(x => ({ key: x.key, pts: x.pts })),
    evidence,
  };
}

module.exports = { roastRepo, SIGNALS, VERDICTS };
