import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { prepareResultSnapshotShadows } from "../src/game/render/ResultSnapshotShadows";

function mapSamplePoints(mapSize: number): THREE.Vector3[] {
  const half = mapSize / 2;
  return [0, 4].flatMap((y) => [
    new THREE.Vector3(-half, y, -half),
    new THREE.Vector3(half, y, -half),
    new THREE.Vector3(half, y, half),
    new THREE.Vector3(-half, y, half),
  ]);
}

function pointInShadowCamera(camera: THREE.OrthographicCamera, point: THREE.Vector3): boolean {
  const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
  const distance = -view.z;

  return (
    view.x >= camera.left &&
    view.x <= camera.right &&
    view.y >= camera.bottom &&
    view.y <= camera.top &&
    distance >= camera.near &&
    distance <= camera.far
  );
}

describe("result snapshot shadows", () => {
  it("fits the whole 30m map in a high-resolution shadow camera and restores gameplay settings", () => {
    const sun = new THREE.DirectionalLight("#ffe7b0", 2.15);
    sun.position.set(12, 8, 13);
    sun.target.position.set(8, 0, 8);
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.updateProjectionMatrix();

    const previousPosition = sun.position.clone();
    const previousTarget = sun.target.position.clone();
    const previousMapSize = sun.shadow.mapSize.clone();
    const previousCamera = {
      left: sun.shadow.camera.left,
      right: sun.shadow.camera.right,
      top: sun.shadow.camera.top,
      bottom: sun.shadow.camera.bottom,
      near: sun.shadow.camera.near,
      far: sun.shadow.camera.far,
    };

    const restore = prepareResultSnapshotShadows(sun, 30, { maxTextureSize: 4096 });

    expect(sun.shadow.mapSize.x).toBe(4096);
    expect(sun.shadow.mapSize.y).toBe(4096);
    for (const point of mapSamplePoints(30)) {
      expect(pointInShadowCamera(sun.shadow.camera, point)).toBe(true);
    }

    restore();

    expect(sun.position.toArray()).toEqual(previousPosition.toArray());
    expect(sun.target.position.toArray()).toEqual(previousTarget.toArray());
    expect(sun.shadow.mapSize.toArray()).toEqual(previousMapSize.toArray());
    expect(sun.shadow.camera.left).toBe(previousCamera.left);
    expect(sun.shadow.camera.right).toBe(previousCamera.right);
    expect(sun.shadow.camera.top).toBe(previousCamera.top);
    expect(sun.shadow.camera.bottom).toBe(previousCamera.bottom);
    expect(sun.shadow.camera.near).toBe(previousCamera.near);
    expect(sun.shadow.camera.far).toBe(previousCamera.far);
  });
});
