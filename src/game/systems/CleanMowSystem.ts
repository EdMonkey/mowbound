import type { VectorXZ } from "../types";

export const CLEAN_MOW_DISTANCE_METERS = 2;
const CLEAN_MOW_MAX_GAP_MS = 1600;
const CLEAN_MOW_MAX_TURN_DEGREES = 55;
const CLEAN_MOW_MIN_SEGMENT_METERS = 0.05;

export interface CleanMowState {
  distanceMeters: number;
  lastCutPosition?: VectorXZ;
  lastCutTimeMs?: number;
  lastDirection?: VectorXZ;
}

export interface CleanMowCutEvent {
  position: VectorXZ;
  timeMs: number;
  cutCount: number;
}

export interface CleanMowResult {
  state: CleanMowState;
  bonuses: number;
}

export function createCleanMowState(): CleanMowState {
  return { distanceMeters: 0 };
}

export function recordCleanMowCut(state: CleanMowState, event: CleanMowCutEvent): CleanMowResult {
  if (event.cutCount <= 0) {
    return { state, bonuses: 0 };
  }

  if (!state.lastCutPosition || state.lastCutTimeMs === undefined) {
    return {
      state: {
        distanceMeters: 0,
        lastCutPosition: event.position,
        lastCutTimeMs: event.timeMs,
      },
      bonuses: 0,
    };
  }

  const gapMs = event.timeMs - state.lastCutTimeMs;
  if (gapMs > CLEAN_MOW_MAX_GAP_MS) {
    return {
      state: {
        distanceMeters: 0,
        lastCutPosition: event.position,
        lastCutTimeMs: event.timeMs,
      },
      bonuses: 0,
    };
  }

  const segment = {
    x: event.position.x - state.lastCutPosition.x,
    z: event.position.z - state.lastCutPosition.z,
  };
  const segmentDistance = Math.hypot(segment.x, segment.z);
  const segmentDirection = segmentDistance >= CLEAN_MOW_MIN_SEGMENT_METERS
    ? { x: segment.x / segmentDistance, z: segment.z / segmentDistance }
    : state.lastDirection;
  const turnsTooMuch =
    !!state.lastDirection &&
    !!segmentDirection &&
    angleDegreesBetween(state.lastDirection, segmentDirection) > CLEAN_MOW_MAX_TURN_DEGREES;
  const startingDistance = turnsTooMuch ? 0 : state.distanceMeters;
  const nextDistance = startingDistance + (segmentDistance >= CLEAN_MOW_MIN_SEGMENT_METERS ? segmentDistance : 0);
  const bonuses = Math.floor(nextDistance / CLEAN_MOW_DISTANCE_METERS);

  return {
    state: {
      distanceMeters: nextDistance - bonuses * CLEAN_MOW_DISTANCE_METERS,
      lastCutPosition: event.position,
      lastCutTimeMs: event.timeMs,
      lastDirection: segmentDirection,
    },
    bonuses,
  };
}

function angleDegreesBetween(a: VectorXZ, b: VectorXZ): number {
  const lengthA = Math.hypot(a.x, a.z) || 1;
  const lengthB = Math.hypot(b.x, b.z) || 1;
  const dot = (a.x * b.x + a.z * b.z) / (lengthA * lengthB);
  return THREE_RAD_TO_DEG * Math.acos(Math.max(-1, Math.min(1, dot)));
}

const THREE_RAD_TO_DEG = 180 / Math.PI;
