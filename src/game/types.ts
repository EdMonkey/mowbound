export interface VectorXZ {
  x: number;
  z: number;
}

export interface GrassState {
  id: string;
  position: VectorXZ;
  hp: number;
}

export type SceneName = "menu" | "game" | "skills";
