/**
 * build-showcase.mjs
 * ----------------------------------------------------------------
 * Composes every Matrix section SVG + the daily Pac-Man graph into
 * ONE animated loop that plays each section in sequence.
 *
 * Output: profile/showcase.svg
 *
 * The source sections keep their original look (same palette, rain,
 * glow, scanline, Courier terminal). Their one-shot intro animations
 * are re-timed onto a single master cycle so every section replays
 * its boot sequence each loop. The Pac-Man graph plays last.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const readText = (path) => readFileSync(new URL(path, root), "utf8");

/* ------------------------------------------------------------------ */
/*  small helpers                                                     */
/* ------------------------------------------------------------------ */

const fmt = (n) => String(Math.round(n * 10000) / 10000);
const clamp01 = (n) => Math.min(1, Math.max(0, n));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function attrs(source) {
  const out = {};
  for (const m of source.matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function secs(value) {
  const m = String(value || "").trim().match(/^(-?[\d.]+)(ms|s)?$/);
  if (!m) return 0;
  return Number(m[1]) * (m[2] === "ms" ? 0.001 : 1);
}

function splitList(value) {
  return String(value)
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v !== "");
}

function keyTimes(list) {
  let prev = -1;
  const out = [];
  for (const raw of list) {
    let n = clamp01(Number(raw));
    if (n <= prev) n = prev + 0.000001;
    if (n > 1) n = 1;
    out.push(fmt(n));
    prev = n;
  }
  return out.join(";");
}

/* ------------------------------------------------------------------ */
/*  master timeline                                                   */
/* ------------------------------------------------------------------ */

const PAD = 0.45; // fade breathing room at the start/end of a scene
const STAGE = { x: 60, y: 78, w: 1080, h: 490 };
const WIDTH = 1200;
const HEIGHT = 640;

const SCENES = [
  { num: "01", label: "WAKE UP", kind: "file", file: "assets/matrix-banner.svg", dur: 3.8, removeBg: true },
  { num: "02", label: "WHITE RABBIT", kind: "file", file: "assets/matrix-typing.svg", dur: 7.0, removeBg: true },
  { num: "03", label: "BOOT SEQUENCE", kind: "file", file: "assets/matrix-boot.svg", dur: 4.8, removeBg: true },
  { num: "04", label: "ABOUT ME", kind: "about", dur: 4.8 },
  { num: "05", label: "TECH STACK", kind: "file", file: "assets/matrix-tech.svg", dur: 4.8, removeBg: true },
  { num: "06", label: "PROFILE STATS", kind: "file", file: "profile/stats.svg", dur: 4.8, removeBg: true },
  { num: "07", label: "ACTIVITY", kind: "file", file: "profile/activity.svg", dur: 4.8, removeBg: true },
  { num: "08", label: "TROPHIES", kind: "file", file: "assets/matrix-trophies.svg", dur: 4.8, removeBg: true },
  { num: "09", label: "PROJECTS", kind: "projects", dur: 5.8 },
  { num: "10", label: "ROADMAP", kind: "file", file: "assets/matrix-roadmap.svg", dur: 4.8, removeBg: true },
  { num: "11", label: "DAILY QUOTE", kind: "file", file: "profile/quote.svg", dur: 5.8, removeBg: true },
  { num: "12", label: "CONNECT", kind: "connect", dur: 4.0 },
  { num: "13", label: "REFERENCES", kind: "file", file: "assets/matrix-references.svg", dur: 4.0, removeBg: true },
  { num: "14", label: "SHUTDOWN", kind: "file", file: "assets/matrix-footer.svg", dur: 4.0, removeBg: true },
  { num: "15", label: "PAC-MAN // LAST LEVEL", kind: "pacman", dur: 8.0 },
];

let clock = 0;
for (const scene of SCENES) {
  scene.start = clock;
  clock += scene.dur;
}
const CYCLE = clock;

/* ------------------------------------------------------------------ */
/*  source-SVG sanitising                                             */
/* ------------------------------------------------------------------ */

const RAIN_GROUP =
  /<g>\s*<animateTransform\b[^>]*\btype="translate"[^>]*\bvalues="-?\d+ 0;0 0"[^>]*\/>[\s\S]*?<\/g>\s*<\/g>/g;

const FADE_RECT =
  /<rect\b[^>]*\bfill="url\(#[^)]*fade[^)]*\)"[^>]*\/>/g;

function extractInner(svg) {
  let inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  inner = inner.replace(/<desc>[\s\S]*?<\/desc>/g, "");
  inner = inner.replace(/<metadata>[\s\S]*?<\/metadata>/g, "");
  inner = inner.replace(/<title>[\s\S]*?<\/title>/g, "");
  return inner;
}

function viewBoxOf(svg) {
  // Only trust the root <svg> tag. Some sources (e.g. the Pac-Man graph)
  // have no root viewBox, and the first viewBox in the file belongs to a
  // <symbol> sprite — using it would scale the whole scene wrong.
  const open = svg.match(/<svg\b[^>]*>/i);
  const tag = open ? open[0] : "";
  const vb = tag.match(/\bviewBox="([^"]+)"/);
  if (vb) return vb[1].split(/[\s,]+/).map(Number);
  const width = Number((tag.match(/\bwidth="([\d.]+)"/) || [])[1]);
  const height = Number((tag.match(/\bheight="([\d.]+)"/) || [])[1]);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return [0, 0, width, height];
  }
  return [0, 0, 1200, 540];
}

