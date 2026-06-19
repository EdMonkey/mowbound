import * as THREE from "three";
import { cloneModel, type ModelKey } from "../assets/models";
import type { ObstacleKind } from "../systems/ObstacleSystem";
import type { VectorXZ } from "../types";

const INTACT_MODEL: Record<ObstacleKind, ModelKey> = { rock: "rock", tree: "tree" };
// What stays after a break: a rock vanishes entirely (null), a tree leaves a stump.
const BROKEN_MODEL: Record<ObstacleKind, ModelKey | null> = { rock: null, tree: "tree_stump" };

/**
 * A rock or tree prop. Shows the intact Blender model and, on `break()`, either
 * vanishes (rock) or swaps in the stump (tree, which stays and keeps blocking).
 * Models are cloned from the shared cache, so dispose() only drops references.
 */
export class Obstacle {
  readonly group = new THREE.Group();
  private current: THREE.Object3D;
  private readonly brokenModel: ModelKey | null;

  constructor(kind: ObstacleKind, position: VectorXZ, scale: number) {
    this.brokenModel = BROKEN_MODEL[kind];
    this.current = cloneModel(INTACT_MODEL[kind]);
    this.group.add(this.current);
    this.group.position.set(position.x, 0, position.z);
    this.group.rotation.y = Math.random() * Math.PI * 2;
    // Caller picks the scale so the collision radius can track it (see GameScene).
    this.group.scale.setScalar(scale);
  }

  break(): void {
    this.group.remove(this.current);
    this.current = this.brokenModel ? cloneModel(this.brokenModel) : new THREE.Group();
    this.group.add(this.current);
  }

  dispose(): void {
    // Geometry/materials are shared with the cached model; only drop references.
    this.group.clear();
  }
}
