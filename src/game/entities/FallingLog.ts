import * as THREE from "three";
import { cloneModel } from "../assets/models";
import type { VectorXZ } from "../types";

const CUT_HEIGHT = 0.28; // pivots from the stump top where the trunk is cut
const LIFETIME = 1.7;
const TARGET_TILT = (Math.PI / 2) * 0.96; // topple to almost flat
const FADE_START = 0.55; // fraction of life before it starts dissolving

/**
 * The cut-off upper tree (`tree_top`) after a tree is felled: it pivots from the
 * cut, topples sideways in a random direction, then fades out and is removed.
 * Materials are cloned per instance (and made transparent) so the fade never
 * touches the shared model cache.
 */
export class FallingLog {
  readonly group = new THREE.Group(); // pivot, sits at the cut height
  private readonly tilt = new THREE.Group();
  private readonly materials: THREE.Material[] = [];
  private readonly toppleSign: number;
  private age = 0;

  constructor(position: VectorXZ, scale: number) {
    this.group.position.set(position.x, CUT_HEIGHT, position.z);
    this.group.rotation.y = Math.random() * Math.PI * 2; // random fall heading
    this.group.scale.setScalar(scale);
    this.toppleSign = Math.random() < 0.5 ? 1 : -1;

    const model = cloneModel("tree_top");
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = source.map((material) => {
        const copy = material.clone();
        copy.transparent = true;
        return copy;
      });
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      this.materials.push(...cloned);
    });

    this.tilt.add(model);
    this.group.add(this.tilt);
  }

  update(deltaSeconds: number): boolean {
    this.age += deltaSeconds;
    const t = Math.min(1, this.age / LIFETIME);

    // Ease-out topple, mostly finished by the time the fade begins.
    const tipT = Math.min(1, t / FADE_START);
    this.tilt.rotation.x = this.toppleSign * TARGET_TILT * (1 - (1 - tipT) * (1 - tipT));

    const opacity = t < FADE_START ? 1 : Math.max(0, 1 - (t - FADE_START) / (1 - FADE_START));
    for (const material of this.materials) {
      material.opacity = opacity;
    }

    return t >= 1;
  }

  dispose(): void {
    for (const material of this.materials) {
      material.dispose(); // cloned per instance
    }
    this.group.clear();
  }
}
