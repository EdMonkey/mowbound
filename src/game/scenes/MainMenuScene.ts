import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { cloneModel } from "../assets/models";
import { Player } from "../entities/Player";
import { resetSave } from "../systems/SaveSystem";
import { clearElement, createButton } from "../ui/Menu";

export class MainMenuScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private readonly previewGroup = new THREE.Group();

  constructor(private readonly app: App) {
    this.scene.background = new THREE.Color("#13261c");
    this.scene.fog = new THREE.Fog("#13261c", 9, 18);
    this.app.setOrthoSize(8);
    this.app.camera.position.set(5.5, 6, 5.5);
    this.app.camera.lookAt(0, 0, 0);

    this.addLights();
    this.addPreviewWorld();
    this.buildMenu();
  }

  update(deltaSeconds: number): void {
    this.previewGroup.rotation.y += deltaSeconds * 0.18;
  }

  dispose(): void {
    this.layer.remove();
    clearElement(this.layer);
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight("#ffffff", 1.1));
    const sun = new THREE.DirectionalLight("#fff6d5", 2.2);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    this.scene.add(sun);
  }

  private addPreviewWorld(): void {
    // Title diorama uses the real game models: GLB ground + farmer (with sickle).
    const ground = cloneModel("ground");
    ground.scale.setScalar(0.5);
    this.previewGroup.add(ground);

    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 1.4 + Math.random() * 0.9;
      const clump = cloneModel("grass");
      clump.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      clump.rotation.y = Math.random() * Math.PI * 2;
      clump.scale.setScalar(0.9 + Math.random() * 0.4);
      this.previewGroup.add(clump);
    }

    const character = new Player();
    character.group.scale.setScalar(1.8);
    this.previewGroup.add(character.group);

    this.scene.add(this.previewGroup);
  }

  private buildMenu(): void {
    this.layer.className = "menu-layer";

    const panel = document.createElement("div");
    panel.className = "menu-panel";

    const title = document.createElement("h1");
    title.className = "menu-title";
    title.textContent = "Mowbound";
    panel.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "menu-subtitle";
    subtitle.textContent = "Ten seconds. One scythe. Cut grass, bank gold, grow stronger.";
    panel.appendChild(subtitle);

    const stack = document.createElement("div");
    stack.className = "button-stack";
    stack.append(
      createButton("Start", () => this.app.show("game")),
      createButton("Skill Tree", () => this.app.show("skills"), "secondary-button"),
      createButton(
        "Reset Save",
        () => {
          if (window.confirm("Reset all Mowbound save data?")) {
            resetSave();
          }
        },
        "danger-button",
      ),
    );
    panel.appendChild(stack);
    this.layer.appendChild(panel);
    this.app.uiRoot.appendChild(this.layer);
  }
}
