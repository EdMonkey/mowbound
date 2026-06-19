# Mowbound Skill Tree Economy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mowbound를 1시간 데모가 가능한 스킬트리/경제 구조로 개편한다.

**Architecture:** 스킬 데이터는 `config/skillTree.ts`, 스킬 계산은 `systems/SkillSystem.ts`, 경제 계산은 `systems/EconomySystem.ts`, 런 결과 저장은 `systems/RunSummarySystem.ts`가 담당한다. `GameScene`은 이벤트를 수집하고 순수 함수에 계산을 위임한다. UI는 스킬 게이트, score waterfall, 다음 목표, tool 선택을 표시한다.

**Tech Stack:** Vite, TypeScript, plain Three.js, Vitest.

---

## 참고 문서

- 기획서: `docs/design/mowbound-skill-tree-economy-redesign-spec.md`
- 리서치: `docs/research/how-to-destroy-a-city-upgrade-economy-analysis.md`

## 전문가 보강 반영

- `seed_bombs`: 10m 15% clear 또는 lifetime grass 500.
- `open_acre`: 10m 30% clear 또는 bomb chain 2+, cost 600g.
- `alien_crop_mark`, `mower_laser`, `tractor_license`: 후반 spectacle 스킬로 추가.
- 총 스킬 비용: 21,593g.
- 60분 목표: 전체 트리 55-74% 완료, spectacle 1개 이상 체험, 나머지는 다음 목표로 남김.
- clean patch 정의: 3초 안에 grass 40개 이상.
- result screen: score waterfall + 다음 구매 3개 + milestone 진행률.
- 새 낫 선택 UI 포함.
- 핵심 VFX/SFX는 1차 범위 포함.
- progression simulation test 필수.

## 검증 게이트 운영 원칙

각 Task는 아래 검증 게이트를 통과해야 완료로 인정한다. 검증을 통과하지 못하면 다음 Task로 넘어갈 수 없다.

운영 규칙:

- Task 수행자는 변경 직후 해당 Gate 명령을 직접 실행한다.
- FAIL, TypeScript error, build error, smoke 실패, 브라우저 확인 실패가 있으면 같은 Task 안에서 수정한다.
- 비용, 노드 수, 게이트 값, progression 목표가 바뀌면 기획서와 구현 계획서를 먼저 동기화한 뒤 다시 검증한다.
- Subagent 작업 시 handoff에는 실행한 명령, 결과, 실패 후 수정 내용을 반드시 남긴다.
- 수동 브라우저 검증이 필요한 Gate는 screenshot 또는 체크리스트 결과가 있어야 완료 처리한다.

## 단계별 검증 계획

| Gate | 적용 Task | 통과 조건 | 다음 단계 진행 조건 |
|---|---|---|---|
| Gate 0 | Task 0 | 기획서에 46개 스킬, 21,593g, spectacle 3종, 55-74% 목표가 모두 명시됨 | 문서 값 불일치가 없을 때 Task 1 진행 |
| Gate 1 | Task 1 | `npm test -- test/skillTree.test.ts` PASS. 46 nodes, total 21,593g, prereq id valid | 스킬 데이터 테스트 통과 후 Task 2 진행 |
| Gate 2 | Task 2 | `npm test -- test/saveSystem.test.ts` PASS. v1 migration, v2 save, lifetimeStats 갱신 확인 | 저장/마이그레이션 통과 후 Task 3 진행 |
| Gate 3 | Task 3 | `npm test -- test/economy.test.ts` PASS. clean patch, clear milestone, gold conversion 확인 | 경제 순수 함수 통과 후 Task 4 진행 |
| Gate 4 | Task 4 | `npm test -- test/skillTree.test.ts test/saveSystem.test.ts` PASS. skill gate, runtime stats, 30m lock 확인 | 스킬 런타임 통과 후 Task 5 진행 |
| Gate 5 | Task 5 | `npm test -- test/economy.test.ts` PASS, `npm run build` PASS. RunSummary와 GameScene 이벤트 연결 확인 | 런 결과 저장/빌드 통과 후 Task 6 진행 |
| Gate 6 | Task 6 | `npm test -- test/skillTree.test.ts` PASS, `npm run build` PASS. multi-prereq DAG와 `branch-spectacle` 표시 확인 | 스킬트리 UI 통과 후 Task 7 진행 |
| Gate 7 | Task 7 | `npm test -- test/skillTree.test.ts` PASS, `npm run build` PASS. 30m locked/unlocked 메뉴 상태 확인 | 맵 게이트 통과 후 Task 8 진행 |
| Gate 8 | Task 8 | `npm test -- test/skillTree.test.ts` PASS, `npm run build` PASS. score waterfall, next goals, milestone 표시 확인 | 결과 화면 통과 후 Task 9 진행 |
| Gate 9 | Task 9 | `npm test -- test/simulation.test.ts` PASS, `npm run build` PASS. obstacle bonus, bomb reward event 확인 | 장애물/폭탄 통과 후 Task 10 진행 |
| Gate 10 | Task 10 | `npm test -- test/skillTree.test.ts` PASS, `npm run build` PASS. Wide/Fast/Bomb/Tractor selector 잠금/선택 확인 | 도구 시스템 통과 후 Task 11 진행 |
| Gate 11 | Task 11 | `npm test -- test/simulation.test.ts` PASS, `npm run build` PASS. crop mark, laser, tractor strip 판정 확인 | spectacle gameplay 통과 후 Task 12 진행 |
| Gate 12 | Task 12 | `npm run build` PASS. SoundSystem no-op fallback, VFX entity import, 이벤트 hook 빌드 확인 | VFX/SFX hook 통과 후 Task 13 진행 |
| Gate 13 | Task 13 | `npm test -- test/progression.test.ts` PASS. 60분 unlock count 범위, spectacle 1개 이상 unlock 가능 확인 | progression 통과 후 Task 14 진행 |
| Gate 14 | Task 14 | `npm test`, `npm run build`, `npm run smoke`, 브라우저 확인 PASS | 전체 릴리즈 후보로 인정 |

