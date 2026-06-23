import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("src/game/config/skillTree.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const context = { exports: {}, require, console };
vm.runInNewContext(output, context, { filename: "skillTree.js" });

const nodes = context.exports.SKILL_NODES;
const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));

const roman = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };
const categoryX = { equipment: -540, harvest: -180, environment: 180, ability: 540 };
const branchOffset = {
  root: 0,
  blade: -70,
  movement: 70,
  harvest: 0,
  obstacles: -70,
  land: 70,
  bombs: -120,
  spectacle: 0,
  summon: 120,
};

const nameKoById = {
  root_sharpen: "첫 날 갈기",
  sharp_edge_1: "예리한 날 I",
  sharp_edge_2: "예리한 날 II",
  clean_sweep_1: "넓은 베기 I",
  clean_sweep_2: "넓은 베기 II",
  wide_arc_1: "넓은 궤적 I",
  wide_arc_2: "넓은 궤적 II",
  wide_arc_3: "넓은 궤적 III",
  grand_sweep_1: "대형 베기 I",
  grand_sweep_2: "대형 베기 II",
  quick_recovery_1: "빠른 회수 I",
  quick_recovery_2: "빠른 회수 II",
  heavy_edge: "묵직한 날",
  ember: "불씨 날",
  burn1: "화상 피해 +",
  burn2: "화상 피해 ++",
  burn3: "화상 피해 +++",
  spread1: "확산 반경 +",
  spread2: "확산 반경 ++",
  spread3: "확산 반경 +++",
  kindle1: "불쏘시개 +",
  kindle2: "불쏘시개 ++",
  kindle3: "불쏘시개 +++",
  cyclone_cut: "회오리 베기",
  light_boots_1: "가벼운 장화 I",
  light_boots_2: "가벼운 장화 II",
  field_rhythm_1: "밭 리듬 I",
  field_rhythm_2: "밭 리듬 II",
  sprint_harvest: "질주 수확",
  long_day: "긴 하루",
  market_cart_1: "시장 손수레 I",
  market_cart_2: "시장 손수레 II",
  clean_rows_1: "깔끔한 줄 I",
  clean_rows_2: "깔끔한 줄 II",
  bulk_buyer_1: "대량 구매자 I",
  bulk_buyer_2: "대량 구매자 II",
  golden_field: "황금 밭",
  accountant: "회계사",
  stone_chips: "돌 조각",
  wood_haul: "목재 운반",
  stump_grinder: "그루터기 분쇄기",
  recoil_training: "반동 훈련",
  quarry_blade: "채석장 날",
  clearcut: "개벌",
  lumberjack: "나무꾼 장부",
  seed_bombs: "씨앗 폭탄",
  fuse_training_1: "도화선 훈련 I",
  fuse_training_2: "도화선 훈련 II",
  blast_control_1: "폭발 제어 I",
  blast_control_2: "폭발 제어 II",
  chain_payout_1: "연쇄 보상 I",
  harvest_detonation: "수확 폭파",
  open_acre: "넓은 밭 계약",
  dense_growth: "빽빽한 성장",
  fertile_soil: "비옥한 토양",
  wide_sickle: "넓은 낫",
  fast_sickle: "빠른 낫",
  bomb_sickle: "폭탄 낫",
  grasslore: "풀 연구",
  bluefoot: "파란 풀 적응",
  timerboon: "시간 풀 보너스",
  fastgrowth: "빠른 재성장",
  tallbounty: "키 큰 풀 현상금",
  grow_speed_1: "빠른 성장 I",
  grow_speed_2: "빠른 성장 II",
  grow_speed_3: "빠른 성장 III",
  grow_speed_4: "빠른 성장 IV",
  grow_speed_5: "빠른 성장 V",
  wide_lands_1: "측량 말뚝 I",
  wide_lands_2: "측량 말뚝 II",
  wide_lands_3: "측량 말뚝 III",
  wide_lands_4: "측량 말뚝 IV",
  survey_rock: "돌 조사",
  survey_tree: "나무 조사",
  field_churn_1: "밭 뒤섞임 I",
  field_churn_2: "밭 뒤섞임 II",
  boulder_lore_1: "큰 돌 지식 I",
  boulder_lore_2: "큰 돌 지식 II",
  alien_crop_mark: "외계 문양",
  mower_laser: "잔디깎이 레이저",
  tractor_license: "트랙터 면허",
  summon_codex: "소환 교본",
  summon_shadow: "그림자 분신",
  summon_scythe: "날아다니는 낫",
  summon_tractor: "트랙터 호출",
  summon_boomerang: "부메랑 낫",
  summon_lightning: "번개 강타",
  summon_drone: "잔디깎이 드론",
  summon_tornado: "토네이도",
};

