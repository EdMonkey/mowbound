import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { SKILL_DEFS, type SkillId } from "../config/balance";
import { canPurchaseSkill, getRuntimeStats, getSkillCost, loadSave, purchaseSkill, saveGame } from "../systems/SaveSystem";
import { createButton } from "../ui/Menu";

export class SkillTreeScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private save = loadSave();

  constructor(private readonly app: App) {
    this.scene.background = new THREE.Color("#12241b");
    this.app.setOrthoSize(8);
    this.app.camera.position.set(4.5, 6, 4.5);
    this.app.camera.lookAt(0, 0, 0);
    this.addWorld();
    this.render();
  }

  update(): void {
    return;
  }

  dispose(): void {
    this.layer.remove();
  }

  private addWorld(): void {
    this.scene.add(new THREE.AmbientLight("#ffffff", 0.9));
    const sun = new THREE.DirectionalLight("#fff1c5", 1.8);
    sun.position.set(4, 7, 2);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshStandardMaterial({ color: "#244d35", roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
  }

  private render(): void {
    this.layer.remove();
    this.layer.replaceChildren();
    this.layer.className = "skill-layer";

    const panel = document.createElement("div");
    panel.className = "skill-panel";

    const header = document.createElement("div");
    header.className = "skill-header";
    const stats = getRuntimeStats(this.save);
    header.innerHTML = `
      <div>
        <h2 class="panel-title">Skill Tree</h2>
        <p class="panel-copy">Total gold: <strong>${this.save.totalGold}</strong></p>
      </div>
      <p class="skill-meta">Damage ${stats.attackDamage} · Ellipse ${stats.attackRangeMeters.toFixed(2)}m · Charge ${(stats.attackChargeDurationMs / 1000).toFixed(2)}s</p>
    `;
    panel.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "skill-grid";

    for (const skillId of Object.keys(SKILL_DEFS) as SkillId[]) {
      const definition = SKILL_DEFS[skillId];
      const level = this.save.skills[skillId];
      const cost = getSkillCost(this.save, skillId);
      const item = document.createElement("div");
      item.className = "skill-item";

      const copy = document.createElement("div");
      copy.innerHTML = `
        <h3 class="skill-name">${definition.name}</h3>
        <p class="skill-desc">${definition.description}</p>
        <p class="skill-meta">Level ${level}/${definition.maxLevel} · Cost ${Number.isFinite(cost) ? cost : "MAX"}</p>
      `;
      item.appendChild(copy);

      const buy = document.createElement("button");
      buy.type = "button";
      buy.textContent = level >= definition.maxLevel ? "Max" : "Buy";
      buy.disabled = !canPurchaseSkill(this.save, skillId);
      buy.addEventListener("click", () => {
        this.save = purchaseSkill(this.save, skillId);
        saveGame(this.save);
        this.render();
      });
      item.appendChild(buy);
      grid.appendChild(item);
    }

    panel.appendChild(grid);

    const actions = document.createElement("div");
    actions.className = "skill-actions";
    actions.append(
      createButton("Start Run", () => this.app.show("game")),
      createButton("Main Menu", () => this.app.show("menu"), "secondary-button"),
    );
    panel.appendChild(actions);
    this.layer.appendChild(panel);
    this.app.uiRoot.appendChild(this.layer);
  }
}
