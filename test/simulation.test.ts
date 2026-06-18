import { describe, expect, it } from "vitest";
import { advanceChargeAttack, resolveAttack } from "../src/game/systems/AttackSystem";
import { getRuntimeStats, purchaseSkill } from "../src/game/systems/SaveSystem";
import { normalizeInputVector } from "../src/game/systems/InputSystem";
import { defaultSave } from "../src/game/config/balance";

describe("attack resolution", () => {
  it("damages grass inside the 1m centered ellipse and ignores grass outside it", () => {
    const result = resolveAttack({
      origin: { x: 0, z: 0 },
      direction: { x: 1, z: 0 },
      range: 1,
      zRadius: 0.7,
      damage: 3,
      grass: [
        { id: "front", position: { x: 0.5, z: 0 }, hp: 5 },
        { id: "side", position: { x: 0, z: 0.72 }, hp: 5 },
        { id: "weak", position: { x: -0.55, z: 0.1 }, hp: 3 },
        { id: "outside", position: { x: 1.1, z: 0 }, hp: 5 },
      ],
    });

    expect(result.hitIds).toEqual(["front", "weak"]);
    expect(result.destroyedIds).toEqual(["weak"]);
    expect(result.grass.find((grass) => grass.id === "front")?.hp).toBe(2);
    expect(result.grass.find((grass) => grass.id === "side")?.hp).toBe(5);
  });

  it("charges for 0.5s before the strike resolves", () => {
    const partial = advanceChargeAttack({ elapsedMs: 0, durationMs: 500 }, 250);
    const complete = advanceChargeAttack(partial.state, 250);

    expect(partial.ready).toBe(false);
    expect(partial.progress).toBe(0.5);
    expect(complete.ready).toBe(true);
    expect(complete.progress).toBe(1);
  });
});

describe("persistent upgrades", () => {
  it("spends gold, increases skill level, and changes runtime stats", () => {
    const save = defaultSave();
    save.totalGold = 25;

    const next = purchaseSkill(save, "damage");
    const stats = getRuntimeStats(next);

    expect(next.totalGold).toBeLessThan(25);
    expect(next.skills.damage).toBe(1);
    expect(stats.attackDamage).toBe(4);
    expect(stats.attackRangeMeters).toBe(1);
  });
});

describe("input vectors", () => {
  it("normalizes diagonal input and applies joystick dead zone", () => {
    expect(normalizeInputVector({ x: 1, z: 1 })).toEqual({
      x: 0.7071067811865475,
      z: 0.7071067811865475,
    });

    expect(normalizeInputVector({ x: 0.05, z: 0.04 }, 0.12)).toEqual({ x: 0, z: 0 });
  });
});
