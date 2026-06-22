import type { SkillEffect, SkillNode, ToolId, UnlockGate } from "./config/skillTree";

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

const SKILL_KO: Record<string, { name: string; description: string }> = {
  root_sharpen: { name: "첫 연마", description: "피해량 +1." },
  sharp_edge_1: { name: "날 세우기 I", description: "피해량 +1. 기본 연마와 함께 풀을 한 번에 벨 수 있습니다." },
  sharp_edge_2: { name: "날 세우기 II", description: "피해량 +1. 장애물 파괴 기준에 도달합니다." },
  clean_sweep_1: { name: "넓은 베기 I", description: "공격 범위 +0.10m." },
  clean_sweep_2: { name: "넓은 베기 II", description: "공격 범위 +0.12m." },
  quick_recovery_1: { name: "빠른 회복 I", description: "공격 간격 -100ms." },
  quick_recovery_2: { name: "빠른 회복 II", description: "공격 간격 -100ms." },
  heavy_edge: { name: "묵직한 날", description: "피해량 +1, 장애물 피해량 +1." },
  cyclone_cut: { name: "회오리 베기", description: "6번째 공격마다 0.85m 원형 베기를 실행합니다." },
  light_boots_1: { name: "가벼운 장화 I", description: "이동 속도 +0.12." },
  light_boots_2: { name: "가벼운 장화 II", description: "이동 속도 +0.14." },
  field_rhythm_1: { name: "밭의 리듬 I", description: "라운드 시간 +8%." },
  field_rhythm_2: { name: "밭의 리듬 II", description: "라운드 시간 +8%." },
  sprint_harvest: { name: "수확 질주", description: "깔끔한 잔디 보너스 후 2초 동안 이동 속도 +20%." },
  long_day: { name: "긴 하루", description: "라운드 시간 +12%." },
  market_cart_1: { name: "시장 수레 I", description: "골드 변환 계수 4.0 -> 3.7." },
  market_cart_2: { name: "시장 수레 II", description: "골드 변환 계수 3.7 -> 3.4." },
  clean_rows_1: { name: "깔끔한 잔디 I", description: "운전 실력 깔끔한 잔디 보너스 +8 점수." },
  clean_rows_2: { name: "깔끔한 잔디 II", description: "운전 실력 깔끔한 잔디 보너스 +14 점수." },
  bulk_buyer_1: { name: "대량 납품 I", description: "클리어율 보너스 +10%." },
  bulk_buyer_2: { name: "대량 납품 II", description: "클리어율 보너스 +15%." },
  golden_field: { name: "황금 밭", description: "라운드 첫 10초 동안 수확 점수 +25%." },
  accountant: { name: "정산 장부", description: "최종 골드 +10%." },
  stone_chips: { name: "돌 조각 판매", description: "바위 파괴 +25 점수." },
  wood_haul: { name: "목재 운반", description: "나무 파괴 +40 점수." },
  stump_grinder: { name: "그루터기 분쇄", description: "나무 파괴 후 그루터기가 이동을 막지 않습니다." },
  recoil_training: { name: "반동 훈련", description: "실패한 벌목 기절 시간 -25%." },
  quarry_blade: { name: "채석 날", description: "장애물 피해량 +2." },
  clearcut: { name: "벌목 연쇄", description: "장애물 파괴 시 주변 풀도 함께 벱니다." },
  lumberjack: { name: "벌목꾼 장부", description: "장애물 점수 +50%." },
  seed_bombs: { name: "씨앗 폭탄", description: "10m 맵에 폭탄 3개를 생성합니다." },
  fuse_training_1: { name: "도화선 훈련 I", description: "폭탄 연쇄 반경 +0.35m." },
  blast_control_1: { name: "폭발 조율 I", description: "폭발 반경 +0.20m." },
  chain_payout_1: { name: "연쇄 보상 I", description: "추가 연쇄 폭탄마다 +30 점수." },
  fuse_training_2: { name: "도화선 훈련 II", description: "폭탄 연쇄 반경 +0.35m." },
  blast_control_2: { name: "폭발 조율 II", description: "폭발 반경 +0.25m." },
  harvest_detonation: { name: "수확 폭발", description: "라운드 첫 폭탄 점수 +50%." },
  open_acre: { name: "넓은 밭 계약", description: "30m 맵을 해금합니다." },
  dense_growth: { name: "빽빽한 성장", description: "기본 풀 +120." },
  fertile_soil: { name: "비옥한 흙", description: "풀 점수 +10%." },
  wide_sickle: { name: "넓은 낫", description: "도구: 범위 +0.25m, 공격 간격 +150ms." },
  fast_sickle: { name: "빠른 낫", description: "도구: 공격 간격 -150ms, 범위 -0.05m." },
  bomb_sickle: { name: "폭탄 낫", description: "도구: 폭탄 +2, 연쇄 보상 +20%." },
  alien_crop_mark: { name: "외계 문양 낙인", description: "12초마다 0.4초 경고 후 지름 2.4m 외계 문양을 찍습니다." },
  mower_laser: { name: "잔디깎이 레이저", description: "8번째 공격마다 6m 광선을 발사해 폭탄도 기폭할 수 있습니다." },
  tractor_license: { name: "트랙터 면허", description: "도구: 이동 중 전방 1.2m 줄을 계속 베고 회전 반응이 -15% 됩니다." },
};

