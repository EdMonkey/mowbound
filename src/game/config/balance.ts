export const BALANCE = {
  roundDurationMs: 10000,
  mapSizeMeters: 10,
  playerMoveSpeed: 0.7,
  baseAttackDamage: 3,
  baseGrassHp: 5,
  baseAttackIntervalMs: 1000,
  baseAttackRangeMeters: 0.5,
  baseAttackArcDegrees: 360,
  attackChargeDurationMs: 1000,
  baseGoldPerGrass: 1,
  initialGrassCount: 900,
  grassSpawnIntervalMs: 320,
  grassSpawnPerTick: 0,
  virtualJoystickRadiusPx: 64,
  virtualJoystickDeadZone: 0.12,
  minAttackIntervalMs: 150,
} as const;

export interface SaveData {
  totalGold: number;
  unlocked: string[];
}

export interface RuntimeStats {
  attackDamage: number;
  attackRangeMeters: number;
  attackArcDegrees: number;
  attackChargeDurationMs: number;
  attackIntervalMs: number;
  moveSpeed: number;
  goldPerGrass: number;
  initialGrassCount: number;
  grassSpawnIntervalMs: number;
  grassSpawnPerTick: number;
  roundDurationMs: number;
}

export type EffectKind =
  | "damage"
  | "range"
  | "arc"
  | "attackInterval"
  | "moveSpeed"
  | "gold"
  | "grassCount"
  | "roundDuration";

export interface SkillEffect {
  kind: EffectKind;
  amount: number;
}

/**
 * One node = one permanent unlock (no per-node leveling). "Leveling" happens by
 * unlocking the next-tier node, which becomes visible once its `prereq` is owned.
 * Some nodes are branch connectors (`effect: null`) that open a cluster of
 * skills, and a skill inside a branch can link to the next branch.
 */
export interface SkillNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  prereq: string | null;
  effect: SkillEffect | null;
}

export const SKILL_ROOT = "dmg1";

export const SKILL_NODES: SkillNode[] = [
  // --- damage trunk (tier chain) ---
  { id: "dmg1", name: "Damage Up", icon: "🗡️", cost: 6, prereq: null, effect: { kind: "damage", amount: 1 }, description: "Scythe damage +1." },
  { id: "dmg2", name: "Damage Up Lv2", icon: "🗡️", cost: 14, prereq: "dmg1", effect: { kind: "damage", amount: 1 }, description: "Scythe damage +1." },
  { id: "dmg3", name: "Damage Up Lv3", icon: "🗡️", cost: 30, prereq: "dmg2", effect: { kind: "damage", amount: 2 }, description: "Scythe damage +2." },

  // --- combat branch (connector + cluster) ---
  { id: "combat", name: "Combat Branch", icon: "🌳", cost: 18, prereq: "dmg1", effect: null, description: "Opens the combat skills." },
  { id: "keen", name: "Keen Edge", icon: "⚔️", cost: 22, prereq: "combat", effect: { kind: "damage", amount: 2 }, description: "Scythe damage +2." },
  { id: "arc1", name: "Wide Swing", icon: "🌀", cost: 20, prereq: "combat", effect: { kind: "arc", amount: 15 }, description: "Attack fan +15°." },
  { id: "arc2", name: "Wide Swing Lv2", icon: "🌀", cost: 34, prereq: "arc1", effect: { kind: "arc", amount: 15 }, description: "Attack fan +15°." },
  { id: "reach", name: "Long Reach", icon: "📏", cost: 24, prereq: "combat", effect: { kind: "range", amount: 0.15 }, description: "Attack range +0.15m." },
  { id: "swift", name: "Swift Cuts", icon: "⚡", cost: 26, prereq: "combat", effect: { kind: "attackInterval", amount: -100 }, description: "Attack 0.1s faster." },
  { id: "swift2", name: "Swift Cuts Lv2", icon: "⚡", cost: 44, prereq: "swift", effect: { kind: "attackInterval", amount: -100 }, description: "Attack 0.1s faster." },

  // --- field branch (linked from combat via swift2) ---
  { id: "field", name: "Field Branch", icon: "🌳", cost: 30, prereq: "swift2", effect: null, description: "Opens the fieldcraft skills." },
  { id: "gold1", name: "Golden Touch", icon: "💰", cost: 28, prereq: "field", effect: { kind: "gold", amount: 1 }, description: "+1 gold per grass." },
  { id: "gold2", name: "Golden Touch Lv2", icon: "💰", cost: 48, prereq: "gold1", effect: { kind: "gold", amount: 2 }, description: "+2 gold per grass." },
  { id: "foot", name: "Fleet Foot", icon: "👟", cost: 24, prereq: "field", effect: { kind: "moveSpeed", amount: 0.22 }, description: "Move speed +0.22." },
  { id: "foot2", name: "Fleet Foot Lv2", icon: "👟", cost: 40, prereq: "foot", effect: { kind: "moveSpeed", amount: 0.22 }, description: "Move speed +0.22." },
  { id: "time1", name: "Overtime", icon: "⏱️", cost: 34, prereq: "field", effect: { kind: "roundDuration", amount: 2000 }, description: "Round time +2s." },
  { id: "time2", name: "Overtime Lv2", icon: "⏱️", cost: 60, prereq: "time1", effect: { kind: "roundDuration", amount: 3000 }, description: "Round time +3s." },
  { id: "dense", name: "Overgrowth", icon: "🌱", cost: 32, prereq: "field", effect: { kind: "grassCount", amount: 60 }, description: "+60 grass at run start." },
];

export const SKILL_NODE_BY_ID: Record<string, SkillNode> = Object.fromEntries(
  SKILL_NODES.map((node) => [node.id, node]),
);

export function defaultSave(): SaveData {
  return {
    totalGold: 0,
    unlocked: [],
  };
}
