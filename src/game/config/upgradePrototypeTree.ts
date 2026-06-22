export type UpgradePrototypeBranch = "root" | "equipment" | "harvest" | "environment";
type MainUpgradeBranch = Exclude<UpgradePrototypeBranch, "root">;

export interface UpgradePrototypeNode {
  id: string;
  branch: UpgradePrototypeBranch;
  tier: number;
  lane: number;
  title: string;
  shortTitle: string;
  description: string;
  cost: number;
  x: number;
  y: number;
  prereq: string[];
  major?: boolean;
}

interface UpgradePrototypeSeed extends Omit<UpgradePrototypeNode, "x" | "y"> {}

type BranchSidePrereq = "core" | "previousLane" | "previousCore" | "previousCoreAndLane";

interface BranchSide {
  lane: number;
  title: string;
  prereq?: BranchSidePrereq;
}

interface BranchTier {
  core: string;
  sides: BranchSide[];
}

export const UPGRADE_PROTOTYPE_ROOT_ID = "rusty_scythe";

export const BRANCH_LAYOUT: Record<UpgradePrototypeBranch, { x: number; yStart: number; tierGap: number; laneGap: number }> = {
  root: { x: 0, yStart: 0, tierGap: 0, laneGap: 0 },
  equipment: { x: -760, yStart: 240, tierGap: 165, laneGap: 98 },
  harvest: { x: 0, yStart: 240, tierGap: 165, laneGap: 98 },
  environment: { x: 760, yStart: 240, tierGap: 165, laneGap: 98 },
};

