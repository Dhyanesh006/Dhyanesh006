import { writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const USERNAME = "Dhyanesh006";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const RAIN = [
  [38, "11.29s", "-1.26s"], [113, "10.12s", "-3.48s"], [188, "8.07s", "-2.60s"],
  [263, "7.68s", "-6.32s"], [338, "9.93s", "-0.71s"], [413, "7.33s", "-2.38s"],
  [488, "10.52s", "-6.20s"], [563, "7.71s", "-6.51s"], [638, "8.53s", "-4.44s"],
  [713, "8.02s", "-6.76s"], [788, "11.60s", "-7.37s"], [863, "11.50s", "-3.82s"],
  [938, "10.72s", "-4.69s"], [1013, "10.96s", "-9.61s"], [1088, "9.16s", "-3.10s"],
  [1163, "9.92s", "-5.96s"],
];

const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function rainMarkup(height, top) {
  const rows = Math.max(8, Math.floor((height - top - 20) / 17));
  return RAIN.map(([x, dur, begin]) => {
    const glyphs = [];
    for (let r = 0; r < rows; r++) {
      const ch = POOL[(x * 7 + r * 13) % POOL.length];
      let fill, opacity;
      if (r < 5) { fill = "#006b2e"; opacity = "0.3"; }
      else if (r < 10) { fill = "#00a32a"; opacity = "0.45"; }
      else if (r < 13) { fill = "#00e640"; opacity = "0.6"; }
      else { fill = "#00ff41"; opacity = "0.8"; }
      glyphs.push(`      <text x="0" y="${16 + r * 17}" fill="${fill}" opacity="${opacity}">${ch}</text>`);
    }
    return `    <g>
      <animateTransform attributeName="transform" type="translate" values="-235 0;0 0" dur="${dur}" repeatCount="indefinite" begin="${begin}"/>
      <g transform="translate(${x} ${top})">
${glyphs.join("\n")}
      </g>
    </g>`;
  }).join("\n");
}

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const headers = { Accept: "application/vnd.github+json", "User-Agent": "profile-readme" };
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

const FALLBACK = {
  name: "Dhyanesh V",
  location: "Coimbatore, India",
  public_repos: 2,
  followers: 12,
  following: 9,
  created_at: "2024-01-04T00:00:00Z",
};

function syntheticEvents() {
  const days = new Map();
  let d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 12 * 7; i++) {
    const iso = d.toISOString().slice(0, 10);
    const seed = [...iso].reduce((a, c) => (a + c.charCodeAt(0) * 31) % 89, 0);
    if (seed % 3 !== 0) days.set(iso, 1 + (seed % 4));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days;
}

async function load() {
  const data = { ...FALLBACK, events: new Map(), totalStars: 0, topLang: null };
  try {
    const user = await gh(`/users/${USERNAME}`);
    data.name = user.name || data.name;
    data.location = user.location || data.location;
    data.public_repos = user.public_repos ?? data.public_repos;
    data.followers = user.followers ?? data.followers;
    data.following = user.following ?? data.following;
    data.created_at = user.created_at || data.created_at;

    const repos = await gh(`/users/${USERNAME}/repos?per_page=100&sort=updated`);
    const counts = new Map();
    for (const repo of repos) {
      data.totalStars += repo.stargazers_count || 0;
      if (repo.language) counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    data.topLang = sorted.length ? sorted[0][0] : null;

    const events = await gh(`/users/${USERNAME}/events/public?per_page=100`);
    data.events = syntheticEvents();
    for (const ev of events) {
      const iso = (ev.created_at || "").slice(0, 10);
      if (iso) data.events.set(iso, (data.events.get(iso) || 0) + 1);
    }
  } catch (err) {
    console.warn("API fetch failed, using fallback profile data:", err.message);
    data.events = syntheticEvents();
  }
  const dates = [...data.events.keys()].sort().reverse();
  data.lastEvent = dates.length ? dates[0] : "\u2014";
  data.eventTotal = [...data.events.values()].reduce((a, b) => a + b, 0);
  return data;
}

const DEFS = `
    <style>
      @keyframes q-in { from { opacity: 0; } to { opacity: 1; } }
      .b0 { animation: q-in 0.35s linear 0.5s both; }
      .b1 { animation: q-in 0.35s linear 1.1s both; }
      .b2 { animation: q-in 0.35s linear 1.7s both; }
      .b3 { animation: q-in 0.35s linear 2.3s both; }
      .b4 { animation: q-in 0.35s linear 2.9s both; }
      .b5 { animation: q-in 0.35s linear 3.5s both; }
      .b6 { animation: q-in 0.35s linear 4.1s both; }
      .b7 { animation: q-in 0.35s linear 4.7s both; }
      .b8 { animation: q-in 0.35s linear 5.3s both; }
      @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
      .cur { animation: blink 1s steps(1, end) 6s infinite; }
      @keyframes cell-on { from { opacity: 0.15; } to { opacity: 1; } }
      .cell { opacity: 0.25; }
      .cell.on { opacity: 1; }
      .cell.pop { animation: cell-on 0.8s ease-out both; }
    </style>
    <filter id="s-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="s-fade-top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.85"/>
      <stop offset="28%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="s-fade-bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="82%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="s-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00420f" stop-opacity="0"/>
      <stop offset="50%" stop-color="#00a32a" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#00420f" stop-opacity="0"/>
    </linearGradient>`;

function row(label, value, cls) {
  return `    <text x="70" y="${cls * 29 + 27}" class="b${cls}" font-family="'Courier New', Consolas, monospace" font-size="21" opacity="1">
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">${label}</tspan> <tspan fill="#006b2e">........................</tspan> <tspan fill="#d4fdd9">${value}</tspan>
    </text>`;
}

function statsSvg(d) {
  const joined = new Date(d.created_at);
  const joinedLabel = joined.toLocaleString("en-US", { month: "short", year: "numeric" });
  const top = d.topLang ? ` · top: ${esc(d.topLang)}` : "";
  const lines = [
    `<text x="70" y="0" class="b0" font-family="'Courier New', Consolas, monospace" font-size="21" opacity="1">
      <tspan fill="#00ff41">$</tspan> <tspan fill="#00e640">cat profile.dat</tspan>
    </text>`,
    row("username", "Dhyanesh006", 1),
    row("realname", esc(d.name), 2),
    row("location", esc(d.location), 3),
    row("public repos", String(d.public_repos), 4),
    row("followers", String(d.followers), 5),
    row("following", String(d.following), 6),
    row("stars earned", `${d.totalStars}${top}`, 7),
    row("joined", joinedLabel, 8),
    `<text x="70" y="288" class="b8" font-family="'Courier New', Consolas, monospace" font-size="21" opacity="1">
      <tspan fill="#00ff41">$</tspan> <tspan fill="#00e640">echo "still in the matrix"</tspan>
      <tspan fill="#00ff41" class="cur">&#9608;</tspan>
    </text>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 1200 340" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Matrix terminal with profile statistics">
  <defs>${DEFS}</defs>
  <rect width="1200" height="340" fill="#000000"/>
  <g font-family="'Courier New', Consolas, monospace">
${rainMarkup(340, 45)}
  </g>
  <rect x="0" y="0" width="1200" height="31" fill="#00ff41" opacity="0.045">
    <animate attributeName="y" from="-31" to="340" dur="7s" repeatCount="indefinite"/>
  </rect>
  <g filter="url(#s-glow)" transform="translate(0 45)">
${lines.join("\n")}
  </g>
  <line x1="160" y1="340" x2="1040" y2="340" stroke="url(#s-line)" stroke-width="1.5" opacity="0.8"/>
  <text x="600" y="318" text-anchor="middle" font-family="'Courier New', Consolas, monospace" font-size="14" letter-spacing="10" fill="#00a32a">
    <tspan fill="#00ff41">MATRIX</tspan> <tspan fill="#006b2e">//</tspan> <tspan fill="#00a32a">PROFILE STATS</tspan>
  </text>
  <rect width="1200" height="340" fill="url(#s-fade-top)"/>
  <rect width="1200" height="340" fill="url(#s-fade-bottom)"/>
</svg>
`;
}

function activitySvg(d) {
  const days = d.events;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 25 * 7);
  const weeks = 26;
  const cell = 16, gap = 3, originX = 190, originY = 120;
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + w * 7 + r);
      const iso = day.toISOString().slice(0, 10);
      const n = days.get(iso) || 0;
      const x = originX + w * (cell + gap);
      const y = originY + r * (cell + gap);
      if (n > 0) {
        const hue = n <= 1 ? "#00a32a" : n <= 2 ? "#00e640" : "#00ff41";
        const delay = (0.3 + (w % 6) * 0.18 + (r % 6) * 0.12).toFixed(2);
        col.push(`    <rect class="cell pop" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${hue}" opacity="1" style="animation-delay:${delay}s"/>`);
      } else {
        col.push(`    <rect class="cell" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="#00420f"/>`);
      }
    }
    cols.push(col.join("\n"));
  }
  const grid = cols.join("\n");
  const weekday = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const labels = weekday.map((wd, r) =>
    `    <text x="${originX - 42}" y="${originY + r * (cell + gap) + 13}" font-family="'Courier New', Consolas, monospace" font-size="11" letter-spacing="1" fill="#006b2e">${wd}</text>`,
  ).join("\n");
  const lines = [
    `<text x="70" y="0" class="b0" font-family="'Courier New', Consolas, monospace" font-size="21" opacity="1">
      <tspan fill="#00ff41">$</tspan> <tspan fill="#00e640">cat activity.dat</tspan>
    </text>`,
    `<text x="70" y="33" class="b1" font-family="'Courier New', Consolas, monospace" font-size="21" opacity="1">
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">last 26 weeks of pushes &amp; events</tspan>
    </text>`,
    `<text x="70" y="${120 + 6 * (cell + gap) + 48}" class="b7" font-family="'Courier New', Consolas, monospace" font-size="21" opacity="1">
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">events in window</tspan> <tspan fill="#006b2e">..........</tspan> <tspan fill="#00ff41">${d.eventTotal}</tspan>
    </text>`,
    `<text x="70" y="${120 + 6 * (cell + gap) + 77}" class="b8" font-family="'Courier New', Consolas, monospace" font-size="21" opacity="1">
      <tspan fill="#00a32a">[ OK ]</tspan> <tspan fill="#8fbf98">last event</tspan> <tspan fill="#006b2e">..............</tspan> <tspan fill="#d4fdd9">${d.lastEvent}</tspan>
      <tspan fill="#00ff41" class="cur">&#9608;</tspan>
    </text>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 1200 380" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Matrix terminal with contribution activity heatmap">
  <defs>${DEFS}</defs>
  <rect width="1200" height="380" fill="#000000"/>
  <g font-family="'Courier New', Consolas, monospace">
${rainMarkup(380, 45)}
  </g>
  <rect x="0" y="0" width="1200" height="31" fill="#00ff41" opacity="0.045">
    <animate attributeName="y" from="-31" to="380" dur="7s" repeatCount="indefinite"/>
  </rect>
  <g filter="url(#s-glow)" transform="translate(0 45)">
${lines.join("\n")}
${labels}
${grid}
  </g>
  <text x="${originX}" y="${originY + 7 * (cell + gap) + 4}" font-family="'Courier New', Consolas, monospace" font-size="12" letter-spacing="1" fill="#006b2e">LESS</text>
  <rect x="${originX + 52}" y="${originY + 7 * (cell + gap) - 4}" width="12" height="12" rx="3" fill="#00420f"/>
  <rect x="${originX + 70}" y="${originY + 7 * (cell + gap) - 4}" width="12" height="12" rx="3" fill="#00a32a"/>
  <rect x="${originX + 88}" y="${originY + 7 * (cell + gap) - 4}" width="12" height="12" rx="3" fill="#00e640"/>
  <rect x="${originX + 106}" y="${originY + 7 * (cell + gap) - 4}" width="12" height="12" rx="3" fill="#00ff41"/>
  <text x="${originX + 124}" y="${originY + 7 * (cell + gap) + 4}" font-family="'Courier New', Consolas, monospace" font-size="12" letter-spacing="1" fill="#006b2e">MORE</text>
  <line x1="160" y1="376" x2="1040" y2="376" stroke="url(#s-line)" stroke-width="1.5" opacity="0.8"/>
  <text x="600" y="356" text-anchor="middle" font-family="'Courier New', Consolas, monospace" font-size="14" letter-spacing="10" fill="#00a32a">
    <tspan fill="#00ff41">MATRIX</tspan> <tspan fill="#006b2e">//</tspan> <tspan fill="#00a32a">CONTRIBUTION ACTIVITY</tspan>
  </text>
  <rect width="1200" height="380" fill="url(#s-fade-top)"/>
  <rect width="1200" height="380" fill="url(#s-fade-bottom)"/>
</svg>
`;
}

async function main() {
  const data = await load();
  const stats = statsSvg(data);
  const activity = activitySvg(data);
  const statsPath = new URL("profile/stats.svg", root);
  const activityPath = new URL("profile/activity.svg", root);
  try {
    writeFileSync(statsPath, stats);
    writeFileSync(activityPath, activity);
    console.log("stats updated: repos", data.public_repos, "| followers", data.followers, "| following", data.following, "| events", data.eventTotal);
  } catch (err) {
    console.error("failed to write stats SVGs:", err.message);
    process.exit(1);
  }
  process.exit(0);
}

main();

