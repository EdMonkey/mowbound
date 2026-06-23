import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { cloneModel } from "../assets/models";
import { MAP_SIZE_OPTIONS } from "../config/balance";
import type { ToolId } from "../config/tools";
import { toolLabel, type Language } from "../i18n";
import { Player } from "../entities/Player";
import { loadSave, resetSave, saveGame, unlockAllSkillsForTest } from "../systems/SaveSystem";
import { canSelectTool, isMapUnlocked, selectTool } from "../systems/CardProgressionSystem";
import { SoundSystem } from "../systems/SoundSystem";
import { clearElement, createButton } from "../ui/Menu";

export class MainMenuScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private readonly previewGroup = new THREE.Group();
  private readonly sound = new SoundSystem();
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
    this.sound.dispose();
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
    subtitle.textContent = this.app.language === "ko"
      ? "짧은 라운드 안에 풀을 베고, 골드를 모아, 더 강해지세요."
      : "Ten seconds. One scythe. Cut grass, bank gold, grow stronger.";
    panel.appendChild(subtitle);

    panel.appendChild(this.buildLanguageSelector());
    panel.appendChild(this.buildMapSizeSelector());
    panel.appendChild(this.buildToolSelector());

    const stack = document.createElement("div");
    stack.className = "button-stack";
    stack.append(
      createButton(this.app.language === "ko" ? "시작" : "Start", () => this.app.show("game")),
      createButton(this.app.language === "ko" ? "업그레이드" : "Upgrades", () => this.app.show("upgradePrototype"), "secondary-button"),
      createButton(this.app.language === "ko" ? "스킬 트리" : "Skill Tree", () => this.app.show("skills"), "secondary-button"),
      ...(this.isTestMode()
        ? [
            createButton(
              this.app.language === "ko" ? "테스트: 모든 스킬 해금" : "Test: Unlock All Skills",
              () => {
                this.save = unlockAllSkillsForTest(this.save);
                saveGame(this.save);
                this.sound.play("purchase");
                this.buildMenu();
              },
              "secondary-button",
            ),
          ]
        : []),
      createButton(
        this.app.language === "ko" ? "저장 초기화" : "Reset Save",
        () => {
          const message = this.app.language === "ko" ? "모든 Mowbound 저장 데이터를 초기화할까요?" : "Reset all Mowbound save data?";
          if (window.confirm(message)) {
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

  private isTestMode(): boolean {
    return new URLSearchParams(window.location.search).get("test") === "1";
  }

  private buildLanguageSelector(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "menu-options";

    const label = document.createElement("span");
    label.className = "menu-options-label";
    label.textContent = this.app.language === "ko" ? "언어" : "Language";
    wrap.appendChild(label);

    const choices = document.createElement("div");
    choices.className = "menu-options-choices";
    const languages: Array<{ id: Language; label: string }> = [
      { id: "ko", label: "한국어" },
      { id: "en", label: "English" },
    ];

    for (const language of languages) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.textContent = language.label;
      button.setAttribute("aria-pressed", String(this.app.language === language.id));
      button.addEventListener("click", () => {
        if (this.app.language !== language.id) {
          this.app.setLanguage(language.id);
        }
      });
      choices.appendChild(button);
    }

    wrap.appendChild(choices);
    return wrap;
  }

  private buildMapSizeSelector(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "menu-options";

    const label = document.createElement("span");
    label.className = "menu-options-label";
    label.textContent = this.app.language === "ko" ? "맵" : "Map";
    wrap.appendChild(label);

    const choices = document.createElement("div");
    choices.className = "menu-options-choices";

    const buttons = MAP_SIZE_OPTIONS.map((size) => {
      const unlocked = isMapUnlocked(this.save, size);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.textContent = unlocked
        ? `${size}x${size}`
        : this.app.language === "ko"
          ? `${size}x${size} 잠김`
          : `${size}x${size} Locked`;
      button.disabled = !unlocked;
      button.title = unlocked
        ? `${size}x${size}`
        : this.app.language === "ko"
          ? "필요: 넓은 밭 계약"
          : "Need: Open Acre";
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
    label.textContent = this.app.language === "ko" ? "도구" : "Tool";
    wrap.appendChild(label);

    const choices = document.createElement("div");
    choices.className = "menu-options-choices";

    const tools: ToolId[] = ["default", "wide_sickle", "fast_sickle", "bomb_sickle", "tractor"];

    const buttons = tools.map((id) => {
      const text = toolLabel(id, this.app.language);
      const unlocked = canSelectTool(this.save, id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.textContent = text;
      button.disabled = !unlocked;
      button.title = unlocked
        ? text
        : this.app.language === "ko"
          ? "스킬 트리에서 이 도구를 해금하세요"
          : "Unlock this tool in the skill tree";
      button.setAttribute("aria-pressed", String(unlocked && this.save.selectedTool === id));
      button.addEventListener("click", () => {
        if (!canSelectTool(this.save, id)) {
          return;
        }
        this.save = selectTool(this.save, id);
        this.sound.play("tool");
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
