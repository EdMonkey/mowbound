# Card JSON Upgrade Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/game/config/cards.json` the final source of truth for upgrades, unlocks, runtime effects, economy effects, tool/map gates, and the in-game upgrade tree.

**Architecture:** `cards.json` becomes the only upgrade data source. A new card progression layer owns reveal/unlock/gold/gate rules, while a card effect layer folds unlocked cards into runtime/economy stats. The current upgrade prototype scene is promoted into the real upgrade tree UI and the legacy skill tree data/scene/system are removed.

**Tech Stack:** Vite, TypeScript, Three.js DOM overlay UI, Vitest, existing localStorage save model.

---

## File Structure

- Modify: `src/game/config/cards.ts` - strong card types, root id, ids, graph helpers.
- Create: `src/game/config/tools.ts` - `ToolId`, tool ids, tool labels map input type source.
- Modify: `src/game/i18n.ts` - card/gate/effect labels use `CardNode` and `CardEffect`, no `SkillNode`.
- Modify: `src/game/systems/SaveSystem.ts` - save schema v3, `unlockedCards`, v2 migration from `levels`.
- Create: `src/game/systems/CardProgressionSystem.ts` - reveal/unlock/gate/tool/map/next goal rules.
- Create: `src/game/systems/CardEffectSystem.ts` - runtime/economy stat folding and spectacle helper exports.
- Modify: `src/game/scenes/UpgradePrototypeScene.ts` then rename to `src/game/scenes/UpgradeTreeScene.ts` - production upgrade tree driven by cards and save data.
- Modify: `src/game/App.ts`, `src/game/types.ts`, `src/game/scenes/MainMenuScene.ts`, `src/game/scenes/GameScene.ts`, `src/game/ui/CheatPanel.ts`, `src/game/ui/Hud.ts`, `src/game/entities/Player.ts`, `src/game/entities/SummonedAbilities.ts` - replace skill/prototype wiring with card wiring.
- Delete after migration: `src/game/config/skillTree.ts`, `src/game/config/upgradePrototypeTree.ts`, `src/game/scenes/SkillTreeScene.ts`, `src/game/systems/SkillSystem.ts`, `scripts/sync-cards-from-skill-tree.mjs`.
- Modify: `package.json` - remove `sync:cards`.
- Tests: rewrite skill tests into card tests under `test/card*.test.ts`, update simulation/progression imports.

---

### Task 1: Card Types And Data Integrity

**Files:**
- Modify: `src/game/config/cards.ts`
- Create: `src/game/config/tools.ts`
- Test: `test/cardDataIntegrity.test.ts`

- [ ] **Step 1: Write failing data integrity tests**

```ts
import { describe, expect, it } from "vitest";
import { CARD_BY_ID, CARD_ROOT_ID, CARDS, CARD_EFFECT_KINDS } from "../src/game/config/cards";

describe("card data integrity", () => {
  it("has a valid root card and unique ids", () => {
    expect(CARD_BY_ID[CARD_ROOT_ID]?.id).toBe(CARD_ROOT_ID);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(CARDS.length);
  });

  it("only references existing prerequisite cards", () => {
    for (const card of CARDS) {
      for (const prereq of card.prereq) {
        expect(CARD_BY_ID[prereq]?.id).toBe(prereq);
      }
    }
  });

  it("has layout coordinates and non-negative costs", () => {
    for (const card of CARDS) {
      expect(Number.isFinite(card.layout.x)).toBe(true);
      expect(Number.isFinite(card.layout.y)).toBe(true);
      expect(card.cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("contains every runtime effect kind used by card json", () => {
    expect(CARD_EFFECT_KINDS).toContain("attackDamage");
    expect(CARD_EFFECT_KINDS).toContain("toolUnlock");
    expect(CARD_EFFECT_KINDS).toContain("summon");
  });
});
```

- [ ] **Step 2: Run test to verify current baseline**

Run: `npm test -- test/cardDataIntegrity.test.ts`
Expected: PASS after basic export exists, or FAIL on missing `CARD_ROOT_ID` before implementation.

- [ ] **Step 3: Add tool type source**

Create `src/game/config/tools.ts`:

