import { CARD_BY_ID, CARDS } from "../config/cards";
import { TOOL_IDS, type ToolId } from "../config/tools";

export const STORAGE_KEY = "mowbound-save-v2";
export const OLD_STORAGE_KEY = "mowbound-save-v1";

export interface LifetimeStats {
  grassCut: number;
  rocksBroken: number;
  treesCut: number;
  bombsTriggered: number;
  bestBombChain: number;
  bestClearPercentByMap: Record<string, number>;
}

export interface SaveData {
  schemaVersion: 3;
  gold: number;
  unlockedCards: Record<string, number>;
  /** @deprecated Compatibility mirror for legacy skill-tree reads. Use unlockedCards. */
  levels: Record<string, number>;
  selectedTool: ToolId;
  lifetimeStats: LifetimeStats;
}

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

const VALID_CARD_IDS = new Set(Object.keys(CARD_BY_ID));
const VALID_TOOL_IDS = new Set<ToolId>(TOOL_IDS);

const LEGACY_UNLOCK_MAP: Record<string, string> = {
  dmg1: "root_sharpen",
  dmg2: "sharp_edge_1",
  dmg3: "heavy_edge",
  reach: "clean_sweep_1",
  swift: "quick_recovery_1",
  swift2: "quick_recovery_2",
  foot: "light_boots_1",
  foot2: "light_boots_2",
  time1: "field_rhythm_1",
  time2: "field_rhythm_2",
  gold1: "market_cart_1",
  gold2: "market_cart_2",
  dense: "dense_growth",
};

export function defaultSave(): SaveData {
  return {
    schemaVersion: 3,
    gold: 0,
    unlockedCards: {},
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
  };
}

function positiveInt(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : 0;
}

function normalizeCardUnlocks(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [id, level] of Object.entries(value as Record<string, unknown>)) {
    if (VALID_CARD_IDS.has(id) && positiveInt(level) > 0) {
      result[id] = 1;
    }
  }
  return result;
}

function normalizeLifetimeStats(value: unknown): LifetimeStats {
  const fallback = defaultSave().lifetimeStats;
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<LifetimeStats>;
  const bestClearPercentByMap: Record<string, number> = {};
  if (candidate.bestClearPercentByMap && typeof candidate.bestClearPercentByMap === "object") {
    for (const [mapSize, percent] of Object.entries(candidate.bestClearPercentByMap)) {
      bestClearPercentByMap[mapSize] = positiveInt(percent);
    }
  }

  return {
    grassCut: positiveInt(candidate.grassCut),
    rocksBroken: positiveInt(candidate.rocksBroken),
    treesCut: positiveInt(candidate.treesCut),
    bombsTriggered: positiveInt(candidate.bombsTriggered),
    bestBombChain: positiveInt(candidate.bestBombChain),
    bestClearPercentByMap,
  };
}

function normalizeLegacySave(candidate: Record<string, unknown>): SaveData {
  const save = defaultSave();
  save.gold = positiveInt(candidate.totalGold);

  if (Array.isArray(candidate.unlocked)) {
    for (const oldId of candidate.unlocked) {
      if (typeof oldId !== "string") {
        continue;
      }
      const mapped = LEGACY_UNLOCK_MAP[oldId] ?? oldId;
      if (VALID_CARD_IDS.has(mapped)) {
        save.unlockedCards[mapped] = 1;
        save.levels[mapped] = 1;
      }
    }
  }

  return save;
}

export function normalizeSave(value: unknown): SaveData {
  if (!value || typeof value !== "object") {
    return defaultSave();
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 2 && candidate.schemaVersion !== 3) {
    return normalizeLegacySave(candidate);
  }

  const selectedTool = typeof candidate.selectedTool === "string" && VALID_TOOL_IDS.has(candidate.selectedTool as ToolId)
    ? candidate.selectedTool as ToolId
    : "default";
  const unlockedCards = {
    ...normalizeCardUnlocks(candidate.schemaVersion === 3 ? candidate.unlockedCards : null),
    ...normalizeCardUnlocks(candidate.levels),
  };

  return {
    schemaVersion: 3,
    gold: positiveInt(candidate.gold),
    unlockedCards,
    levels: { ...unlockedCards },
    selectedTool,
    lifetimeStats: normalizeLifetimeStats(candidate.lifetimeStats),
  };
}

export function loadSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeSave(JSON.parse(raw));
    }

    const oldRaw = window.localStorage.getItem(OLD_STORAGE_KEY);
    return normalizeSave(oldRaw ? JSON.parse(oldRaw) : null);
  } catch {
    return defaultSave();
  }
}

export function saveGame(save: SaveData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSave(save)));
}

export function resetSave(): SaveData {
  const fresh = defaultSave();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function unlockAllCardsForTest(save: SaveData): SaveData {
  const normalized = normalizeSave(save);
  const unlockedCards = Object.fromEntries(CARDS.map((card) => [card.id, 1]));
  return normalizeSave({
    ...normalized,
    unlockedCards,
    levels: unlockedCards,
  });
}

/** @deprecated Use unlockAllCardsForTest. */
export const unlockAllSkillsForTest = unlockAllCardsForTest;

export function applyRunResultToSave(save: SaveData, result: RunSaveResult): SaveData {
  const normalized = normalizeSave(save);
  const mapKey = String(result.mapSize);
  const bestClear = normalized.lifetimeStats.bestClearPercentByMap[mapKey] ?? 0;

  return normalizeSave({
    ...normalized,
    gold: normalized.gold + positiveInt(result.gold),
    lifetimeStats: {
      grassCut: normalized.lifetimeStats.grassCut + positiveInt(result.grassCut),
      rocksBroken: normalized.lifetimeStats.rocksBroken + positiveInt(result.rocksBroken),
      treesCut: normalized.lifetimeStats.treesCut + positiveInt(result.treesCut),
      bombsTriggered: normalized.lifetimeStats.bombsTriggered + positiveInt(result.bombsTriggered),
      bestBombChain: Math.max(normalized.lifetimeStats.bestBombChain, positiveInt(result.bestBombChain)),
      bestClearPercentByMap: {
        ...normalized.lifetimeStats.bestClearPercentByMap,
        [mapKey]: Math.max(bestClear, positiveInt(result.clearPercent)),
      },
    },
  });
}

export function addGold(save: SaveData, amount: number): SaveData {
  const normalized = normalizeSave(save);
  return normalizeSave({
    ...normalized,
    gold: normalized.gold + Math.max(0, Math.floor(amount)),
  });
}