function effectKinds(node) {
  return new Set((node.effects ?? []).map((effect) => effect.kind));
}

function categoryFor(node) {
  const kinds = effectKinds(node);
  if (node.branch === "harvest") {
    return "harvest";
  }
  if (node.branch === "obstacles") {
    return "environment";
  }
  if (node.branch === "land") {
    return kinds.has("toolUnlock") ? "equipment" : "environment";
  }
  if (node.branch === "bombs" || node.branch === "spectacle" || node.branch === "summon") {
    return "ability";
  }
  return "equipment";
}

function computeTier(id, visiting = new Set()) {
  const node = byId[id];
  if (!node || node.prereq.length === 0) {
    return 0;
  }
  if (visiting.has(id)) {
    throw new Error(`Cycle at ${id}`);
  }
  visiting.add(id);
  const tier = Math.max(...node.prereq.map((prereq) => computeTier(prereq, visiting))) + 1;
  visiting.delete(id);
  return tier;
}

function tagsFor(node) {
  const tags = new Set([node.branch, categoryFor(node)]);
  for (const effect of node.effects ?? []) {
    tags.add(effect.kind);
    if (effect.kind === "summon") {
      tags.add(effect.ability);
    }
    if (effect.kind === "special") {
      tags.add(effect.id);
    }
    if (effect.kind === "toolUnlock") {
      tags.add(effect.tool);
    }
    if (effect.kind === "obstacleSurvey") {
      tags.add(effect.obstacle);
    }
  }
  return [...tags].sort();
}

function nameKoFor(id, fallback) {
  if (nameKoById[id]) {
    return nameKoById[id];
  }

  let match;
  if ((match = id.match(/^shadow_count_(\d)$/))) return "그림자 분신 +1";
  if ((match = id.match(/^shadow_dmg_(\d)$/))) return `분신 날 ${roman[match[1]]}`;
  if ((match = id.match(/^shadow_cd_(\d)$/))) return `분신 호출 ${roman[match[1]]}`;
  if ((match = id.match(/^scythe_count_(\d)$/))) return "낫 부채 +1";
  if ((match = id.match(/^scythe_dmg_(\d)$/))) return `날아다니는 낫날 ${roman[match[1]]}`;
  if ((match = id.match(/^scythe_radius_(\d)$/))) return `넓은 회전 ${roman[match[1]]}`;
  if ((match = id.match(/^scythe_spin_(\d)$/))) return `긴 회전 ${roman[match[1]]}`;
  if ((match = id.match(/^tractor_width_(\d)$/))) return `넓은 데크 ${roman[match[1]]}`;
  if ((match = id.match(/^tractor_dmg_(\d)$/))) return `트랙터 날 ${roman[match[1]]}`;
  if ((match = id.match(/^tractor_cd_(\d)$/))) return `빠른 시동 ${roman[match[1]]}`;
  if ((match = id.match(/^boom_count_(\d)$/))) return "부메랑 +1";
  if ((match = id.match(/^boom_dmg_(\d)$/))) return `부메랑 날 ${roman[match[1]]}`;
  if ((match = id.match(/^boom_range_(\d)$/))) return `긴 투척 ${roman[match[1]]}`;
  if ((match = id.match(/^light_count_(\d)$/))) return "폭풍 +1";
  if ((match = id.match(/^light_radius_(\d)$/))) return `넓은 번개 ${roman[match[1]]}`;
  if ((match = id.match(/^light_cd_(\d)$/))) return `충전 ${roman[match[1]]}`;
  if ((match = id.match(/^drone_count_(\d)$/))) return "드론 +1";
  if ((match = id.match(/^drone_radius_(\d)$/))) return `넓은 훑기 ${roman[match[1]]}`;
  if ((match = id.match(/^drone_dur_(\d)$/))) return `긴 비행 ${roman[match[1]]}`;
  if ((match = id.match(/^drone_dmg_(\d)$/))) return "드론 날";
  if ((match = id.match(/^torn_size_(\d)$/))) return `큰 깔때기 ${roman[match[1]]}`;
  if ((match = id.match(/^torn_dur_(\d)$/))) return `오래가는 폭풍 ${roman[match[1]]}`;
  if ((match = id.match(/^torn_dmg_(\d)$/))) return `토네이도 위력 ${roman[match[1]]}`;
  return fallback;
}

