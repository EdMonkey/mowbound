export interface VectorXZ {
  x: number;
  z: number;
}

export type GrassKind = "normal" | "tall" | "blue" | "timer";

export interface GrassState {
  id: string;
  position: VectorXZ;
  hp: number;
  kind: GrassKind;
  growthRatio: number;
  regrowDelay: number;
  burningSeconds?: number;
}

export type CanonicalSceneName = "menu" | "game" | "upgrades" | "cardCatalog";
export type SceneName = CanonicalSceneName | "upgradePrototype" | "skills";
