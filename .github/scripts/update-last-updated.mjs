import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);

const now = new Date();
const ist = new Date(now.getTime() + 5.5 * 3600000);
const pad = (n) => String(n).padStart(2, "0");
const stamp =
  `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ` +
  `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())} IST`;

const block = `  <span style="color: #00a32a;">[ matrix://last.sync ]</span>&nbsp; Last updated: <span style="color: #d4fdd9;">${stamp}</span>`;

const readmePath = new URL("README.md", root);
const readme = readFileSync(readmePath, "utf8");

const startMarker = "<!-- UPDATE:START -->";
const endMarker = "<!-- UPDATE:END -->";
const s = readme.indexOf(startMarker);
const e = readme.indexOf(endMarker);
if (s === -1 || e === -1 || e < s) {
  console.error("ERROR: UPDATE markers not found in README");
  process.exit(1);
}

const newBlock = startMarker + "\n" + block + "\n" + endMarker;
if (readme.slice(s, e + endMarker.length) === newBlock) {
  console.log("last-updated unchanged:", stamp);
  process.exit(0);
}

const updated = readme.slice(0, s) + newBlock + readme.slice(e + endMarker.length);
writeFileSync(readmePath, updated);
console.log("last-updated written:", stamp);
