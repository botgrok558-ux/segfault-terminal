// $SEGFAULT knowledge base (source: ../concept.md, 2 Oct 2026) + intent matcher.
// Honesty rules: coin NOT launched, no CA yet, no promises, not financial advice.
const X = '@SegfaultDevBot';
const X_URL = 'https://x.com/SegfaultDevBot';

const FACTS = {
  status: 'NOT launched yet. There is no contract address (CA) yet.',
  ca: `CA: coming soon. The only valid CA will be posted by ${X} on X (and on this site). Anything else is a fake.`,
};

const INTENTS = [
  {
    id: 'what', kw: ['what is', 'whats', 'what\'s', 'explain', 'about', 'segfault coin', 'meme coin', 'project', 'tell me'], strong: ['what is segfault', 'what is $segfault', 'what is this', 'what are you'],
    answer: [
      '$SEGFAULT is a Solana meme coin with a bot that actually works: it roasts public GitHub repos (Crash Score 0-100 + one real fix) and debugs stack traces.',
      'Pitch: "The AI that roasts your code until it crashes. Creator fees pay its API bill."',
      `Status: ${FACTS.status} This terminal is the working bot; X replies via ${X} and a Telegram bot are planned.`,
      'It\'s a meme. No intrinsic value, no promises. Not financial advice.',
    ],
  },
  {
    id: 'how', kw: ['how does', 'how do', 'work', 'works', 'bot', 'crash score', 'score', 'calculated', 'roast work', 'engine', 'ai'], strong: ['how does it work', 'how does the bot work', 'how is the crash score', 'how do you work'],
    answer: [
      'How the bot works:',
      '1. /roast <repo>: I call the public GitHub REST API (repo metadata, languages, file tree). I never read file contents, so no .env or secrets.',
      '2. I compute a deterministic Crash Score 0-100 from real signals: README, tests, CI, license, .gitignore, committed node_modules/.env/huge files, last push, open issues, stars...',
      '3. A template library turns the worst signals into a roast and picks ONE concrete fix. Same repo = cached answer (6h), so GitHub\'s 60 req/h limit lasts.',
      '4. /debug: rule-based matching of common errors (segfault, NPE, TypeError, KeyError, CORS, ECONNREFUSED, OOM, Rust borrow errors...) -> likely cause + fix.',
      'Planned for launch: the same bot replying on X and Telegram, with creator fees paying for an LLM API. Roasts target code, never people.',
    ],
  },
  {
    id: 'tokenomics', kw: ['tokenomics', 'supply', 'allocation', 'tax', 'liquidity', 'lp', 'dev buy', 'team tokens', 'distribution', 'burn', 'fees', 'creator fee'], strong: ['tokenomics', 'total supply'],
    answer: [
      'Tokenomics (planned, final values only after launch):',
      '- Launch: fair launch on pump.fun (Solana). Supply: 1,000,000,000 (pump.fun standard).',
      '- Dev buy: TBA, small, and publicly disclosed.',
      '- Creator fees: pump.fun pays the creator a fee on trades (per pump.fun\'s fee docs, May 2026: 0.30% on the bonding curve). Those fees go to the creator wallet and pay the bot\'s API bill, tracked in a public "fuel report".',
      '- By design: NO staking, NO buybacks, NO revenue share, NO token-gating. The bot is free for everyone, holder or not.',
      `- ${FACTS.ca}`,
    ],
  },
  {
    id: 'ca', kw: ['ca', 'contract', 'address', 'mint', 'token address', 'contract address', 'pump.fun link', 'chart', 'dexscreener'], strong: ['contract address', 'what is the ca', 'whats the ca', 'ca?'],
    answer: [
      `${FACTS.status}`,
      FACTS.ca,
      'Heads-up: fake clones with the same ticker are common on pump.fun. Never trust a CA from DMs, replies or random Telegram groups.',
    ],
  },
  {
    id: 'launch', kw: ['when', 'launch', 'launched', 'live', 'release', 'date', 'soon', 'presale', 'whitelist', 'airdrop', 'ido'], strong: ['when launch', 'when is the launch', 'is it live', 'presale', 'airdrop', 'whitelist'],
    answer: [
      `${FACTS.status} No launch date is announced.`,
      'There is no presale, no whitelist and no airdrop. If someone offers you one, it is a scam.',
      `Follow ${X} (${X_URL}) - the launch and the CA will be announced only there.`,
    ],
  },
  {
    id: 'roadmap', kw: ['roadmap', 'plan', 'plans', 'future', 'next', 'milestone', 'phase', 'vision'], strong: ['roadmap'],
    answer: [
      'Roadmap: deliberately none. No roadmap promises, no metaverse.',
      'What exists today: this web terminal (repo roasts, /debug, Hall of Shame, roast cards).',
      `What's planned: the same bot answering mentions on X (${X}) and a Telegram bot, plus a public fuel report (fees in vs. API costs out).`,
      'Everything else is "maybe, if it\'s fun and the fuel lasts".',
    ],
  },
  {
    id: 'safe', kw: ['safe', 'rug', 'rugpull', 'scam', 'legit', 'trust', 'risk', 'honeypot', 'audit', 'secure'], strong: ['is it safe', 'is this a scam', 'rug pull', 'is it a rug'],
    answer: [
      'Honest answer: $SEGFAULT is a meme coin. It has no intrinsic value and no rights to anything. Most pump.fun coins lose almost all their value. You can lose everything you put in.',
      'What is done to be transparent: fair launch on pump.fun, dev buy disclosed, the bot server has no access to any wallet keys, fees and API spend will be reported publicly.',
      `Protect yourself: only use the CA posted by ${X}, never share your seed phrase, nobody from $SEGFAULT will ever DM you first.`,
      'Not financial advice. Only spend what you can afford to lose.',
    ],
  },
  {
    id: 'buy', kw: ['buy', 'purchase', 'get some', 'where to buy', 'how to buy', 'invest', 'exchange', 'raydium', 'jupiter', 'phantom', 'swap', 'trade'], strong: ['how to buy', 'how do i buy', 'where can i buy', 'how can i buy'],
    answer: [
      `You can't buy it: ${FACTS.status}`,
      `When it launches, it will be on pump.fun (Solana). The only valid CA will come from ${X}.`,
      'I won\'t tell you to buy anything. It\'s a meme coin, high risk, not financial advice. The bot is free either way; holding the token gives you nothing extra.',
    ],
  },
  {
    id: 'price', kw: ['price', 'moon', 'pump', '100x', '1000x', 'x100', 'profit', 'returns', 'worth', 'go up', 'rich', 'lambo', 'prediction', 'market cap', 'mcap', 'ath'], strong: ['will it moon', 'price prediction', 'will it go up', 'wen moon', 'wen lambo'],
    answer: [
      'No price talk, no predictions, no promises. Not before launch, not after.',
      '$SEGFAULT is a meme with a working bot, not an investment. It can go to zero. Not financial advice.',
      'If you want something guaranteed to go up: your node_modules folder.',
    ],
  },
  {
    id: 'holder', kw: ['holder', 'holders', 'hold', 'benefit', 'utility', 'perks', 'staking', 'stake', 'reward', 'rewards', 'revenue', 'dividend', 'buyback', 'token gated'], strong: ['what is the utility', 'do holders get', 'staking'],
    answer: [
      'Utility for holders: none, on purpose. No staking, no rewards, no revenue share, no buybacks, no token-gating.',
      'The bot is free for everybody. The only "utility" is that creator fees keep the bot\'s API bill paid.',
    ],
  },
  {
    id: 'fuel', kw: ['fuel', 'fuel report', 'api bill', 'api cost', 'who pays', 'pays', 'funding', 'money'], strong: ['fuel report', 'who pays'],
    answer: [
      'Fuel report: pump.fun creator fees come in, LLM/API costs go out, and the numbers get published (fees claimed, API spent, roasts served, fuel left).',
      `There is no fuel report yet because ${FACTS.status.toLowerCase()} Example math (not a forecast): 0.30% of 10,000 USD volume = 30 USD of fuel.`,
    ],
  },
  {
    id: 'socials', kw: ['twitter', 'x account', 'telegram', 'tg', 'discord', 'social', 'socials', 'community', 'follow', 'website', 'links', 'contact'], strong: ['telegram', 'twitter', 'discord'],
    answer: [
      `X: ${X} -> ${X_URL} (the only official account).`,
      'Telegram: planned, not live yet. Discord: not planned.',
      'This web terminal is the bot you can use right now.',
    ],
  },
  {
    id: 'who', kw: ['who', 'team', 'dev', 'developer', 'founder', 'behind', 'made', 'built', 'creator', 'doxxed'], strong: ['who made this', 'who is behind', 'who is the dev', 'who built'],
    answer: [
      `Built by an indie developer who has read "Segmentation fault (core dumped)" one too many times. Official channel: ${X}.`,
      'No VC, no team allocation, no marketing agency. Just a bot, a meme and a lot of stack traces.',
    ],
  },
  {
    id: 'privacy', kw: ['privacy', 'private repo', 'data', 'secrets', 'store', 'read my code', 'tracking', 'cookies', 'env'], strong: ['private repo', 'do you store', 'privacy'],
    answer: [
      'I only use PUBLIC GitHub data: repo metadata, language stats and the file tree (names + sizes). I never read file contents, so .env files and secrets are never opened.',
      'Private repos are not supported. Roast results (repo name, score, roast) are stored locally for the Hall of Shame. No accounts, no cookies, no tracking.',
    ],
  },
  {
    id: 'chain', kw: ['solana', 'chain', 'blockchain', 'ethereum', 'eth', 'base', 'bsc', 'network', 'sol'], strong: ['which chain', 'what chain'],
    answer: ['Chain: Solana, via a pump.fun launch (planned). Not on Ethereum, Base or BSC. Anything on those chains using the name is not us.'],
  },
  {
    id: 'name', kw: ['name', 'why segfault', 'segmentation', 'meaning', 'ticker', 'logo', 'robot'], strong: ['why segfault', 'what does segfault mean', 'segmentation fault'],
    answer: [
      'A segmentation fault is when a program touches memory it doesn\'t own and the OS kills it: "Segmentation fault (core dumped)". Every developer has seen it, usually at 2am.',
      'The logo is a robot with X eyes and a cracked head: a bot that crashed from reading too much bad code.',
    ],
  },
  {
    id: 'advice', kw: ['financial advice', 'nfa', 'should i', 'is it a good investment', 'legal', 'security token', 'finma', 'mica', 'tax', 'taxes'], strong: ['financial advice', 'should i buy', 'good investment'],
    answer: [
      'Nothing here is financial, investment, legal or tax advice. $SEGFAULT is a meme coin with no expectation of financial return.',
      'Should you buy? I\'m a code-roasting bot; I roast repos, not portfolios. Do your own research and only risk what you can afford to lose.',
    ],
  },
];