const BRANCH_TIERS: Record<MainUpgradeBranch, BranchTier[]> = {
  equipment: [
    { core: "낫 손질", sides: sides(["날 세우기", "넓은 날", "빠른 회전"], [-1, 1, 2]) },
    { core: "큰낫 준비", sides: sides(["묵직한 날", "긴 손잡이", "깊은 베기", "되돌림 연습"], [-2, -1, 1, 2], [-1, 1]) },
    { core: "큰낫 해금", sides: sides(["넓은 휘두르기", "무게 줄이기", "연속 베기"], [-1, 1, 2], [1]) },
    { core: "예초기 준비", sides: sides(["회전날", "연료통", "시동 안정", "소음 억제", "날 보호대"], [-3, -2, -1, 1, 2], [-1, 2]) },
    { core: "예초기 해금", sides: sides(["지속 회전", "좁은 코너", "과열 방지", "잔디 흡입"], [-2, -1, 1, 2], [-2]) },
    { core: "강화 예초기", sides: sides(["이중 회전날", "고출력 모터", "안정 손잡이", "급가속"], [-2, -1, 1, 3], [1]) },
    { core: "트랙터 준비", sides: sides(["차체 정비", "앞날 장착", "조향 연습", "바퀴 접지", "넓은 축"], [-3, -2, -1, 1, 2], [-2, 1]) },
    { core: "트랙터 면허", sides: sides(["넓은 전방날", "회전 보정", "연료 효율"], [-1, 1, 2], [-1]) },
    { core: "자동 장비", sides: sides(["보조 날개", "자율 보정", "과충전", "장비 동기화"], [-2, -1, 1, 2], [2]) },
    { core: "초월 장비", sides: sides(["레이저 장착", "외계 날", "거대 수확기", "무한 동력", "차원 절단"], [-3, -2, -1, 1, 2], [-2, 1]) },
  ],
  harvest: [
    { core: "수확 장부", sides: sides(["시장 수레", "깔끔한 잔디", "동전 줍기", "첫 거래"], [-2, -1, 1, 2]) },
    { core: "수확 계산", sides: sides(["골드 환산", "연속 보너스", "수확 집중"], [-1, 1, 2], [-1]) },
    { core: "납품 계약", sides: sides(["대량 납품", "클리어 보너스", "빠른 정산", "동전 자석", "짧은 휴식"], [-3, -2, -1, 1, 2], [-1, 1]) },
    { core: "풍작 준비", sides: sides(["황금 씨앗", "풍작 시간", "수확 질주"], [-2, -1, 1], [-2]) },
    { core: "황금 들판", sides: sides(["초반 보너스", "잔디 가치", "깔끔한 줄", "보너스 배율"], [-2, -1, 1, 2], [1]) },
    { core: "마을 거래", sides: sides(["고정 단가", "상인 할인", "계약 연장", "빠른 배달", "숙련 보너스"], [-3, -2, -1, 1, 2], [-1, 2]) },
    { core: "수확 축제", sides: sides(["축제 보너스", "콤보 보상", "긴 하루"], [-2, 1, 2], [2]) },
    { core: "대형 시장", sides: sides(["묶음 판매", "프리미엄 납품", "운송 개선", "시장 확장"], [-2, -1, 1, 3], [-2]) },
    { core: "황금 회계", sides: sides(["최종 정산", "연쇄 수익", "수확 투자", "골드 창고", "행운 동전"], [-3, -2, -1, 1, 2], [-1, 1]) },
    { core: "왕실 납품", sides: sides(["왕실 계약", "무역 길드", "끝없는 수확"], [-1, 1, 2], [1]) },
  ],
  environment: [
    { core: "밭 살피기", sides: sides(["질긴 풀", "돌 확인", "나무 확인"], [-1, 1, 2]) },
    { core: "장애물 조사", sides: sides(["돌 깨기", "나무 베기", "뿌리 제거", "파편 보상", "작은 폭탄"], [-3, -2, -1, 1, 2], [1, 2]) },
    { core: "밭 개척", sides: sides(["새 풀 군집", "큰 돌", "굵은 나무", "안전 지대"], [-2, -1, 1, 2], [-1]) },
    { core: "폭탄 배치", sides: sides(["폭발 반경", "연쇄 거리", "폭탄 보상"], [-1, 1, 2], [2]) },
    { core: "넓은 밭 계약", sides: sides(["30m 진입", "경계 정리", "큰 장애물", "새 길목", "경고 표시"], [-3, -2, -1, 1, 2], [-2, 1]) },
    { core: "위험 지대", sides: sides(["단단한 돌", "오래된 나무", "폭탄 무리"], [-2, -1, 2], [-1]) },
    { core: "개척 장비", sides: sides(["돌 보상", "목재 보상", "폭발 수확", "길 열기"], [-2, -1, 1, 2], [2]) },
    { core: "먼 들판", sides: sides(["희귀 풀", "바위 군락", "숲 가장자리", "폭탄 연쇄", "두꺼운 풀"], [-3, -2, -1, 1, 2], [-2, 1]) },
    { core: "외계 흔적", sides: sides(["원형 문양", "하늘 낙인", "이상한 풀"], [-1, 1, 2], [1]) },
    { core: "거대 농지", sides: sides(["대형 맵", "끝없는 풀", "환경 보상", "완전 개척", "빛나는 돌"], [-3, -2, -1, 1, 2], [-1, 2]) },
  ],
};

function sides(titles: string[], lanes: number[], linkedLanes: number[] = []): BranchSide[] {
  return titles.map((title, index) => ({
    title,
    lane: lanes[index],
    prereq: linkedLanes.includes(lanes[index]) ? "previousLane" : "core",
  }));
}

function laneKey(lane: number): string {
  if (lane === 0) {
    return "core";
  }
  return lane < 0 ? `l${Math.abs(lane)}` : `r${lane}`;
}

function nodeId(branch: MainUpgradeBranch, tier: number, lane: number): string {
  return `${branch}_t${String(tier).padStart(2, "0")}_${laneKey(lane)}`;
}

function shortTitle(title: string): string {
  return title.replace(/\s+/g, "").slice(0, 4);
}

function branchDescription(branch: MainUpgradeBranch, title: string, tier: number, lane: number): string {
  const branchText: Record<MainUpgradeBranch, string> = {
    equipment: "장비 성능과 조작감을 확장하는 업그레이드입니다.",
    harvest: "골드, 점수, 시간, 이동 효율을 키우는 업그레이드입니다.",
    environment: "새 풀, 장애물, 폭탄, 맵 확장을 여는 업그레이드입니다.",
  };
  const role = lane === 0 ? "해당 티어의 중심 노드입니다." : "중심 노드에서 좌우로 파생되는 보조 노드입니다.";
  return `${title}: ${branchText[branch]} Tier ${tier}. ${role}`;
}

