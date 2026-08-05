import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const quotes = JSON.parse(readFileSync(new URL("quotes.json", root), "utf8"));

const now = new Date();
const ist = new Date(now.getTime() + 5.5 * 3600000);
const start = new Date(Date.UTC(ist.getUTCFullYear(), 0, 0));
const day = Math.floor((ist - start) / 86400000);
const q = quotes[day % quotes.length];

const sourceTag = q.source ? ` <span style="color: #60a5fa;">(${q.source})</span>` : "";
const block = [
  "  <em>&ldquo;" + q.text + "&rdquo;</em>",
  "  <br />",
  "  <span style=\"color: #8b949e;\">&mdash; " + q.by + sourceTag + "</span>",
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
if (readme.slice(s, e + endMarker.length) === newBlock) {
  console.log("quote unchanged:", q.text, "—", q.by);
  process.exit(0);
}

const updated = readme.slice(0, s) + newBlock + readme.slice(e + endMarker.length);
writeFileSync(readmePath, updated);
console.log("quote updated:", q.text, "—", q.by);