const SMALLTALK = [
  { re: /^(hi|hey|hello|yo|gm|hallo|servus|grüezi|sup|hola|good (morning|evening))\b/i, a: ['gm. Paste a GitHub repo and I\'ll tell you what\'s wrong with it. Or type /help.'] },
  { re: /\b(thanks|thank you|thx|danke|merci|ty)\b/i, a: ['You\'re welcome. Your code still isn\'t, though.'] },
  { re: /\b(who are you|what are you|are you (an? )?(ai|bot|human)|your name)\b/i, a: ['I\'m the $SEGFAULT terminal: a bot that roasts GitHub repos and debugs stack traces. Rule-based by default, so I crash deterministically.'] },
  { re: /\b(joke|funny|make me laugh)\b/i, a: ['Why do programmers prefer dark mode? Because light attracts bugs. ... I\'ll see myself out (exit code 0).', 'There are 10 kinds of people: those who understand binary, and those whose repo I just roasted.'] },
  { re: /\b(love you|you('re| are) (great|awesome|cool|funny))\b/i, a: ['Flattery will not lower your Crash Score.'] },
  { re: /\b(stupid|dumb|useless|sucks|trash)\b/i, a: ['Bold words from someone whose repo I haven\'t roasted yet. Try /roast <your-repo>.'] },
];

function norm(s) { return ' ' + String(s).toLowerCase().replace(/[^a-z0-9$.?'\s/-]/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }

function matchIntent(q) {
  const s = norm(q);
  let best = null, bestScore = 0;
  for (const it of INTENTS) {
    let score = 0;
    for (const p of it.strong) if (s.includes(' ' + p.replace(/[^a-z0-9$.?'\s/-]/g, '') .trim())) score += 5;
    for (const k of it.kw) {
      const re = new RegExp(`(^|\\s|\\$)${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|\\?|$|s\\b)`);
      if (re.test(s)) score += k.includes(' ') ? 2 : 1;
    }
    if (score > bestScore) { bestScore = score; best = it; }
  }
  return bestScore >= 1 ? { intent: best, confidence: bestScore } : null;
}

function answer(q) {
  for (const st of SMALLTALK) if (st.re.test(q)) return { id: 'smalltalk', lines: [st.a[String(q).length % st.a.length]] };
  const m = matchIntent(q);
  if (!m) return null;
  return { id: m.intent.id, confidence: m.confidence, lines: m.intent.answer };
}

// Plain-text KB for the optional LLM system prompt
function kbText() {
  return INTENTS.map(i => `[${i.id}] ${i.answer.join(' ')}`).join('\n');
}

module.exports = { answer, matchIntent, kbText, X, X_URL };
