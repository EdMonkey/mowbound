import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const indexPath = join(distDir, "index.html");

if (!existsSync(indexPath)) {
  throw new Error("dist/index.html missing. Run npm run build first.");
}

const html = readFileSync(indexPath, "utf8");

if (!html.includes("Mowbound")) {
  throw new Error("Built HTML does not include Mowbound title.");
}

if (!html.includes("/assets/")) {
  throw new Error("Built HTML does not reference bundled assets.");
}

console.log("Smoke OK: dist/index.html exists and references bundled assets.");
