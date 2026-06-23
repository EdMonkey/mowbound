import { describe, expect, it } from "vitest";
import { CARD_BY_ID, CARD_EFFECT_KINDS, CARD_ROOT_ID, CARDS } from "../src/game/config/cards";
import { TOOL_IDS } from "../src/game/config/tools";

interface EffectPayload {
  kind: string;
  amount?: unknown;
  id?: unknown;
  tool?: unknown;
  mapSize?: unknown;
  ability?: unknown;
  stat?: unknown;
  obstacle?: unknown;
}

const TOOL_ID_SET = new Set<string>(TOOL_IDS);

const EFFECT_KINDS_WITH_AMOUNT = new Set([
  "attackDamage",
  "attackInterval",
  "attackRange",
  "blueGrassSlow",
  "bombBlastRadius",
  "bombChainRadius",
  "bombChainScore",
  "bombCount10m",
  "cleanPatchScore",
  "clearBonusPercent",
  "failedChopStunPercent",
  "fireDamagePerSecond",
  "fireIgniteChance",
  "fireSpreadChancePerSecond",
  "fireSpreadRadiusMeters",
  "firstBombScorePercent",
  "goldDivisor",
  "grassGrowSpeed",
  "grassRegrowDelay",
  "grassScorePercent",
  "initialGrassCount",
  "mapExpandCap",
  "moveSpeed",
  "obstacleDamage",
  "obstacleScorePercent",
  "obstacleSize",
  "obstacleSpawnRate",
  "rockScore",
  "roundDurationPercent",
  "tallGrassGold",
  "timerGrassBonus",
  "treeScore",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function getEffectPayloadIssues(effect: EffectPayload): string[] {
  const issues: string[] = [];

  if (EFFECT_KINDS_WITH_AMOUNT.has(effect.kind) && !Number.isFinite(effect.amount)) {
    issues.push(`${effect.kind}.amount must be finite`);
  }

  if (effect.kind === "toolUnlock" && (!isNonEmptyString(effect.tool) || !TOOL_ID_SET.has(effect.tool))) {
    issues.push("toolUnlock.tool must be one of TOOL_IDS");
  }

  if (effect.kind === "summon") {
    if (!Number.isFinite(effect.amount)) {
      issues.push("summon.amount must be finite");
    }
    if (!isNonEmptyString(effect.ability)) {
      issues.push("summon.ability must be non-empty");
    }
    if (!isNonEmptyString(effect.stat)) {
      issues.push("summon.stat must be non-empty");
    }
  }

  if (effect.kind === "unlockMap" && !Number.isFinite(effect.mapSize)) {
    issues.push("unlockMap.mapSize must be finite");
  }

  if (effect.kind === "special" && !isNonEmptyString(effect.id)) {
    issues.push("special.id must be non-empty");
  }

  if (effect.kind === "obstacleSurvey" && !isNonEmptyString(effect.obstacle)) {
    issues.push("obstacleSurvey.obstacle must be non-empty");
  }

  return issues;
}

describe("card data integrity", () => {
  it("keeps root card id mapped to root card", () => {
    expect(CARD_BY_ID[CARD_ROOT_ID]?.id).toBe(CARD_ROOT_ID);
  });

  it("keeps card ids unique", () => {
    const cardIds = CARDS.map((card) => card.id);

    expect(new Set(cardIds).size).toBe(cardIds.length);
  });

  it("keeps every prereq id resolvable", () => {
    for (const card of CARDS) {
      for (const prereq of card.prereq) {
        expect(CARD_BY_ID[prereq], `${card.id} prereq ${prereq}`).toBeDefined();
      }
    }
  });

  it("keeps every card layout finite", () => {
    for (const card of CARDS) {
      expect(Number.isFinite(card.layout.x), `${card.id} layout.x`).toBe(true);
      expect(Number.isFinite(card.layout.y), `${card.id} layout.y`).toBe(true);
    }
  });

  it("keeps every card cost non-negative", () => {
    for (const card of CARDS) {
      expect(card.cost, `${card.id} cost`).toBeGreaterThanOrEqual(0);
    }
  });

  it("exposes required card effect kinds", () => {
    expect(CARD_EFFECT_KINDS).toEqual(expect.arrayContaining(["attackDamage", "toolUnlock", "summon"]));
  });

  it("rejects invalid tool unlock tools", () => {
    expect(getEffectPayloadIssues({ kind: "toolUnlock", tool: "typo_sickle" })).toContain(
      "toolUnlock.tool must be one of TOOL_IDS",
    );
  });

  it("keeps every card effect payload valid", () => {
    for (const card of CARDS) {
      for (const effect of card.effects) {
        expect(getEffectPayloadIssues(effect), `${card.id} ${effect.kind}`).toEqual([]);
      }
    }
  });
});