const SPECIAL_KO: Record<string, string> = {
  cyclone_cut: "회오리 베기",
  sprint_harvest: "수확 질주",
  golden_field: "황금 밭",
  clearcut: "벌목 연쇄",
  alien_crop_mark: "외계 문양",
  mower_laser: "레이저",
};

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

export function toolLabel(tool: ToolId, language: Language): string {
  return language === "ko" ? TOOL_KO[tool] : TOOL_EN[tool];
}

export function skillName(node: SkillNode, language: Language): string {
  return language === "ko" ? SKILL_KO[node.id]?.name ?? node.name : node.name;
}

export function skillDescription(node: SkillNode, language: Language): string {
  return language === "ko" ? SKILL_KO[node.id]?.description ?? node.description : node.description;
}

const SUMMON_NAME: Record<string, { ko: string; en: string }> = {
  shadowClone: { ko: "그림자 분신", en: "Shadow Clone" },
  flyingScythe: { ko: "날아가는 낫", en: "Flying Scythe" },
  tractorSummon: { ko: "트랙터", en: "Tractor" },
  boomerang: { ko: "부메랑", en: "Boomerang" },
  lightning: { ko: "번개", en: "Lightning" },
  drone: { ko: "드론", en: "Drone" },
  tornado: { ko: "회오리", en: "Tornado" },
};

function summonEffectText(
  effect: Extract<SkillEffect, { kind: "summon" }>,
  language: Language,
): string {
  const name = SUMMON_NAME[effect.ability]?.[language] ?? effect.ability;
  const n = effect.amount;
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
  }
}

