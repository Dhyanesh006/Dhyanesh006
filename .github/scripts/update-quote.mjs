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

const KATA =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
const POOL = KATA + "0123456789ABCDEF";

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
      `      <text x="0" y="${13 + r * 14}" fill="${fill}" opacity="${opacity}">${ch}</text>`,
    );
  }
  return `    <g>
      <animateTransform attributeName="transform" type="translate" values="-196 0;0 0" dur="${dur}" repeatCount="indefinite" begin="${begin}"/>
      <g transform="translate(${x} 30)">
${glyphs.join("\n")}
      </g>
    </g>`;
}).join("\n");

const sourceTag = q.source
  ? ` <tspan fill="#006b2e">(${esc(q.source)})</tspan>`
  : "";

const bootLog = [
  `<text x="70" y="0" font-family="'Courier New', Consolas, monospace" font-size="14" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.35s" begin="0.5s" fill="freeze"/>
      <tspan fill="#00ff41">$</tspan> <tspan fill="#00e640">cat daily-quote.dat</tspan>
    </text>`,
  `<text x="70" y="20" font-family="'Courier New', Consolas, monospace" font-size="14" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.35s" begin="1.2s" fill="freeze"/>
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">accessing the oracle</tspan> <tspan fill="#006b2e">......</tspan>
    </text>`,
  `<text x="70" y="40" font-family="'Courier New', Consolas, monospace" font-size="14" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.35s" begin="2s" fill="freeze"/>
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#d4fdd9">&#8220;${esc(q.text)}&#8221;</tspan>
    </text>`,
  `<text x="70" y="60" font-family="'Courier New', Consolas, monospace" font-size="14" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.35s" begin="2.8s" fill="freeze"/>
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">attribution</tspan> <tspan fill="#00ff41">${esc(q.by)}</tspan>${sourceTag}
    </text>`,
  `<text x="70" y="80" font-family="'Courier New', Consolas, monospace" font-size="14" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.35s" begin="3.6s" fill="freeze"/>
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">quote locked in memory</tspan> <tspan fill="#006b2e">.......</tspan>
      <tspan fill="#00ff41">&#9608;<animate attributeName="opacity" values="1;0;1" keyTimes="0;0.5;1" dur="0.9s" begin="4.2s" repeatCount="indefinite"/></tspan>
    </text>`,
].join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Matrix terminal boot log with daily quote">
  <defs>
    <filter id="q-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur"/>
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

  <rect width="1200" height="240" fill="#000000"/>

  <g font-family="'Courier New', Consolas, monospace">
${rain}
  </g>

  <rect x="0" y="0" width="1200" height="26" fill="#00ff41" opacity="0.045">
    <animate attributeName="y" from="-26" to="240" dur="7s" repeatCount="indefinite"/>
  </rect>

  <g filter="url(#q-glow)" transform="translate(0 34)">
${bootLog}
    <text x="70" y="140" font-family="'Courier New', Consolas, monospace" font-size="11" letter-spacing="4" fill="#006b2e" opacity="0">
      <animate attributeName="opacity" from="0" to="0.8" dur="0.6s" begin="4.4s" fill="freeze"/>
      &gt; the oracle has spoken &#8212; see you next boot.
    </text>
  </g>

  <line x1="160" y1="196" x2="1040" y2="196" stroke="url(#q-line)" stroke-width="1.5" opacity="0.8"/>
  <text x="600" y="222" text-anchor="middle" font-family="'Courier New', Consolas, monospace" font-size="12" letter-spacing="8" fill="#00a32a">
    <tspan fill="#00ff41">MATRIX</tspan> <tspan fill="#006b2e">//</tspan> <tspan fill="#00a32a">DAILY QUOTE</tspan>
  </text>

  <rect width="1200" height="240" fill="url(#q-fade-top)"/>
  <rect width="1200" height="240" fill="url(#q-fade-bottom)"/>
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
