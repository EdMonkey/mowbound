export type UpgradePrototypeBranch = "root" | "equipment" | "harvest" | "environment";

export interface UpgradePrototypeNode {
  id: string;
  branch: UpgradePrototypeBranch;
  title: string;
  shortTitle: string;
  description: string;
  cost: number;
  x: number;
  y: number;
  prereq: string[];
  major?: boolean;
}

export const UPGRADE_PROTOTYPE_ROOT_ID = "rusty_scythe";

export const UPGRADE_PROTOTYPE_NODES: UpgradePrototypeNode[] = [
  {
    id: UPGRADE_PROTOTYPE_ROOT_ID,
    branch: "root",
    title: "녹슨 낫 갈기",
    shortTitle: "낫",
    description: "오래 묵은 낫을 갈아 첫 업그레이드 가지를 엽니다.",
    cost: 0,
    x: 0,
    y: 0,
    prereq: [],
    major: true,
  },
  {
    id: "equipment_handle",
    branch: "equipment",
    title: "튼튼한 손잡이",
    shortTitle: "손잡이",
    description: "장비 계열의 시작점입니다. 낫과 도구 성능을 확장합니다.",
    cost: 15,
    x: 0,
    y: -150,
    prereq: [UPGRADE_PROTOTYPE_ROOT_ID],
    major: true,
  },
  {
    id: "equipment_edge",
    branch: "equipment",
    title: "날 세우기",
    shortTitle: "날",
    description: "잔디를 더 빠르게 베기 위한 피해 업그레이드입니다.",
    cost: 25,
    x: -115,
    y: -280,
    prereq: ["equipment_handle"],
  },
  {
    id: "equipment_reach",
    branch: "equipment",
    title: "넓은 날",
    shortTitle: "범위",
    description: "한 번에 닿는 잔디 폭을 넓히는 업그레이드입니다.",
    cost: 30,
    x: 115,
    y: -280,
    prereq: ["equipment_handle"],
  },
  {
    id: "equipment_big_scythe",
    branch: "equipment",
    title: "큰낫",
    shortTitle: "큰낫",
    description: "느리지만 넓게 베는 장비 해금 후보입니다.",
    cost: 80,
    x: -230,
    y: -420,
    prereq: ["equipment_edge"],
    major: true,
  },
  {
    id: "equipment_trimmer",
    branch: "equipment",
    title: "예초기",
    shortTitle: "예초기",
    description: "연속 베기 장비 해금 후보입니다.",
    cost: 130,
    x: 0,
    y: -470,
    prereq: ["equipment_edge", "equipment_reach"],
    major: true,
  },
  {
    id: "equipment_tractor",
    branch: "equipment",
    title: "트랙터",
    shortTitle: "트랙터",
    description: "후반 대면적 수확 장비 해금 후보입니다.",
    cost: 260,
    x: 230,
    y: -420,
    prereq: ["equipment_reach"],
    major: true,
  },
  {
    id: "harvest_ledger",
    branch: "harvest",
    title: "수확 장부",
    shortTitle: "장부",
    description: "수확 계열의 시작점입니다. 보상과 런 효율을 확장합니다.",
    cost: 15,
    x: 230,
    y: 125,
    prereq: [UPGRADE_PROTOTYPE_ROOT_ID],
    major: true,
  },
  {
    id: "harvest_market",
    branch: "harvest",
    title: "시장 수레",
    shortTitle: "골드",
    description: "점수를 골드로 바꾸는 효율을 올리는 업그레이드입니다.",
    cost: 30,
    x: 375,
    y: 40,
    prereq: ["harvest_ledger"],
  },
  {
    id: "harvest_clean_mow",
    branch: "harvest",
    title: "깔끔한 잔디",
    shortTitle: "깔끔",
    description: "끊기지 않고 잘 베었을 때 보너스를 주는 업그레이드입니다.",
    cost: 35,
    x: 380,
    y: 185,
    prereq: ["harvest_ledger"],
  },
  {
    id: "harvest_long_day",
    branch: "harvest",
    title: "긴 하루",
    shortTitle: "시간",
    description: "라운드 시간을 늘리는 업그레이드 후보입니다.",
    cost: 95,
    x: 545,
    y: 185,
    prereq: ["harvest_clean_mow"],
  },
  {
    id: "harvest_golden_field",
    branch: "harvest",
    title: "황금 들판",
    shortTitle: "황금",
    description: "후반 수확 보상 폭발력을 주는 업그레이드 후보입니다.",
    cost: 180,
    x: 580,
    y: 55,
    prereq: ["harvest_market", "harvest_clean_mow"],
    major: true,
  },
  {
    id: "environment_scout",
    branch: "environment",
    title: "밭 가장자리 살피기",
    shortTitle: "개척",
    description: "환경 계열의 시작점입니다. 새 목표와 방해물을 확장합니다.",
    cost: 15,
    x: -230,
    y: 125,
    prereq: [UPGRADE_PROTOTYPE_ROOT_ID],
    major: true,
  },
  {
    id: "environment_thick_grass",
    branch: "environment",
    title: "질긴 풀",
    shortTitle: "질긴풀",
    description: "체력이 높은 신규 풀을 여는 후보입니다.",
    cost: 30,
    x: -380,
    y: 40,
    prereq: ["environment_scout"],
  },
  {
    id: "environment_stones",
    branch: "environment",
    title: "돌 깨기",
    shortTitle: "돌",
    description: "돌 파괴 가능 업그레이드 후보입니다.",
    cost: 45,
    x: -380,
    y: 185,
    prereq: ["environment_scout"],
  },
  {
    id: "environment_trees",
    branch: "environment",
    title: "나무 베기",
    shortTitle: "나무",
    description: "나무 베기와 그루터기 처리를 여는 후보입니다.",
    cost: 90,
    x: -545,
    y: 185,
    prereq: ["environment_stones"],
  },
  {
    id: "environment_bombs",
    branch: "environment",
    title: "폭탄 배치",
    shortTitle: "폭탄",
    description: "맵에 폭탄과 연쇄 폭발 목표를 추가하는 후보입니다.",
    cost: 110,
    x: -545,
    y: 55,
    prereq: ["environment_thick_grass", "environment_stones"],
    major: true,
  },
  {
    id: "environment_open_acre",
    branch: "environment",
    title: "넓은 밭 계약",
    shortTitle: "30m",
    description: "30m 맵 같은 확장 공간을 여는 후보입니다.",
    cost: 220,
    x: -700,
    y: 120,
    prereq: ["environment_bombs"],
    major: true,
  },
];

export const UPGRADE_PROTOTYPE_NODE_BY_ID: Record<string, UpgradePrototypeNode> = Object.fromEntries(
  UPGRADE_PROTOTYPE_NODES.map((node) => [node.id, node]),
);

export function getPrototypeNode(id: string): UpgradePrototypeNode | undefined {
  return UPGRADE_PROTOTYPE_NODE_BY_ID[id];
}

export function getRevealedPrototypeNodes(unlockedIds: Iterable<string>): UpgradePrototypeNode[] {
  const unlocked = new Set(unlockedIds);
  return UPGRADE_PROTOTYPE_NODES.filter(
    (node) => node.prereq.length === 0 || node.prereq.some((prereq) => unlocked.has(prereq)),
  );
}

export function canUnlockPrototypeNode(node: UpgradePrototypeNode, unlockedIds: Iterable<string>): boolean {
  const unlocked = new Set(unlockedIds);
  return !unlocked.has(node.id) && node.prereq.every((prereq) => unlocked.has(prereq));
}
