import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const quotes = JSON.parse(readFileSync(new URL("quotes.json", root), "utf8"));

const now = new Date();
const ist = new Date(now.getTime() + 5.5 * 3600000);
const start = new Date(Date.UTC(ist.getUTCFullYear(), 0, 0));
const day = Math.floor((ist - start) / 86400000);
const q = quotes[day % quotes.length];

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const RAIN = [
  [38, "11.29s", "-1.26s"],
  [113, "10.12s", "-3.48s"],
  [188, "8.07s", "-2.60s"],
  [263, "7.68s", "-6.32s"],
  [338, "9.93s", "-0.71s"],
  [413, "7.33s", "-2.38s"],
  [488, "10.52s", "-6.20s"],
  [563, "7.71s", "-6.51s"],
  [638, "8.53s", "-4.44s"],
  [713, "8.02s", "-6.76s"],
  [788, "11.60s", "-7.37s"],
  [863, "11.50s", "-3.82s"],
  [938, "10.72s", "-4.69s"],
  [1013, "10.96s", "-9.61s"],
  [1088, "9.16s", "-3.10s"],
  [1163, "9.92s", "-5.96s"],
];

const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const rain = RAIN.map(([x, dur, begin]) => {
  const glyphs = [];
  for (let r = 0; r < 14; r++) {
    const ch = POOL[(x * 7 + r * 13) % POOL.length];
    let fill;
    let opacity;
    if (r < 5) {
      fill = "#006b2e";
      opacity = "0.3";
    } else if (r < 10) {
      fill = "#00a32a";
      opacity = "0.45";
    } else if (r < 13) {
      fill = "#00e640";
      opacity = "0.6";
    } else {
      fill = "#00ff41";
      opacity = "0.8";
    }
    glyphs.push(
      `      <text x="0" y="${16 + r * 17}" fill="${fill}" opacity="${opacity}">${ch}</text>`,
    );
  }
  return `    <g>
      <animateTransform attributeName="transform" type="translate" values="-235 0;0 0" dur="${dur}" repeatCount="indefinite" begin="${begin}"/>
      <g transform="translate(${x} 36)">
${glyphs.join("\n")}
      </g>
    </g>`;
}).join("\n");

const sourceTag = q.source
  ? ` <tspan fill="#006b2e">(${esc(q.source)})</tspan>`
  : "";

const bootLog = [
  `<text x="70" y="0" class="b0" font-family="'Courier New', Consolas, monospace" font-size="17" opacity="1">
      <tspan fill="#00ff41">$</tspan> <tspan fill="#00e640">cat daily-quote.dat</tspan>
    </text>`,
  `<text x="70" y="24" class="b1" font-family="'Courier New', Consolas, monospace" font-size="17" opacity="1">
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">accessing the oracle</tspan> <tspan fill="#006b2e">......</tspan>
    </text>`,
  `<text x="70" y="48" class="b2" font-family="'Courier New', Consolas, monospace" font-size="17" opacity="1">
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#d4fdd9">&#8220;${esc(q.text)}&#8221;</tspan>
    </text>`,
  `<text x="70" y="72" class="b3" font-family="'Courier New', Consolas, monospace" font-size="17" opacity="1">
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">attribution</tspan> <tspan fill="#00ff41">${esc(q.by)}</tspan>${sourceTag}
    </text>`,
  `<text x="70" y="96" class="b4" font-family="'Courier New', Consolas, monospace" font-size="17" opacity="1">
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">quote locked in memory</tspan> <tspan fill="#006b2e">.......</tspan>
      <tspan fill="#00ff41" class="cur">&#9608;</tspan>
    </text>`,
].join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 1200 288" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Matrix terminal boot log with daily quote">
  <defs>
    <style>
      @keyframes q-in { from { opacity: 0; } to { opacity: 1; } }
      .b0 { animation: q-in 0.35s linear 0.5s both; }
      .b1 { animation: q-in 0.35s linear 1.2s both; }
      .b2 { animation: q-in 0.35s linear 2s both; }
      .b3 { animation: q-in 0.35s linear 2.8s both; }
      .b4 { animation: q-in 0.35s linear 3.6s both; }
      @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
      .cur { animation: blink 1s steps(1, end) 4.2s infinite; }
    </style>
    <filter id="q-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="q-fade-top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.85"/>
      <stop offset="30%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="q-fade-bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="70%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="q-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00420f" stop-opacity="0"/>
      <stop offset="50%" stop-color="#00a32a" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#00420f" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="288" fill="#000000"/>

  <g font-family="'Courier New', Consolas, monospace">
${rain}
  </g>

  <rect x="0" y="0" width="1200" height="31" fill="#00ff41" opacity="0.045">
    <animate attributeName="y" from="-31" to="288" dur="7s" repeatCount="indefinite"/>
  </rect>

  <g filter="url(#q-glow)" transform="translate(0 41)">
${bootLog}
    <text x="70" y="168" font-family="'Courier New', Consolas, monospace" font-size="13" letter-spacing="5" fill="#006b2e" opacity="0.8">
      &gt; the oracle has spoken &#8212; see you next boot.
    </text>
  </g>

  <line x1="160" y1="392" x2="1040" y2="392" stroke="url(#q-line)" stroke-width="1.5" opacity="0.8"/>
  <text x="600" y="266" text-anchor="middle" font-family="'Courier New', Consolas, monospace" font-size="14" letter-spacing="10" fill="#00a32a">
    <tspan fill="#00ff41">MATRIX</tspan> <tspan fill="#006b2e">//</tspan> <tspan fill="#00a32a">DAILY QUOTE</tspan>
  </text>

  <rect width="1200" height="288" fill="url(#q-fade-top)"/>
  <rect width="1200" height="288" fill="url(#q-fade-bottom)"/>
</svg>
`;

const svgPath = new URL("profile/quote.svg", root);
let svgChanged = false;
try {
  if (readFileSync(svgPath, "utf8") !== svg) {
    writeFileSync(svgPath, svg);
    svgChanged = true;
  }
} catch {
  writeFileSync(svgPath, svg);
  svgChanged = true;
}

const block = [
  `<p align="center">`,
  `  <img src="profile/quote.svg" alt="Daily Matrix boot-log quote" width="100%" />`,
  `</p>`,
].join("\n");

const readmePath = new URL("README.md", root);
const readme = readFileSync(readmePath, "utf8");

const startMarker = "<!-- QUOTE:START -->";
const endMarker = "<!-- QUOTE:END -->";
const s = readme.indexOf(startMarker);
const e = readme.indexOf(endMarker);
if (s === -1 || e === -1 || e < s) {
  console.error("ERROR: QUOTE markers not found in README");
  process.exit(1);
}

const newBlock = startMarker + "\n" + block + "\n  " + endMarker;
const readmeChanged = readme.slice(s, e + endMarker.length) !== newBlock;

if (readmeChanged) {
  const updated = readme.slice(0, s) + newBlock + readme.slice(e + endMarker.length);
  writeFileSync(readmePath, updated);
}

if (!svgChanged && !readmeChanged) {
  console.log("quote unchanged:", q.text, "—", q.by);
} else {
  console.log("quote updated:", q.text, "—", q.by);
}
process.exit(0);