```ts
export const TOOL_IDS = ["default", "wide_sickle", "fast_sickle", "bomb_sickle", "tractor"] as const;
export type ToolId = (typeof TOOL_IDS)[number];
export const SELECTABLE_TOOL_IDS = TOOL_IDS;
```

- [ ] **Step 4: Strengthen card exports**

In `src/game/config/cards.ts`, import `ToolId`, add `CARD_ROOT_ID = "root_sharpen"`, export `CARD_IDS`, keep current JSON shape, and move the `tool?: string` effect field to `tool?: ToolId`. Do not import `skillTree.ts`.

- [ ] **Step 5: Verify**

Run: `npm test -- test/cardDataIntegrity.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/game/config/cards.ts src/game/config/tools.ts test/cardDataIntegrity.test.ts
git commit -m "feat: validate card data source"
```

---

### Task 2: Save Schema V3 With Card Unlocks

**Files:**
- Modify: `src/game/systems/SaveSystem.ts`
- Test: `test/saveSystem.test.ts`

- [ ] **Step 1: Write failing save migration tests**

Add cases:

```ts
import { describe, expect, it } from "vitest";
import { defaultSave, normalizeSave, unlockAllCardsForTest } from "../src/game/systems/SaveSystem";
import { CARDS } from "../src/game/config/cards";

describe("card save schema", () => {
  it("stores unlocked cards in schema v3", () => {
    const save = defaultSave();
    expect(save.schemaVersion).toBe(3);
    expect(save.unlockedCards).toEqual({});
  });

  it("migrates v2 skill levels to unlockedCards when ids still exist in cards.json", () => {
    const save = normalizeSave({
      schemaVersion: 2,
      gold: 30,
      levels: { root_sharpen: 1, missing_node: 1 },
      selectedTool: "default",
      lifetimeStats: {},
    });
    expect(save.schemaVersion).toBe(3);
    expect(save.unlockedCards.root_sharpen).toBe(1);
    expect(save.unlockedCards.missing_node).toBeUndefined();
  });

  it("unlocks all cards for test mode", () => {
    const save = unlockAllCardsForTest(defaultSave());
    expect(Object.keys(save.unlockedCards).length).toBe(CARDS.length);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/saveSystem.test.ts`
Expected: FAIL because `schemaVersion` is still `2` and `unlockedCards` does not exist.

- [ ] **Step 3: Implement schema v3**

Change `SaveData`:

```ts
export interface SaveData {
  schemaVersion: 3;
  gold: number;
  unlockedCards: Record<string, number>;
  selectedTool: ToolId;
  lifetimeStats: LifetimeStats;
}
```

Use `CARD_BY_ID` for validation. Replace `normalizeLevels` with `normalizeUnlockedCards`. `normalizeSave` accepts v3 `unlockedCards`, v2 `levels`, and legacy `unlocked`.

- [ ] **Step 4: Rename test helper**

Replace `unlockAllSkillsForTest` with `unlockAllCardsForTest`. It returns all `CARDS.map((card) => [card.id, 1])`.

- [ ] **Step 5: Verify**

Run: `npm test -- test/saveSystem.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/game/systems/SaveSystem.ts test/saveSystem.test.ts
git commit -m "feat: migrate save data to card unlocks"
```

---

### Task 3: Card Progression System

**Files:**
- Create: `src/game/systems/CardProgressionSystem.ts`
- Modify: `src/game/i18n.ts`
- Test: `test/cardProgression.test.ts`

- [ ] **Step 1: Write failing progression tests**

```ts
import { describe, expect, it } from "vitest";
import { CARD_ROOT_ID } from "../src/game/config/cards";
import {
  canUnlockCard,
  getCardCost,
  getRevealedCards,
  isCardUnlocked,
  unlockCard,
} from "../src/game/systems/CardProgressionSystem";
import { defaultSave } from "../src/game/systems/SaveSystem";

describe("card progression", () => {
  it("reveals root at a new save", () => {
    const save = { ...defaultSave(), gold: 10 };
    expect(getRevealedCards(save).some((card) => card.id === CARD_ROOT_ID)).toBe(true);
    expect(canUnlockCard(save, CARD_ROOT_ID)).toBe(true);
  });

  it("spends gold and unlocks one card", () => {
    const save = unlockCard({ ...defaultSave(), gold: 10 }, CARD_ROOT_ID);
    expect(isCardUnlocked(save, CARD_ROOT_ID)).toBe(true);
    expect(save.gold).toBe(0);
  });

  it("reveals a child when one of its prerequisites is unlocked", () => {
    const save = unlockCard({ ...defaultSave(), gold: 10 }, CARD_ROOT_ID);
    expect(getRevealedCards(save).some((card) => card.prereq.includes(CARD_ROOT_ID))).toBe(true);
    expect(getCardCost("missing")).toBe(Number.POSITIVE_INFINITY);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/cardProgression.test.ts`
