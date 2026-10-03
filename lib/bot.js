// Command router for the $SEGFAULT terminal.
const crypto = require('crypto');
const { parseRepo, fetchRepoFacts, rate } = require('./github');
const { roastRepo } = require('./roast');
const { debugError, looksLikeError } = require('./debug');
const kb = require('./kb');
const llm = require('./llm');
const store = require('./store');

const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

const HELP = [
  'Available commands:',
  '  /roast <repo>     roast a public GitHub repo (URL or owner/repo)',
  '  /debug <error>    paste an error / stack trace, get cause + fix',
  '  /shame            Hall of Shame (worst Crash Scores so far)',
  '  /about            what is $SEGFAULT?',
  '  /ca               contract address (CA) + pump.fun link',
  '  /tokenomics       tokenomics',
  '  /roadmap          spoiler: there is none',
  '  /score            how the Crash Score works',
  '  /status           GitHub API quota + engine status',
  '  /clear            clear the terminal',
  'Or just paste a repo URL, a stack trace, or ask a question.',
];

// ---------- easter eggs ----------
const EGGS = [
  { re: /^sudo\b/i, a: () => ['[sudo] password for you: ********', 'Sorry, user is not in the sudoers file. This incident will be reported.', '(to @SegfaultDevBot. He will laugh.)'] },
  { re: /rm\s+-rf\s+\/(\s|$|\*)|rm -rf --no-preserve-root/i, a: () => ['rm: it is dangerous to operate recursively on \'/\'', 'Nice try. I deleted your Crash Score instead. Just kidding, it\'s still bad.'] },
  { re: /^(:q!?|:wq!?|:x|exit vim|how (do i|to) (exit|quit) vim|esc :q)$/i, a: () => ['E37: No write since last change (add ! to override)', 'Congratulations, you are one of the 0.01% who escaped vim. Achievement unlocked: "I can leave whenever I want".'] },
  { re: /^(exit|quit|logout|bye)$/i, a: () => ['logout', 'Connection to segfault closed.', '...just kidding. There is no escape. Type /help.'] },
  { re: /^git push (-f|--force)/i, a: () => ['To github.com:you/prod.git', ' + 3f2a1b9...0000000 main -> main (forced update)', 'Your coworkers\' last 3 days of work have been "optimized". Use --force-with-lease, you monster.'] },
  { re: /^(npm (i|install)|yarn add|pnpm add)\b/i, a: () => ['added 1,337 packages, and audited 1,338 packages in 42s', '87 vulnerabilities (12 low, 40 moderate, 35 critical)', 'Run `npm audit fix --force` to make it worse.'] },
  { re: /^(ls|ls -la|dir)$/i, a: () => ['drwxr-xr-x  roasts/', '-rw-r--r--  your_code.c', '-rw-------  core   (2.1 GB)', '-rw-r--r--  excuses.txt  (empty, you used them all)'] },
  { re: /^whoami$/i, a: () => ['someone who is about to get their repo roasted.'] },
  { re: /^(pwd)$/i, a: () => ['/dev/null/your/career'] },
  { re: /^(hello,? world!?|print\(?["']?hello world["']?\)?|console\.log\(["']hello world["']\))$/i, a: () => ['Hello, World!', 'Segmentation fault (core dumped)', 'Impressive. You crashed hello world.'] },
  { re: /^(make me a sandwich|sudo make me a sandwich)$/i, a: () => ['What? Make it yourself.', '(xkcd 149 reference acknowledged)'] },
  { re: /^(42|what is the meaning of life\??)$/i, a: () => ['42. Also the number of TODOs in your codebase. Coincidence?'] },
  { re: /^(ping)$/i, a: () => ['PING segfault (127.0.0.1): 56 data bytes', '64 bytes: icmp_seq=0 ttl=64 time=0.042 ms', 'pong. I\'m alive. Unlike your repo\'s commit history.'] },
  { re: /^(coffee|brew coffee)$/i, a: () => ['HTTP 418 I\'m a teapot.'] },
  { re: /^(segfault|segmentation fault)$/i, a: () => ['Segmentation fault (core dumped)', 'You said my name three times... no wait, once. I\'m still here. Type /help.'] },
  { re: /^(matrix|the matrix)$/i, a: () => ['Wake up, Neo...', 'The Matrix has you.', 'Also it has no tests.'] },
  { re: /^(drop table|drop database|'; ?drop table)/i, a: () => ['Little Bobby Tables, we meet again. Inputs here are data, not SQL. Nothing was dropped.'] },
  { re: /^(:\(\)\{ ?:\|:& ?\};:)$/, a: () => ['Fork bomb detected. I\'m a single-threaded bot, you can\'t hurt me. (Please don\'t run that anywhere real.)'] },
  { re: /^(hack|hack the planet|i'?m in)$/i, a: () => ['ACCESS GRANTED... to absolutely nothing. This is a roast bot.'] },
  { re: /(seed phrase|private key|mnemonic)/i, a: () => ['NEVER share a seed phrase or private key with anyone, including me. Nobody from $SEGFAULT will ever ask for it. If someone does: scam. Block, report, move on.'] },
];

function newId() { return crypto.randomBytes(5).toString('hex'); }

function shareText(r) {
  // X counts most chars as 1, emoji as 2, URLs as 23. Keep total <= 250.
  const head = `${r.repo} just got roasted by the $SEGFAULT terminal. Crash Score: ${r.score}/100`;
  const tail = `Roast your repo too, @SegfaultDevBot`;
  const urlCost = PUBLIC_URL ? 24 : 0;
  const budget = 248 - head.length - tail.length - urlCost - 6;
  let quote = r.roast.replace(/`/g, '');
  if (quote.length > budget) quote = quote.slice(0, Math.max(0, budget - 3)).replace(/\s+\S*$/, '') + '...';
  let text = `${head}\n"${quote}"\n${tail}`;
  return { text, url: PUBLIC_URL ? `${PUBLIC_URL}/r/${r.id}` : null, length: text.length + urlCost };
}

function intentUrl(share) {
  const p = new URLSearchParams({ text: share.text });
  if (share.url) p.set('url', share.url);
  return 'https://x.com/intent/tweet?' + p.toString();
}

function rateLimitMsg(e) {
  const mins = e.resetAt ? Math.max(1, Math.ceil((e.resetAt - Date.now()) / 60000)) : 60;
  return [
    'ERR 429: GitHub says I\'ve roasted too hard this hour (60 unauthenticated requests/hour).',
    `My API quota resets in ~${mins} min. Cached repos still work - try one from the Hall of Shame (/shame).`,
    'Meanwhile: paste a stack trace for /debug, or ask me about $SEGFAULT.',
  ];
}

async function doRoast(input) {
  const ref = parseRepo(input);
  if (!ref) return { type: 'text', lines: ['Usage: /roast <github-url | owner/repo>', 'Example: /roast torvalds/linux'] , cls: 'warn' };
  let facts, cache;
  try {
    ({ facts, cache } = await fetchRepoFacts(ref.owner, ref.repo));
  } catch (e) {
    if (e.code === 'RATE_LIMIT') return { type: 'error', code: 'RATE_LIMIT', lines: rateLimitMsg(e), resetAt: e.resetAt };
    if (e.code === 'NOT_FOUND') return { type: 'error', code: 'NOT_FOUND', lines: [`404: ${ref.owner}/${ref.repo} not found.`, 'Either it doesn\'t exist, it\'s private, or you typo\'d it. I only roast public repos.'] };
    return { type: 'error', code: e.code || 'ERR', lines: [`Could not fetch the repo: ${e.message}`, 'Try again in a minute.'] };
  }
  const r = roastRepo(facts);
  const record = { id: newId(), ...r, createdAt: Date.now(), dataFetchedAt: facts.fetchedAt, cache };
  record.share = shareText(record);
  record.shareUrl = intentUrl(record.share);
  store.saveRoast(record);
  return { type: 'roast', roast: record, cardUrl: `/api/card/${record.id}.png` };
}

function doDebug(text) {
  if (!text || !text.trim()) return { type: 'text', lines: ['Paste your error or stack trace after /debug, or just paste it directly.', 'Example: /debug TypeError: Cannot read properties of undefined (reading \'map\')'] };
  return { type: 'debug', debug: debugError(text) };
}

function kbAnswer(id) {
  const map = { about: 'what is segfault', ca: 'what is the ca', tokenomics: 'tokenomics', roadmap: 'roadmap', score: 'how does the crash score work' };
  return kb.answer(map[id]);
}

async function handle(raw) {
  const msg = String(raw || '').trim().slice(0, 20000);
  if (!msg) return { type: 'text', lines: ['Say something. Even "segfault" works.'] };

  // slash commands
  const m = msg.match(/^\/(\w+)\s*([\s\S]*)$/);
  if (m) {
    const [, cmd, arg] = m;
    switch (cmd.toLowerCase()) {
      case 'help': case 'h': case 'commands': return { type: 'text', lines: HELP, cls: 'help' };
      case 'roast': case 'r': return doRoast(arg);
      case 'debug': case 'd': return doDebug(arg);
      case 'shame': case 'leaderboard': case 'hall': return { type: 'shame', shame: store.hallOfShame(10), stats: store.stats() };
      case 'about': case 'ca': case 'tokenomics': case 'roadmap': case 'score': {
        const a = kbAnswer(cmd.toLowerCase());
        return { type: 'text', lines: a.lines, source: 'kb:' + a.id, actions: a.actions };
      }
      case 'status': return {
        type: 'text', lines: [
          `GitHub API: ${rate.remaining === null ? 'not used yet this session' : `${rate.remaining}/${rate.limit} requests left`}${rate.resetAt ? `, resets ${new Date(rate.resetAt).toLocaleTimeString('en-GB', { timeZone: process.env.TZ || 'Europe/Zurich' })}` : ''}`,
          `Engine: rule-based${llm.provider ? ` + ${llm.provider} for free-form questions` : ' (no LLM key set, 100% deterministic)'}`,
          `Roasts served: ${store.stats().roastsServed}`,
        ],
      };
      case 'clear': case 'cls': return { type: 'clear' };
      default: return { type: 'text', lines: [`segfault: command not found: /${cmd}`, 'Type /help for commands.'], cls: 'warn' };
    }
  }

  for (const egg of EGGS) if (egg.re.test(msg)) return { type: 'text', lines: egg.a(msg), cls: 'egg' };

  // bare repo URL / owner/repo
  const single = !/\s/.test(msg);
  const WORD_PAIRS = /^(and\/or|yes\/no|true\/false|on\/off|he\/him|she\/her|they\/them|input\/output|read\/write|client\/server|w\/o|i\/o|n\/a|tcp\/ip|24\/7)$/i;
  if (single && WORD_PAIRS.test(msg)) return { type: 'text', lines: ['That looks like a word pair, not a repo. Try /roast owner/repo.'], cls: 'warn' };
  if (/github\.com\//i.test(msg) || (single && /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(msg))) {
    const url = (msg.match(/(https?:\/\/)?(www\.)?github\.com\/[^\s)]+/i) || [msg])[0];
    if (parseRepo(url)) return doRoast(url);
  }
  // "roast torvalds/linux"
  const rm = msg.match(/^roast\s+(\S+)/i);
  if (rm && parseRepo(rm[1])) return doRoast(rm[1]);

  // stack trace / error
  if ((msg.includes('\n') || msg.length > 25 || /error|exception|fault/i.test(msg)) && looksLikeError(msg) && !/\?\s*$/.test(msg)) return doDebug(msg);

  const a = kb.answer(msg);
  if (a) return { type: 'text', lines: a.lines, source: 'kb:' + a.id, actions: a.actions };

  const free = await llm.llmAnswer(msg);
  if (free) return { type: 'text', lines: free.split(/\n+/), source: 'llm:' + llm.provider };

  return {
    type: 'text', lines: [
      'I\'m a roast bot, not an oracle. I didn\'t understand that one.',
      'Try: a GitHub repo (e.g. expressjs/express), a pasted stack trace, or questions like "what is $SEGFAULT?", "is it safe?", "what\'s the CA?". /help lists everything.',
    ], cls: 'warn',
  };
}

module.exports = { handle, shareText, intentUrl };