export function effectText(effect: SkillEffect, language: Language): string {
  if (effect.kind === "summon") {
    return summonEffectText(effect, language);
  }
  if (language === "en") {
    switch (effect.kind) {
      case "attackDamage":
        return `Damage +${effect.amount}`;
      case "attackRange":
        return `Range +${effect.amount}m`;
      case "attackInterval":
        return `Attack speed +${(Math.abs(effect.amount) / 1000).toFixed(2)}s`;
      case "moveSpeed":
        return `Move speed +${effect.amount}`;
      case "roundDurationPercent":
        return `Round time +${effect.amount}%`;
      case "goldDivisor":
        return `Gold divisor ${effect.amount}`;
      case "cleanPatchScore":
        return `Clean mow +${effect.amount}`;
      case "clearBonusPercent":
        return `Clear bonus +${effect.amount}%`;
      case "rockScore":
        return `Rock +${effect.amount}`;
      case "treeScore":
        return `Tree +${effect.amount}`;
      case "stumpNoCollision":
        return "Stumps stop blocking";
      case "failedChopStunPercent":
        return `Recoil stun ${effect.amount}%`;
      case "obstacleDamage":
        return `Obstacle damage +${effect.amount}`;
      case "obstacleBreakGrassBonus":
        return "Obstacle break cuts grass";
      case "obstacleScorePercent":
        return `Obstacle score +${effect.amount}%`;
      case "bombCount10m":
        return `10m bombs +${effect.amount}`;
      case "bombChainRadius":
        return `Chain radius +${effect.amount}m`;
      case "bombBlastRadius":
        return `Blast radius +${effect.amount}m`;
      case "bombChainScore":
        return `Chain score +${effect.amount}`;
      case "firstBombScorePercent":
        return `First bomb score +${effect.amount}%`;
      case "unlockMap":
        return `${effect.mapSize}m map`;
      case "initialGrassCount":
        return `Grass +${effect.amount}`;
      case "grassScorePercent":
        return `Grass score +${effect.amount}%`;
      case "toolUnlock":
        return `Tool: ${toolLabel(effect.tool, language)}`;
      case "special":
        return effect.id.replace(/_/g, " ");
      case "fireIgniteChance":
        return `Ignite ${(effect.amount * 100).toFixed(0)}%`;
      case "fireDamagePerSecond":
        return `Burn +${effect.amount}/s`;
      case "fireSpreadRadiusMeters":
        return `Spread +${effect.amount}m`;
      case "fireSpreadChancePerSecond":
        return `Spread speed +${effect.amount}/s`;
      case "blueGrassSlow":
        return `Blue slow ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
      case "timerGrassBonus":
        return `Timer +${effect.amount}s`;
      case "tallGrassGold":
        return `Tall grass +${effect.amount} gold`;
      case "grassRegrowDelay":
        return `Regrow delay ${effect.amount > 0 ? "+" : ""}${effect.amount}s`;
      case "grassGrowSpeed":
        return `Grow speed +${effect.amount}s faster`;
      case "mapExpandCap":
        return `Map can grow +${effect.amount}m`;
      case "obstacleSurvey":
        return effect.obstacle === "rock" ? "Rocks start spawning" : "Trees start spawning";
      case "obstacleSpawnRate":
        return `Obstacles ${effect.amount}s sooner`;
      case "obstacleSize":
        return `Obstacle size +${effect.amount}`;
    }
  }

  switch (effect.kind) {
    case "attackDamage":
      return `피해량 +${effect.amount}`;
    case "attackRange":
      return `범위 +${effect.amount}m`;
    case "attackInterval":
      return `공격 간격 -${(Math.abs(effect.amount) / 1000).toFixed(2)}초`;
    case "moveSpeed":
      return `이동 속도 +${effect.amount}`;
    case "roundDurationPercent":
      return `라운드 시간 +${effect.amount}%`;
    case "goldDivisor":
      return `골드 변환 ${effect.amount}`;
    case "cleanPatchScore":
      return `깔끔한 잔디 +${effect.amount}`;
    case "clearBonusPercent":
      return `클리어 보너스 +${effect.amount}%`;
    case "rockScore":
      return `바위 +${effect.amount}`;
    case "treeScore":
      return `나무 +${effect.amount}`;
    case "stumpNoCollision":
      return "그루터기 충돌 제거";
    case "failedChopStunPercent":
      return `반동 기절 ${effect.amount}%`;
    case "obstacleDamage":
      return `장애물 피해 +${effect.amount}`;
    case "obstacleBreakGrassBonus":
      return "장애물 파괴 시 풀 베기";
    case "obstacleScorePercent":
      return `장애물 점수 +${effect.amount}%`;
    case "bombCount10m":
      return `10m 폭탄 +${effect.amount}`;
    case "bombChainRadius":
      return `연쇄 반경 +${effect.amount}m`;
    case "bombBlastRadius":
      return `폭발 반경 +${effect.amount}m`;
    case "bombChainScore":
      return `연쇄 점수 +${effect.amount}`;
    case "firstBombScorePercent":
      return `첫 폭탄 점수 +${effect.amount}%`;
    case "unlockMap":
      return `${effect.mapSize}m 맵`;
    case "initialGrassCount":
      return `풀 +${effect.amount}`;
    case "grassScorePercent":
      return `풀 점수 +${effect.amount}%`;
    case "toolUnlock":
      return `도구: ${toolLabel(effect.tool, language)}`;
    case "special":
      return SPECIAL_KO[effect.id] ?? effect.id;
    case "fireIgniteChance":
      return `점화 ${(effect.amount * 100).toFixed(0)}%`;
    case "fireDamagePerSecond":
      return `화염 피해 +${effect.amount}/s`;
    case "fireSpreadRadiusMeters":
      return `번짐 반경 +${effect.amount}m`;
    case "fireSpreadChancePerSecond":
      return `번짐 속도 +${effect.amount}/s`;
    case "blueGrassSlow":
      return `파란 풀 감속 ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
    case "timerGrassBonus":
      return `타이머 +${effect.amount}초`;
    case "tallGrassGold":
      return `키 큰 풀 +${effect.amount} 골드`;
    case "grassRegrowDelay":
      return `재성장 지연 ${effect.amount > 0 ? "+" : ""}${effect.amount}초`;
    case "grassGrowSpeed":
      return `성장 속도 ${effect.amount}초 단축`;
    case "mapExpandCap":
      return `맵 확장 한계 +${effect.amount}m`;
    case "obstacleSurvey":
      return effect.obstacle === "rock" ? "돌 등장 시작" : "나무 등장 시작";
    case "obstacleSpawnRate":
      return `장애물 ${effect.amount}초 빨리`;
    case "obstacleSize":
      return `장애물 크기 +${effect.amount}`;
  }
}

export function effectLabel(node: SkillNode, language: Language): string {
  return node.effects.length > 0
    ? node.effects.map((effect) => effectText(effect, language)).join(" / ")
    : language === "ko"
      ? "새 가지 열림"
      : "Opens a branch";
}

export function gateLabel(gate: UnlockGate, language: Language): string {
  if (language === "en") {
    switch (gate.kind) {
      case "bestClearPercent":
        return `${gate.mapSize}m clear ${gate.percent}%`;
      case "lifetimeGrass":
        return `Lifetime grass ${gate.count}`;
      case "bestBombChain":
        return `Bomb chain ${gate.length}+`;
    }
  }

  switch (gate.kind) {
    case "bestClearPercent":
      return `${gate.mapSize}m 클리어 ${gate.percent}%`;
    case "lifetimeGrass":
      return `누적 풀 ${gate.count}`;
    case "bestBombChain":
      return `폭탄 연쇄 ${gate.length}+`;
  }
}
