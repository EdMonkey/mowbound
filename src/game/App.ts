import * as THREE from "three";
import { BALANCE } from "./config/balance";
import { GameScene } from "./scenes/GameScene";
import { CardCatalogScene } from "./scenes/CardCatalogScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { SkillTreeScene } from "./scenes/SkillTreeScene";
import { UpgradePrototypeScene } from "./scenes/UpgradePrototypeScene";
import { loadLanguage, saveLanguage, type Language } from "./i18n";
import { loadSave } from "./systems/SaveSystem";
import { isMapUnlocked } from "./systems/CardProgressionSystem";
import { CheatPanel } from "./ui/CheatPanel";
import type { SceneName } from "./types";

export interface GameSceneController {
  readonly scene: THREE.Scene;
  update(deltaSeconds: number): void;
  dispose(): void;
}

export class App {
  readonly shell = document.createElement("div");
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  readonly camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  readonly uiRoot = document.createElement("div");
  /** Player-selected map size (meters/side); set on the menu, read by GameScene. */
  mapSizeMeters: number = BALANCE.mapSizeMeters;
  /** Set by CheatPanel to skip the map-unlock gate on the next show("game"). */
  bypassMapLock = false;
  language: Language = loadLanguage();
  private activeScene: GameSceneController;
  private readonly cheatPanel: CheatPanel;
  private previousTime = 0;
  private orthoSize = 8;

  constructor(private readonly root: HTMLElement) {
    this.shell.className = "app-shell";
    this.renderer.domElement.className = "game-canvas";
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.uiRoot.className = "ui-root";

    this.shell.append(this.renderer.domElement, this.uiRoot);
    this.root.appendChild(this.shell);

    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.onContextRestored);

    this.activeScene = new MainMenuScene(this);
    this.cheatPanel = new CheatPanel(this.uiRoot, this);
    this.onResize();
    this.renderer.setAnimationLoop(this.tick);
  }

  show(sceneName: SceneName): void {
    this.activeScene.dispose();

    if (sceneName === "game") {
      if (!this.bypassMapLock && !isMapUnlocked(loadSave(), this.mapSizeMeters)) {
        this.mapSizeMeters = BALANCE.mapSizeMeters;
      }
      this.bypassMapLock = false;
      this.activeScene = new GameScene(this);
    } else if (sceneName === "upgradePrototype") {
      this.activeScene = new UpgradePrototypeScene(this);
    } else if (sceneName === "cardCatalog") {
      this.activeScene = new CardCatalogScene(this);
    } else if (sceneName === "skills") {
      this.activeScene = new SkillTreeScene(this);
    } else {
      this.activeScene = new MainMenuScene(this);
    }

    this.previousTime = performance.now();
    this.onResize();
  }

  setLanguage(language: Language): void {
    this.language = language;
    saveLanguage(language);
    this.show("menu");
  }

  setOrthoSize(size: number): void {
    this.orthoSize = size;
    this.onResize();
  }

  captureSceneSnapshot(scene: THREE.Scene, camera: THREE.Camera, width = 1280, height = 720): string | undefined {
    const previousTarget = this.renderer.getRenderTarget();
    const previousSize = this.renderer.getSize(new THREE.Vector2());
    const previousPixelRatio = this.renderer.getPixelRatio();

    try {
      this.renderer.setRenderTarget(null);
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.renderer.render(scene, camera);
      return this.renderer.domElement.toDataURL("image/jpeg", 0.9);
    } catch {
      return undefined;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.setPixelRatio(previousPixelRatio);
      this.renderer.setSize(previousSize.x, previousSize.y, false);
    }
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.activeScene.dispose();
    this.cheatPanel.dispose();
    this.renderer.dispose();
    this.shell.remove();
  }

  private readonly tick = (time: number): void => {
    const deltaSeconds = Math.min(0.05, (time - this.previousTime) / 1000 || 0);
    this.previousTime = time;
    this.activeScene.update(deltaSeconds);
    this.renderer.render(this.activeScene.scene, this.camera);
  };

  private readonly onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / Math.max(1, height);
    const halfHeight = this.orthoSize / 2;
    const halfWidth = halfHeight * aspect;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onContextRestored = (): void => {
    this.onResize();
  };
}