function costFor(branchIndex: number, tier: number, lane: number): number {
  if (tier === 0) {
    return 0;
  }
  const laneCost = lane === 0 ? 0 : 8 + Math.abs(lane) * 7;
  return 10 + tier * tier * 12 + branchIndex * 5 + laneCost;
}

function centerPrereq(branch: MainUpgradeBranch, tier: number): string[] {
  if (tier === 1) {
    return [UPGRADE_PROTOTYPE_ROOT_ID];
  }
  return [nodeId(branch, tier - 1, 0)];
}

function tierHasLane(branch: MainUpgradeBranch, tier: number, lane: number): boolean {
  return Boolean(BRANCH_TIERS[branch][tier - 1]?.sides.some((side) => side.lane === lane));
}

function sidePrereq(branch: MainUpgradeBranch, tier: number, side: BranchSide): string[] {
  const prereqKind = side.prereq ?? "core";
  if (prereqKind === "previousLane" && tier > 1 && tierHasLane(branch, tier - 1, side.lane)) {
    return [nodeId(branch, tier - 1, side.lane)];
  }
  if (prereqKind === "previousCore" && tier > 1) {
    return [nodeId(branch, tier - 1, 0)];
  }
  if (prereqKind === "previousCoreAndLane" && tier > 1) {
    const prereq = [nodeId(branch, tier - 1, 0)];
    if (tierHasLane(branch, tier - 1, side.lane)) {
      prereq.push(nodeId(branch, tier - 1, side.lane));
    }
    return prereq;
  }
  return [nodeId(branch, tier, 0)];
}

function createSeeds(): UpgradePrototypeSeed[] {
  const seeds: UpgradePrototypeSeed[] = [
    {
      id: UPGRADE_PROTOTYPE_ROOT_ID,
      branch: "root",
      tier: 0,
      lane: 0,
      title: "녹슨 낫 갈기",
      shortTitle: "낫",
      description: "오래 묵은 낫을 갈아 장비, 수확, 환경 업그레이드 가지를 엽니다.",
      cost: 0,
      prereq: [],
      major: true,
    },
  ];

  (Object.keys(BRANCH_TIERS) as MainUpgradeBranch[]).forEach((branch, branchIndex) => {
    BRANCH_TIERS[branch].forEach((tierData, tierIndex) => {
      const tier = tierIndex + 1;
      seeds.push({
        id: nodeId(branch, tier, 0),
        branch,
        tier,
        lane: 0,
        title: tierData.core,
        shortTitle: shortTitle(tierData.core),
        description: branchDescription(branch, tierData.core, tier, 0),
        cost: costFor(branchIndex, tier, 0),
        prereq: centerPrereq(branch, tier),
        major: true,
      });

      tierData.sides.forEach((side) => {
        seeds.push({
          id: nodeId(branch, tier, side.lane),
          branch,
          tier,
          lane: side.lane,
          title: side.title,
          shortTitle: shortTitle(side.title),
          description: branchDescription(branch, side.title, tier, side.lane),
          cost: costFor(branchIndex, tier, side.lane),
          prereq: sidePrereq(branch, tier, side),
          major: tier >= 8 && Math.abs(side.lane) >= 2,
        });
      });
    });
  });

  return seeds;
}

export function layoutPrototypeNode(node: Pick<UpgradePrototypeNode, "branch" | "tier" | "lane">): { x: number; y: number } {
  if (node.branch === "root") {
    return { x: 0, y: 0 };
  }
  const layout = BRANCH_LAYOUT[node.branch];
  const sideYOffset = node.lane === 0 ? 0 : Math.abs(node.lane) === 1 ? 46 : Math.abs(node.lane) === 2 ? -46 : 88;
  return {
    x: layout.x + node.lane * layout.laneGap,
    y: layout.yStart + (node.tier - 1) * layout.tierGap + sideYOffset,
  };
}

export const UPGRADE_PROTOTYPE_NODES: UpgradePrototypeNode[] = createSeeds().map((seed) => ({
  ...seed,
  ...layoutPrototypeNode(seed),
}));

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