function plus(amount, suffix = "") {
  if (amount === undefined) {
    return "";
  }
  return `${amount > 0 ? "+" : ""}${amount}${suffix}`;
}

function abilityKo(id) {
  return (
    {
      shadowClone: "그림자 분신",
      flyingScythe: "날아다니는 낫",
      tractorSummon: "소환 트랙터",
      boomerang: "부메랑",
      lightning: "번개",
      drone: "드론",
      tornado: "토네이도",
    }[id] ?? id
  );
}

function summonStatKo(stat) {
  return (
    {
      count: "개수",
      damage: "피해량",
      interval: "간격",
      radius: "반경",
      spins: "회전 수",
      duration: "지속시간",
      width: "폭",
      size: "크기",
      range: "거리",
    }[stat] ?? stat
  );
}

function specialKo(id) {
  return (
    {
      cyclone_cut: "6번째 공격마다 원형 베기",
      sprint_harvest: "깔끔한 잔디 후 2초간 이동속도 증가",
      golden_field: "초반 10초 수확 점수 증가",
      clearcut: "장애물 파괴 시 주변 풀 제거",
      alien_crop_mark: "하늘에서 외계 문양 잔디깎기",
      mower_laser: "전방으로 잔디깎이 레이저 발사",
    }[id] ?? id
  );
}

function toolKo(tool) {
  return (
    {
      wide_sickle: "넓은 낫",
      fast_sickle: "빠른 낫",
      bomb_sickle: "폭탄 낫",
      tractor: "트랙터",
    }[tool] ?? tool
  );
}

