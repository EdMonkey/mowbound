import { describe, expect, it } from "vitest";
import { advanceChargeAttack, resolveAttack } from "../src/game/systems/AttackSystem";
import { getRuntimeStats, purchaseSkill } from "../src/game/systems/SaveSystem";
import {
  InputSystem,
  mapScreenInputToWorldMovement,
  normalizeInputVector,
} from "../src/game/systems/InputSystem";
import { BALANCE, defaultSave } from "../src/game/config/balance";

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
  it("damages grass inside the 1m 90-degree forward fan and ignores grass outside it", () => {
    const result = resolveAttack({
      origin: { x: 0, z: 0 },
      direction: { x: 1, z: 0 },
      range: 1,
      arcDegrees: 90,
      damage: 3,
      grass: [
        { id: "front", position: { x: 0.5, z: 0 }, hp: 5 },
        { id: "side", position: { x: 0.5, z: 0.6 }, hp: 5 },
        { id: "weak", position: { x: 0.4, z: 0.2 }, hp: 3 },
        { id: "behind", position: { x: -0.2, z: 0 }, hp: 5 },
      ],
    });

    expect(result.hitIds).toEqual(["front", "weak"]);
    expect(result.destroyedIds).toEqual(["weak"]);
    expect(result.grass.find((grass) => grass.id === "front")?.hp).toBe(2);
    expect(result.grass.find((grass) => grass.id === "side")?.hp).toBe(5);
  });

  it("charges for 1s before the strike resolves", () => {
    const partial = advanceChargeAttack({ elapsedMs: 0, durationMs: 1000 }, 500);
    const complete = advanceChargeAttack(partial.state, 500);

    expect(partial.ready).toBe(false);
    expect(partial.progress).toBe(0.5);
    expect(complete.ready).toBe(true);
    expect(complete.progress).toBe(1);
  });
});

describe("persistent upgrades", () => {
  it("uses slower default movement, 1s base attack timing, and 10s rounds", () => {
    const stats = getRuntimeStats(defaultSave());

    expect(stats.moveSpeed).toBe(0.7);
    expect(stats.attackIntervalMs).toBe(1000);
    expect(stats.attackChargeDurationMs).toBe(1000);
    expect(BALANCE.roundDurationMs).toBe(10000);
  });

  it("spends gold, increases skill level, and changes runtime stats", () => {
    const save = defaultSave();
    save.totalGold = 25;

    const next = purchaseSkill(save, "damage");
    const stats = getRuntimeStats(next);

    expect(next.totalGold).toBeLessThan(25);
    expect(next.skills.damage).toBe(1);
    expect(stats.attackDamage).toBe(4);
    expect(stats.attackRangeMeters).toBe(1);
    expect(stats.attackArcDegrees).toBe(90);
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
