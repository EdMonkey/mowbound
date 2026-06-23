import rawCards from "./cards.json";

export const CARD_CATEGORIES = ["equipment", "harvest", "environment", "ability"] as const;

export type CardCategory = (typeof CARD_CATEGORIES)[number];

export interface CardGate {
  kind: string;
  mapSize?: number;
  percent?: number;
  count?: number;
  length?: number;
}

export interface CardEffect {
  kind: string;
  amount?: number;
  id?: string;
  tool?: string;
  mapSize?: number;
  ability?: string;
  stat?: string;
  obstacle?: string;
}

export interface CardNode {
  id: string;
  nameKo: string;
  nameEn: string;
  category: CardCategory;
  branch: string;
  tier: number;
  cost: number;
  prereq: string[];
  gates: CardGate[];
  tags: string[];
  effects: CardEffect[];
  descriptionKo: string;
  descriptionEn: string;
  layout: {
    x: number;
    y: number;
  };
  sort: number;
}

export interface CardCatalogFilters {
  category?: CardCategory | "all";
  tier?: number | "all";
  effectKind?: string | "all";
  search?: string;
}

export type CardsByCategoryAndTier = Record<CardCategory, Record<number, CardNode[]>>;

export const CARD_CATEGORY_LABELS_KO: Record<CardCategory, string> = {
  equipment: "장비",
  harvest: "수확",
  environment: "환경",
  ability: "능력",
};

export const CARD_CATEGORY_LABELS_EN: Record<CardCategory, string> = {
  equipment: "Equipment",
  harvest: "Harvest",
  environment: "Environment",
  ability: "Ability",
};

const CARD_CATEGORY_ORDER: Record<CardCategory, number> = Object.fromEntries(
  CARD_CATEGORIES.map((category, index) => [category, index]),
) as Record<CardCategory, number>;

export const CARDS = rawCards as CardNode[];

export const CARD_BY_ID: Record<string, CardNode> = Object.fromEntries(CARDS.map((card) => [card.id, card]));

export const CARD_TIERS = [...new Set(CARDS.map((card) => card.tier))].sort((a, b) => a - b);

export const CARD_EFFECT_KINDS = [...new Set(CARDS.flatMap((card) => card.effects.map((effect) => effect.kind)))]
  .filter(Boolean)
  .sort();

export function compareCardsForCatalog(a: CardNode, b: CardNode): number {
  return (
    CARD_CATEGORY_ORDER[a.category] - CARD_CATEGORY_ORDER[b.category] ||
    a.tier - b.tier ||
    a.cost - b.cost ||
    a.sort - b.sort
  );
}

export function filterCards(filters: CardCatalogFilters = {}, source: CardNode[] = CARDS): CardNode[] {
  const category = filters.category ?? "all";
  const tier = filters.tier ?? "all";
  const effectKind = filters.effectKind ?? "all";
  const search = (filters.search ?? "").trim().toLocaleLowerCase();

  return source.filter((card) => {
    if (category !== "all" && card.category !== category) {
      return false;
    }
    if (tier !== "all" && card.tier !== tier) {
      return false;
    }
    if (effectKind !== "all" && !card.effects.some((effect) => effect.kind === effectKind)) {
      return false;
    }
    if (!search) {
      return true;
    }

    const haystack = [
      card.id,
      card.nameKo,
      card.nameEn,
      card.category,
      card.branch,
      card.descriptionKo,
      card.descriptionEn,
      ...card.tags,
    ].join(" ").toLocaleLowerCase();

    return haystack.includes(search);
  });
}

export function groupCardsByCategoryAndTier(source: CardNode[] = CARDS): CardsByCategoryAndTier {
  const grouped = Object.fromEntries(CARD_CATEGORIES.map((category) => [category, {}])) as CardsByCategoryAndTier;

  for (const card of source) {
    grouped[card.category][card.tier] ??= [];
    grouped[card.category][card.tier].push(card);
  }

  for (const category of CARD_CATEGORIES) {
    for (const cards of Object.values(grouped[category])) {
      cards.sort(compareCardsForCatalog);
    }
  }

  return grouped;
}
