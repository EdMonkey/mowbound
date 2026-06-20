import * as THREE from "three";

const DESIRED_SHADOW_MAP_SIZE = 4096;
const LIGHT_DIRECTION = new THREE.Vector3(4, 8, 5).normalize();
const SCENE_SAMPLE_HEIGHTS = [0, 4];
const CAMERA_PADDING = 1.2;

interface SnapshotShadowOptions {
  maxTextureSize?: number;
}

interface ShadowCameraState {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
}

function mapSamplePoints(mapSize: number): THREE.Vector3[] {
  const half = mapSize / 2;
  return SCENE_SAMPLE_HEIGHTS.flatMap((y) => [
    new THREE.Vector3(-half, y, -half),
    new THREE.Vector3(half, y, -half),
    new THREE.Vector3(half, y, half),
    new THREE.Vector3(-half, y, half),
  ]);
}

function snapshotShadowMapSize(maxTextureSize?: number): number {
  const limit = Math.max(512, maxTextureSize ?? DESIRED_SHADOW_MAP_SIZE);
  return Math.min(DESIRED_SHADOW_MAP_SIZE, limit);
}

function disposeShadowMapIfStale(shadow: THREE.DirectionalLightShadow): void {
  if (!shadow.map) {
    return;
  }

  if (shadow.map.width !== shadow.mapSize.x || shadow.map.height !== shadow.mapSize.y) {
    shadow.map.dispose();
    shadow.map = null;
  }
}

function updateShadowMatrices(sun: THREE.DirectionalLight): void {
  sun.target.updateMatrixWorld(true);
  sun.updateMatrixWorld(true);
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.updateMatrices(sun);
  sun.shadow.needsUpdate = true;
}

function fitShadowCameraToMap(sun: THREE.DirectionalLight, mapSize: number): void {
  updateShadowMatrices(sun);

  const camera = sun.shadow.camera;
  const viewPoints = mapSamplePoints(mapSize).map((point) => point.applyMatrix4(camera.matrixWorldInverse));
  const minX = Math.min(...viewPoints.map((point) => point.x));
  const maxX = Math.max(...viewPoints.map((point) => point.x));
  const minY = Math.min(...viewPoints.map((point) => point.y));
  const maxY = Math.max(...viewPoints.map((point) => point.y));
  const distances = viewPoints.map((point) => -point.z);
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  camera.left = minX - CAMERA_PADDING;
  camera.right = maxX + CAMERA_PADDING;
  camera.bottom = minY - CAMERA_PADDING;
  camera.top = maxY + CAMERA_PADDING;
  camera.near = Math.max(0.1, minDistance - CAMERA_PADDING);
  camera.far = Math.max(camera.near + 1, maxDistance + CAMERA_PADDING);
  updateShadowMatrices(sun);
}

export function prepareResultSnapshotShadows(
  sun: THREE.DirectionalLight,
  mapSize: number,
  options: SnapshotShadowOptions = {},
): () => void {
  const camera = sun.shadow.camera;
  const previousPosition = sun.position.clone();
  const previousTarget = sun.target.position.clone();
  const previousMapSize = sun.shadow.mapSize.clone();
  const previousCamera: ShadowCameraState = {
    left: camera.left,
    right: camera.right,
    top: camera.top,
    bottom: camera.bottom,
    near: camera.near,
    far: camera.far,
  };

  sun.position.copy(LIGHT_DIRECTION).multiplyScalar(Math.max(24, mapSize * 1.2));
  sun.target.position.set(0, 0, 0);
  sun.shadow.mapSize.setScalar(snapshotShadowMapSize(options.maxTextureSize));
  disposeShadowMapIfStale(sun.shadow);
  fitShadowCameraToMap(sun, mapSize);

  return () => {
    sun.position.copy(previousPosition);
    sun.target.position.copy(previousTarget);
    sun.shadow.mapSize.copy(previousMapSize);
    camera.left = previousCamera.left;
    camera.right = previousCamera.right;
    camera.top = previousCamera.top;
    camera.bottom = previousCamera.bottom;
    camera.near = previousCamera.near;
    camera.far = previousCamera.far;
    disposeShadowMapIfStale(sun.shadow);
    updateShadowMatrices(sun);
  };
}