Expected: FAIL because `CardProgressionSystem` does not exist.

- [ ] **Step 3: Implement card progression**

Functions to export:

```ts
isCardUnlocked(save, cardId)
isCardRevealed(save, cardId)
areCardGatesSatisfied(save, card)
canUnlockCard(save, cardId)
unlockCard(save, cardId)
getCardCost(cardId)
getRevealedCards(save)
nextAffordableCardGoals(save, limit)
isMapUnlocked(save, mapSize)
canSelectTool(save, tool)
selectTool(save, tool)
```

Rules:
- Revealed if no prereq or at least one prerequisite is unlocked, matching current prototype branch opening.
- Unlock allowed only if every `prereq` is unlocked, gates satisfied, not already unlocked, and enough gold.
- Gates keep current semantics: a card with multiple gates is satisfied when at least one gate passes.
- Tool unlock is detected by any unlocked card effect `{ kind: "toolUnlock", tool }`.
- 30m map unlock is detected by unlocked card effect `{ kind: "unlockMap", mapSize: 30 }`.

- [ ] **Step 4: Update i18n type imports**

Change `i18n.ts` to use `CardNode`, `CardEffect`, and `CardGate` from `cards.ts`. Replace `skillName/skillDescription/effectLabel` with `cardName/cardDescription/cardEffectLabel`. Existing Korean labels can defer to `card.nameKo` and `card.descriptionKo`, so remove the hardcoded `SKILL_KO` table.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- test/cardProgression.test.ts test/cardDataIntegrity.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/game/systems/CardProgressionSystem.ts src/game/i18n.ts test/cardProgression.test.ts
git commit -m "feat: add card progression rules"
```

---

### Task 4: Card Runtime And Economy Effects

**Files:**
- Create: `src/game/systems/CardEffectSystem.ts`
- Modify: `src/game/entities/SummonedAbilities.ts`
- Test: `test/cardEffects.test.ts`
- Modify existing tests: `test/simulation.test.ts`, `test/progression.test.ts`

- [ ] **Step 1: Write failing effect tests**

```ts
import { describe, expect, it } from "vitest";
import { defaultSave } from "../src/game/systems/SaveSystem";
import { getEconomyStats, getRuntimeStats } from "../src/game/systems/CardEffectSystem";

