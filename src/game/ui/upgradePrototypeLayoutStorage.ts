export const UPGRADE_PROTOTYPE_LAYOUT_STORAGE_KEY = "mowbound-upgrade-tree-layout-v1";

export interface UpgradePrototypePosition {
  x: number;
  y: number;
}

export type UpgradePrototypePositionOverrides = Record<string, UpgradePrototypePosition>;

interface UpgradePrototypeLayoutPayload {
  version: 1;
  positions: UpgradePrototypePositionOverrides;
}

interface LayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseUpgradePrototypeLayoutOverrides(
  raw: string | null,
  validIds: Iterable<string>,
): UpgradePrototypePositionOverrides {
  if (!raw) {
    return {};
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!isRecord(payload) || payload.version !== 1 || !isRecord(payload.positions)) {
    return {};
  }

  const valid = new Set(validIds);
  const parsed: UpgradePrototypePositionOverrides = {};
  for (const [id, position] of Object.entries(payload.positions)) {
    if (!valid.has(id) || !isRecord(position) || typeof position.x !== "number" || typeof position.y !== "number") {
      continue;
    }
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      continue;
    }
    parsed[id] = { x: position.x, y: position.y };
  }
  return parsed;
}

export function serializeUpgradePrototypeLayoutOverrides(overrides: UpgradePrototypePositionOverrides): string {
  const positions: UpgradePrototypePositionOverrides = {};
  for (const [id, position] of Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b))) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      continue;
    }
    positions[id] = { x: position.x, y: position.y };
  }
  const payload: UpgradePrototypeLayoutPayload = {
    version: 1,
    positions,
  };
  return JSON.stringify(payload, null, 2);
}

export function readUpgradePrototypeLayoutOverrides(
  storage: LayoutStorage,
  validIds: Iterable<string>,
): UpgradePrototypePositionOverrides {
  return parseUpgradePrototypeLayoutOverrides(storage.getItem(UPGRADE_PROTOTYPE_LAYOUT_STORAGE_KEY), validIds);
}

export function writeUpgradePrototypeLayoutOverrides(
  storage: LayoutStorage,
  overrides: UpgradePrototypePositionOverrides,
): void {
  storage.setItem(UPGRADE_PROTOTYPE_LAYOUT_STORAGE_KEY, serializeUpgradePrototypeLayoutOverrides(overrides));
}

export function clearUpgradePrototypeLayoutOverrides(storage: LayoutStorage): void {
  storage.removeItem(UPGRADE_PROTOTYPE_LAYOUT_STORAGE_KEY);
}
