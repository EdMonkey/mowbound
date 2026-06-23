import { CARD_BY_ID, CARDS, type CardEffect, type CardGate, type CardNode } from "../config/cards";
import type { ToolId } from "../config/tools";
import { normalizeSave, type SaveData } from "./SaveSystem";

function unlockedCardEffects(save: SaveData): CardEffect[] {
  const normalized = normalizeSave(save);
  return CARDS
    .filter((card) => isCardUnlocked(normalized, card.id))
    .flatMap((card) => card.effects);
}

export function isCardUnlocked(save: SaveData, cardId: string): boolean {
  return (normalizeSave(save).unlockedCards[cardId] ?? 0) > 0;
}

export function isCardRevealed(save: SaveData, cardId: string): boolean {
  const card = CARD_BY_ID[cardId];
  if (!card) {
    return false;
  }
  return card.prereq.length === 0 || card.prereq.some((prereq) => isCardUnlocked(save, prereq));
}

function isCardGateSatisfied(save: SaveData, gate: CardGate): boolean {
  const normalized = normalizeSave(save);
  switch (gate.kind) {
    case "bestClearPercent":
      return (
        Number.isFinite(gate.mapSize) &&
        Number.isFinite(gate.percent) &&
        (normalized.lifetimeStats.bestClearPercentByMap[String(gate.mapSize)] ?? 0) >= gate.percent!
      );
    case "lifetimeGrass":
      return Number.isFinite(gate.count) && normalized.lifetimeStats.grassCut >= gate.count!;
    case "bestBombChain":
      return Number.isFinite(gate.length) && normalized.lifetimeStats.bestBombChain >= gate.length!;
    default:
      return false;
  }
}

export function areCardGatesSatisfied(save: SaveData, card: CardNode): boolean {
  return card.gates.length === 0 || card.gates.some((gate) => isCardGateSatisfied(save, gate));
}

export function canUnlockCard(save: SaveData, cardId: string): boolean {
  const normalized = normalizeSave(save);
  const card = CARD_BY_ID[cardId];
  if (!card) {
    return false;
  }

  return (
    isCardRevealed(normalized, cardId) &&
    card.prereq.every((prereq) => isCardUnlocked(normalized, prereq)) &&
    areCardGatesSatisfied(normalized, card) &&
    !isCardUnlocked(normalized, cardId) &&
    normalized.gold >= card.cost
  );
}

export function unlockCard(save: SaveData, cardId: string): SaveData {
  const normalized = normalizeSave(save);
  if (!canUnlockCard(normalized, cardId)) {
    return normalized;
  }

  const cost = getCardCost(cardId);
  return normalizeSave({
    ...normalized,
    gold: normalized.gold - cost,
    unlockedCards: {
      ...normalized.unlockedCards,
      [cardId]: 1,
    },
    levels: {
      ...normalized.levels,
      [cardId]: 1,
    },
  });
}

export function getCardCost(cardId: string): number {
  return CARD_BY_ID[cardId]?.cost ?? Number.POSITIVE_INFINITY;
}

export function getRevealedCards(save: SaveData): CardNode[] {
  return CARDS.filter((card) => isCardRevealed(save, card.id));
}

export function nextAffordableCardGoals(save: SaveData, limit = 3): CardNode[] {
  const normalized = normalizeSave(save);
  return CARDS
    .filter((card) => canUnlockCard(normalized, card.id))
    .sort((a, b) => a.cost - b.cost || a.sort - b.sort)
    .slice(0, limit);
}

export function isMapUnlocked(save: SaveData, mapSize: number): boolean {
  if (mapSize === 10) {
    return true;
  }
  return mapSize === 30 && unlockedCardEffects(save).some((effect) => effect.kind === "unlockMap" && effect.mapSize === 30);
}

export function canSelectTool(save: SaveData, tool: ToolId): boolean {
  if (tool === "default") {
    return true;
  }
  return unlockedCardEffects(save).some((effect) => effect.kind === "toolUnlock" && effect.tool === tool);
}

export function selectTool(save: SaveData, tool: ToolId): SaveData {
  const normalized = normalizeSave(save);
  if (!canSelectTool(normalized, tool)) {
    return normalized;
  }
  return normalizeSave({ ...normalized, selectedTool: tool });
}