describe("card runtime effects", () => {
  it("folds attack damage and range from unlocked cards", () => {
    const save = {
      ...defaultSave(),
      unlockedCards: { root_sharpen: 1, clean_sweep_1: 1 },
    };
    const stats = getRuntimeStats(save);
    expect(stats.attackDamage).toBe(4);
    expect(stats.attackRangeMeters).toBeCloseTo(0.6);
  });

  it("folds economy effects from unlocked cards", () => {
    const save = {
      ...defaultSave(),
      unlockedCards: { market_cart_1: 1, clean_rows_1: 1 },
    };
    const stats = getEconomyStats(save);
    expect(stats.goldDivisor).toBeCloseTo(3.7);
    expect(stats.cleanPatchScore).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/cardEffects.test.ts`
Expected: FAIL because `CardEffectSystem` does not exist.

- [ ] **Step 3: Move runtime folding from SkillSystem**

Create `CardEffectSystem.ts` by moving current `RuntimeStats`, `SummonRuntime`, `getRuntimeStats`, `getEconomyStats`, `computeCropMarkHits`, `computeLaserHits`, and `computeTractorStripHits`. Replace `SKILL_NODES` iteration with `CARDS` and `isCardUnlocked`.

- [ ] **Step 4: Replace skill types**

`SummonedAbilities.ts` imports `RuntimeStats` and `SummonAbilityId` from `CardEffectSystem`. `SummonAbilityId` and `SummonStatKind` are exported from `cards.ts`.

- [ ] **Step 5: Preserve current behavior**

Keep these effect mappings identical to current `SkillSystem`:
- `attackDamage`, `attackRange`, `attackInterval`, `moveSpeed`, `roundDurationPercent`, `initialGrassCount`
- obstacle, bomb, fire, special, summon, map expand, economy effects
- tool modifiers for `wide_sickle`, `fast_sickle`, `bomb_sickle`, and `tractor`

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- test/cardEffects.test.ts test/simulation.test.ts
```

Expected: PASS for updated card imports; progression curve failures may remain until Task 8 rewrites expected one-hour route.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/game/systems/CardEffectSystem.ts src/game/entities/SummonedAbilities.ts test/cardEffects.test.ts test/simulation.test.ts
git commit -m "feat: fold runtime stats from cards"
```

---

### Task 5: Promote Upgrade Prototype Into Production Upgrade Tree

**Files:**
- Rename: `src/game/scenes/UpgradePrototypeScene.ts` to `src/game/scenes/UpgradeTreeScene.ts`
- Reuse: `src/game/ui/upgradePrototypeInteraction.ts`
- Reuse: `src/game/ui/upgradePrototypeLayoutStorage.ts`
- Delete: `src/game/config/upgradePrototypeTree.ts`
- Test: `test/upgradeTree.test.ts`

- [ ] **Step 1: Write failing upgrade tree data tests**

```ts
import { describe, expect, it } from "vitest";
import { CARD_ROOT_ID, CARDS } from "../src/game/config/cards";
import { defaultSave } from "../src/game/systems/SaveSystem";
import { getRevealedCards } from "../src/game/systems/CardProgressionSystem";

describe("upgrade tree data", () => {
  it("starts from the card root and reveals first branches", () => {
    const save = { ...defaultSave(), gold: 10 };
    const root = getRevealedCards(save).find((card) => card.id === CARD_ROOT_ID);
    expect(root?.nameKo).toBe("첫 날 갈기");
  });

  it("uses every card layout from cards.json", () => {
    expect(CARDS.every((card) => Number.isFinite(card.layout.x) && Number.isFinite(card.layout.y))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- test/upgradeTree.test.ts`
Expected: PASS after Task 3; this guards tree source before UI migration.

- [ ] **Step 3: Rename scene class**

Rename class to `UpgradeTreeScene`. It keeps pan, zoom, pinch, hover, long-press, edit mode, layout save, and all visual branch behavior.

- [ ] **Step 4: Replace prototype node source**

Remove imports from `upgradePrototypeTree.ts`. Use:
- nodes: `getRevealedCards(this.save)`
- all nodes for edit/all unlock: `CARDS`
- id lookup: `CARD_BY_ID`
- node title: `card.nameKo` or `card.nameEn`
- short title: first 4 visible Korean characters or first 8 English characters
- branch class: `category-${card.category}` plus `branch-${card.branch}`
- position: `card.layout`
- prereq: `card.prereq`
- cost: `card.cost`

- [ ] **Step 5: Connect real unlock**

`buildNode(card)` behavior:
- unlocked: `isCardUnlocked(this.save, card.id)`
- available: `canUnlockCard(this.save, card.id)`
- click/tap confirm: calls `unlockCard(this.save, card.id)`, saves through `saveGame`, rerenders
- header gold uses `this.save.gold`
- "모두 해금" uses `unlockAllCardsForTest(loadSave())`, saves, rerenders

- [ ] **Step 6: Keep edit mode**

Layout edit storage must validate against `CARDS.map((card) => card.id)`. Rename localStorage key only if migration is included:
- old key can be read once
- new key: `mowbound-upgrade-tree-layout-v1`

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- test/upgradeTree.test.ts test/upgradePrototypeInteraction.test.ts test/upgradePrototypeLayoutStorage.test.ts
```

Expected: PASS. Interaction/storage test names may remain if helper filenames are not renamed in this task.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/game/scenes/UpgradeTreeScene.ts src/game/ui/upgradePrototypeLayoutStorage.ts test/upgradeTree.test.ts
git rm src/game/scenes/UpgradePrototypeScene.ts src/game/config/upgradePrototypeTree.ts
git commit -m "feat: promote card upgrade tree"
```

---

### Task 6: Wire Game, Menu, HUD, Cheat, Tools To Cards

**Files:**
- Modify: `src/game/App.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/scenes/MainMenuScene.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/ui/CheatPanel.ts`
- Modify: `src/game/ui/Hud.ts`
- Modify: `src/game/entities/Player.ts`
- Test: `test/appRouting.test.ts`, update related tests

- [ ] **Step 1: Write routing/wiring test**

Use focused unit tests where possible:

```ts
import { describe, expect, it } from "vitest";
import { defaultSave } from "../src/game/systems/SaveSystem";
import { canSelectTool, isMapUnlocked } from "../src/game/systems/CardProgressionSystem";

describe("card app gates", () => {
  it("locks 30m and advanced tools until their cards are unlocked", () => {
    const save = defaultSave();
    expect(isMapUnlocked(save, 10)).toBe(true);
    expect(isMapUnlocked(save, 30)).toBe(false);
    expect(canSelectTool(save, "default")).toBe(true);
    expect(canSelectTool(save, "tractor")).toBe(false);
  });
});
```

- [ ] **Step 2: Update SceneName**

Use canonical scene names:

```ts
export type SceneName = "menu" | "game" | "upgrades" | "cardCatalog";
```

Remove `"skills"` and `"upgradePrototype"` from normal app routing.

- [ ] **Step 3: Update App**

Imports:
- remove `SkillTreeScene`
- remove `UpgradePrototypeScene`
- import `UpgradeTreeScene`
- import `isMapUnlocked` from `CardProgressionSystem`

Routing:
- `sceneName === "upgrades"` creates `new UpgradeTreeScene(this)`

- [ ] **Step 4: Update buttons**

Main menu:
- `업그레이드` -> `this.app.show("upgrades")`
- remove `스킬 트리`
- test unlock button calls `unlockAllCardsForTest`

Card catalog:
- `업그레이드` -> `this.app.show("upgrades")`

Result HUD:
- upgrade button text: `업그레이드`
- callback: `this.app.show("upgrades")`

Cheat:
- "모든 스킬 해금" becomes "모든 카드 해금"
- uses `CARDS` and `unlockAllCardsForTest`
- category unlock uses card `category` or `branch`, not `SkillNode.branch`

- [ ] **Step 5: Update GameScene imports**

Replace imports from `SkillSystem` with:
- `getRuntimeStats`, `getEconomyStats`, spectacle helpers from `CardEffectSystem`
- `nextAffordableCardGoals` from `CardProgressionSystem`

Result screen next goals now receives cards, so update `Hud.ts` type from `SkillNode[]` to `CardNode[]` and labels to `card.nameKo/nameEn`.

- [ ] **Step 6: Update tool imports**

`MainMenuScene.ts`, `Player.ts`, and any other `ToolId` import comes from `src/game/config/tools.ts`.

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- test/appRouting.test.ts test/cardProgression.test.ts test/cardEffects.test.ts
npm run build
```

Expected: PASS and build exits 0.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/game/App.ts src/game/types.ts src/game/scenes/MainMenuScene.ts src/game/scenes/GameScene.ts src/game/scenes/CardCatalogScene.ts src/game/ui/CheatPanel.ts src/game/ui/Hud.ts src/game/entities/Player.ts test/appRouting.test.ts
git commit -m "feat: route gameplay through card upgrades"
```

---

### Task 7: Remove Legacy Skill Tree Source

**Files:**
- Delete: `src/game/config/skillTree.ts`
- Delete: `src/game/scenes/SkillTreeScene.ts`
- Delete: `src/game/systems/SkillSystem.ts`
- Delete: `scripts/sync-cards-from-skill-tree.mjs`
- Modify: `package.json`
- Modify tests importing deleted modules

- [ ] **Step 1: Delete old files**

Run:

```bash
git rm src/game/config/skillTree.ts src/game/scenes/SkillTreeScene.ts src/game/systems/SkillSystem.ts scripts/sync-cards-from-skill-tree.mjs
```

- [ ] **Step 2: Remove package script**

Remove `"sync:cards"` from `package.json`.

- [ ] **Step 3: Find remaining legacy imports**

Run:

```bash
rg -F "skillTree" src test
rg -F "SkillSystem" src test
rg -F "SkillTreeScene" src test
rg -F "sync:cards" .
```

Expected: no matches except plan/docs text.

- [ ] **Step 4: Rewrite tests**

Rename or edit:
- `test/skillTree.test.ts` -> `test/cardTree.test.ts`
- `test/progression.test.ts` imports card systems
- `test/simulation.test.ts` imports card effects/progression

Assertions should count `Object.keys(save.unlockedCards).length` instead of `save.levels`.

- [ ] **Step 5: Verify**

Run:

```bash
npm test
npm run build
```

Expected: either all tests pass or only known economy curve expectations fail with explicit updated target notes in Task 8.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json test
git commit -m "refactor: remove legacy skill tree source"
```

---

### Task 8: Balance And Progression Test Rebaseline

**Files:**
- Modify: `test/progression.test.ts`
- Modify: `src/game/config/cards.json` only if costs/reveals need rebaseline
- Modify: `docs/design/mowbound-skill-tree-economy-redesign-spec.md` or create a new card progression note if test target changes

- [ ] **Step 1: Re-run current one-hour simulation**

Run: `npm test -- test/progression.test.ts`
Expected before rebaseline: the known count/spectacle assertions may fail.

- [ ] **Step 2: Decide target assertions**

For the current one-hour demo, keep these gates:
- 60 minutes unlocks more than 26 cards.
- 60 minutes unlocks fewer than 45 cards unless user approves faster curve.
- At least one spectacle or summon card unlocks by 60 minutes.
- The full card tree is not complete by 60 minutes.

- [ ] **Step 3: Adjust progression test**

Update test to read `unlockedCards`, not `levels`, and spectacle/summon ids from `CARDS.filter((card) => card.category === "ability" || card.branch === "spectacle")`.

- [ ] **Step 4: Adjust costs only if needed**

If spectacle/summon does not unlock by 60 minutes, lower one route cost using `cards.json`:
- `summon_codex`
- `alien_crop_mark`
- one prerequisite chain required by those cards

Do not change unrelated late-game cards in this task.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- test/progression.test.ts
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add test/progression.test.ts src/game/config/cards.json docs/design
git commit -m "test: rebaseline card upgrade progression"
```

---

### Task 9: Browser Verification And Vercel Preview

**Files:**
- No source changes unless verification finds a defect.

- [ ] **Step 1: Local verification commands**

Run:

```bash
npm test
npm run build
npm run smoke
```

Expected: all pass.

- [ ] **Step 2: Browser smoke**

Run dev server:

```bash
npm run dev -- --host 127.0.0.1 --port 5182
```

Browser checks:
- Main menu shows `업그레이드`, not `스킬 트리`.
- Upgrade tree opens from cards.
- `첫 날 갈기` shows cost and can be unlocked with enough gold.
- Unlock spends gold and persists after returning to menu.
- A newly unlocked damage/range/card effect changes HUD stats in a run.
- Result screen `업그레이드` button returns to the production tree.
- Cheat menu `모든 카드 해금` unlocks all cards.
- Card catalog still shows `138/138개`.

- [ ] **Step 3: Commit verification fixes**

If fixes were needed:

```bash
git add src test
git commit -m "fix: polish card upgrade runtime"
```

- [ ] **Step 4: Push and deploy preview**

Run:

```bash
git push origin HEAD
npx vercel --yes
npx vercel inspect <preview-url>
```

Expected: Vercel deployment status `Ready`.

---

## Self-Review

- Spec coverage: covers card JSON source, old skill tree removal, production upgrade tree, save migration, runtime effects, economy effects, UI routing, tests, and Vercel preview.
- Placeholder scan: no task depends on unknown files or unnamed functions; every new function has a concrete target file and call site.
- Type consistency: `CardNode/CardEffect/CardGate` replace `SkillNode/SkillEffect/UnlockGate`; `unlockedCards` replaces `levels`; `CardProgressionSystem` owns unlock/reveal/gates; `CardEffectSystem` owns runtime/economy folding.
- Scope: one vertical refactor; large but coherent because all subsystems depend on the same source-of-truth transition.
