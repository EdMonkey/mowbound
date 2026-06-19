import { describe, expect, it } from "vitest";
import { Coin } from "../src/game/entities/Coin";
import { advanceChargeAttack, getSurvivingHitIds, resolveAttack } from "../src/game/systems/AttackSystem";
import {
  bombsTriggeredBy,
  createBombState,
  grassInRadius,
  resolveChainDetonation,
} from "../src/game/systems/BombSystem";
import { createGrassBatch } from "../src/game/systems/GrassSystem";
import {
  canUnlockNode,
  getRuntimeStats,
  isNodeRevealed,
  isNodeUnlocked,
  unlockNode,
} from "../src/game/systems/SaveSystem";
import {
  InputSystem,
  mapScreenInputToWorldMovement,
  normalizeInputVector,
} from "../src/game/systems/InputSystem";
import { BALANCE, defaultSave, ROUND_DURATION_BY_MAP, TEST_BOMB_COUNTS } from "../src/game/config/balance";

class FakeInputTarget {
  innerWidth = 1000;
  innerHeight = 500;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set<(event: Event) => void>();
    listeners.add((event) => {
      if (typeof listener === "function") {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    });
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type);

    if (!listeners) {
      return;
    }

    for (const entry of listeners) {
      if (entry === listener) {
        listeners.delete(entry);
      }
    }
  }

  emit(type: string, data: Record<string, unknown>): void {
    const event = {
      ...data,
      preventDefault: () => undefined,
    } as Event;

    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

describe("attack resolution", () => {
  it("damages grass inside the 0.5m 180-degree forward fan and ignores grass outside it", () => {
    const result = resolveAttack({
      origin: { x: 0, z: 0 },
      direction: { x: 1, z: 0 },
      range: 0.5,
      arcDegrees: 180,
      damage: 3,
      grass: [
        { id: "front", position: { x: 0.5, z: 0 }, hp: 5 },
        { id: "side", position: { x: 0.01, z: 0.49 }, hp: 5 },
        { id: "weak", position: { x: 0.3, z: 0.15 }, hp: 3 },
        { id: "far", position: { x: 0.51, z: 0 }, hp: 5 },
        { id: "behind", position: { x: -0.2, z: 0 }, hp: 5 },
      ],
    });

    expect(result.hitIds).toEqual(["front", "side", "weak"]);
    expect(result.destroyedIds).toEqual(["weak"]);
    expect(result.grass.find((grass) => grass.id === "front")?.hp).toBe(2);
    expect(result.grass.find((grass) => grass.id === "side")?.hp).toBe(2);
    expect(result.grass.find((grass) => grass.id === "far")?.hp).toBe(5);
    expect(result.grass.find((grass) => grass.id === "behind")?.hp).toBe(5);
  });

  it("charges for 1s before the strike resolves", () => {
    const partial = advanceChargeAttack({ elapsedMs: 0, durationMs: 1000 }, 500);
    const complete = advanceChargeAttack(partial.state, 500);

    expect(partial.ready).toBe(false);
    expect(partial.progress).toBe(0.5);
    expect(complete.ready).toBe(true);
    expect(complete.progress).toBe(1);
  });

  it("marks only hit grass that survives for shake feedback", () => {
    const result = resolveAttack({
      origin: { x: 0, z: 0 },
      direction: { x: 1, z: 0 },
      range: 0.5,
      arcDegrees: 180,
      damage: 3,
      grass: [
        { id: "front", position: { x: 0.4, z: 0 }, hp: 5 },
        { id: "weak", position: { x: 0.3, z: 0 }, hp: 3 },
        { id: "outside", position: { x: -0.4, z: 0 }, hp: 5 },
      ],
    });

    expect(getSurvivingHitIds(result)).toEqual(["front"]);
  });
});

describe("runtime stats from skill nodes", () => {
  it("uses base stats with nothing unlocked", () => {
    const stats = getRuntimeStats(defaultSave());

    expect(stats.attackDamage).toBe(3);
    expect(stats.moveSpeed).toBe(0.7);
    expect(stats.attackIntervalMs).toBe(1000);
    expect(stats.attackChargeDurationMs).toBe(1000);
    expect(stats.attackRangeMeters).toBe(0.5);
    expect(stats.attackArcDegrees).toBe(360);
    expect(stats.initialGrassCount).toBe(1600);
    expect(stats.grassSpawnPerTick).toBe(0);
    expect(stats.roundDurationMs).toBe(10000);
    expect(BALANCE.roundDurationMs).toBe(10000);
  });

  it("accumulates the effects of unlocked nodes", () => {
    const save = { ...defaultSave(), unlocked: ["dmg1", "dmg2"] };
    expect(getRuntimeStats(save).attackDamage).toBe(5); // 3 + 1 + 1
  });

  it("applies the play-time skill to round duration", () => {
    const save = { ...defaultSave(), unlocked: ["time1", "time2"] };
    expect(getRuntimeStats(save).roundDurationMs).toBe(10000 + 2000 + 3000);
  });
});

describe("grass and coins", () => {
  it("places grass on a 40x40 jittered grid inside a 10cm edge margin", () => {
    const states = createGrassBatch(1600, 1, 10);

    expect(states.length).toBe(1600);

    for (const grass of states) {
      // stays at least 10cm from the 5m map edge
      expect(Math.abs(grass.position.x)).toBeLessThanOrEqual(4.9);
      expect(Math.abs(grass.position.z)).toBeLessThanOrEqual(4.9);
    }

    const quadrants = new Set(
      states.map((g) => `${g.position.x >= 0 ? "E" : "W"}${g.position.z >= 0 ? "S" : "N"}`),
    );
    expect(quadrants.size).toBe(4);
  });

  it("bounces coins on the floor before they disappear", () => {
    const coin = new Coin({ x: 0, z: 0 });
    const floorY = coin.group.position.y;
    const heights: number[] = [];
    let expired = false;

    for (let index = 0; index < 34; index += 1) {
      expired = coin.update(0.08);
      heights.push(coin.group.position.y);
    }

    expect(Math.max(...heights)).toBeGreaterThan(floorY + 0.15);
    expect(heights.some((height, index) => index > 1 && Math.abs(height - floorY) < 0.02)).toBe(true);
    expect(expired).toBe(true);

    coin.dispose();
  });
});

describe("bomb chain detonation", () => {
  const line = [
    createBombState("a", { x: 0, z: 0 }),
    createBombState("b", { x: 4, z: 0 }), // within 5m of a
    createBombState("c", { x: 8, z: 0 }), // within 5m of b, but not of a
    createBombState("d", { x: 20, z: 0 }), // far from everything
  ];

  it("propagates transitively through bombs within the blast radius", () => {
    const order = resolveChainDetonation(line, "a", 5);
    expect(order).toEqual(["a", "b", "c"]);
    expect(order).not.toContain("d");
  });

  it("returns nothing when the trigger is already detonated", () => {
    const spent = line.map((bomb) => (bomb.id === "a" ? { ...bomb, detonated: true } : bomb));
    expect(resolveChainDetonation(spent, "a", 5)).toEqual([]);
  });

  it("does not mutate the input bombs", () => {
    resolveChainDetonation(line, "a", 5);
    expect(line.every((bomb) => bomb.detonated === false)).toBe(true);
  });

  it("triggers only live bombs the player is touching", () => {
    expect(bombsTriggeredBy(line, { x: 0.3, z: 0 }, 0.7)).toEqual(["a"]);
    expect(bombsTriggeredBy(line, { x: 2, z: 0 }, 0.7)).toEqual([]);

    const spent = line.map((bomb) => (bomb.id === "a" ? { ...bomb, detonated: true } : bomb));
    expect(bombsTriggeredBy(spent, { x: 0.3, z: 0 }, 0.7)).toEqual([]);
  });

  it("selects grass within the blast radius", () => {
    const grass = [
      { id: "near", position: { x: 1, z: 0 }, hp: 5 },
      { id: "edge", position: { x: 5, z: 0 }, hp: 5 },
      { id: "outside", position: { x: 6, z: 0 }, hp: 5 },
    ];
    expect(grassInRadius(grass, { x: 0, z: 0 }, 5)).toEqual(["near", "edge"]);
  });

  it("places test bombs only on the large map and runs it longer", () => {
    expect(TEST_BOMB_COUNTS[10]).toBe(0);
    expect(TEST_BOMB_COUNTS[30]).toBe(30);
    expect(ROUND_DURATION_BY_MAP[10]).toBe(10000);
    expect(ROUND_DURATION_BY_MAP[30]).toBe(30000);
    // chain radius is smaller than the mow radius so chains stay local
    expect(BALANCE.bombChainRadiusMeters).toBeLessThan(BALANCE.bombBlastRadiusMeters);
  });
});

describe("skill tree unlocks", () => {
  it("reveals a node only after its prerequisite is unlocked", () => {
    const save = { ...defaultSave(), totalGold: 9999 };

    expect(isNodeRevealed(save, "dmg1")).toBe(true); // root
    expect(isNodeRevealed(save, "dmg2")).toBe(false);
    expect(canUnlockNode(save, "dmg2")).toBe(false);

    const afterRoot = unlockNode(save, "dmg1");
    expect(isNodeUnlocked(afterRoot, "dmg1")).toBe(true);
    expect(afterRoot.totalGold).toBeLessThan(9999);
    expect(isNodeRevealed(afterRoot, "dmg2")).toBe(true);
    expect(isNodeRevealed(afterRoot, "combat")).toBe(true);
    expect(canUnlockNode(afterRoot, "dmg2")).toBe(true);
    // deeper tier stays hidden until its own prerequisite is unlocked
    expect(isNodeRevealed(afterRoot, "dmg3")).toBe(false);
  });

  it("unlocks each node once and refuses locked nodes", () => {
    let save = { ...defaultSave(), totalGold: 9999, unlocked: ["dmg1"] };
    save = unlockNode(save, "dmg2");
    expect(isNodeUnlocked(save, "dmg2")).toBe(true);

    // unlocking again is a no-op: no duplicate, no extra spend
    const goldAfter = save.totalGold;
    const again = unlockNode(save, "dmg2");
    expect(again.totalGold).toBe(goldAfter);
    expect(again.unlocked.filter((id) => id === "dmg2").length).toBe(1);

    // a node whose prerequisite isn't unlocked is refused
    const locked = unlockNode(save, "field");
    expect(locked.totalGold).toBe(goldAfter);
    expect(isNodeUnlocked(locked, "field")).toBe(false);
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

  it("maps screen-relative controls to isometric world movement", () => {
    expect(mapScreenInputToWorldMovement({ x: 0, z: -1 })).toEqual({
      x: -0.7071067811865475,
      z: -0.7071067811865475,
    });

    expect(mapScreenInputToWorldMovement({ x: 1, z: 0 })).toEqual({
      x: 0.7071067811865475,
      z: -0.7071067811865475,
    });
  });

  it("ignores desktop mouse movement and uses keyboard movement", () => {
    const target = new FakeInputTarget();
    const input = new InputSystem(target as unknown as Window);

    target.emit("pointermove", { pointerType: "mouse", clientX: 1000, clientY: 250 });
    expect(input.getMovementVector()).toEqual({ x: 0, z: 0 });

    target.emit("keydown", { code: "KeyD" });
    expect(input.getMovementVector()).toEqual({
      x: 1,
      z: 0,
    });

    target.emit("keyup", { code: "KeyD" });
    expect(input.getMovementVector()).toEqual({ x: 0, z: 0 });
    input.dispose();
  });
});
