import { describe, expect, it } from "vitest";
import {
  CLEAN_MOW_DISTANCE_METERS,
  createCleanMowState,
  recordCleanMowCut,
} from "../src/game/systems/CleanMowSystem";

describe("clean mow streak", () => {
  it("awards one clean grass bonus after two meters of continuous direct mowing", () => {
    let state = createCleanMowState();

    state = recordCleanMowCut(state, { position: { x: 0, z: 0 }, timeMs: 0, cutCount: 2 }).state;
    state = recordCleanMowCut(state, { position: { x: 1, z: 0 }, timeMs: 900, cutCount: 2 }).state;
    const result = recordCleanMowCut(state, { position: { x: 2, z: 0 }, timeMs: 1800, cutCount: 2 });

    expect(CLEAN_MOW_DISTANCE_METERS).toBe(2);
    expect(result.bonuses).toBe(1);
    expect(result.state.distanceMeters).toBe(0);
  });

  it("keeps overflow distance toward the next bonus", () => {
    let state = createCleanMowState();

    state = recordCleanMowCut(state, { position: { x: 0, z: 0 }, timeMs: 0, cutCount: 1 }).state;
    const result = recordCleanMowCut(state, { position: { x: 3.8, z: 0 }, timeMs: 1000, cutCount: 1 });

    expect(result.bonuses).toBe(1);
    expect(result.state.distanceMeters).toBeCloseTo(1.8, 5);
  });

  it("resets when mowing is interrupted for too long", () => {
    let state = createCleanMowState();

    state = recordCleanMowCut(state, { position: { x: 0, z: 0 }, timeMs: 0, cutCount: 1 }).state;
    state = recordCleanMowCut(state, { position: { x: 1, z: 0 }, timeMs: 900, cutCount: 1 }).state;
    const result = recordCleanMowCut(state, { position: { x: 2, z: 0 }, timeMs: 2601, cutCount: 1 });

    expect(result.bonuses).toBe(0);
    expect(result.state.distanceMeters).toBe(0);
  });

  it("allows a one and a half second gap during testing", () => {
    let state = createCleanMowState();

    state = recordCleanMowCut(state, { position: { x: 0, z: 0 }, timeMs: 0, cutCount: 1 }).state;
    state = recordCleanMowCut(state, { position: { x: 1, z: 0 }, timeMs: 1000, cutCount: 1 }).state;
    const result = recordCleanMowCut(state, { position: { x: 2, z: 0 }, timeMs: 2500, cutCount: 1 });

    expect(result.bonuses).toBe(1);
    expect(result.state.distanceMeters).toBe(0);
  });

  it("allows a fifty degree turn during testing", () => {
    let state = createCleanMowState();
    const length = 1.1;
    const radians = (50 * Math.PI) / 180;

    state = recordCleanMowCut(state, { position: { x: 0, z: 0 }, timeMs: 0, cutCount: 1 }).state;
    state = recordCleanMowCut(state, { position: { x: length, z: 0 }, timeMs: 700, cutCount: 1 }).state;
    const result = recordCleanMowCut(state, {
      position: { x: length + Math.cos(radians) * length, z: Math.sin(radians) * length },
      timeMs: 1400,
      cutCount: 1,
    });

    expect(result.bonuses).toBe(1);
    expect(result.state.distanceMeters).toBeCloseTo(0.2, 5);
  });

  it("starts a new streak when the player turns too sharply", () => {
    let state = createCleanMowState();

    state = recordCleanMowCut(state, { position: { x: 0, z: 0 }, timeMs: 0, cutCount: 1 }).state;
    state = recordCleanMowCut(state, { position: { x: 1.2, z: 0 }, timeMs: 800, cutCount: 1 }).state;
    const result = recordCleanMowCut(state, { position: { x: 1.2, z: 1.2 }, timeMs: 1600, cutCount: 1 });

    expect(result.bonuses).toBe(0);
    expect(result.state.distanceMeters).toBeCloseTo(1.2, 5);
  });

  it("ignores events with no grass cut", () => {
    const state = createCleanMowState();
    const result = recordCleanMowCut(state, { position: { x: 3, z: 0 }, timeMs: 1000, cutCount: 0 });

    expect(result.bonuses).toBe(0);
    expect(result.state).toEqual(state);
  });
});
