import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { SKILL_DEFS, SKILL_PREREQ, type SkillId } from "../config/balance";
import {
  canPurchaseSkill,
  getRuntimeStats,
  getSkillCost,
  isSkillOwned,
  isSkillRevealed,
  loadSave,
  purchaseSkill,
  saveGame,
} from "../systems/SaveSystem";
import { createButton } from "../ui/Menu";

const SVG_NS = "http://www.w3.org/2000/svg";
const CANVAS_W = 680;
const CANVAS_H = 540;

interface NodeLayout {
  x: number;
  y: number;
  icon: string;
}

// Radial layout: damage is the trunk at the center, branches fan outward.
const NODE_LAYOUT: Record<SkillId, NodeLayout> = {
  damage: { x: 340, y: 270, icon: "🗡️" },
  attackSpeed: { x: 340, y: 146, icon: "⚡" },
  moveSpeed: { x: 340, y: 44, icon: "👟" },
  range: { x: 540, y: 356, icon: "🎯" },
  goldValue: { x: 140, y: 356, icon: "💰" },
  grassDensity: { x: 84, y: 470, icon: "🌱" },
};

const SKILL_IDS = Object.keys(SKILL_DEFS) as SkillId[];

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
    panel.className = "skill-panel skilltree-panel";

    const header = document.createElement("div");
    header.className = "skill-header";
    const stats = getRuntimeStats(this.save);
    header.innerHTML = `
      <div>
        <h2 class="panel-title">Skill Tree</h2>
        <p class="panel-copy">Unlock <strong>Damage</strong> first, then grow new branches. Total gold: <strong>${this.save.totalGold}</strong></p>
      </div>
      <p class="skill-meta">Damage ${stats.attackDamage} · Fan ${stats.attackRangeMeters.toFixed(2)}m / ${stats.attackArcDegrees}deg · Charge ${(stats.attackChargeDurationMs / 1000).toFixed(2)}s</p>
    `;
    panel.appendChild(header);

    const viewport = document.createElement("div");
    viewport.className = "tree-viewport";

    const canvas = document.createElement("div");
    canvas.className = "tree-canvas";
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    canvas.appendChild(this.buildBranches());
    for (const skillId of SKILL_IDS) {
      if (isSkillRevealed(this.save, skillId)) {
        canvas.appendChild(this.buildNode(skillId));
      }
    }
    viewport.appendChild(canvas);
    panel.appendChild(viewport);

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

  private buildBranches(): SVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "tree-branches");
    svg.setAttribute("viewBox", `0 0 ${CANVAS_W} ${CANVAS_H}`);
    svg.setAttribute("preserveAspectRatio", "none");

    for (const skillId of SKILL_IDS) {
      const prerequisite = SKILL_PREREQ[skillId];
      // A branch only exists once its child node is revealed (its parent owned).
      if (!prerequisite || !isSkillRevealed(this.save, skillId)) {
        continue;
      }

      const from = NODE_LAYOUT[prerequisite];
      const to = NODE_LAYOUT[skillId];
      const grown = isSkillOwned(this.save, skillId);

      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute(
        "d",
        `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2} ${to.x} ${to.y}`,
      );
      path.setAttribute("class", `tree-branch ${grown ? "is-grown" : "is-growing"}`);
      svg.appendChild(path);
    }

    return svg;
  }

  private buildNode(skillId: SkillId): HTMLButtonElement {
    const definition = SKILL_DEFS[skillId];
    const layout = NODE_LAYOUT[skillId];
    const level = this.save.skills[skillId];
    const owned = isSkillOwned(this.save, skillId);
    const maxed = level >= definition.maxLevel;
    const cost = getSkillCost(this.save, skillId);
    const affordable = canPurchaseSkill(this.save, skillId);

    const node = document.createElement("button");
    node.type = "button";
    const state = maxed ? "is-max" : owned ? "is-owned" : "is-available";
    node.className = `tree-node ${state}${affordable ? " can-buy" : ""}`;
    node.style.left = `${(layout.x / CANVAS_W) * 100}%`;
    node.style.top = `${(layout.y / CANVAS_H) * 100}%`;
    node.disabled = !affordable;
    node.title = definition.description;

    node.innerHTML = `
      <span class="tree-node-icon">${layout.icon}</span>
      <span class="tree-node-name">${definition.name}</span>
      <span class="tree-node-meta">${owned ? `Lv ${level}/${definition.maxLevel}` : "Unlock"}</span>
      <span class="tree-node-cost">${maxed ? "MAX" : `${cost}g`}</span>
    `;

    node.addEventListener("click", () => {
      this.save = purchaseSkill(this.save, skillId);
      saveGame(this.save);
      this.render();
    });

    return node;
  }
}
