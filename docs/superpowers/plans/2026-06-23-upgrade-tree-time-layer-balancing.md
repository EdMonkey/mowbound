# Upgrade Tree Time Layer Balancing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance `cards.json` so the upgrade tree is laid out as a 5-minute time-layer tree with equipment left, harvest center, environment right, and special ability fruit on the outer edges.

**Architecture:** Keep `cards.json` as the runtime source of truth. Add a one-off deterministic Node script that rewrites card `tier`, `cost`, `prereq`, `layout`, and `sort` from explicit timeline rules, then commit the generated JSON and tests. No runtime scene behavior changes are required.

**Tech Stack:** Vite, TypeScript, Three.js, Vitest, Node.js ESM scripts.

---

## File Structure

- Modify: `src/game/config/cards.json`
  - Final data source for card costs, prerequisites, tiers, sort order, and upgrade tree coordinates.
- Create: `scripts/rebalance-upgrade-tree.mjs`
  - Deterministic data migration script. It reads `cards.json`, applies the time-layer layout rules, validates every ID, and writes formatted JSON.
- Modify: `test/cardTree.test.ts`
  - Update cost expectations and add major-card timeline tests.
- Modify: `test/upgradeTree.test.ts`
  - Add reachability and layout collision tests.
- Modify: `test/progression.test.ts`
  - Update 1-hour route expectations so 5-minute milestone cards are encountered without completing the full tree.
- Optional delete after final verification: `scripts/rebalance-upgrade-tree.mjs`
  - Keep it if future balancing iterations need deterministic regeneration. Recommended: keep it.

---

### Task 1: Add Timeline Guard Tests

**Files:**
- Modify: `test/cardTree.test.ts`
- Modify: `test/upgradeTree.test.ts`

- [ ] **Step 1: Add major timeline constants to `test/cardTree.test.ts`**

Insert after imports:

```ts
const FIVE_MINUTE_LAYER_Y = 220;

const MAJOR_TIME_LAYERS = [
  { minute: 0, ids: ["root_sharpen"] },
  { minute: 5, ids: ["clean_rows_1"] },
  { minute: 10, ids: ["ember", "survey_rock"] },
  { minute: 15, ids: ["seed_bombs"] },
  { minute: 20, ids: ["golden_field", "survey_tree"] },
  { minute: 25, ids: ["open_acre"] },
  { minute: 30, ids: ["wide_sickle", "fast_sickle"] },
  { minute: 35, ids: ["alien_crop_mark"] },
  { minute: 40, ids: ["tractor_license"] },
  { minute: 45, ids: ["mower_laser"] },
  { minute: 50, ids: ["summon_codex", "summon_drone", "summon_lightning"] },
  { minute: 55, ids: ["summon_tornado", "summon_tractor"] },
];

function expectedLayerY(minute: number): number {
  return -(minute / 5) * FIVE_MINUTE_LAYER_Y;
}
```

- [ ] **Step 2: Replace the total cost expectation**

Change:

```ts
expect(CARDS.reduce((sum, card) => sum + card.cost, 0)).toBe(45855);
```

To:

```ts
expect(CARDS.reduce((sum, card) => sum + card.cost, 0)).toBe(54947);
```

- [ ] **Step 3: Replace the cost expectation block**

Replace only the object inside `expect(costs).toMatchObject({ ... })` with:

```ts
{
  root_sharpen: 10,
  clean_rows_1: 34,
  ember: 90,
  survey_rock: 130,
  seed_bombs: 220,
  golden_field: 420,
  survey_tree: 360,
  open_acre: 650,
  wide_sickle: 900,
  fast_sickle: 900,
  alien_crop_mark: 1300,
  tractor_license: 1900,
  mower_laser: 1700,
  summon_codex: 1600,
  summon_drone: 2100,
  summon_lightning: 2200,
  summon_tornado: 3000,
  summon_tractor: 3200,
}
```

- [ ] **Step 4: Add a test for major card layers**

Add under `describe("card tree data", () => {`:

