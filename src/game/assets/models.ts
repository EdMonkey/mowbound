import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type ModelKey =
  | "farmer"
  | "sickle"
  | "grass"
  | "ground"
  | "coin"
  | "rock"
  | "rock_broken"
  | "tree"
  | "tree_stump"
  | "tree_top";

const MODEL_FILES: Record<ModelKey, string> = {
  farmer: "farmer.glb",
  sickle: "sickle.glb",
  grass: "grass.glb",
  ground: "ground.glb",
  coin: "coin.glb",
  rock: "rock.glb",
  rock_broken: "rock_broken.glb",
  tree: "tree.glb",
  tree_stump: "tree_stump.glb",
  tree_top: "tree_top.glb",
};

export type ModelLibrary = Record<ModelKey, THREE.Object3D>;

let library: ModelLibrary | null = null;

function markShadows(object: THREE.Object3D, cast: boolean, receive: boolean): void {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
    }
  });
}

/**
 * Loads every Blender-authored GLB once and caches the source scenes. Entities
 * clone from the cache, so geometry and materials stay shared (and must never be
 * disposed per-instance). Call once during startup before any scene is built.
 */
export async function loadModels(): Promise<ModelLibrary> {
  if (library) {
    return library;
  }

  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL;
  const keys = Object.keys(MODEL_FILES) as ModelKey[];
  const loaded = await Promise.all(
    keys.map((key) => loader.loadAsync(`${base}models/${MODEL_FILES[key]}`)),
  );

  const next = {} as ModelLibrary;
  keys.forEach((key, index) => {
    const root = loaded[index].scene;
    // The ground only catches shadows; props cast and receive.
    markShadows(root, key !== "ground", true);
    next[key] = root;
  });

  library = next;
  return library;
}

export function getModels(): ModelLibrary {
  if (!library) {
    throw new Error("Models are not loaded yet. Call loadModels() during startup.");
  }
  return library;
}

/**
 * Deep clone of a cached model. Geometry and materials are shared, not copied.
 * Returns an empty group if models are not loaded (the production flow always
 * preloads before building scenes; this keeps entity logic unit-testable).
 */
export function cloneModel(key: ModelKey): THREE.Object3D {
  const source = library?.[key];
  return source ? source.clone(true) : new THREE.Group();
}
