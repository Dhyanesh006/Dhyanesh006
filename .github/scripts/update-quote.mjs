import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const quotes = JSON.parse(readFileSync(new URL("quotes.json", root), "utf8"));

const now = new Date();
const ist = new Date(now.getTime() + 5.5 * 3600000);
const start = new Date(Date.UTC(ist.getUTCFullYear(), 0, 0));
const day = Math.floor((ist - start) / 86400000);
const q = quotes[day % quotes.length];

const sourceTag = q.source ? ` <span style="color: #006b2e;">(${q.source})</span>` : "";
const block = [
  `<div align="center">`,
  `<pre style="font-family: 'Courier New', Consolas, monospace; font-size: 14px; background: #000000; color: #00ff41; border: 1px solid #00a32a; border-radius: 8px; padding: 12px 20px; margin: 8px auto; text-align: left; display: inline-block; overflow-x: auto; line-height: 1.55;">`,
  `<span style="color: #00ff41;">MATRIX</span> <span style="color: #006b2e;">//</span> <span style="color: #00a32a;">DAILY QUOTE SEQUENCE</span>`,
  `$ <span style="color: #00e640;">cat daily-quote.dat</span>`,
  `<span style="color: #00a32a;">[ OK ]</span> <span style="color: #8fbf98;">accessing the oracle</span> <span style="color: #006b2e;">......</span>`,
  `<span style="color: #00a32a;">[ OK ]</span> <span style="color: #d4fdd9;">&ldquo;${q.text}&rdquo;</span>`,
  `<span style="color: #00a32a;">[ OK ]</span> <span style="color: #8fbf98;">attribution</span> <span style="color: #00ff41;">${q.by}</span>${sourceTag}`,
  `<span style="color: #00a32a;">[ OK ]</span> <span style="color: #8fbf98;">quote locked in memory</span> <span style="color: #006b2e;">.......</span>`,
  `<span style="color: #00ff41;">&#9608;</span></pre>`,
  `</div>`,
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