function removeFirstFullBleed(inner) {
  return inner.replace(/<rect\b[^>]*\bfill="#000000"[^>]*\/>/, "");
}

function prefixIds(inner, prefix) {
  return inner
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
    .replace(/(\b(?:xlink:)?href)="#([^"]+)"/g, (_, attr, id) => `${attr}="#${prefix}-${id}"`);
}

function cssDelays(inner) {
  const style = inner.match(/<style>([\s\S]*?)<\/style>/);
  const b = {};
  if (!style) return b;
  for (const m of style[1].matchAll(
    /\.(b\d+)\s*\{\s*animation:\s*q-in\s+([\d.]+)s\s+linear\s+([\d.]+)s\s+both;?\s*\}/g,
  )) {
    b[m[1]] = { dur: Number(m[2]), delay: Number(m[3]) };
  }
  return b;
}

function measureSpan(inner) {
  let span = 0;
  for (const m of inner.matchAll(/<animate\b([^>]*)>/g)) {
    const a = attrs(m[1]);
    if (a.begin && a.fill === "freeze" && a.dur) {
      span = Math.max(span, secs(a.begin) + secs(a.dur));
    }
  }
  for (const value of inner.matchAll(/animation-delay:\s*([\d.]+)s/g)) {
    span = Math.max(span, Number(value[1]) + 0.8);
  }
  const delays = cssDelays(inner);
  for (const d of Object.values(delays)) span = Math.max(span, d.delay + d.dur);
  return span || 1;
}

function mapTime(t, start, scale, cycle) {
  return clamp01((start + t * scale) / cycle);
}

function opacityAnimation(delay, duration, start, scale, cycle) {
  const t0 = mapTime(delay, start, scale, cycle);
  const t1 = mapTime(delay + duration, start, scale, cycle);
  return `<animate attributeName="opacity" values="0;0;1;1" keyTimes="${keyTimes([0, t0, t1, 1])}" dur="${fmt(cycle)}s" repeatCount="indefinite"/>`;
}