## 파일 구조

- 생성: `src/game/config/skillTree.ts`
- 생성: `src/game/systems/SkillSystem.ts`
- 생성: `src/game/systems/RunSummarySystem.ts`
- 수정: `src/game/config/balance.ts`
- 수정: `src/game/systems/SaveSystem.ts`
- 수정: `src/game/systems/EconomySystem.ts`
- 수정: `src/game/scenes/GameScene.ts`
- 수정: `src/game/scenes/MainMenuScene.ts`
- 수정: `src/game/scenes/SkillTreeScene.ts`
- 수정: `src/game/ui/Hud.ts`
- 수정: `src/game/assets/models.ts` only if tool variants need model aliases later.
- 생성: `src/game/entities/CropMark.ts`
- 생성: `src/game/entities/LaserBeam.ts`
- 생성: `src/game/entities/TractorTrail.ts`
- 수정: `src/styles.css`
- 생성: `test/skillTree.test.ts`
- 생성: `test/economy.test.ts`
- 생성: `test/saveSystem.test.ts`
- 생성: `test/progression.test.ts`
- 수정: `test/simulation.test.ts`

---

### Task 0: 1시간 데모 MVP 범위 고정

**Files:**
- Modify: `docs/design/mowbound-skill-tree-economy-redesign-spec.md`

- [ ] **Step 1: 구현 범위 확인**

1시간 데모 필수 구현:

- 스킬 46개 데이터.
- 실제 효과 구현 33개 이상.
- capstone은 최소 7개 실제 효과 구현: `cyclone_cut`, `golden_field`, `harvest_detonation`, `wide_sickle` 또는 `fast_sickle`, `alien_crop_mark`, `mower_laser`, `tractor_license`.
- 새 낫 선택 UI.
- result score waterfall.
- 핵심 VFX/SFX hook.

- [ ] **Step 2: 보류 가능 항목 확인**

정식판으로 미룰 수 있는 항목:

- bespoke GLB 새 낫/트랙터 모델. 데모에서는 기존 sickle scale/color/trail, 플레이어 상단 간이 트랙터 프레임으로 처리.
- 75/90/100% clear bonus.
- 랜드마크 별도 GLB. 데모에서는 황금 잔디 군집으로 대체.

- [ ] **Step 3: 커밋**

```bash
git add docs/design/mowbound-skill-tree-economy-redesign-spec.md
git commit -m "docs: lock one hour demo scope"
```

---

### Task 1: 스킬 데이터 모델 작성

**Files:**
- Create: `src/game/config/skillTree.ts`
- Modify: `src/game/config/balance.ts`
- Test: `test/skillTree.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`test/skillTree.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SKILL_NODE_BY_ID, SKILL_NODES, SKILL_ROOT } from "../src/game/config/skillTree";