function effectKo(effect) {
  switch (effect.kind) {
    case "attackDamage": return `공격력 ${plus(effect.amount)}`;
    case "attackRange": return `공격범위 ${plus(effect.amount, "m")}`;
    case "attackInterval": return `공격간격 ${plus(effect.amount, "ms")}`;
    case "moveSpeed": return `이동속도 ${plus(effect.amount)}`;
    case "roundDurationPercent": return `라운드 시간 ${plus(effect.amount, "%")}`;
    case "goldDivisor": return `골드 환산 효율 ${plus(Math.abs(effect.amount))}`;
    case "cleanPatchScore": return `깔끔한 잔디 점수 ${plus(effect.amount)}`;
    case "clearBonusPercent": return `클리어 보너스 ${plus(effect.amount, "%")}`;
    case "rockScore": return `돌 파괴 점수 ${plus(effect.amount)}`;
    case "treeScore": return `나무 파괴 점수 ${plus(effect.amount)}`;
    case "stumpNoCollision": return "부서진 그루터기 충돌 제거";
    case "failedChopStunPercent": return `실패 타격 스턴 ${plus(effect.amount, "%")}`;
    case "obstacleDamage": return `장애물 피해 ${plus(effect.amount)}`;
    case "obstacleBreakGrassBonus": return "장애물 파괴 시 주변 풀 보너스";
    case "obstacleScorePercent": return `장애물 점수 ${plus(effect.amount, "%")}`;
    case "bombCount10m": return `10m 맵 폭탄 ${plus(effect.amount)}개`;
    case "bombChainRadius": return `폭탄 연쇄 반경 ${plus(effect.amount, "m")}`;
    case "bombBlastRadius": return `폭발 반경 ${plus(effect.amount, "m")}`;
    case "bombChainScore": return `연쇄 폭탄 점수 ${plus(effect.amount)}`;
    case "firstBombScorePercent": return `첫 폭탄 점수 ${plus(effect.amount, "%")}`;
    case "unlockMap": return `${effect.mapSize}m 맵 해금`;
    case "initialGrassCount": return `기본 풀 ${plus(effect.amount)}`;
    case "grassScorePercent": return `풀 점수 ${plus(effect.amount, "%")}`;
    case "toolUnlock": return `${toolKo(effect.tool)} 해금`;
    case "special": return specialKo(effect.id);
    case "fireIgniteChance": return `불붙임 확률 ${plus(effect.amount * 100, "%")}`;
    case "fireDamagePerSecond": return `화상 피해 ${plus(effect.amount, "/초")}`;
    case "fireSpreadRadiusMeters": return `불 확산 반경 ${plus(effect.amount, "m")}`;
    case "fireSpreadChancePerSecond": return `불 확산 속도 ${plus(effect.amount, "/초")}`;
    case "blueGrassSlow": return `파란 풀 감속 ${plus(effect.amount)}`;
    case "timerGrassBonus": return `시간 풀 보너스 ${plus(effect.amount)}`;
    case "tallGrassGold": return `키 큰 풀 골드 ${plus(effect.amount)}`;
    case "grassRegrowDelay": return `풀 재성장 지연 ${plus(effect.amount, "초")}`;
    case "grassGrowSpeed": return `풀 성장속도 ${plus(effect.amount)}`;
    case "summon": return `${abilityKo(effect.ability)} ${summonStatKo(effect.stat)} ${plus(effect.amount)}`;
    case "mapExpandCap": return `자동 맵 확장 한도 ${plus(effect.amount, "m")}`;
    case "obstacleSurvey": return `${effect.obstacle === "rock" ? "돌" : "나무"} 등장 해금`;
    case "obstacleSpawnRate": return `장애물 등장 간격 ${plus(effect.amount, "초")}`;
    case "obstacleSize": return `장애물 크기 ${plus(effect.amount)}`;
    default: return effect.kind;
  }
}

function connectorDescription(card) {
  return (
    {
      equipment: "장비 계열 카드가 열립니다.",
      harvest: "수확 계열 카드가 열립니다.",
      environment: "환경 계열 카드가 열립니다.",
      ability: "능력 계열 카드가 열립니다.",
    }[card.category] ?? "새 카드 가지가 열립니다."
  );
}

const categoryCounts = {};
const cards = nodes.map((node, index) => {
  const category = categoryFor(node);
  const tier = computeTier(node.id);
  const laneIndex = categoryCounts[`${category}:${tier}`] ?? 0;
  categoryCounts[`${category}:${tier}`] = laneIndex + 1;
  const spread = (laneIndex % 2 === 0 ? -1 : 1) * Math.ceil(laneIndex / 2) * 52;
  const card = {
    id: node.id,
    nameKo: nameKoFor(node.id, node.name),
    nameEn: node.name,
    category,
    branch: node.branch,
    tier,
    cost: node.cost,
    prereq: node.prereq,
    gates: node.gates,
    tags: tagsFor(node),
    effects: node.effects,
    descriptionKo: "",
    descriptionEn: node.description,
    layout: {
      x: categoryX[category] + (branchOffset[node.branch] || 0) + spread,
      y: -tier * 170,
    },
    sort: index,
  };
  card.descriptionKo = card.effects.length > 0 ? card.effects.map(effectKo).join(", ") : connectorDescription(card);
  return card;
});

fs.writeFileSync("src/game/config/cards.json", `${JSON.stringify(cards, null, 2)}\n`);
console.log(`Synced ${cards.length} cards to src/game/config/cards.json`);