function transformCssAnimations(inner, { start, scale, cycle }) {
  const style = inner.match(/<style>([\s\S]*?)<\/style>/);
  if (!style) return inner;

  const delays = cssDelays(inner);
  let out = inner.replace(style[0], "");

  // Activity heat-map cells -------------------------------------------------
  out = out.replace(
    /<rect\b([^>]*?)\sclass="([^"]*)"([^>]*?)(\/?)>/g,
    (full, pre, cls, post, selfClose) => {
      const classes = cls.split(/\s+/).filter(Boolean);
      if (!classes.includes("cell")) return full;
      const isPop = classes.includes("pop");
      const delayMatch = `${pre} ${post}`.match(/animation-delay:\s*([\d.]+)s/);
      const delay = delayMatch ? Number(delayMatch[1]) : 0.3;
      let clean = `${pre} ${post}`
        .replace(/\sstyle="[^"]*"/g, "")
        .replace(/\sopacity="[^"]*"/g, "");
      if (isPop) {
        const t0 = mapTime(delay, start, scale, cycle);
        const t1 = mapTime(delay + 0.8, start, scale, cycle);
        return `<rect${clean} opacity="1"><animate attributeName="opacity" values="0.15;0.15;1;1" keyTimes="${keyTimes([0, t0, t1, 1])}" dur="${fmt(cycle)}s" repeatCount="indefinite"/></rect>`;
      }
      return `<rect${clean} opacity="0.25"${selfClose}>`;
    },
  );

  // Class-based reveal (.b0 … .b8) + blinking cursor ----------------------
  out = out.replace(
    /<([a-zA-Z][\w:-]*)([^>]*?)\sclass="([^"]*)"([^>]*?)(\/?)>/g,
    (full, tag, pre, cls, post, selfClose) => {
      const classes = cls.split(/\s+/).filter(Boolean);
      if (classes.includes("cell")) return full;

      let animate = "";
      const reveal = classes.find((c) => /^b\d+$/.test(c));
      if (reveal && delays[reveal]) {
        animate += opacityAnimation(
          delays[reveal].delay,
          delays[reveal].dur,
          start,
          scale,
          cycle,
        );
      }
      if (classes.includes("cur")) {
        animate += `<animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" begin="${fmt(start)}s"/>`;
      }

      const rest = classes.filter((c) => c !== "cur" && !/^b\d+$/.test(c));
      const classAttr = rest.length ? ` class="${rest.join(" ")}"` : "";
      if (animate) {
        if (selfClose) return `<${tag}${pre}${classAttr}${post}>${animate}</${tag}>`;
        return `<${tag}${pre}${classAttr}${post}>${animate}`;
      }
      return `<${tag}${pre}${classAttr}${post}${selfClose}>`;
    },
  );

  return out;
}

function transformOneShotAnimations(inner, { start, scale, cycle }) {
  return inner.replace(/<animate\b([^>]*?)\/?>/g, (full, raw) => {
    const a = attrs(raw);
    if (!a.begin || a.fill !== "freeze" || !a.dur) return full;
    if (a.repeatCount && a.repeatCount !== "1") return full;

    const begin = secs(a.begin);
    const duration = secs(a.dur);
    let values;
    let times;

    if (a.values != null) {
      const source = splitList(a.values);
      const sourceTimes = a.keyTimes
        ? splitList(a.keyTimes).map(Number)
        : source.map((_, i) => (source.length === 1 ? 0 : i / (source.length - 1)));
      const mapped = sourceTimes.map((k) => mapTime(begin + k * duration, start, scale, cycle));
      values = [source[0], ...source, source[source.length - 1]];
      times = [0, ...mapped, 1];
    } else {
      const from = a.from != null ? a.from : "0";
      const to = a.to != null ? a.to : "1";
      values = [from, from, to, to];
      times = [0, mapTime(begin, start, scale, cycle), mapTime(begin + duration, start, scale, cycle), 1];
    }

    // Drop duplicated keyTimes, keeping the later value.
    const keep = [];
    for (let i = 0; i < values.length; i++) {
      if (i === 0 || times[i] > times[keep[keep.length - 1]]) keep.push(i);
      else keep[keep.length - 1] = i;
    }

    const out = {
      attributeName: a.attributeName,
      values: keep.map((i) => values[i]).join(";"),
      keyTimes: keyTimes(keep.map((i) => times[i])),
      dur: `${fmt(cycle)}s`,
      repeatCount: "indefinite",
    };
    if (a.calcMode) out.calcMode = a.calcMode;
    if (a.additive) out.additive = a.additive;

    return `<animate ${Object.entries(out)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ")}/>`;
  });
}