describe("v2 skill tree data", () => {
  it("contains 46 nodes and revised total cost", () => {
    expect(SKILL_NODES).toHaveLength(46);
    expect(SKILL_NODES.reduce((sum, node) => sum + node.cost, 0)).toBe(21593);
    expect(SKILL_ROOT).toBe("root_sharpen");
  });

  it("uses the revised expert-reviewed unlock costs", () => {
    const costs = Object.fromEntries(SKILL_NODES.map((node) => [node.id, node.cost]));
    expect(costs).toMatchObject({
      root_sharpen: 10,
      sharp_edge_1: 18,
      sharp_edge_2: 60,
      clean_sweep_1: 28,
      clean_sweep_2: 90,
      quick_recovery_1: 35,
      quick_recovery_2: 130,
      heavy_edge: 110,
      cyclone_cut: 1200,
      light_boots_1: 14,
      light_boots_2: 55,
      field_rhythm_1: 32,
      field_rhythm_2: 125,
      sprint_harvest: 260,
      long_day: 700,
      market_cart_1: 20,
      market_cart_2: 80,
      clean_rows_1: 26,
      clean_rows_2: 110,
      bulk_buyer_1: 75,
      bulk_buyer_2: 210,
      golden_field: 380,
      accountant: 1200,
      stone_chips: 70,
      wood_haul: 95,
      stump_grinder: 160,
      recoil_training: 120,
      quarry_blade: 240,
      clearcut: 360,
      lumberjack: 1400,
      seed_bombs: 160,
      fuse_training_1: 190,
      blast_control_1: 220,
      chain_payout_1: 260,
      fuse_training_2: 780,
      blast_control_2: 850,
      harvest_detonation: 1800,
      open_acre: 600,
      dense_growth: 220,
      fertile_soil: 300,
      wide_sickle: 1200,
      fast_sickle: 1200,
      bomb_sickle: 1500,
      alien_crop_mark: 1200,
      mower_laser: 1500,
      tractor_license: 2200,
    });
  });

  it("keeps all prereq ids valid", () => {
    for (const node of SKILL_NODES) {
      for (const prereq of node.prereq) {
        expect(SKILL_NODE_BY_ID[prereq], `${node.id} prereq ${prereq}`).toBeDefined();
      }
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/skillTree.test.ts`

Expected: FAIL. `skillTree` module 없음.

- [ ] **Step 3: `skillTree.ts` 생성**

필수 타입:

```ts
export type ToolId = "default" | "wide_sickle" | "fast_sickle" | "bomb_sickle" | "tractor";
export type SkillBranch = "root" | "blade" | "movement" | "harvest" | "obstacles" | "bombs" | "land" | "spectacle";

export type UnlockGate =
  | { kind: "bestClearPercent"; mapSize: number; percent: number }
  | { kind: "lifetimeGrass"; count: number }
  | { kind: "bestBombChain"; length: number };

export interface SkillNode {
  id: string;
  name: string;
  branch: SkillBranch;
  icon: string;
  cost: number;
  prereq: string[];
  gates: UnlockGate[];
  effects: SkillEffect[];
  description: string;
}
```

`SKILL_NODES`는 기획서의 46개 표와 정확히 일치.

- [ ] **Step 4: `balance.ts` re-export**

기존 `SKILL_NODES` 정의 제거. 끝에 추가:

```ts
export {
  SKILL_NODES,
  SKILL_NODE_BY_ID,
  SKILL_ROOT,
  type SkillNode,
  type SkillEffect,
} from "./skillTree";
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- test/skillTree.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/game/config/skillTree.ts src/game/config/balance.ts test/skillTree.test.ts
git commit -m "feat: define expert reviewed skill tree"
```

---

### Task 2: SaveData v2와 v1 마이그레이션

**Files:**
- Modify: `src/game/systems/SaveSystem.ts`
- Test: `test/saveSystem.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`test/saveSystem.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultSave, normalizeSave, applyRunResultToSave } from "../src/game/systems/SaveSystem";

describe("save v2", () => {
  it("creates v2 save with lifetime stats", () => {
    expect(defaultSave()).toEqual({
      schemaVersion: 2,
      gold: 0,
      levels: {},
      selectedTool: "default",
      lifetimeStats: {
        grassCut: 0,
        rocksBroken: 0,
        treesCut: 0,
        bombsTriggered: 0,
        bestBombChain: 0,
        bestClearPercentByMap: {},
      },
    });
  });

  it("migrates v1 totalGold and known unlocks", () => {
    const save = normalizeSave({ totalGold: 99, unlocked: ["dmg1", "dmg2", "gold1", "unknown"] });
    expect(save.gold).toBe(99);
    expect(save.levels.root_sharpen).toBe(1);
    expect(save.levels.sharp_edge_1).toBe(1);
    expect(save.levels.market_cart_1).toBe(1);
    expect(save.levels.unknown).toBeUndefined();
  });

  it("updates lifetime stats from run result", () => {
    const save = applyRunResultToSave(defaultSave(), {
      gold: 12,
      grassCut: 100,
      rocksBroken: 2,
      treesCut: 1,
      bombsTriggered: 3,
      bestBombChain: 3,
      mapSize: 10,
      clearPercent: 18,
    });

    expect(save.gold).toBe(12);
    expect(save.lifetimeStats.grassCut).toBe(100);
    expect(save.lifetimeStats.rocksBroken).toBe(2);
    expect(save.lifetimeStats.treesCut).toBe(1);
    expect(save.lifetimeStats.bombsTriggered).toBe(3);
    expect(save.lifetimeStats.bestBombChain).toBe(3);
    expect(save.lifetimeStats.bestClearPercentByMap["10"]).toBe(18);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/saveSystem.test.ts`

Expected: FAIL. v2 save 함수 없음.

- [ ] **Step 3: save v2 구현**

`SaveSystem.ts`:

```ts
export const STORAGE_KEY = "mowbound-save-v2";
export const OLD_STORAGE_KEY = "mowbound-save-v1";
```

`loadSave()`는 v2 먼저 읽고, 없으면 v1을 읽어 normalize.

- [ ] **Step 4: `applyRunResultToSave()` 구현**

```ts
export interface RunSaveResult {
  gold: number;
  grassCut: number;
  rocksBroken: number;
  treesCut: number;
  bombsTriggered: number;
  bestBombChain: number;
  mapSize: number;
  clearPercent: number;
}
```

누적값은 더하고 best 값은 max.

- [ ] **Step 5: 테스트 통과**

Run: `npm test -- test/saveSystem.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/game/systems/SaveSystem.ts test/saveSystem.test.ts
git commit -m "feat: add v2 save and run stat migration"
```

---

### Task 3: 이벤트 기반 경제와 clean patch

**Files:**
- Modify: `src/game/systems/EconomySystem.ts`
- Test: `test/economy.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`test/economy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clearPercentScore,
  detectCleanPatchCount,
  goldFromScore,
  scoreRun,
  type EconomyStats,
} from "../src/game/systems/EconomySystem";

const baseStats: EconomyStats = {
  goldDivisor: 4,
  goldMultiplier: 1,
  grassScoreMultiplier: 1,
  cleanPatchScore: 0,
  clearBonusPercent: 0,
  rockScore: 0,
  treeScore: 0,
  bombChainScore: 0,
  firstBombScoreMultiplier: 1,
  obstacleScoreMultiplier: 1,
  largeMapBonusCap: 1,
};

describe("event economy", () => {
  it("converts grass score to gold", () => {
    const result = scoreRun([{ kind: "grassCut", count: 40 }], baseStats);
    expect(result.totalScore).toBe(40);
    expect(goldFromScore(result.totalScore, baseStats)).toBe(10);
  });

  it("uses 5/10/20/35/50 clear milestones", () => {
    expect(clearPercentScore(4, 0)).toBe(0);
    expect(clearPercentScore(5, 0)).toBe(10);
    expect(clearPercentScore(10, 0)).toBe(35);
    expect(clearPercentScore(50, 0)).toBe(465);
  });

  it("detects clean patches as 40 grass within 3 seconds", () => {
    const cuts = Array.from({ length: 40 }, (_, index) => index * 50);
    expect(detectCleanPatchCount(cuts, 3000, 40)).toBe(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/economy.test.ts`

Expected: FAIL. 신규 함수 없음.

- [ ] **Step 3: 경제 함수 구현**

`RunScoreEvent`:

```ts
export type RunScoreEvent =
  | { kind: "grassCut"; count: number }
  | { kind: "cleanPatch"; count: number }
  | { kind: "rockBroken"; count: number }
  | { kind: "treeBroken"; count: number }
  | { kind: "bombChain"; chainLength: number; firstBomb: boolean }
  | { kind: "clearPercent"; percent: number; mapSize: number };
```

`clearPercentScore` milestones: 5/10/20/35/50.

- [ ] **Step 4: 기존 `rewardForGrass` 호환 유지**

기존 테스트/호출 보호:

```ts
export function rewardForGrass(stats: { goldPerGrass?: number }, destroyedCount: number): number {
  return (stats.goldPerGrass ?? 1) * Math.max(0, Math.floor(destroyedCount));
}
```

- [ ] **Step 5: 테스트 통과**

Run: `npm test -- test/economy.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/game/systems/EconomySystem.ts test/economy.test.ts
git commit -m "feat: add event economy and clean patch scoring"
```

---

### Task 4: SkillSystem 런타임 스탯과 게이트

**Files:**
- Create: `src/game/systems/SkillSystem.ts`
- Modify: `src/game/systems/SaveSystem.ts`
- Test: `test/skillTree.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`test/skillTree.test.ts` 추가:

```ts
import { canUnlockNode, getRuntimeStats, isMapUnlocked, unlockNode } from "../src/game/systems/SkillSystem";
import { defaultSave } from "../src/game/systems/SaveSystem";

it("applies root and blade damage", () => {
  let save = { ...defaultSave(), gold: 999 };
  save = unlockNode(save, "root_sharpen");
  save = unlockNode(save, "sharp_edge_1");
  expect(getRuntimeStats(save).attackDamage).toBe(5);
});

it("uses softened seed_bombs gate", () => {
  const save = { ...defaultSave(), gold: 999, levels: { root_sharpen: 1 } };
  expect(canUnlockNode(save, "seed_bombs")).toBe(false);
  const cleared = {
    ...save,
    lifetimeStats: { ...save.lifetimeStats, bestClearPercentByMap: { "10": 15 } },
  };
  expect(canUnlockNode(cleared, "seed_bombs")).toBe(true);
});

it("locks 30m until open_acre is unlocked", () => {
  const save = defaultSave();
  expect(isMapUnlocked(save, 10)).toBe(true);
  expect(isMapUnlocked(save, 30)).toBe(false);
  expect(isMapUnlocked({ ...save, levels: { open_acre: 1 } }, 30)).toBe(true);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/skillTree.test.ts`

Expected: FAIL. `SkillSystem` 없음.

- [ ] **Step 3: `SkillSystem.ts` 구현**

필수 export:

```ts
export function isNodeUnlocked(save: SaveData, nodeId: string): boolean;
export function isNodeRevealed(save: SaveData, nodeId: string): boolean;
export function canUnlockNode(save: SaveData, nodeId: string): boolean;
export function unlockNode(save: SaveData, nodeId: string): SaveData;
export function getNodeCost(nodeId: string): number;
export function getRuntimeStats(save: SaveData): RuntimeStats;
export function getEconomyStats(save: SaveData): EconomyStats;
export function isMapUnlocked(save: SaveData, mapSize: number): boolean;
export function nextAffordableGoals(save: SaveData, limit?: number): SkillNode[];
```

- [ ] **Step 4: gate evaluator 구현**

`bestClearPercent`, `lifetimeGrass`, `bestBombChain` 지원.

- [ ] **Step 5: 테스트 통과**

Run: `npm test -- test/skillTree.test.ts test/saveSystem.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/game/systems/SkillSystem.ts src/game/systems/SaveSystem.ts test/skillTree.test.ts
git commit -m "feat: apply skill gates and runtime stats"
```

---

### Task 5: RunSummarySystem과 GameScene 이벤트 연결

**Files:**
- Create: `src/game/systems/RunSummarySystem.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Test: `test/economy.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`test/economy.test.ts` 추가:

```ts
import { summarizeRun } from "../src/game/systems/RunSummarySystem";

it("summarizes run events into save stats and gold", () => {
  const summary = summarizeRun(
    [
      { kind: "grassCut", count: 80 },
      { kind: "rockBroken", count: 1 },
      { kind: "clearPercent", percent: 10, mapSize: 10 },
    ],
    { ...baseStats, rockScore: 25 },
    10,
  );

  expect(summary.gold).toBeGreaterThan(0);
  expect(summary.grassCut).toBe(80);
  expect(summary.rocksBroken).toBe(1);
  expect(summary.clearPercent).toBe(10);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/economy.test.ts`

Expected: FAIL. `RunSummarySystem` 없음.

- [ ] **Step 3: `RunSummarySystem.ts` 구현**

`summarizeRun(events, economyStats, mapSize)`는 다음을 반환:

```ts
export interface RunSummary {
  score: RunScoreResult;
  gold: number;
  grassCut: number;
  rocksBroken: number;
  treesCut: number;
  bombsTriggered: number;
  bestBombChain: number;
  mapSize: number;
  clearPercent: number;
}
```

- [ ] **Step 4: `GameScene` 즉시 골드 누적 제거**

제거 대상:

- 폭탄 처리 중 `this.roundGold += rewardForGrass(...)`
- 공격 처리 중 `this.roundGold += rewardForGrass(...)`

대신 `scoreEvents`에 기록하고 HUD에는 preview만 표시.

- [ ] **Step 5: `endRound()`에서 summary 계산/저장**

`endRound()`:

```ts
const summary = summarizeRun(this.scoreEvents, getEconomyStats(this.save), this.mapSize);
this.roundGold = summary.gold;
this.save = applyRunResultToSave(this.save, summary);
saveGame(this.save);
```

- [ ] **Step 6: 테스트/빌드**

Run: `npm test -- test/economy.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/game/systems/RunSummarySystem.ts src/game/scenes/GameScene.ts test/economy.test.ts
git commit -m "feat: summarize runs from score events"
```

---

### Task 6: SkillTreeScene multi-prereq DAG UI

**Files:**
- Modify: `src/game/scenes/SkillTreeScene.ts`
- Modify: `src/styles.css`
- Test: `test/skillTree.test.ts`

- [ ] **Step 1: multi-prereq reveal 테스트 추가**

```ts
it("reveals nodes only when all prereqs and gates are satisfied", () => {
  const partial = { ...defaultSave(), levels: { clean_sweep_2: 1 } };
  expect(canUnlockNode({ ...partial, gold: 999 }, "cyclone_cut")).toBe(false);

  const complete = { ...defaultSave(), gold: 999, levels: { clean_sweep_2: 1, quick_recovery_2: 1 } };
  expect(canUnlockNode(complete, "cyclone_cut")).toBe(true);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/skillTree.test.ts`

Expected: FAIL if old single-prereq behavior remains.

- [ ] **Step 3: UI import 교체**

`SkillTreeScene.ts`는 `config/skillTree.ts`와 `SkillSystem.ts`를 사용.

- [ ] **Step 4: DAG layout**

primary parent:

```ts
const primaryParent = node.prereq[0] ?? null;
```

추가 prereq는 얇은 보조선으로 렌더.

- [ ] **Step 5: gate 표시**

노드 상세에 표시:

```txt
Gate: 10m clear 15%
Progress: 12/15%
```

- [ ] **Step 6: branch 색상 CSS**

`branch-blade`, `branch-movement`, `branch-harvest`, `branch-obstacles`, `branch-bombs`, `branch-land`, `branch-spectacle`.

- [ ] **Step 7: 테스트/빌드**

Run: `npm test -- test/skillTree.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add src/game/scenes/SkillTreeScene.ts src/styles.css test/skillTree.test.ts
git commit -m "feat: render gated skill DAG"
```

---

### Task 7: 30m 맵 게이트와 메뉴

**Files:**
- Modify: `src/game/scenes/MainMenuScene.ts`
- Modify: `src/game/App.ts`
- Test: `test/skillTree.test.ts`

- [ ] **Step 1: 30m 잠금 테스트는 Task 4 테스트 사용**

이미 `isMapUnlocked` 테스트가 존재해야 함.

- [ ] **Step 2: 메뉴 잠금 UI 구현**

30m locked:

```txt
30x30 Locked
Need: Open Acre
```

- [ ] **Step 3: 게임 시작 보정**

잠긴 맵으로 `GameScene` 진입 시 10m로 되돌림.

- [ ] **Step 4: 테스트/빌드**

Run: `npm test -- test/skillTree.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/game/scenes/MainMenuScene.ts src/game/App.ts
git commit -m "feat: lock large map behind skill gate"
```

---

### Task 8: 결과 화면 score waterfall

**Files:**
- Modify: `src/game/ui/Hud.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Test: `test/skillTree.test.ts`

- [ ] **Step 1: next goals 테스트**

```ts
import { nextAffordableGoals } from "../src/game/systems/SkillSystem";

it("returns next goals sorted by cost", () => {
  const save = { ...defaultSave(), gold: 25, levels: { root_sharpen: 1 } };
  expect(nextAffordableGoals(save, 3).map((node) => node.id)).toEqual([
    "light_boots_1",
    "sharp_edge_1",
    "market_cart_1",
  ]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/skillTree.test.ts`

Expected: FAIL if `nextAffordableGoals` 없음.

- [ ] **Step 3: Hud result 확장**

`showResult()` 인자:

```ts
showResult(roundGold: number, callbacks: ResultCallbacks, summary: RunSummary, goals: SkillNode[]): void
```

표시:

- Grass
- Clean Rows
- Obstacles
- Bomb Chains
- Clear Bonus
- Multipliers
- Gold
- Next Goals
- Milestones

- [ ] **Step 4: CSS 추가**

`result-breakdown`, `result-breakdown-row`, `next-goals`, `milestone-row`.

- [ ] **Step 5: 테스트/빌드**

Run: `npm test -- test/skillTree.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/game/ui/Hud.ts src/game/scenes/GameScene.ts src/styles.css test/skillTree.test.ts
git commit -m "feat: show run score waterfall"
```

---

### Task 9: 장애물/폭탄 보상과 gameplay effect 연결

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/systems/ObstacleSystem.ts`
- Modify: `src/game/systems/BombSystem.ts`
- Test: `test/simulation.test.ts`

- [ ] **Step 1: obstacle damage 테스트**

```ts
it("applies obstacle bonus damage", () => {
  const rock = createObstacleState("r", "rock", { x: 0.3, z: 0 }, 5, 0.3);
  const result = resolveObstacleAttack({
    origin: { x: 0, z: 0 },
    direction: { x: 1, z: 0 },
    range: 0.5,
    arcDegrees: 360,
    damage: 4,
    obstacleDamageBonus: 2,
    obstacles: [rock],
  });
  expect(result.destroyedIds).toEqual(["r"]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/simulation.test.ts`

Expected: FAIL. `obstacleDamageBonus` 없음.

- [ ] **Step 3: obstacle damage 구현**

`ObstacleAttackRequest`에 `obstacleDamageBonus?: number`.

- [ ] **Step 4: bomb stats 연결**

폭탄 count/radius/chain radius는 `getRuntimeStats(save)` 결과를 사용.

- [ ] **Step 5: event 기록**

rock/tree/bomb chain 이벤트를 `scoreEvents`에 기록.

- [ ] **Step 6: 테스트/빌드**

Run: `npm test -- test/simulation.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/game/scenes/GameScene.ts src/game/systems/ObstacleSystem.ts src/game/systems/BombSystem.ts test/simulation.test.ts
git commit -m "feat: connect obstacle and bomb rewards"
```

---

### Task 10: 새 낫 선택 UI와 tool runtime

**Files:**
- Modify: `src/game/scenes/SkillTreeScene.ts`
- Modify: `src/game/scenes/MainMenuScene.ts`
- Modify: `src/game/systems/SkillSystem.ts`
- Modify: `src/game/entities/Player.ts`
- Modify: `src/styles.css`
- Test: `test/skillTree.test.ts`

- [ ] **Step 1: selected tool 테스트**

```ts
import { canSelectTool, selectTool } from "../src/game/systems/SkillSystem";

it("allows selecting only unlocked tools", () => {
  const save = defaultSave();
  expect(canSelectTool(save, "wide_sickle")).toBe(false);
  expect(canSelectTool(save, "tractor")).toBe(false);
  const unlocked = { ...save, levels: { wide_sickle: 1 } };
  expect(canSelectTool(unlocked, "wide_sickle")).toBe(true);
  expect(selectTool(unlocked, "wide_sickle").selectedTool).toBe("wide_sickle");
  const tractorUnlocked = { ...save, levels: { tractor_license: 1 } };
  expect(canSelectTool(tractorUnlocked, "tractor")).toBe(true);
  expect(selectTool(tractorUnlocked, "tractor").selectedTool).toBe("tractor");
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/skillTree.test.ts`

Expected: FAIL. tool 함수 없음.

- [ ] **Step 3: tool runtime 구현**

`wide_sickle`, `fast_sickle`, `bomb_sickle`, `tractor` stats modifier 적용.

- [ ] **Step 4: UI 구현**

스킬트리 또는 메뉴에 tool selector 추가:

- Default
- Wide
- Fast
- Bomb
- Tractor

잠긴 도구는 disabled.

- [ ] **Step 5: Player visual hook**

데모 범위에서는 model 교체 대신 sickle scale/trail/material tint, 트랙터는 플레이어 상단 간이 프레임과 바퀴 자국 trail을 사용.

- [ ] **Step 6: 테스트/빌드**

Run: `npm test -- test/skillTree.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/game/scenes/SkillTreeScene.ts src/game/scenes/MainMenuScene.ts src/game/systems/SkillSystem.ts src/game/entities/Player.ts src/styles.css test/skillTree.test.ts
git commit -m "feat: add selectable sickle tools"
```

---

### Task 11: Spectacle 스킬 gameplay effect

**Files:**
- Create: `src/game/entities/CropMark.ts`
- Create: `src/game/entities/LaserBeam.ts`
- Create: `src/game/entities/TractorTrail.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/systems/SkillSystem.ts`
- Test: `test/simulation.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`test/simulation.test.ts` 추가:

```ts
import { computeCropMarkHits, computeLaserHits, computeTractorStripHits } from "../src/game/systems/SkillSystem";

it("alien crop mark cuts grass inside the stamped circle", () => {
  const hits = computeCropMarkHits(
    [
      { id: "a", x: 0, z: 0, alive: true },
      { id: "b", x: 1.3, z: 0, alive: true },
      { id: "c", x: 3, z: 0, alive: true },
    ],
    { x: 0, z: 0 },
    1.2,
  );
  expect(hits).toEqual(["a"]);
});

it("mower laser cuts a narrow forward line and can trigger bombs", () => {
  const result = computeLaserHits({
    origin: { x: 0, z: 0 },
    direction: { x: 1, z: 0 },
    length: 6,
    width: 0.3,
    grass: [
      { id: "g1", x: 2, z: 0.1, alive: true },
      { id: "g2", x: 2, z: 0.4, alive: true },
    ],
    bombs: [
      { id: "b1", x: 4, z: 0.05, triggered: false },
      { id: "b2", x: 7, z: 0, triggered: false },
    ],
  });
  expect(result.grassIds).toEqual(["g1"]);
  expect(result.bombIds).toEqual(["b1"]);
});

it("tractor strip cuts a wide rectangle in front of the player", () => {
  const hits = computeTractorStripHits({
    origin: { x: 0, z: 0 },
    direction: { x: 1, z: 0 },
    length: 1.2,
    width: 1.2,
    grass: [
      { id: "front", x: 0.8, z: 0.4, alive: true },
      { id: "side", x: 0.8, z: 0.8, alive: true },
      { id: "back", x: -0.2, z: 0, alive: true },
    ],
  });
  expect(hits).toEqual(["front"]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/simulation.test.ts`

Expected: FAIL. spectacle 판정 함수 없음.

- [ ] **Step 3: 판정 함수 구현**

`SkillSystem.ts`에 순수 판정 함수 추가:

```ts
export interface CuttablePoint {
  id: string;
  x: number;
  z: number;
  alive: boolean;
}

export interface BombPoint {
  id: string;
  x: number;
  z: number;
  triggered: boolean;
}

export interface LaserHitRequest {
  origin: { x: number; z: number };
  direction: { x: number; z: number };
  length: number;
  width: number;
  grass: CuttablePoint[];
  bombs: BombPoint[];
}

export interface StripHitRequest {
  origin: { x: number; z: number };
  direction: { x: number; z: number };
  length: number;
  width: number;
  grass: CuttablePoint[];
}

function normalize2(v: { x: number; z: number }): { x: number; z: number } {
  const length = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / length, z: v.z / length };
}

function isInForwardStrip(
  point: { x: number; z: number },
  origin: { x: number; z: number },
  direction: { x: number; z: number },
  length: number,
  width: number,
): boolean {
  const dir = normalize2(direction);
  const dx = point.x - origin.x;
  const dz = point.z - origin.z;
  const forward = dx * dir.x + dz * dir.z;
  const side = Math.abs(dx * -dir.z + dz * dir.x);
  return forward >= 0 && forward <= length && side <= width / 2;
}

export function computeCropMarkHits(grass: CuttablePoint[], center: { x: number; z: number }, radius: number): string[] {
  const radiusSq = radius * radius;
  return grass
    .filter((item) => item.alive && (item.x - center.x) ** 2 + (item.z - center.z) ** 2 <= radiusSq)
    .map((item) => item.id);
}

export function computeLaserHits(request: LaserHitRequest): { grassIds: string[]; bombIds: string[] } {
  return {
    grassIds: request.grass
      .filter((item) => item.alive && isInForwardStrip(item, request.origin, request.direction, request.length, request.width))
      .map((item) => item.id),
    bombIds: request.bombs
      .filter((item) => !item.triggered && isInForwardStrip(item, request.origin, request.direction, request.length, request.width))
      .map((item) => item.id),
  };
}

export function computeTractorStripHits(request: StripHitRequest): string[] {
  return request.grass
    .filter((item) => item.alive && isInForwardStrip(item, request.origin, request.direction, request.length, request.width))
    .map((item) => item.id);
}
```

- [ ] **Step 4: `GameScene` 런타임 연결**

- `alien_crop_mark` unlocked: 12초마다 다음 공격 위치에 예고 mark 생성, 0.4초 뒤 `computeCropMarkHits` 결과 절단.
- `mower_laser` unlocked: 8번째 공격마다 `computeLaserHits` 실행, grass 절단과 bomb 즉시 기폭.
- selected tool `tractor`: 이동 중 0.2초마다 `computeTractorStripHits` 실행. 회전 반응은 input direction lerp를 기존보다 느리게 적용.

- [ ] **Step 5: 경량 visual entity 생성**

- `CropMark.ts`: 예고 ring + 낙인 shockwave mesh.
- `LaserBeam.ts`: 0.15초 유지되는 얇은 beam mesh.
- `TractorTrail.ts`: 0.8초 fade되는 strip/바퀴 자국 mesh.

- [ ] **Step 6: 테스트/빌드**

Run: `npm test -- test/simulation.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/game/entities/CropMark.ts src/game/entities/LaserBeam.ts src/game/entities/TractorTrail.ts src/game/scenes/GameScene.ts src/game/systems/SkillSystem.ts test/simulation.test.ts
git commit -m "feat: add spectacle skill effects"
```

---

### Task 12: 핵심 VFX/SFX hook

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/entities/Player.ts`
- Modify: `src/game/entities/Explosions.ts`
- Modify: `src/game/entities/Debris.ts`
- Modify: `src/game/entities/CropMark.ts`
- Modify: `src/game/entities/LaserBeam.ts`
- Modify: `src/game/entities/TractorTrail.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: VFX 매트릭스 구현 범위 확인**

필수:

- Blade trail.
- Speed streak.
- Golden field tint.
- Bomb chain pulse.
- Tool-specific trail.
- Alien crop mark stamp.
- Laser beam flash.
- Tractor strip/trail.
- Unlock splash.

- [ ] **Step 2: SFX hook은 무음 fallback**

오디오 파일이 없어도 `SoundSystem.play("event")` 호출부를 먼저 둔다. 파일이 없으면 no-op.

- [ ] **Step 3: `SoundSystem.ts` 생성**

```ts
export type SoundId =
  | "swing"
  | "grass"
  | "coin"
  | "rock"
  | "tree"
  | "bomb"
  | "purchase"
  | "unlock"
  | "tool"
  | "alienStamp"
  | "laser"
  | "tractor";

export class SoundSystem {
  play(_id: SoundId): void {
    return;
  }
}
```

- [ ] **Step 4: 이벤트별 hook 연결**

실제 음원 전까지 no-op 유지. 빌드 깨짐 방지.

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/game src/styles.css
git commit -m "feat: add demo feedback hooks"
```

---

### Task 13: Progression simulation

**Files:**
- Create: `test/progression.test.ts`

- [ ] **Step 1: 시뮬레이션 테스트 작성**

`test/progression.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultSave } from "../src/game/systems/SaveSystem";
import { canUnlockNode, nextAffordableGoals, unlockNode } from "../src/game/systems/SkillSystem";

const demoGoldByRun = [
  18, 22, 26, 32, 38,
  46, 55, 66, 80, 96,
  115, 138, 165, 198, 235,
  275, 320, 370, 430, 500,
  580, 660, 740, 820, 900,
  980, 1060, 1140, 1220, 1300,
];

describe("one hour demo progression", () => {
  it("allows early purchases in the first two runs", () => {
    let save = defaultSave();
    save = { ...save, gold: demoGoldByRun[0] };
    expect(nextAffordableGoals(save, 3).map((node) => node.id)).toContain("root_sharpen");
  });

  it("does not complete the whole tree within the 60 minute target curve", () => {
    let save = defaultSave();
    for (const gold of demoGoldByRun) {
      save = { ...save, gold: save.gold + gold };
      let bought = true;
      while (bought) {
        bought = false;
        const next = nextAffordableGoals(save, 1)[0];
        if (next && canUnlockNode(save, next.id)) {
          save = unlockNode(save, next.id);
          bought = true;
        }
      }
    }
    const unlockedCount = Object.keys(save.levels).length;
    expect(unlockedCount).toBeGreaterThanOrEqual(26);
    expect(unlockedCount).toBeLessThanOrEqual(34);
  });

  it("allows one spectacle skill after its midgame prerequisites", () => {
    const save = {
      ...defaultSave(),
      gold: 1200,
      levels: {
        root_sharpen: 1,
        clean_sweep_1: 1,
        clean_sweep_2: 1,
        seed_bombs: 1,
        chain_payout_1: 1,
      },
    };
    expect(canUnlockNode(save, "alien_crop_mark")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- test/progression.test.ts`

Expected: FAIL until skill/save systems exist.

- [ ] **Step 3: 테스트 조정**

시뮬레이션은 자동 구매가 비용순이라 실제 플레이보다 단순하다. 실패하면 비용/게이트를 조정하되 목표는 유지:

- 60분 unlock count 26-34.
- 전체 46개 완료 금지.
- spectacle 스킬 1개 이상은 60분 안에 unlock 가능.
- `seed_bombs`, `open_acre`는 해당 milestone 없이는 잠김.

- [ ] **Step 4: 테스트 통과**

Run: `npm test -- test/progression.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add test/progression.test.ts
git commit -m "test: lock one hour demo progression"
```

---

### Task 14: 전체 검증

**Files:**
- Modify: `AGENTS.md` if final gameplay values differ.

- [ ] **Step 1: 전체 테스트**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: 빌드**

Run: `npm run build`

Expected: build succeeds. Existing large chunk warning is acceptable.

- [ ] **Step 3: smoke**

Run: `npm run smoke`

Expected: `Smoke OK: dist/index.html exists and references bundled assets.`

- [ ] **Step 4: 브라우저 확인**

Run: `npm run dev -- --port 5173`

확인:

- 10m 선택 가능.
- 30m는 `open_acre` 전 잠김.
- 1런 후 score waterfall 표시.
- 다음 목표 3개 표시.
- `seed_bombs` milestone 진행률 표시.
- 46개 노드 branch 색상 표시.
- 새 낫 selector 표시.
- `alien_crop_mark` 예고 문양과 낙인 절단 확인.
- `mower_laser` 전방 광선과 폭탄 즉시 기폭 확인.
- `tractor_license` 선택 후 전방 strip 절단 확인.
- 모바일 joystick 유지.

- [ ] **Step 5: 문서 동기화**

값 변경 시 수정:

- `docs/design/mowbound-skill-tree-economy-redesign-spec.md`
- `docs/superpowers/plans/2026-06-19-mowbound-skill-tree-economy-redesign.md`
- `AGENTS.md`

- [ ] **Step 6: 최종 커밋**

```bash
git add .
git commit -m "feat: redesign skill tree economy demo"
```

---

## Self-Review

- Spec coverage: 전문가 3명 피드백 모두 반영됨. 게이트, 비용, 시각 피드백, save migration, clean patch, tool UI, spectacle 스킬 3종, progression test 포함.
- Placeholder scan: 비용/게이트/테스트 목표값 고정됨.
- Type consistency: `SkillNode`, `UnlockGate`, `SaveData`, `RunSummary`, `EconomyStats`, `ToolId` 소유 파일 명시됨.
- Scope check: 1시간 데모로 충분. bespoke art asset 제작은 보류하고 trail/tint/SFX hook, crop mark, laser, tractor strip으로 데모 만족감 확보.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-19-mowbound-skill-tree-economy-redesign.md`. Two execution options:

1. Subagent-Driven (recommended) - 작업별 fresh subagent 배정, task 단위 리뷰, 빠른 병렬 진행.
2. Inline Execution - 이 세션에서 순차 실행, 체크포인트마다 검증.

Which approach?
