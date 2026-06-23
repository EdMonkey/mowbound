import { CARD_BY_ID, type CardEffect, type CardGate, type CardNode } from "./config/cards";
import type { SkillEffect, SkillNode, UnlockGate } from "./config/skillTree";
import type { ToolId } from "./config/tools";

export type Language = "ko" | "en";

export const LANGUAGE_STORAGE_KEY = "mowbound-language";

export function loadLanguage(): Language {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
}

export function saveLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* localStorage can be unavailable in private contexts. */
  }
}

const TOOL_KO: Record<ToolId, string> = {
  default: "기본",
  wide_sickle: "넓은 낫",
  fast_sickle: "빠른 낫",
  bomb_sickle: "폭탄 낫",
  tractor: "트랙터",
};

const TOOL_EN: Record<ToolId, string> = {
  default: "Default",
  wide_sickle: "Wide",
  fast_sickle: "Fast",
  bomb_sickle: "Bomb",
  tractor: "Tractor",
};

const SPECIAL_KO: Record<string, string> = {
  cyclone_cut: "소용돌이 베기",
  sprint_harvest: "질주 수확",
  golden_field: "황금 밭",
  clearcut: "벌목 연쇄",
  alien_crop_mark: "외계 문양",
  mower_laser: "레이저",
};

const SUMMON_NAME: Record<string, { ko: string; en: string }> = {
  shadowClone: { ko: "그림자 분신", en: "Shadow Clone" },
  flyingScythe: { ko: "날아가는 낫", en: "Flying Scythe" },
  tractorSummon: { ko: "트랙터", en: "Tractor" },
  boomerang: { ko: "부메랑", en: "Boomerang" },
  lightning: { ko: "번개", en: "Lightning" },
  drone: { ko: "드론", en: "Drone" },
  tornado: { ko: "토네이도", en: "Tornado" },
};

export function toolLabel(tool: ToolId, language: Language): string {
  return language === "ko" ? TOOL_KO[tool] : TOOL_EN[tool];
}

function amount(effect: CardEffect): number {
  return effect.amount ?? 0;
}

export function cardName(card: CardNode, language: Language): string {
  return language === "ko" ? card.nameKo : card.nameEn;
}

export function cardDescription(card: CardNode, language: Language): string {
  return language === "ko" ? card.descriptionKo : card.descriptionEn;
}

function summonEffectText(effect: CardEffect, language: Language): string {
  const name = SUMMON_NAME[effect.ability ?? ""]?.[language] ?? effect.ability ?? "Summon";
  const n = amount(effect);
  const sign = n > 0 ? "+" : "";
  if (language === "en") {
    switch (effect.stat) {
      case "count": return `${name} count ${sign}${n}`;
      case "damage": return `${name} damage ${sign}${Math.round(n * 100)}%`;
      case "interval": return `${name} cooldown ${n}s`;
      case "radius": return `${name} radius ${sign}${n}m`;
      case "spins": return `${name} spins ${sign}${n}`;
      case "duration": return `${name} duration ${sign}${n}s`;
      case "width": return `${name} width ${sign}${n}m`;
      case "size": return `${name} size ${sign}${n}m`;
      case "range": return `${name} range ${sign}${n}m`;
      default: return `${name} ${sign}${n}`;
    }
  }

  switch (effect.stat) {
    case "count": return `${name} 개수 ${sign}${n}`;
    case "damage": return `${name} 피해 ${sign}${Math.round(n * 100)}%`;
    case "interval": return `${name} 쿨다운 ${n}초`;
    case "radius": return `${name} 범위 ${sign}${n}m`;
    case "spins": return `${name} 회전 ${sign}${n}`;
    case "duration": return `${name} 지속 ${sign}${n}초`;
    case "width": return `${name} 폭 ${sign}${n}m`;
    case "size": return `${name} 크기 ${sign}${n}m`;
    case "range": return `${name} 사거리 ${sign}${n}m`;
    default: return `${name} ${sign}${n}`;
  }
}

