import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const quotes = JSON.parse(readFileSync(new URL("quotes.json", root), "utf8"));

const now = new Date();
const start = new Date(now.getFullYear(), 0, 0);
const day = Math.floor((now - start) / 86400000);
const q = quotes[day % quotes.length];

const sourceTag = q.source ? ` <span style="color: #60a5fa;">(${q.source})</span>` : "";
const block = [
  "  <em>&ldquo;" + q.text + "&rdquo;</em>",
  "  <br />",
  "  <span style=\"color: #8b949e;\">&mdash; " + q.by + sourceTag + "</span>",
].join("\n");

const readmePath = new URL("README.md", root);
let readme = readFileSync(readmePath, "utf8");
const before = readme;
readme = readme.replace(
  /<!-- QUOTE:START -->[\s\S]*?<!-- QUOTE:END -->/,
  "<!-- QUOTE:START -->\n" + block + "\n  <!-- QUOTE:END -->"
);
if (readme === before) {
  console.error("ERROR: QUOTE markers not found in README");
  process.exit(1);
}
writeFileSync(readmePath, readme);
console.log("quote updated:", q.text, "—", q.by);
