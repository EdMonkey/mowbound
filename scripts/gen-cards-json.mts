// Generates cards-site/cards.json for the card-list website directly from the
// in-repo card source of truth (src/game/config/cards.json). Run via
// `npm run build:cards`. Because it reads the live game data, the published
// list always matches the current branch — no vendored snapshot to refresh.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = resolve(here, "../src/game/config/cards.json");
const outDir = resolve(here, "../cards-site");
mkdirSync(outDir, { recursive: true });

const raw = JSON.parse(readFileSync(srcPath, "utf8"));
const nodes: unknown[] = Array.isArray(raw) ? raw : raw.nodes ?? raw.cards ?? [];

const payload = {
  generatedAt: new Date().toISOString(),
  source: "src/game/config/cards.json",
  count: nodes.length,
  nodes,
};

writeFileSync(resolve(outDir, "cards.json"), JSON.stringify(payload, null, 2), "utf8");
console.log(`wrote cards-site/cards.json — ${nodes.length} cards`);