export function effectText(effect: CardEffect, language: Language): string {
  if (effect.kind === "summon") {
    return summonEffectText(effect, language);
  }

  if (language === "en") {
    switch (effect.kind) {
      case "attackDamage": return `Damage +${amount(effect)}`;
      case "attackRange": return `Range +${amount(effect)}m`;
      case "attackInterval": return `Attack speed +${(Math.abs(amount(effect)) / 1000).toFixed(2)}s`;
      case "moveSpeed": return `Move speed +${amount(effect)}`;
      case "roundDurationPercent": return `Round time +${amount(effect)}%`;
      case "goldDivisor": return `Gold divisor ${amount(effect)}`;
      case "cleanPatchScore": return `Clean mow +${amount(effect)}`;
      case "clearBonusPercent": return `Clear bonus +${amount(effect)}%`;
      case "rockScore": return `Rock +${amount(effect)}`;
      case "treeScore": return `Tree +${amount(effect)}`;
      case "stumpNoCollision": return "Stumps stop blocking";
      case "failedChopStunPercent": return `Recoil stun ${amount(effect)}%`;
      case "obstacleDamage": return `Obstacle damage +${amount(effect)}`;
      case "obstacleBreakGrassBonus": return "Obstacle break cuts grass";
      case "obstacleScorePercent": return `Obstacle score +${amount(effect)}%`;
      case "bombCount10m": return `10m bombs +${amount(effect)}`;
      case "bombChainRadius": return `Chain radius +${amount(effect)}m`;
      case "bombBlastRadius": return `Blast radius +${amount(effect)}m`;
      case "bombChainScore": return `Chain score +${amount(effect)}`;
      case "firstBombScorePercent": return `First bomb score +${amount(effect)}%`;
      case "unlockMap": return `${effect.mapSize}m map`;
      case "initialGrassCount": return `Grass +${amount(effect)}`;
      case "grassScorePercent": return `Grass score +${amount(effect)}%`;
      case "toolUnlock": return `Tool: ${effect.tool ? toolLabel(effect.tool, language) : "Unknown"}`;
      case "special": return effect.id?.replace(/_/g, " ") ?? "Special";
      case "fireIgniteChance": return `Ignite ${(amount(effect) * 100).toFixed(0)}%`;
      case "fireDamagePerSecond": return `Burn +${amount(effect)}/s`;
      case "fireSpreadRadiusMeters": return `Spread +${amount(effect)}m`;
      case "fireSpreadChancePerSecond": return `Spread speed +${amount(effect)}/s`;
      case "blueGrassSlow": return `Blue slow ${amount(effect) > 0 ? "+" : ""}${amount(effect)}`;
      case "timerGrassBonus": return `Timer +${amount(effect)}s`;
      case "tallGrassGold": return `Tall grass +${amount(effect)} gold`;
      case "grassRegrowDelay": return `Regrow delay ${amount(effect) > 0 ? "+" : ""}${amount(effect)}s`;
      case "grassGrowSpeed": return `Grow speed +${amount(effect)}s faster`;
      case "mapExpandCap": return `Map can grow +${amount(effect)}m`;
      case "obstacleSurvey": return effect.obstacle === "rock" ? "Rocks start spawning" : "Trees start spawning";
      case "obstacleSpawnRate": return `Obstacles ${amount(effect)}s sooner`;
      case "obstacleSize": return `Obstacle size +${amount(effect)}`;
      default: return effect.kind;
    }
  }

  switch (effect.kind) {
    case "attackDamage": return `피해 +${amount(effect)}`;
    case "attackRange": return `범위 +${amount(effect)}m`;
    case "attackInterval": return `공격 간격 -${(Math.abs(amount(effect)) / 1000).toFixed(2)}초`;
    case "moveSpeed": return `이동 속도 +${amount(effect)}`;
    case "roundDurationPercent": return `라운드 시간 +${amount(effect)}%`;
    case "goldDivisor": return `골드 환산 ${amount(effect)}`;
    case "cleanPatchScore": return `깔끔한 베기 +${amount(effect)}`;
    case "clearBonusPercent": return `클리어 보너스 +${amount(effect)}%`;
    case "rockScore": return `바위 +${amount(effect)}`;
    case "treeScore": return `나무 +${amount(effect)}`;
    case "stumpNoCollision": return "그루터기 충돌 제거";
    case "failedChopStunPercent": return `반동 기절 ${amount(effect)}%`;
    case "obstacleDamage": return `장애물 피해 +${amount(effect)}`;
    case "obstacleBreakGrassBonus": return "장애물 파괴 시 풀 베기";
    case "obstacleScorePercent": return `장애물 점수 +${amount(effect)}%`;
    case "bombCount10m": return `10m 폭탄 +${amount(effect)}`;
    case "bombChainRadius": return `연쇄 반경 +${amount(effect)}m`;
    case "bombBlastRadius": return `폭발 반경 +${amount(effect)}m`;
    case "bombChainScore": return `연쇄 점수 +${amount(effect)}`;
    case "firstBombScorePercent": return `첫 폭탄 점수 +${amount(effect)}%`;
    case "unlockMap": return `${effect.mapSize}m 맵`;
    case "initialGrassCount": return `풀 +${amount(effect)}`;
    case "grassScorePercent": return `풀 점수 +${amount(effect)}%`;
    case "toolUnlock": return `도구: ${effect.tool ? toolLabel(effect.tool, language) : "알 수 없음"}`;
    case "special": return effect.id ? SPECIAL_KO[effect.id] ?? effect.id : "특수";
    case "fireIgniteChance": return `발화 ${(amount(effect) * 100).toFixed(0)}%`;
    case "fireDamagePerSecond": return `화상 피해 +${amount(effect)}/s`;
    case "fireSpreadRadiusMeters": return `확산 반경 +${amount(effect)}m`;
    case "fireSpreadChancePerSecond": return `확산 속도 +${amount(effect)}/s`;
    case "blueGrassSlow": return `푸른 풀 감속 ${amount(effect) > 0 ? "+" : ""}${amount(effect)}`;
    case "timerGrassBonus": return `타이머 +${amount(effect)}초`;
    case "tallGrassGold": return `키 큰 풀 +${amount(effect)} 골드`;
    case "grassRegrowDelay": return `재성장 지연 ${amount(effect) > 0 ? "+" : ""}${amount(effect)}초`;
    case "grassGrowSpeed": return `성장 속도 ${amount(effect)}초 단축`;
    case "mapExpandCap": return `맵 확장 한계 +${amount(effect)}m`;
    case "obstacleSurvey": return effect.obstacle === "rock" ? "바위 등장 시작" : "나무 등장 시작";
    case "obstacleSpawnRate": return `장애물 ${amount(effect)}초 빨리`;
    case "obstacleSize": return `장애물 크기 +${amount(effect)}`;
    default: return effect.kind;
  }
}