function sanitize(inner, options) {
  const {
    prefix,
    start,
    scale,
    cycle,
    removeBg = false,
    removeRain = false,
    removeFades = false,
  } = options;

  let out = inner;
  out = transformCssAnimations(out, { start, scale, cycle });
  out = transformOneShotAnimations(out, { start, scale, cycle });
  // SMIL only understands "indefinite" (some source files say "infinite").
  out = out.replace(/repeatCount="infinite"/g, 'repeatCount="indefinite"');
  if (removeRain) out = out.replace(RAIN_GROUP, "");
  if (removeBg) out = removeFirstFullBleed(out);
  if (removeFades) out = out.replace(FADE_RECT, "");
  out = prefixIds(out, prefix);
  return out;
}

/* ------------------------------------------------------------------ */
/*  scene builders                                                    */
/* ------------------------------------------------------------------ */

function sceneWindow(scene) {
  return scene.dur - PAD * 2;
}

function fileScene(scene, prefix, index) {
  const raw = readText(scene.file);
  const vb = viewBoxOf(raw);
  let inner = extractInner(raw);
  const span = measureSpan(inner);
  const start = scene.start + PAD;
  const window = sceneWindow(scene);
  inner = sanitize(inner, {
    prefix,
    start,
    scale: window / span,
    cycle: CYCLE,
    removeBg: scene.removeBg,
    removeRain: true,
    removeFades: true,
  });
  return { content: inner, viewBox: vb.join(" "), index };
}

function aboutScene(scene, prefix) {
  const window = sceneWindow(scene);

  const avatarRaw = readText("assets/matrix-avatar.svg");
  const avatar = sanitize(extractInner(avatarRaw), {
    prefix: `${prefix}-avatar`,
    start: scene.start + PAD,
    scale: 1,
    cycle: CYCLE,
  });

  const aboutRaw = readText("assets/matrix-about.svg");
  const aboutVb = viewBoxOf(aboutRaw);
  const aboutInner = extractInner(aboutRaw);
  const aboutSpan = measureSpan(aboutInner);
  const aboutStart = scene.start + PAD + 0.2;
  const about = sanitize(aboutInner, {
    prefix: `${prefix}-about`,
    start: aboutStart,
    scale: (window - 0.2) / aboutSpan,
    cycle: CYCLE,
    removeBg: true,
    removeRain: true,
    removeFades: true,
  });

  return {
    viewBox: "0 0 1200 540",
    content: `
      <svg x="32" y="190" width="154" height="154" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">${avatar}</svg>
      <svg x="215" y="110" width="945" height="320" viewBox="${aboutVb.join(" ")}" preserveAspectRatio="xMidYMid meet">${about}</svg>`,
  };
}

function projectsScene(scene, prefix) {
  const cards = [
    "matrix-profile.svg",
    "matrix-portfolio.svg",
    "matrix-rentalhub.svg",
    "matrix-pcstore.svg",
  ];
  const positions = [
    [60, 0],
    [620, 0],
    [60, 290],
    [620, 290],
  ];
  const window = sceneWindow(scene);
  const stagger = 0.22;

  const content = cards
    .map((file, i) => {
      const raw = readText(`assets/projects/${file}`);
      const vb = viewBoxOf(raw);
      const inner = extractInner(raw);
      const span = measureSpan(inner);
      const start = scene.start + PAD + i * stagger;
      const duration = window - i * stagger;
      const svg = sanitize(inner, {
        prefix: `${prefix}-c${i}`,
        start,
        scale: duration / span,
        cycle: CYCLE,
      });
      return `<svg x="${positions[i][0]}" y="${positions[i][1]}" width="520" height="250" viewBox="${vb.join(" ")}" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
    })
    .join("\n");

  return { viewBox: "0 0 1200 540", content };
}

function connectScene(scene, prefix) {
  const badges = [
    "github",
    "linkedin",
    "x",
    "email",
    "proton",
    "portfolio",
    "leetcode",
    "codeforces",
    "devto",
  ];
  const content = badges
    .map((name, i) => {
      const raw = readText(`assets/badges/${name}.svg`);
      const vb = viewBoxOf(raw);
      const inner = sanitize(extractInner(raw), {
        prefix: `${prefix}-b${i}`,
        start: scene.start + PAD,
        scale: 1,
        cycle: CYCLE,
      });
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 195 + col * 280;
      const y = 152 + row * 90;
      return `<svg x="${x}" y="${y}" width="250" height="55" viewBox="${vb.join(" ")}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
    })
    .join("\n");
  return { viewBox: "0 0 1200 540", content };
}