```ts
it("places major experience cards on 5-minute time layers", () => {
  for (const layer of MAJOR_TIME_LAYERS) {
    for (const id of layer.ids) {
      const card = CARD_BY_ID[id];
      expect(card, id).toBeDefined();
      expect(card.layout.y, id).toBe(expectedLayerY(layer.minute));
    }
  }
});
```

- [ ] **Step 5: Add a test for lane placement**

Add under the previous test:

```ts
it("keeps equipment left, harvest center, environment right, and special fruit outside", () => {
  const inRange = (value: number, min: number, max: number) => value >= min && value <= max;

  for (const card of CARDS) {
    const effectKinds = card.effects.map((effect) => effect.kind);
    const isSpecialFruit =
      effectKinds.includes("summon") ||
      effectKinds.includes("special") ||
      effectKinds.includes("bombCount10m");

    if (card.id === "root_sharpen") {
      expect(card.layout.x, card.id).toBe(0);
    } else if (isSpecialFruit) {
      expect(Math.abs(card.layout.x), card.id).toBeGreaterThanOrEqual(1050);
    } else if (card.category === "equipment") {
      expect(inRange(card.layout.x, -1000, -350), card.id).toBe(true);
    } else if (card.category === "harvest") {
      expect(inRange(card.layout.x, -180, 220), card.id).toBe(true);
    } else if (card.category === "environment") {
      expect(inRange(card.layout.x, 350, 1000), card.id).toBe(true);
    }
  }
});
```

- [ ] **Step 6: Add layout collision test to `test/upgradeTree.test.ts`**

Add under `has finite layout coordinates for every card`:

```ts
it("keeps upgrade cards far enough apart to avoid visual overlap", () => {
  const minXGap = 135;
  const minYGap = 95;

  for (let i = 0; i < CARDS.length; i += 1) {
    for (let j = i + 1; j < CARDS.length; j += 1) {
      const a = CARDS[i];
      const b = CARDS[j];
      const dx = Math.abs(a.layout.x - b.layout.x);
      const dy = Math.abs(a.layout.y - b.layout.y);
      expect(dx >= minXGap || dy >= minYGap, `${a.id} overlaps ${b.id}`).toBe(true);
    }
  }
});
```

- [ ] **Step 7: Add full reachability test to `test/upgradeTree.test.ts`**

Add after the collision test:

```ts
it("keeps every card reachable from the root through prerequisites", () => {
  const reachable = new Set<string>([CARD_ROOT_ID]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const card of CARDS) {
      if (reachable.has(card.id)) {
        continue;
      }
      if (card.prereq.every((id) => reachable.has(id))) {
        reachable.add(card.id);
        changed = true;
      }
    }
  }

  expect([...CARDS.map((card) => card.id).filter((id) => !reachable.has(id))]).toEqual([]);
});
```

- [ ] **Step 8: Run focused tests and confirm failure**

Run:

```bash
npm test -- test/cardTree.test.ts test/upgradeTree.test.ts
```

Expected: fail on new timeline/lane/collision expectations because `cards.json` has not been rebalanced yet.

---

### Task 2: Create Deterministic Rebalance Script

**Files:**
- Create: `scripts/rebalance-upgrade-tree.mjs`

- [ ] **Step 1: Create the script file**

