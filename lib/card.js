// Renders a shareable roast card (1200x630, OG/X size) as SVG -> PNG via resvg.
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const FONTS = [path.join(FONT_DIR, 'DejaVuSansMono.ttf'), path.join(FONT_DIR, 'DejaVuSansMono-Bold.ttf')];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
// Card has no emoji font: strip non-BMP/emoji to avoid tofu boxes
const clean = s => String(s).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/`/g, '');

function wrap(text, width, maxLines) {
  const words = clean(text).split(/\s+/);
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) { lines.push(cur.trim()); cur = w; }
    else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,3}$/, '...'); }
  return lines;
}

const LOGO = `
  <line x1="512" y1="210" x2="512" y2="130" stroke="#ff4d6d" stroke-width="26" stroke-linecap="round"/>
  <circle cx="512" cy="112" r="34" fill="#ff9f1c"/>
  <rect x="192" y="200" width="640" height="560" rx="150" fill="url(#face)"/>
  <rect x="262" y="290" width="500" height="380" rx="90" fill="#0b0d12"/>
  <g stroke="#ff4d6d" stroke-width="34" stroke-linecap="round">
    <line x1="340" y1="380" x2="430" y2="470"/><line x1="430" y1="380" x2="340" y2="470"/>
    <line x1="594" y1="380" x2="684" y2="470"/><line x1="684" y1="380" x2="594" y2="470"/>
  </g>
  <rect x="452" y="560" width="120" height="30" rx="8" fill="#ff9f1c"/>
  <path d="M770 222 L728 268 L758 292 L716 336" fill="none" stroke="#0b0d12" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;

function cardSvg(r) {
  const W = 1200, H = 630;
  const scoreColor = r.score >= 80 ? '#ff4d6d' : r.score >= 60 ? '#ff7a45' : r.score >= 40 ? '#ff9f1c' : r.score >= 20 ? '#ffd166' : '#4ade80';
  const roastLines = wrap(r.roast, 50, 6);
  const fixLines = wrap('fix> ' + r.fix, 62, 3);
  const date = new Date(r.createdAt).toISOString().slice(0, 10);
  const repo = r.repo.length > 38 ? r.repo.slice(0, 36) + '..' : r.repo;
  const gaugeW = 300, filled = Math.round(gaugeW * r.score / 100);
  const ev = (r.evidence || []).filter(e => ['stars', 'last push', 'tests', 'CI', 'README', 'license'].includes(e[0])).slice(0, 6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14101a"/><stop offset="1" stop-color="#07080c"/></linearGradient>
  <linearGradient id="face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d6d"/><stop offset="1" stop-color="#ff9f1c"/></linearGradient>
  <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff4d6d"/><stop offset="1" stop-color="#ff9a3c"/></linearGradient>
  <radialGradient id="glow" cx="0.85" cy="0.2" r="0.6"><stop offset="0" stop-color="#ff4d6d" stop-opacity="0.28"/><stop offset="1" stop-color="#ff4d6d" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="22" fill="#0b0d12" fill-opacity="0.82" stroke="#2a2f3f"/>
<rect x="24" y="24" width="${W - 48}" height="46" rx="22" fill="#10131a"/><rect x="24" y="50" width="${W - 48}" height="20" fill="#10131a"/>
<circle cx="54" cy="47" r="7" fill="#ff5f57"/><circle cx="76" cy="47" r="7" fill="#febc2e"/><circle cx="98" cy="47" r="7" fill="#28c840"/>
<text x="124" y="53" font-family="DejaVu Sans Mono" font-size="17" fill="#9aa1b2">segfault@terminal:~$ roast ${esc(repo)}</text>
<line x1="24" y1="70" x2="${W - 24}" y2="70" stroke="#2a2f3f"/>

<g transform="translate(60 92) scale(0.085)">${LOGO}</g>
<text x="140" y="130" font-family="DejaVu Sans Mono" font-weight="bold" font-size="34" fill="url(#grad)">$SEGFAULT</text>
<text x="140" y="156" font-family="DejaVu Sans Mono" font-size="16" fill="#9aa1b2">the AI that roasts your code until it crashes</text>

<text x="60" y="222" font-family="DejaVu Sans Mono" font-size="18" fill="#9aa1b2">repo</text>
<text x="60" y="256" font-family="DejaVu Sans Mono" font-weight="bold" font-size="30" fill="#eef0f5">${esc(repo)}</text>

${roastLines.map((l, i) => `<text x="60" y="${312 + i * 34}" font-family="DejaVu Sans Mono" font-size="24" fill="#e7e9ef">${i === 0 ? '<tspan fill="#ff4d6d" font-weight="bold">&gt; </tspan>' : '  '}${esc(l)}</text>`).join('\n')}

${fixLines.map((l, i) => `<text x="60" y="${516 + i * 24}" font-family="DejaVu Sans Mono" font-size="17" fill="${i === 0 ? '#4ade80' : '#9be7b5'}">${esc(l)}</text>`).join('\n')}

<g transform="translate(830 92)">
  <rect width="320" height="400" rx="18" fill="#12151e" stroke="#2a2f3f"/>
  <text x="160" y="44" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="17" fill="#9aa1b2" letter-spacing="3">CRASH SCORE</text>
  <text x="160" y="160" text-anchor="middle" font-family="DejaVu Sans Mono" font-weight="bold" font-size="112" fill="${scoreColor}">${r.score}</text>
  <text x="160" y="194" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="20" fill="#9aa1b2">/ 100</text>
  <rect x="10" y="214" width="${gaugeW}" height="14" rx="7" fill="#1b1f2b"/>
  <rect x="10" y="214" width="${Math.max(filled, 14)}" height="14" rx="7" fill="url(#grad)"/>
  <text x="160" y="258" text-anchor="middle" font-family="DejaVu Sans Mono" font-weight="bold" font-size="${r.verdict.length > 24 ? 13 : 16}" fill="#ff9f1c">${esc(r.verdict)}</text>
  ${ev.map((e, i) => `<text x="22" y="${296 + i * 18}" font-family="DejaVu Sans Mono" font-size="13" fill="#9aa1b2">${esc(e[0])}:</text><text x="298" y="${296 + i * 18}" text-anchor="end" font-family="DejaVu Sans Mono" font-size="13" fill="#d4d7e0">${esc(String(e[1]).replace(/ \(.*$/, "").slice(0, 22))}</text>`).join('')}
</g>

<text x="${W - 60}" y="${H - 36}" text-anchor="end" font-family="DejaVu Sans Mono" font-size="15" fill="#6b7285">@SegfaultDevBot · ${date} · based on public GitHub API data</text>
</svg>`;
}

function renderCard(r) {
  const svg = cardSvg(r);
  const resvg = new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans Mono' }, fitTo: { mode: 'original' } });
  return resvg.render().asPng();
}

module.exports = { renderCard, cardSvg };
