import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { MAP_SIZE_OPTIONS } from "../config/balance";
import type { ToolId } from "../config/skillTree";
import { cloneModel } from "../assets/models";
import { Player } from "../entities/Player";
import { loadSave, resetSave, saveGame } from "../systems/SaveSystem";
import { canSelectTool, isMapUnlocked, selectTool } from "../systems/SkillSystem";
import { clearElement, createButton } from "../ui/Menu";

export class MainMenuScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private readonly previewGroup = new THREE.Group();
  private save = loadSave();

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
    this.layer.remove();
    clearElement(this.layer);
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

    panel.appendChild(this.buildMapSizeSelector());
    panel.appendChild(this.buildToolSelector());

    const stack = document.createElement("div");
    stack.className = "button-stack";
    stack.append(
      createButton("Start", () => this.app.show("game")),
      createButton("Skill Tree", () => this.app.show("skills"), "secondary-button"),
      createButton(
        "Reset Save",
        () => {
          if (window.confirm("Reset all Mowbound save data?")) {
            this.save = resetSave();
            this.app.mapSizeMeters = 10;
            this.buildMenu();
          }
        },
        "danger-button",
      ),
    );
    panel.appendChild(stack);
    this.layer.appendChild(panel);
    this.app.uiRoot.appendChild(this.layer);
  }

  private buildMapSizeSelector(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "menu-options";

    const label = document.createElement("span");
    label.className = "menu-options-label";
    label.textContent = "Map";
    wrap.appendChild(label);

    const choices = document.createElement("div");
    choices.className = "menu-options-choices";

    const buttons = MAP_SIZE_OPTIONS.map((size) => {
      const unlocked = isMapUnlocked(this.save, size);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.textContent = unlocked ? `${size}x${size}` : `${size}x${size} Locked`;
      button.disabled = !unlocked;
      button.title = unlocked ? `${size}x${size}` : "Need: Open Acre";
      button.setAttribute("aria-pressed", String(unlocked && size === this.app.mapSizeMeters));
      button.addEventListener("click", () => {
        if (!isMapUnlocked(this.save, size)) {
          return;
        }
        this.app.mapSizeMeters = size;
        for (const other of buttons) {
          other.setAttribute("aria-pressed", String(other === button));
        }
      });
      choices.appendChild(button);
      return button;
    });

    wrap.appendChild(choices);
    return wrap;
  }

  private buildToolSelector(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "menu-options tool-options";

    const label = document.createElement("span");
    label.className = "menu-options-label";
    label.textContent = "Tool";
    wrap.appendChild(label);

    const choices = document.createElement("div");
    choices.className = "menu-options-choices";

    const tools: Array<{ id: ToolId; label: string }> = [
      { id: "default", label: "Default" },
      { id: "wide_sickle", label: "Wide" },
      { id: "fast_sickle", label: "Fast" },
      { id: "bomb_sickle", label: "Bomb" },
      { id: "tractor", label: "Tractor" },
    ];

    const buttons = tools.map(({ id, label: text }) => {
      const unlocked = canSelectTool(this.save, id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.textContent = text;
      button.disabled = !unlocked;
      button.title = unlocked ? text : "Unlock this tool in the skill tree";
      button.setAttribute("aria-pressed", String(unlocked && this.save.selectedTool === id));
      button.addEventListener("click", () => {
        if (!canSelectTool(this.save, id)) {
          return;
        }
        this.save = selectTool(this.save, id);
        saveGame(this.save);
        for (const other of buttons) {
          other.setAttribute("aria-pressed", String(other === button));
        }
      });
      choices.appendChild(button);
      return button;
    });

    wrap.appendChild(choices);
    return wrap;
  }
}