export function cardEffectLabel(card: CardNode, language: Language): string {
  return card.effects.length > 0
    ? card.effects.map((effect) => effectText(effect, language)).join(" / ")
    : language === "ko"
      ? "새 가지 열림"
      : "Opens a branch";
}

export function gateLabel(gate: CardGate | UnlockGate, language: Language): string {
  if (language === "en") {
    switch (gate.kind) {
      case "bestClearPercent": return `${gate.mapSize}m clear ${gate.percent}%`;
      case "lifetimeGrass": return `Lifetime grass ${gate.count}`;
      case "bestBombChain": return `Bomb chain ${gate.length}+`;
      default: return gate.kind;
    }
  }

  switch (gate.kind) {
    case "bestClearPercent": return `${gate.mapSize}m 클리어 ${gate.percent}%`;
    case "lifetimeGrass": return `누적 풀 ${gate.count}`;
    case "bestBombChain": return `폭탄 연쇄 ${gate.length}+`;
    default: return gate.kind;
  }
}

function cardForSkill(node: SkillNode): CardNode | undefined {
  return CARD_BY_ID[node.id];
}

function skillEffectToCardEffect(effect: SkillEffect): CardEffect {
  return effect as CardEffect;
}

export function skillName(node: SkillNode, language: Language): string {
  const card = cardForSkill(node);
  if (card) {
    return cardName(card, language);
  }
  return node.name;
}

export function skillDescription(node: SkillNode, language: Language): string {
  const card = cardForSkill(node);
  if (card) {
    return cardDescription(card, language);
  }
  return node.description;
}

export function effectLabel(node: SkillNode | CardNode, language: Language): string {
  return node.effects.length > 0
    ? node.effects.map((effect) => effectText(skillEffectToCardEffect(effect as SkillEffect), language)).join(" / ")
    : language === "ko"
      ? "새 가지 열림"
      : "Opens a branch";
}
