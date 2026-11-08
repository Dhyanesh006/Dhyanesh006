/**
 * build-showcase.mjs
 * ----------------------------------------------------------------
 * Composes every Matrix section into ONE tall animated SVG.
 *
 * Output: profile/showcase.svg
 *
 * Unlike the old single-stage carousel, this version stacks every
 * section vertically (one below another). All intro lines share one
 * master timeline: sections appear in reading order, each intro
 * finishes on its own clock, and every line stays visible once it
 * has appeared. Decorative loops (rain, cursors, scanlines, Pac-Man)
 * keep playing. Section labels are drawn between the blocks so the
 * single image still reads as the numbered profile.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const readText = (path) => readFileSync(new URL(path, root), "utf8");

/* ------------------------------------------------------------------ */
/*  small helpers                                                     */
/* ------------------------------------------------------------------ */

const fmt = (n) => String(Math.round(n * 10000) / 10000);
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

/* ------------------------------------------------------------------ */
/*  source-SVG sanitising                                             */
/* ------------------------------------------------------------------ */

const RAIN_GROUP =
  /<g>\s*<animateTransform\b[^>]*\btype="translate"[^>]*\bvalues="-?\d+ 0;0 0"[^>]*\/>[\s\S]*?<\/g>\s*<\/g>/g;

const FADE_RECT = /<rect\b[^>]*\bfill="url\(#[^)]*fade[^)]*\)"[^>]*\/>/g;

function extractInner(svg) {
  let inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  inner = inner.replace(/<desc>[\s\S]*?<\/desc>/g, "");
  inner = inner.replace(/<metadata>[\s\S]*?<\/metadata>/g, "");
  inner = inner.replace(/<title>[\s\S]*?<\/title>/g, "");
  return inner;
}