function pacmanScene(scene, prefix, pacmanSvg) {
  if (!pacmanSvg) {
    return {
      viewBox: "0 0 1200 540",
      content: `<g font-family="'Courier New', Consolas, monospace" text-anchor="middle">
        <text x="600" y="255" font-size="22" fill="#00a32a">[ OFFLINE ]</text>
        <text x="600" y="292" font-size="16" fill="#006b2e">pac-man graph unavailable — the next run will retry</text>
        <text x="600" y="322" font-size="14" fill="#00ff41">&#9608;</text>
      </g>`,
    };
  }

  const vb = viewBoxOf(pacmanSvg);
  let inner = extractInner(pacmanSvg);
  inner = inner.replace(/<rect\b[^>]*width="100%"[^>]*height="100%"[^>]*fill="#0d1117"[^>]*\/>/, "");
  inner = inner.replace(
    /<(animate(?:Transform|Motion)?)\b([^>]*?)(\/?)>/g,
    (full, tag, raw, selfClose) => {
      if (/\bbegin=/.test(raw)) return full;
      return `<${tag}${raw} begin="${fmt(scene.start + PAD)}s"${selfClose}>`;
    },
  );
  inner = prefixIds(inner, prefix);
  return { viewBox: vb.join(" "), content: inner };
}

/* ------------------------------------------------------------------ */
/*  background, chrome, scene wrapper                                 */
/* ------------------------------------------------------------------ */

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

function globalRain() {
  const rows = Math.max(8, Math.floor((HEIGHT - 40) / 17));
  return RAIN.map(([x, dur, begin]) => {
    const glyphs = [];
    for (let r = 0; r < rows; r++) {
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
      glyphs.push(`<text x="0" y="${16 + r * 17}" fill="${fill}" opacity="${opacity}">${ch}</text>`);
    }
    return `<g><animateTransform attributeName="transform" type="translate" values="-235 0;0 0" dur="${dur}" repeatCount="indefinite" begin="${begin}"/><g transform="translate(${x} 24)">${glyphs.join("")}</g></g>`;
  }).join("\n");
}

function sceneOpacity(scene) {
  const S = scene.start / CYCLE;
  const E = (scene.start + scene.dur) / CYCLE;
  const fade = 0.4 / CYCLE;

  if (scene.start === 0) {
    return {
      values: "1;1;0;0",
      keyTimes: keyTimes([0, Math.max(0, E - fade), E, 1]),
    };
  }
  if (scene.start + scene.dur >= CYCLE - 1e-6) {
    return {
      values: "0;0;1;1",
      keyTimes: keyTimes([0, S, Math.min(1, S + fade), 1]),
    };
  }
  return {
    values: "0;0;1;1;0;0",
    keyTimes: keyTimes([0, S, Math.min(1, S + fade), Math.max(0, E - fade), E, 1]),
  };
}

function wrapScene(scene, piece) {
  const opacity = sceneOpacity(scene);
  return `<g opacity="0">
    <animate attributeName="opacity" values="${opacity.values}" keyTimes="${opacity.keyTimes}" dur="${fmt(CYCLE)}s" repeatCount="indefinite"/>
    <text x="60" y="68" font-family="'Courier New', Consolas, monospace" font-size="15" letter-spacing="4" fill="#00a32a"><tspan fill="#00ff41">[ ${scene.num} ]</tspan> ${esc(scene.label)}</text>
    <svg x="${STAGE.x}" y="${STAGE.y}" width="${STAGE.w}" height="${STAGE.h}" viewBox="${piece.viewBox}" preserveAspectRatio="xMidYMid meet">${piece.content}</svg>
  </g>`;
}