Create `scripts/rebalance-upgrade-tree.mjs` with:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsPath = path.resolve(__dirname, "../src/game/config/cards.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const byId = new Map(cards.map((card) => [card.id, card]));

const STEP_Y = 220;

const x = {
  root: 0,
  equipmentMain: -620,
  equipmentLeft: -820,
  equipmentOuter: -1120,
  harvest: 0,
  harvestLeft: -160,
  harvestRight: 160,
  environmentMain: 620,
  environmentRight: 820,
  environmentOuter: 1120,
};

function layer(minute) {
  return -(minute / 5) * STEP_Y;
}

function requireCard(id) {
  const card = byId.get(id);
  if (!card) {
    throw new Error(`Missing card id: ${id}`);
  }
  return card;
}

function patch(id, update) {
  const card = requireCard(id);
  Object.assign(card, update);
  if (update.layout) {
    card.layout = update.layout;
  }
}

function patchPath(ids, baseX, startMinute, yStepMinutes, xOffsets = [-160, 0, 160]) {
  ids.forEach((id, index) => {
    const row = Math.floor(index / xOffsets.length);
    const col = index % xOffsets.length;
    patch(id, {
      layout: {
        x: baseX + xOffsets[col],
        y: layer(startMinute + row * yStepMinutes) - col * 34,
      },
      sort: 1000 + cards.findIndex((card) => card.id === id),
    });
  });
}

const exact = {
  root_sharpen: { tier: 0, cost: 10, prereq: [], layout: { x: x.root, y: layer(0) }, sort: 0 },

  clean_rows_1: { tier: 1, cost: 34, prereq: ["root_sharpen"], layout: { x: x.harvest, y: layer(5) }, sort: 100 },
  ember: { tier: 2, cost: 90, prereq: ["sharp_edge_1"], layout: { x: x.equipmentMain, y: layer(10) }, sort: 200 },
  survey_rock: { tier: 2, cost: 130, prereq: ["root_sharpen"], layout: { x: x.environmentMain, y: layer(10) }, sort: 201 },
  seed_bombs: { tier: 3, cost: 220, prereq: ["survey_rock"], layout: { x: x.environmentOuter, y: layer(15) }, sort: 300 },
  golden_field: { tier: 4, cost: 420, prereq: ["market_cart_2", "clean_rows_2"], layout: { x: x.harvest, y: layer(20) }, sort: 400 },
  survey_tree: { tier: 4, cost: 360, prereq: ["survey_rock"], layout: { x: x.environmentMain, y: layer(20) }, sort: 401 },
  open_acre: { tier: 5, cost: 650, prereq: ["wide_lands_2"], layout: { x: x.environmentMain, y: layer(25) }, sort: 500 },
  wide_sickle: { tier: 6, cost: 900, prereq: ["open_acre", "clean_sweep_2"], layout: { x: x.equipmentMain - 120, y: layer(30) }, sort: 600 },
  fast_sickle: { tier: 6, cost: 900, prereq: ["open_acre", "quick_recovery_2"], layout: { x: x.equipmentMain + 120, y: layer(30) }, sort: 601 },
  alien_crop_mark: { tier: 7, cost: 1300, prereq: ["seed_bombs", "chain_payout_1"], layout: { x: x.equipmentOuter, y: layer(35) }, sort: 700 },
  tractor_license: { tier: 8, cost: 1900, prereq: ["open_acre", "wide_sickle", "long_day"], layout: { x: x.equipmentMain, y: layer(40) }, sort: 800 },
  mower_laser: { tier: 9, cost: 1700, prereq: ["alien_crop_mark", "sharp_edge_2"], layout: { x: x.equipmentOuter, y: layer(45) }, sort: 900 },
  summon_codex: { tier: 10, cost: 1600, prereq: ["mower_laser", "golden_field"], layout: { x: x.environmentOuter, y: layer(50) }, sort: 1000 },
  summon_drone: { tier: 10, cost: 2100, prereq: ["summon_codex"], layout: { x: x.environmentOuter - 170, y: layer(50) }, sort: 1001 },
  summon_lightning: { tier: 10, cost: 2200, prereq: ["summon_codex"], layout: { x: x.environmentOuter + 170, y: layer(50) }, sort: 1002 },
  summon_tornado: { tier: 11, cost: 3000, prereq: ["summon_codex"], layout: { x: x.environmentOuter - 160, y: layer(55) }, sort: 1100 },
  summon_tractor: { tier: 11, cost: 3200, prereq: ["tractor_license", "summon_codex"], layout: { x: x.equipmentOuter, y: layer(55) }, sort: 1101 },
};

for (const [id, update] of Object.entries(exact)) {
  patch(id, update);
}

patchPath([
  "sharp_edge_1",
  "sharp_edge_2",
  "heavy_edge",
  "clean_sweep_1",
  "clean_sweep_2",
  "quick_recovery_1",
  "quick_recovery_2",
], x.equipmentMain, 5, 5);

patchPath([
  "burn1",
  "spread1",
  "kindle1",
  "burn2",
  "spread2",
  "kindle2",
  "burn3",
  "spread3",
  "kindle3",
  "cyclone_cut",
], x.equipmentMain, 15, 5);

patchPath([
  "light_boots_1",
  "field_rhythm_1",
  "light_boots_2",
  "field_rhythm_2",
  "sprint_harvest",
  "long_day",
], x.equipmentMain + 260, 10, 5, [-80, 80]);

patchPath([
  "market_cart_1",
  "market_cart_2",
  "clean_rows_2",
  "bulk_buyer_1",
  "bulk_buyer_2",
  "accountant",
], x.harvest, 10, 5, [-150, 0, 150]);

patchPath([
  "wide_lands_1",
  "wide_lands_2",
  "wide_lands_3",
  "wide_lands_4",
  "dense_growth",
  "fertile_soil",
], x.environmentMain, 15, 5, [-150, 0, 150]);

patchPath([
  "grasslore",
  "bluefoot",
  "timerboon",
  "fastgrowth",
  "tallbounty",
  "grow_speed_1",
  "grow_speed_2",
  "grow_speed_3",
  "grow_speed_4",
  "grow_speed_5",
], x.environmentRight, 20, 5);

patchPath([
  "stone_chips",
  "wood_haul",
  "stump_grinder",
  "recoil_training",
  "quarry_blade",
  "clearcut",
  "lumberjack",
  "field_churn_1",
  "field_churn_2",
  "boulder_lore_1",
  "boulder_lore_2",
], x.environmentMain, 25, 5);

patchPath([
  "fuse_training_1",
  "blast_control_1",
  "chain_payout_1",
  "fuse_training_2",
  "blast_control_2",
  "harvest_detonation",
  "bomb_sickle",
], x.environmentOuter, 20, 5);

patchPath([
  "shadow_count_2",
  "shadow_count_3",
  "shadow_dmg_1",
  "shadow_dmg_2",
  "shadow_dmg_3",
  "shadow_cd_1",
  "shadow_cd_2",
  "shadow_cd_3",
  "summon_shadow",
], x.environmentOuter, 55, 5);

patchPath([
  "summon_scythe",
  "scythe_count_2",
  "scythe_count_3",
  "scythe_count_4",
  "scythe_count_5",
  "scythe_dmg_1",
  "scythe_dmg_2",
  "scythe_dmg_3",
  "scythe_radius_1",
  "scythe_radius_2",
  "scythe_spin_1",
  "scythe_spin_2",
], x.equipmentOuter, 50, 5);

patchPath([
  "boom_count_2",
  "boom_count_3",
  "boom_dmg_1",
  "boom_dmg_2",
  "boom_range_1",
  "boom_range_2",
  "summon_boomerang",
], x.equipmentOuter, 55, 5);

patchPath([
  "drone_count_2",
  "drone_radius_1",
  "drone_radius_2",
  "drone_dur_1",
  "drone_dur_2",
  "drone_dmg_1",
], x.environmentOuter, 60, 5);

patchPath([
  "light_count_2",
  "light_count_3",
  "light_radius_1",
  "light_radius_2",
  "light_cd_1",
  "light_cd_2",
], x.environmentOuter + 260, 60, 5, [-80, 80]);

patchPath([
  "tractor_width_1",
  "tractor_width_2",
  "tractor_dmg_1",
  "tractor_dmg_2",
  "tractor_cd_1",
  "tractor_cd_2",
], x.equipmentOuter - 260, 60, 5, [-80, 80]);

patchPath([
  "torn_size_1",
  "torn_size_2",
  "torn_dur_1",
  "torn_dur_2",
  "torn_dmg_1",
  "torn_dmg_2",
], x.environmentOuter + 420, 60, 5, [-80, 80]);

const missing = cards.filter((card) => !Number.isFinite(card.layout?.x) || !Number.isFinite(card.layout?.y));
if (missing.length > 0) {
  throw new Error(`Cards with invalid layout: ${missing.map((card) => card.id).join(", ")}`);
}

for (const card of cards) {
  for (const prereq of card.prereq) {
    if (!byId.has(prereq)) {
      throw new Error(`${card.id} has missing prereq ${prereq}`);
    }
  }
}

cards.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
fs.writeFileSync(cardsPath, `${JSON.stringify(cards, null, 2)}\n`);
console.log(`Rebalanced ${cards.length} cards at ${path.relative(process.cwd(), cardsPath)}`);
```

- [ ] **Step 2: Run the script**

Run:

```bash
node scripts/rebalance-upgrade-tree.mjs
```

Expected:

```text
Rebalanced 138 cards at src/game/config/cards.json
```

- [ ] **Step 3: Inspect generated diff**

Run:

```bash
git diff -- src/game/config/cards.json scripts/rebalance-upgrade-tree.mjs
```

Expected:
- `cards.json` has reordered cards by new `sort`.
- Major cards have exact `layout.y` matching 5-minute layers.
- `summon_codex` moves from early root child to late prerequisite path.

---

### Task 3: Repair Tests Against Generated Data

**Files:**
- Modify: `test/cardTree.test.ts`
- Modify: `test/progression.test.ts`

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- test/cardTree.test.ts test/upgradeTree.test.ts test/progression.test.ts
```

Expected:
- Most new layout tests pass.
- `progression.test.ts` may fail because the old helper prefers any ability as soon as possible and expected unlock counts were tuned for the old tree.

- [ ] **Step 2: Replace progression helper priority**

In `test/progression.test.ts`, replace `spectacleOrSummonIds` with:

```ts
const milestoneIds = [
  "root_sharpen",
  "clean_rows_1",
  "ember",
  "survey_rock",
  "seed_bombs",
  "golden_field",
  "survey_tree",
  "open_acre",
  "wide_sickle",
  "fast_sickle",
  "alien_crop_mark",
  "tractor_license",
  "mower_laser",
  "summon_codex",
  "summon_drone",
  "summon_lightning",
  "summon_tornado",
  "summon_tractor",
];

const spectacleOrSummonIds = CARDS.filter((card) => card.category === "ability" || card.branch === "spectacle").map(
  (card) => card.id,
);
```

- [ ] **Step 3: Replace `chooseNextPurchase`**

Replace the function body with:

```ts
function chooseNextPurchase(save: SaveData) {
  const milestone = milestoneIds.find((id) => !isCardUnlocked(save, id) && canUnlockCard(save, id));
  if (milestone) {
    return CARDS.find((card) => card.id === milestone);
  }
  return nextAffordableCardGoals(save, 1)[0];
}
```

- [ ] **Step 4: Add milestone progression test**

Add under `describe("one hour demo progression", () => {`:

```ts
it("unlocks at least ten milestone experience cards during the one hour route", () => {
  const save = simulateOneHour();
  const unlockedMilestones = milestoneIds.filter((id) => isCardUnlocked(save, id));

  expect(unlockedMilestones.length).toBeGreaterThanOrEqual(10);
  expect(unlockedMilestones).toContain("seed_bombs");
  expect(unlockedMilestones).toContain("open_acre");
  expect(unlockedMilestones).toContain("alien_crop_mark");
});
```

- [ ] **Step 5: Keep one-hour tree incomplete**

If unlock count changes, update only these two bounds:

```ts
expect(unlockedCount).toBeGreaterThan(30);
expect(unlockedCount).toBeLessThan(60);
```

Do not relax `expect(unlockedCount).toBeLessThan(CARDS.length);`.

- [ ] **Step 6: Update midgame spectacle test**

Replace the `allows one spectacle skill after its midgame prerequisites` save with:

```ts
const save = {
  ...defaultSave(),
  gold: 1300,
  unlockedCards: {
    root_sharpen: 1,
    survey_rock: 1,
    seed_bombs: 1,
    chain_payout_1: 1,
  },
};
expect(canUnlockCard(save, "alien_crop_mark")).toBe(true);
```

- [ ] **Step 7: Run focused tests again**

Run:

```bash
npm test -- test/cardTree.test.ts test/upgradeTree.test.ts test/progression.test.ts
```

Expected: pass.

---

### Task 4: Verify Runtime Data Integrity

**Files:**
- Read only unless failures require fixes:
  - `test/cardDataIntegrity.test.ts`
  - `test/cardEffects.test.ts`
  - `test/simulation.test.ts`
  - `src/game/systems/CardProgressionSystem.ts`

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass. Vite chunk-size warning is acceptable.

- [ ] **Step 3: Run smoke**

Run:

```bash
npm run smoke
```

Expected: smoke script passes with no app boot error.

- [ ] **Step 4: If total cost differs from `54947`, update the exact test**

Run:

```bash
node -e "const cards=require('./src/game/config/cards.json'); console.log(cards.reduce((sum, card) => sum + card.cost, 0));"
```

Expected:

```text
54947
```

If the output differs because the rebalance script intentionally changed more costs, update `test/cardTree.test.ts` to the printed exact value and add the reason to the commit message.

---

### Task 5: Browser Layout Verification

**Files:**
- Read/verify:
  - `src/game/scenes/UpgradeTreeScene.ts`
  - `src/styles.css`

- [ ] **Step 1: Start local dev server**

Run:

```bash
npm run dev -- --port 5173
```

Expected: Vite starts at `http://localhost:5173/`.

- [ ] **Step 2: Open upgrade tree in browser**

Use browser automation or manual check:

```text
http://localhost:5173/?test=1
```

Actions:
- Open main menu.
- Click `업그레이드`.
- Click `모든 트리 해금`.
- Click `맞춤`.
- Zoom out to `0.1`.

Expected:
- Root at bottom center.
- Equipment branch grows left.
- Harvest branch grows up the center.
- Environment branch grows right.
- Special cards sit on outer left/right edges.
- No cards overlap at default zoom or `0.1` zoom.
- Panning still works.
- Tooltip still appears above pointer/touch point.

- [ ] **Step 3: Capture layout notes**

If a card overlaps visually, do not edit CSS first. Adjust `layout.x` or `layout.y` for that card in `cards.json`, then rerun:

```bash
npm test -- test/cardTree.test.ts test/upgradeTree.test.ts
```

Expected: tests still pass.

---

### Task 6: Commit Implementation

**Files:**
- Commit:
  - `scripts/rebalance-upgrade-tree.mjs`
  - `src/game/config/cards.json`
  - `test/cardTree.test.ts`
  - `test/upgradeTree.test.ts`
  - `test/progression.test.ts`

- [ ] **Step 1: Review status**

Run:

```bash
git status --short
```

Expected tracked changes only in the files above, plus existing unrelated untracked files:

```text
?? .claude/
?? CLAUDE.local-before-main-pull-20260623.md
```

Leave those untracked files alone.

- [ ] **Step 2: Stage implementation files**

Run:

```bash
git add scripts/rebalance-upgrade-tree.mjs src/game/config/cards.json test/cardTree.test.ts test/upgradeTree.test.ts test/progression.test.ts
```

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "카드 트리 시간층 배치 밸런싱"
```

Expected: commit succeeds on branch `codex/업그레이드-트리-밸런싱`.

---

### Task 7: Final Verification Summary

**Files:**
- No file changes expected.

- [ ] **Step 1: Run final commands**

Run:

```bash
npm test
npm run build
npm run smoke
git status --short --branch
```

Expected:
- tests pass.
- build passes.
- smoke passes.
- branch is `codex/업그레이드-트리-밸런싱`.
- only unrelated untracked `.claude/` and `CLAUDE.local-before-main-pull-20260623.md` remain.

- [ ] **Step 2: Report**

Report:
- New layout branch model.
- Major card timing.
- Verification results.
- Whether `scripts/rebalance-upgrade-tree.mjs` was kept.

---

## Self-Review

Spec coverage:
- Time-layer `y` rule covered by Task 1 and Task 2.
- Equipment/harvest/environment/special lane rule covered by Task 1 and Task 2.
- Cost rebalance covered by Task 1 and Task 2.
- Direct prerequisite reachability covered by Task 1.
- 1-hour milestone pacing covered by Task 3.
- Collision and browser layout covered by Task 1 and Task 5.

Placeholder scan:
- No `TBD`.
- No undefined test helper names.
- No path placeholders.

Type consistency:
- Uses existing `CardNode` fields: `tier`, `cost`, `prereq`, `layout`, `sort`.
- Uses existing progression API: `canUnlockCard`, `unlockCard`, `nextAffordableCardGoals`, `isCardUnlocked`.
- Script uses plain JSON fields and does not require runtime TypeScript imports.
