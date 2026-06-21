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
  createObstacleState,
  resolveCollision,
  resolveObstacleAttack,
} from "../src/game/systems/ObstacleSystem";
import {
  canUnlockNode,
  computeCropMarkHits,
  computeLaserHits,
  computeTractorStripHits,
  getRuntimeStats,
  isNodeRevealed,
  isNodeUnlocked,
  unlockNode,
} from "../src/game/systems/SkillSystem";
import {
  InputSystem,
  mapScreenInputToWorldMovement,
  normalizeInputVector,
} from "../src/game/systems/InputSystem";
import { BALANCE, ROUND_DURATION_BY_MAP, TEST_BOMB_COUNTS } from "../src/game/config/balance";
import { defaultSave } from "../src/game/systems/SaveSystem";

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
        { id: "front", position: { x: 0.5, z: 0 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
        { id: "side", position: { x: 0.01, z: 0.49 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
        { id: "weak", position: { x: 0.3, z: 0.15 }, hp: 3, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
        { id: "far", position: { x: 0.51, z: 0 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
        { id: "behind", position: { x: -0.2, z: 0 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
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
        { id: "front", position: { x: 0.4, z: 0 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
        { id: "weak", position: { x: 0.3, z: 0 }, hp: 3, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
        { id: "outside", position: { x: -0.4, z: 0 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
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
    const save = { ...defaultSave(), levels: { root_sharpen: 1, sharp_edge_1: 1 } };
    expect(getRuntimeStats(save).attackDamage).toBe(5); // 3 + 1 + 1
  });

  it("applies the play-time skill to round duration", () => {
    const save = { ...defaultSave(), levels: { field_rhythm_1: 1, field_rhythm_2: 1 } };
    expect(getRuntimeStats(save).roundDurationMs).toBe(11600);
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

  it("keeps initial grass outside rock exclusion circles", () => {
    const exclusion = { x: 0, z: 0, radius: 1.8 };
    const states = createGrassBatch(400, 1, 10, [exclusion]);

    expect(states.length).toBeLessThan(400);
    for (const grass of states) {
      expect(Math.hypot(grass.position.x - exclusion.x, grass.position.z - exclusion.z)).toBeGreaterThan(
        exclusion.radius,
      );
    }
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
      { id: "near", position: { x: 1, z: 0 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
      { id: "edge", position: { x: 5, z: 0 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
      { id: "outside", position: { x: 6, z: 0 }, hp: 5, kind: "normal" as const, growthRatio: 1, regrowDelay: 0 },
    ];
    expect(grassInRadius(grass, { x: 0, z: 0 }, 5)).toEqual(["near", "edge"]);
  });

  it("places test bombs only on the large map and runs it longer", () => {
    expect(TEST_BOMB_COUNTS[10]).toBe(0);
    expect(TEST_BOMB_COUNTS[30]).toBe(30);
    expect(ROUND_DURATION_BY_MAP[10]).toBe(10000);
    expect(ROUND_DURATION_BY_MAP[30]).toBe(30000);
    // small mow radius, with a wider chain radius so neighbors still detonate
    expect(BALANCE.bombBlastRadiusMeters).toBe(1.25);
    expect(BALANCE.bombChainRadiusMeters).toBe(2.5);
  });
});

describe("rock/tree obstacles", () => {
  const attack = (damage: number, obstacles: ReturnType<typeof createObstacleState>[]) =>
    resolveObstacleAttack({
      origin: { x: 0, z: 0 },
      direction: { x: 1, z: 0 },
      range: 0.5,
      arcDegrees: 360,
      damage,
      obstacles,
    });

  it("breaks an obstacle when damage exceeds its HP, without stunning", () => {
    const rock = createObstacleState("r", "rock", { x: 0.3, z: 0 }, 5, 0.3);
    const result = attack(6, [rock]);
    expect(result.destroyedIds).toEqual(["r"]);
    expect(result.blockedIds).toEqual([]);
    expect(result.stun).toBe(false);
  });

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

  it("stuns the attacker (no HP change) when damage fails to break the obstacle", () => {
    const tree = createObstacleState("t", "tree", { x: 0.3, z: 0 }, 5, 0.24);
    // equal damage is not enough — must be strictly greater
    expect(attack(5, [tree])).toEqual({ destroyedIds: [], blockedIds: ["t"], stun: true });
    expect(attack(3, [tree])).toEqual({ destroyedIds: [], blockedIds: ["t"], stun: true });
  });

  it("reaches an obstacle when the swing touches its edge, not only its center", () => {
    // center at 0.7 is past the 0.5 range, but within range + radius (0.5 + 0.3)
    const near = createObstacleState("near", "rock", { x: 0.7, z: 0 }, 5, 0.3);
    expect(attack(6, [near]).destroyedIds).toEqual(["near"]);
    // center at 0.95 is beyond reach (0.8) -> untouched
    const far = createObstacleState("far", "rock", { x: 0.95, z: 0 }, 5, 0.3);
    expect(attack(6, [far]).destroyedIds).toEqual([]);
  });

  it("ignores out-of-range and already-destroyed obstacles", () => {
    const far = createObstacleState("far", "rock", { x: 3, z: 0 }, 1, 0.3);
    const spent = { ...createObstacleState("spent", "tree", { x: 0.2, z: 0 }, 1, 0.24), destroyed: true };
    const result = attack(99, [far, spent]);
    expect(result.destroyedIds).toEqual([]);
    expect(result.blockedIds).toEqual([]);
    expect(result.stun).toBe(false);
  });

  it("pushes the player out of an intact obstacle's collision circle", () => {
    // player (r=0.2) overlapping a blocker (r=0.3) at distance 0.2 -> pushed to 0.5
    const pushed = resolveCollision({ x: 0.2, z: 0 }, [{ x: 0, z: 0, radius: 0.3 }], 0.2);
    expect(Math.hypot(pushed.x, pushed.z)).toBeCloseTo(0.5, 5);
    // already clear of the blocker -> unchanged
    expect(resolveCollision({ x: 2, z: 0 }, [{ x: 0, z: 0, radius: 0.3 }], 0.2)).toEqual({ x: 2, z: 0 });
  });
});

describe("skill tree unlocks", () => {
  it("reveals a node only after its prerequisite is unlocked", () => {
    const save = { ...defaultSave(), gold: 9999 };

    expect(isNodeRevealed(save, "root_sharpen")).toBe(true); // root
    expect(isNodeRevealed(save, "sharp_edge_1")).toBe(false);
    expect(canUnlockNode(save, "sharp_edge_1")).toBe(false);

    const afterRoot = unlockNode(save, "root_sharpen");
    expect(isNodeUnlocked(afterRoot, "root_sharpen")).toBe(true);
    expect(afterRoot.gold).toBeLessThan(9999);
    expect(isNodeRevealed(afterRoot, "sharp_edge_1")).toBe(true);
    expect(isNodeRevealed(afterRoot, "clean_sweep_1")).toBe(true);
    expect(canUnlockNode(afterRoot, "sharp_edge_1")).toBe(true);
    // deeper tier stays hidden until its own prerequisite is unlocked
    expect(isNodeRevealed(afterRoot, "sharp_edge_2")).toBe(false);
  });

  it("unlocks each node once and refuses locked nodes", () => {
    let save = defaultSave();
    save = { ...save, gold: 9999, levels: { root_sharpen: 1 } };
    save = unlockNode(save, "sharp_edge_1");
    expect(isNodeUnlocked(save, "sharp_edge_1")).toBe(true);

    // unlocking again is a no-op: no duplicate, no extra spend
    const goldAfter = save.gold;
    const again = unlockNode(save, "sharp_edge_1");
    expect(again.gold).toBe(goldAfter);
    expect(again.levels.sharp_edge_1).toBe(1);

    // a node whose prerequisite isn't unlocked is refused
    const locked = unlockNode(save, "field_rhythm_2");
    expect(locked.gold).toBe(goldAfter);
    expect(isNodeUnlocked(locked, "field_rhythm_2")).toBe(false);
  });
});

describe("spectacle skill targeting", () => {
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