async function loadPacman() {
  const fromEnv = process.env.PACMAN_SVG;
  if (fromEnv && existsSync(fromEnv)) return readFileSync(fromEnv, "utf8");

  const local = new URL("profile/pacman-contribution-graph-dark.svg", root);
  if (existsSync(local)) return readFileSync(local, "utf8");

  try {
    const url = `https://raw.githubusercontent.com/Dhyanesh006/Dhyanesh006/output/pacman-contribution-graph-dark.svg?cb=${Date.now()}`;
    const res = await fetch(url);
    if (res.ok) return await res.text();
    console.warn(`pac-man fetch -> ${res.status}; using placeholder`);
  } catch (err) {
    console.warn(`pac-man fetch failed: ${err.message}; using placeholder`);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  compose                                                           */
/* ------------------------------------------------------------------ */

const pacmanSvg = await loadPacman();

const scenes = SCENES.map((scene, index) => {
  const prefix = `s${String(index + 1).padStart(2, "0")}`;
  let piece;
  switch (scene.kind) {
    case "about":
      piece = aboutScene(scene, prefix);
      break;
    case "projects":
      piece = projectsScene(scene, prefix);
      break;
    case "connect":
      piece = connectScene(scene, prefix);
      break;
    case "pacman":
      piece = pacmanScene(scene, prefix, pacmanSvg);
      break;
    default:
      piece = fileScene(scene, prefix, index);
  }
  return wrapScene(scene, piece);
}).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Matrix profile showcase — every section animated in one loop, ending with the Pac-Man contribution graph">
  <defs>
    <filter id="g-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="g-fade-top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.75"/>
      <stop offset="9%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="g-fade-bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="90%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.75"/>
    </linearGradient>
    <linearGradient id="g-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00420f" stop-opacity="0"/>
      <stop offset="50%" stop-color="#00a32a" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#00420f" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000000"/>
  <g font-family="'Courier New', Consolas, monospace" font-size="14">
${globalRain()}
  </g>

  <rect x="0" y="0" width="${WIDTH}" height="28" fill="#00ff41" opacity="0.045">
    <animate attributeName="y" from="-28" to="${HEIGHT}" dur="7s" repeatCount="indefinite"/>
  </rect>

  <g id="g-scenes">
${scenes}
  </g>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g-fade-top)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g-fade-bottom)"/>

  <g font-family="'Courier New', Consolas, monospace">
    <text x="60" y="34" font-size="15" letter-spacing="5" fill="#00a32a"><tspan fill="#00ff41">MATRIX</tspan> <tspan fill="#006b2e">//</tspan> PROFILE</text>
    <text x="1140" y="34" text-anchor="end" font-size="12" letter-spacing="3" fill="#006b2e">ONE LOOP · ALL SYSTEMS GREEN</text>
    <line x1="60" y1="48" x2="1140" y2="48" stroke="url(#g-line)" stroke-width="1.5" opacity="0.8"/>

    <text x="60" y="612" font-size="12" letter-spacing="3" fill="#006b2e">&gt; one terminal session · every section · pac-man takes the last level</text>
    <text x="1140" y="612" text-anchor="end" font-size="12" letter-spacing="3" fill="#006b2e">LOOP ${fmt(CYCLE)}s</text>
    <line x1="60" y1="624" x2="1140" y2="624" stroke="#00420f" stroke-width="2"/>
    <rect x="60" y="621" width="90" height="6" fill="#00ff41" opacity="0.9" filter="url(#g-glow)">
      <animate attributeName="x" from="60" to="1050" dur="${fmt(CYCLE)}s" repeatCount="indefinite"/>
    </rect>
  </g>
</svg>
`;

const out = new URL("profile/showcase.svg", root);
let previous = "";
try {
  previous = readFileSync(out, "utf8");
} catch {
  /* first build */
}

if (previous === svg) {
  console.log(`showcase unchanged (${(svg.length / 1024).toFixed(1)} KiB, ${fmt(CYCLE)}s loop, ${SCENES.length} scenes)`);
} else {
  writeFileSync(out, svg);
  console.log(`showcase written (${(svg.length / 1024).toFixed(1)} KiB, ${fmt(CYCLE)}s loop, ${SCENES.length} scenes)`);
}