function viewBoxOf(svg) {
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

/* ------------------------------------------------------------------ */
/*  CSS reveal parsing (.b0 … .b8, .cur, heat-map cells)              */
/* ------------------------------------------------------------------ */

function parseCss(inner) {
  const style = inner.match(/<style>([\s\S]*?)<\/style>/);
  const css = style ? style[1] : "";
  const reveals = {};
  for (const m of css.matchAll(
    /\.b(\d+)\s*\{\s*animation:\s*q-in\s+([\d.]+)s\s+linear\s+([\d.]+)s\s+both;?\s*\}/g,
  )) {
    reveals[m[1]] = { dur: Number(m[2]), delay: Number(m[3]) };
  }
  const cur = css.match(
    /\.cur\s*\{\s*animation:\s*blink\s+[\d.]+s\s+steps\(1,\s*end\)\s+([\d.]+)s\s+infinite/,
  );
  const cell = css.match(/\.cell\.pop\s*\{\s*animation:\s*cell-on\s+([\d.]+)s/);
  return {
    reveals,
    curDelay: cur ? Number(cur[1]) : null,
    cellDur: cell ? Number(cell[1]) : 0.8,
    hasStyle: Boolean(style),
  };
}

function measureSpan(inner) {
  let span = 0;
  for (const m of inner.matchAll(/<animate\b([^>]*)>/g)) {
    const a = attrs(m[1]);
    if (a.fill === "freeze" || a.repeatCount === "1") {
      span = Math.max(span, secs(a.begin) + secs(a.dur));
    }
  }
  const css = parseCss(inner);
  for (const r of Object.values(css.reveals)) {
    span = Math.max(span, r.delay + r.dur);
  }
  for (const m of inner.matchAll(/animation-delay:\s*([\d.]+)s/g)) {
    span = Math.max(span, Number(m[1]) + css.cellDur);
  }
  return span;
}

function offsetOneShotTimes(inner, { start, scale }) {
  return inner.replace(/<(animate|animateTransform|animateMotion)\b([^>]*?)\/?>/g, (full, tag, raw) => {
    const a = attrs(raw);
    if (a.repeatCount === "indefinite") return full;

    if (!a.begin) {
      if (a.fill !== "freeze") return full;
      let out = full;
      if (a.dur != null) out = out.replace(/\bdur="[^"]*"/, `dur="${fmt(secs(a.dur) * scale)}s"`);
      return out.replace(/\s*\/?>$/, (m) => ` begin="${fmt(start)}s"${m}`);
    }

    if (!/^\s*-?[\d.]+(?:ms|s)?\s*$/.test(a.begin)) return full;
    const begin = secs(a.begin);
    let out = full.replace(/\bbegin="[^"]*"/, `begin="${fmt(start + begin * scale)}s"`);
    if (a.dur != null) out = out.replace(/\bdur="[^"]*"/, `dur="${fmt(secs(a.dur) * scale)}s"`);
    return out;
  });
}

function transformCss(inner, { start, scale }) {
  const css = parseCss(inner);
  let out = inner.replace(/<style>[\s\S]*?<\/style>/, "");

  out = out.replace(
    /<([a-zA-Z][\w:-]*)([^>]*?)\sclass="([^"]*)"([^>]*?)(\/?)>/g,
    (full, tag, pre, cls, post, selfClose) => {
      const classes = cls.split(/\s+/).filter(Boolean);
      if (!classes.length) return full;

      /* Activity heat-map cells -------------------------------------- */
      if (classes.includes("cell")) {
        const isOn = classes.includes("on");
        const isPop = classes.includes("pop");
        const delayMatch = `${pre} ${post}`.match(/animation-delay:\s*([\d.]+)s/);
        const delay = delayMatch ? Number(delayMatch[1]) : 0;
        const clean = `${pre} ${post}`
          .replace(/\sstyle="[^"]*"/g, "")
          .replace(/\sopacity="[^"]*"/g, "");
        if (isPop) {
          return `<${tag}${clean} opacity="0.15"><animate attributeName="opacity" from="0.15" to="1" dur="${fmt(
            css.cellDur * scale,
          )}s" begin="${fmt(start + delay * scale)}s" repeatCount="1" fill="freeze"/></${tag}>`;
        }
        return `<${tag}${clean} opacity="${isOn ? "1" : "0.25"}"${selfClose}>`;
      }

      /* Typed boot-log lines + blinking cursor ----------------------- */
      const reveal = classes.find((c) => /^b\d+$/.test(c));
      const isCur = classes.includes("cur");
      let animate = "";
      let opacity = null;

      if (reveal && css.reveals[reveal.slice(1)]) {
        const r = css.reveals[reveal.slice(1)];
        opacity = "0";
        animate += `<animate attributeName="opacity" from="0" to="1" dur="${fmt(r.dur * scale)}s" begin="${fmt(
          start + r.delay * scale,
        )}s" repeatCount="1" fill="freeze"/>`;
      }
      if (isCur) {
        animate += `<animate attributeName="opacity" values="1;0;1" dur="1s" begin="${fmt(
          start + css.curDelay * scale,
        )}s" repeatCount="indefinite"/>`;
      }
      if (!animate) return full;

      const clean = `${pre} ${post}`;
      if (opacity != null) {
        const attrs = clean.replace(/\sopacity="[^"]*"/g, "");
        if (selfClose) return `<${tag}${attrs} opacity="${opacity}">${animate}</${tag}>`;
        return `<${tag}${attrs} opacity="${opacity}">${animate}`;
      }
      if (selfClose) return `<${tag}${clean}>${animate}</${tag}>`;
      return `<${tag}${clean}>${animate}`;
    },
  );

  return out;
}

function sanitize(inner, options) {
  const {
    prefix,
    start,
    scale,
    removeBg = false,
    removeRain = false,
    removeFades = false,
  } = options;

  let out = inner;
  out = offsetOneShotTimes(out, { start, scale });
  out = transformCss(out, { start, scale });
  out = out.replace(/repeatCount="infinite"/g, 'repeatCount="indefinite"');
  if (removeRain) out = out.replace(RAIN_GROUP, "");
  if (removeBg) out = removeFirstFullBleed(out);
  if (removeFades) out = out.replace(FADE_RECT, "");
  out = prefixIds(out, prefix);
  return out;
}

/* ------------------------------------------------------------------ */
/*  master layout / timeline                                          */
/* ------------------------------------------------------------------ */

const WIDTH = 1200;
const SPEED = 0.62; // compress every section's local timeline a little
const LEAD_CAP = 2.4; // longest one section may hold the page before the next starts
const GAP_TIME = 0.35; // quiet beat between sections, in seconds
const GAP_PX = 16; // breathing room between stacked sections
const HEADING_H = 52; // height reserved for each section label
const TOP_PAD = 12;
const BOTTOM_PAD = 12;

const sections = [
  { id: "banner", file: "assets/matrix-banner.svg", keepRain: true },
  { id: "typing", file: "assets/matrix-typing.svg" },
  { id: "divider", file: "assets/matrix-divider.svg" },
  { id: "h-boot", kind: "heading", label: "01 · BOOT SEQUENCE" },
  { id: "boot", file: "assets/matrix-boot.svg" },
  { id: "h-about", kind: "heading", label: "02 · ABOUT ME" },
  { id: "about", kind: "about" },
  { id: "h-tech", kind: "heading", label: "03 · TECH STACK" },
  { id: "tech", file: "assets/matrix-tech.svg" },
  { id: "h-stats", kind: "heading", label: "04 · STATS" },
  { id: "stats", file: "profile/stats.svg" },
  { id: "activity", file: "profile/activity.svg" },
  { id: "h-trophies", kind: "heading", label: "05 · TROPHIES & ACHIEVEMENTS" },
  { id: "trophies", file: "assets/matrix-trophies.svg" },
  { id: "h-pacman", kind: "heading", label: "06 · PAC-MAN — DAILY CONTRIBUTION GRAPH" },
  { id: "pacman", kind: "pacman" },
  { id: "h-projects", kind: "heading", label: "07 · FEATURED PROJECTS" },
  { id: "projects", kind: "projects" },
  { id: "h-roadmap", kind: "heading", label: "08 · LEARNING ROADMAP" },
  { id: "roadmap", file: "assets/matrix-roadmap.svg" },
  { id: "h-quote", kind: "heading", label: "09 · DAILY QUOTE" },
  { id: "quote", file: "profile/quote.svg" },
  { id: "h-connect", kind: "heading", label: "10 · CONNECT" },
  { id: "connect", kind: "connect" },
  { id: "h-references", kind: "heading", label: "11 · MATRIX REFERENCES" },
  { id: "references", file: "assets/matrix-references.svg" },
  { id: "footer", file: "assets/matrix-footer.svg" },
];

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

const pacmanSvg = await loadPacman();

function readPiece(file) {
  const raw = readText(file);
  const inner = extractInner(raw);
  const css = parseCss(inner);
  if (/class="b\d/.test(inner) && !Object.keys(css.reveals).length) {
    throw new Error(
      `${file}: found .bN reveal classes but no one-shot .bN rules — ` +
        `the section would render invisible in the showcase`,
    );
  }
  return { vb: viewBoxOf(raw), inner, span: Math.max(measureSpan(inner), 0.6) };
}

function prepare(sec) {
  if (sec.kind === "heading") {
    sec.height = HEADING_H;
    sec.span = 0.4;
    return;
  }

  if (sec.file) {
    const piece = readPiece(sec.file);
    sec.vb = piece.vb;
    sec.inner = piece.inner;
    sec.span = piece.span;
    sec.height = (piece.vb[3] / piece.vb[2]) * WIDTH;
    return;
  }

  if (sec.kind === "about") {
    sec.avatar = readPiece("assets/matrix-avatar.svg");
    sec.about = readPiece("assets/matrix-about.svg");
    sec.span = Math.max(sec.about.span + 0.2, 1);
    sec.height = 288;
    return;
  }

  if (sec.kind === "projects") {
    sec.cards = [
      "matrix-profile.svg",
      "matrix-portfolio.svg",
      "matrix-rentalhub.svg",
      "matrix-pcstore.svg",
    ].map((name) => readPiece(`assets/projects/${name}`));
    sec.stagger = 0.9;
    sec.cardW = 560;
    sec.cardH = (250 / 520) * sec.cardW;
    sec.height = sec.cardH * 2 + 20;
    sec.span = Math.max(...sec.cards.map((c) => c.span)) + (sec.cards.length - 1) * sec.stagger;
    return;
  }

  if (sec.kind === "connect") {
    sec.badges = [
      "github",
      "linkedin",
      "x",
      "email",
      "proton",
      "portfolio",
      "leetcode",
      "codeforces",
      "devto",
    ].map((name) => readPiece(`assets/badges/${name}.svg`));
    sec.stagger = 0.18;
    sec.badgeW = 260;
    sec.badgeH = (44 / 200) * sec.badgeW;
    sec.height = sec.badgeH * 3 + 28;
    sec.span = (sec.badges.length - 1) * sec.stagger + 0.4;
    return;
  }

  if (sec.kind === "pacman") {
    sec.span = 0.6;
    if (pacmanSvg) {
      const inner = extractInner(pacmanSvg);
      sec.vb = viewBoxOf(pacmanSvg);
      sec.inner = inner;
      sec.height = (sec.vb[3] / sec.vb[2]) * WIDTH;
    } else {
      sec.vb = [0, 0, 1200, 120];
      sec.inner = null;
      sec.height = 120;
    }
  }
}

for (const sec of sections) prepare(sec);

let clock = 0;
for (const sec of sections) {
  sec.start = clock;
  // Later sections overlap the tail of a long intro (they sit far below the
  // fold), so the page is fully written in well under a minute.
  sec.lead = Math.min(Math.max(sec.span * SPEED, 0.35), LEAD_CAP);
  clock += sec.lead + GAP_TIME;
}

let cursorY = TOP_PAD;
for (const sec of sections) {
  sec.y = cursorY;
  cursorY += sec.height + GAP_PX;
}
const HEIGHT = cursorY - GAP_PX + BOTTOM_PAD;

if (process.env.DEBUG_TIMELINE) {
  for (const sec of sections) {
    console.log(
      `${sec.id.padEnd(14)} start=${fmt(sec.start).padStart(8)} end=${fmt(sec.start + sec.lead).padStart(
        8,
      )} lead=${fmt(sec.lead).padStart(6)} h=${fmt(sec.height)}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  section renderers                                                 */
/* ------------------------------------------------------------------ */

function headingSection(sec) {
  const label = esc(sec.label);
  return `<g font-family="'Courier New', Consolas, monospace" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.35s" begin="${fmt(
        sec.start,
      )}s" repeatCount="1" fill="freeze"/>
      <text x="40" y="${fmt(sec.y + 30)}" font-size="20" letter-spacing="3" fill="#00ff41" filter="url(#page-glow)">${label}</text>
      <text x="40" y="${fmt(sec.y + 30)}" font-size="20" letter-spacing="3" fill="#d4fdd9" opacity="0.25">${label}</text>
      <rect x="40" y="${fmt(sec.y + 42)}" width="1120" height="1" fill="#006b2e" opacity="0.55"/>
    </g>`;
}

function fileSection(sec) {
  const content = sanitize(sec.inner, {
    prefix: sec.id,
    start: sec.start,
    scale: SPEED,
    removeBg: true,
    removeRain: !sec.keepRain,
    removeFades: true,
  });
  return `<svg x="0" y="${fmt(sec.y)}" width="${WIDTH}" height="${fmt(sec.height)}" viewBox="${sec.vb.join(
    " ",
  )}" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
}

function aboutSection(sec) {
  const avatar = sanitize(sec.avatar.inner, {
    prefix: `${sec.id}-avatar`,
    start: sec.start,
    scale: SPEED,
    removeRain: true,
  });
  const about = sanitize(sec.about.inner, {
    prefix: `${sec.id}-text`,
    start: sec.start + 0.2 * SPEED,
    scale: SPEED,
    removeBg: true,
    removeRain: true,
    removeFades: true,
  });
  const aboutW = 950;
  const aboutH = (288 / 1200) * aboutW;
  return `<svg x="40" y="${fmt(sec.y + (sec.height - 140) / 2)}" width="140" height="140" viewBox="${sec.avatar.vb.join(
    " ",
  )}" preserveAspectRatio="xMidYMid meet">${avatar}</svg>
    <svg x="210" y="${fmt(sec.y + (sec.height - aboutH) / 2)}" width="${aboutW}" height="${fmt(
      aboutH,
    )}" viewBox="${sec.about.vb.join(" ")}" preserveAspectRatio="xMidYMid meet">${about}</svg>`;
}

function projectsSection(sec) {
  const pos = [
    [30, 0],
    [30 + sec.cardW + 20, 0],
    [30, sec.cardH + 20],
    [30 + sec.cardW + 20, sec.cardH + 20],
  ];
  return sec.cards
    .map((card, i) => {
      const content = sanitize(card.inner, {
        prefix: `${sec.id}-${i}`,
        start: sec.start + i * sec.stagger * SPEED,
        scale: SPEED,
        removeBg: true,
        removeRain: true,
        removeFades: true,
      });
      return `<svg x="${fmt(pos[i][0])}" y="${fmt(sec.y + pos[i][1])}" width="${fmt(
        sec.cardW,
      )}" height="${fmt(sec.cardH)}" viewBox="${card.vb.join(" ")}" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
    })
    .join("\n    ");
}

function connectSection(sec) {
  return sec.badges
    .map((badge, i) => {
      const content = sanitize(badge.inner, {
        prefix: `${sec.id}-${i}`,
        start: sec.start,
        scale: SPEED,
        removeRain: true,
      });
      const x = 170 + (i % 3) * 280;
      const y = sec.y + Math.floor(i / 3) * (sec.badgeH + 14);
      return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${fmt(
        sec.start + i * sec.stagger * SPEED,
      )}s" repeatCount="1" fill="freeze"/><svg x="${x}" y="${fmt(y)}" width="${fmt(
        sec.badgeW,
      )}" height="${fmt(sec.badgeH)}" viewBox="${badge.vb.join(
        " ",
      )}" preserveAspectRatio="xMidYMid meet">${content}</svg></g>`;
    })
    .join("\n    ");
}

function pacmanSection(sec) {
  if (!sec.inner) {
    return `<g font-family="'Courier New', Consolas, monospace" text-anchor="middle">
      <text x="600" y="${fmt(sec.y + 48)}" font-size="22" fill="#00a32a">[ OFFLINE ]</text>
      <text x="600" y="${fmt(sec.y + 80)}" font-size="16" fill="#006b2e">pac-man graph unavailable — the next run will retry</text>
    </g>`;
  }
  const content = sanitize(sec.inner, {
    prefix: sec.id,
    start: sec.start,
    scale: SPEED,
  })
    /* let the page's black backdrop show through instead of the graph's own panel */
    .replace(/<rect\b[^>]*\bwidth="100%"[^>]*\bfill="#0d1117"[^>]*\/>/g, "");
  return `<svg x="0" y="${fmt(sec.y)}" width="${WIDTH}" height="${fmt(sec.height)}" viewBox="${sec.vb.join(
    " ",
  )}" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
}

function render(sec) {
  switch (sec.kind) {
    case "heading":
      return headingSection(sec);
    case "about":
      return aboutSection(sec);
    case "projects":
      return projectsSection(sec);
    case "connect":
      return connectSection(sec);
    case "pacman":
      return pacmanSection(sec);
    default:
      return fileSection(sec);
  }
}

const body = sections.map((sec) => `    <!-- ${sec.id} -->\n    ${render(sec)}`).join("\n");

/* ------------------------------------------------------------------ */
/*  global backdrop rain                                              */
/* ------------------------------------------------------------------ */

const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function globalRain() {
  const columns = 16;
  const gap = WIDTH / columns;
  const rows = Math.max(10, Math.ceil((HEIGHT - 24) / 30));
  const out = [];
  for (let c = 0; c < columns; c++) {
    const glyphs = [];
    for (let r = 0; r < rows; r++) {
      const ch = POOL[(c * 7 + r * 13) % POOL.length];
      const phase = (r + c * 3) % 10;
      let fill;
      let opacity;
      if (phase < 4) {
        fill = "#006b2e";
        opacity = "0.18";
      } else if (phase < 7) {
        fill = "#00a32a";
        opacity = "0.24";
      } else if (phase < 9) {
        fill = "#00e640";
        opacity = "0.3";
      } else {
        fill = "#00ff41";
        opacity = "0.34";
      }
      glyphs.push(`<text x="0" y="${16 + r * 30}" fill="${fill}" opacity="${opacity}">${ch}</text>`);
    }
    const x = Math.round(c * gap + gap / 2);
    const dur = (8 + ((c * 37) % 60) / 10).toFixed(2);
    const begin = (-((c * 53) % 90) / 10).toFixed(2);
    out.push(
      `<g><animateTransform attributeName="transform" type="translate" values="-${gap} 0;0 0" dur="${dur}s" repeatCount="indefinite" begin="${begin}s"/><g transform="translate(${x} 8)">${glyphs.join(
        "",
      )}</g></g>`,
    );
  }
  return out.join("\n      ");
}

/* ------------------------------------------------------------------ */
/*  compose                                                           */
/* ------------------------------------------------------------------ */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Dhyanesh's Matrix profile — every section stacked in one file, written line by line">
  <defs>
    <filter id="page-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000000"/>
  <g font-family="'Courier New', Consolas, monospace" font-size="14">
      ${globalRain()}
  </g>

  <g id="page">
${body}
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

const sectionCount = sections.filter((sec) => sec.kind !== "heading").length;
const finishAt = Math.max(...sections.map((sec) => sec.start + sec.span * SPEED));
const summary = `${(svg.length / 1024).toFixed(1)} KiB · ${HEIGHT.toFixed(0)}px tall · ${sectionCount} sections · written by ${fmt(
  finishAt,
)}s`;

if (previous === svg) {
  console.log(`showcase unchanged (${summary})`);
} else {
  writeFileSync(out, svg);
  console.log(`showcase written (${summary})`);
}
