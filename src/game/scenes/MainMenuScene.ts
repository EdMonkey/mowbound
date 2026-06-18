import * as THREE from "three";
import type { App, GameSceneController } from "../App";
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
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.18, 5.5),
      new THREE.MeshStandardMaterial({ color: "#3f8f4e", roughness: 0.9 }),
    );
    ground.receiveShadow = true;
    this.previewGroup.add(ground);

    for (let index = 0; index < 60; index += 1) {
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.25 + Math.random() * 0.22, 4),
        new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? "#62b75c" : "#2e8d48", roughness: 0.9 }),
      );
      blade.position.set(Math.random() * 5 - 2.5, 0.18, Math.random() * 5 - 2.5);
      blade.castShadow = true;
      this.previewGroup.add(blade);
    }

    const mower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.6, 5, 12),
      new THREE.MeshStandardMaterial({ color: "#f0c85a", roughness: 0.65 }),
    );
    mower.position.set(0, 0.6, 0);
    mower.castShadow = true;
    this.previewGroup.add(mower);

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
