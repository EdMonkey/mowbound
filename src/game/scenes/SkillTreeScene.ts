import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { SKILL_DEFS, SKILL_PREREQ, type SkillId } from "../config/balance";
import {
  addGold,
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
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const TAP_MOVE = 8;
const LONG_PRESS_MS = 450;

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

interface PressState {
  id: number;
  skill: SkillId | null;
  x: number;
  y: number;
  type: string;
  button: number;
  moved: boolean;
  longFired: boolean;
  timer: number;
}

export class SkillTreeScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private save = loadSave();

  // pan/zoom camera state (persists across re-renders)
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private viewReady = false;

  private viewport!: HTMLDivElement;
  private world!: HTMLDivElement;
  private detailEl!: HTMLDivElement;

  // gesture state (reset each render)
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private panning = false;
  private lastPan = { x: 0, y: 0 };
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };
  private press: PressState | null = null;

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
    this.resetGestures();
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
        <p class="panel-copy">Unlock <strong>Damage</strong>, then grow new branches. Total gold: <strong>${this.save.totalGold}</strong></p>
      </div>
      <p class="skill-meta">Drag to pan · scroll / pinch to zoom · hover or long-press for details</p>
    `;
    panel.appendChild(header);

    const viewport = document.createElement("div");
    viewport.className = "tree-viewport";
    this.viewport = viewport;

    const world = document.createElement("div");
    world.className = "tree-world";
    world.style.width = `${CANVAS_W}px`;
    world.style.height = `${CANVAS_H}px`;
    world.appendChild(this.buildBranches());
    for (const skillId of SKILL_IDS) {
      if (isSkillRevealed(this.save, skillId)) {
        world.appendChild(this.buildNode(skillId));
      }
    }
    this.world = world;
    viewport.appendChild(world);
    viewport.appendChild(this.buildZoomControls());
    this.attachInteractions(viewport);
    panel.appendChild(viewport);

    const actions = document.createElement("div");
    actions.className = "skill-actions";
    actions.append(
      createButton("Start Run", () => this.app.show("game")),
      createButton("Main Menu", () => this.app.show("menu"), "secondary-button"),
    );
    panel.appendChild(actions);

    this.detailEl = document.createElement("div");
    this.detailEl.className = "tree-detail";

    this.layer.appendChild(panel);
    this.layer.appendChild(this.detailEl);
    this.app.uiRoot.appendChild(this.layer);

    if (!this.viewReady) {
      this.fitView();
      this.viewReady = true;
    } else {
      this.applyTransform();
    }
  }

  private buildBranches(): SVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "tree-branches");
    svg.setAttribute("viewBox", `0 0 ${CANVAS_W} ${CANVAS_H}`);
    svg.setAttribute("preserveAspectRatio", "none");

    for (const skillId of SKILL_IDS) {
      const prerequisite = SKILL_PREREQ[skillId];
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
    node.dataset.skill = skillId;
    const state = maxed ? "is-max" : owned ? "is-owned" : "is-available";
    node.className = `tree-node ${state}${affordable ? " can-buy" : ""}`;
    node.style.left = `${(layout.x / CANVAS_W) * 100}%`;
    node.style.top = `${(layout.y / CANVAS_H) * 100}%`;
    node.innerHTML = `
      <span class="tree-node-icon">${layout.icon}</span>
      <span class="tree-node-name">${definition.name}</span>
      <span class="tree-node-meta">${owned ? `Lv ${level}/${definition.maxLevel}` : "Unlock"}</span>
      <span class="tree-node-cost">${maxed ? "MAX" : `${cost}g`}</span>
    `;

    // Desktop: hover shows the detail panel.
    node.addEventListener("mouseenter", () => {
      if (!this.panning && this.pointers.size === 0) {
        this.showDetail(skillId, node);
      }
    });
    node.addEventListener("mouseleave", () => this.hideDetail());
    return node;
  }

  private buildZoomControls(): HTMLDivElement {
    const box = document.createElement("div");
    box.className = "tree-zoom";
    // Keep the controls out of the pan/zoom gesture so their clicks fire.
    box.addEventListener("pointerdown", (e) => e.stopPropagation());

    const make = (label: string, className: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = className;
      b.textContent = label;
      b.addEventListener("click", onClick);
      return b;
    };
    const center = () => {
      const r = this.viewport.getBoundingClientRect();
      return { x: r.width / 2, y: r.height / 2 };
    };

    box.append(
      // TODO(test): temporary debug grant for skill-tree testing; remove before prod.
      make("+100 Gold", "tree-test-gold", () => {
        this.save = addGold(this.save, 100);
        saveGame(this.save);
        this.render();
      }),
      make("+", "", () => {
        const c = center();
        this.zoomAtPoint(c.x, c.y, 1.2);
      }),
      make("⟲", "", () => this.fitView()),
      make("−", "", () => {
        const c = center();
        this.zoomAtPoint(c.x, c.y, 1 / 1.2);
      }),
    );
    return box;
  }

  // ----- camera -----

  private applyTransform(): void {
    if (this.world) {
      this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    }
  }

  private zoomAtPoint(px: number, py: number, factor: number): void {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
    const real = next / this.zoom;
    this.panX = px - (px - this.panX) * real;
    this.panY = py - (py - this.panY) * real;
    this.zoom = next;
    this.applyTransform();
  }

  private fitView(): void {
    const r = this.viewport.getBoundingClientRect();
    const vw = r.width || CANVAS_W;
    const vh = r.height || CANVAS_H;
    this.zoom = Math.max(MIN_ZOOM, Math.min(vw / CANVAS_W, vh / CANVAS_H, 1.4) * 0.94);
    this.panX = (vw - CANVAS_W * this.zoom) / 2;
    this.panY = (vh - CANVAS_H * this.zoom) / 2;
    this.applyTransform();
  }

  // ----- gestures -----

  private resetGestures(): void {
    this.clearPressTimer();
    this.pointers.clear();
    this.panning = false;
    this.pinchDist = 0;
    this.press = null;
  }

  private clearPressTimer(): void {
    if (this.press && this.press.timer) {
      window.clearTimeout(this.press.timer);
      this.press.timer = 0;
    }
  }

  private attachInteractions(viewport: HTMLDivElement): void {
    viewport.addEventListener("wheel", this.onWheel, { passive: false });
    viewport.addEventListener("pointerdown", this.onPointerDown);
    viewport.addEventListener("pointermove", this.onPointerMove);
    viewport.addEventListener("pointerup", this.onPointerUp);
    viewport.addEventListener("pointercancel", this.onPointerUp);
    viewport.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const r = this.viewport.getBoundingClientRect();
    this.zoomAtPoint(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    try {
      this.viewport.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-captured pointer */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.hideDetail();

    if (this.pointers.size === 2) {
      this.clearPressTimer();
      this.press = null;
      this.panning = false;
      const pts = [...this.pointers.values()];
      this.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.pinchMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      return;
    }

    const nodeEl = (e.target as HTMLElement).closest(".tree-node") as HTMLElement | null;
    const skill = (nodeEl?.dataset.skill ?? null) as SkillId | null;

    if (e.pointerType === "mouse" && e.button === 2) {
      this.panning = true;
      this.lastPan = { x: e.clientX, y: e.clientY };
      return;
    }

    this.press = {
      id: e.pointerId,
      skill,
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType,
      button: e.button,
      moved: false,
      longFired: false,
      timer: 0,
    };

    if (e.pointerType === "touch" && skill && nodeEl) {
      this.press.timer = window.setTimeout(() => {
        if (this.press && !this.press.moved) {
          this.press.longFired = true;
          this.showDetail(skill, nodeEl);
        }
      }, LONG_PRESS_MS);
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) {
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size >= 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const r = this.viewport.getBoundingClientRect();
      if (this.pinchDist > 0) {
        this.zoomAtPoint(mid.x - r.left, mid.y - r.top, dist / this.pinchDist);
        this.panX += mid.x - this.pinchMid.x;
        this.panY += mid.y - this.pinchMid.y;
        this.applyTransform();
      }
      this.pinchDist = dist;
      this.pinchMid = mid;
      return;
    }

    if (this.panning) {
      this.panX += e.clientX - this.lastPan.x;
      this.panY += e.clientY - this.lastPan.y;
      this.lastPan = { x: e.clientX, y: e.clientY };
      this.applyTransform();
      return;
    }

    if (this.press && e.pointerId === this.press.id && !this.press.moved) {
      if (Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > TAP_MOVE) {
        this.press.moved = true;
        this.clearPressTimer();
        this.hideDetail();
        if (this.press.type === "touch") {
          this.panning = true;
          this.lastPan = { x: e.clientX, y: e.clientY };
        }
      }
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    try {
      this.viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) {
      this.pinchDist = 0;
    }
    if (this.pointers.size === 0) {
      this.panning = false;
    }

    if (this.press && e.pointerId === this.press.id) {
      const p = this.press;
      this.clearPressTimer();
      if (!p.moved) {
        if (p.type === "mouse" && p.button === 0 && p.skill) {
          this.buy(p.skill); // desktop left-click unlocks
        } else if (p.type === "touch" && !p.longFired && p.skill) {
          this.showConfirm(p.skill); // mobile tap -> yes/no
        } else if (p.longFired) {
          this.hideDetail(); // mobile long-press release
        }
      }
      this.press = null;
    }
  };

  // ----- actions / popups -----

  private buy(skillId: SkillId): void {
    if (!canPurchaseSkill(this.save, skillId)) {
      return;
    }
    this.save = purchaseSkill(this.save, skillId);
    saveGame(this.save);
    this.render();
  }

  private showDetail(skillId: SkillId, anchor: HTMLElement): void {
    const def = SKILL_DEFS[skillId];
    const layout = NODE_LAYOUT[skillId];
    const level = this.save.skills[skillId];
    const maxed = level >= def.maxLevel;
    const cost = getSkillCost(this.save, skillId);

    this.detailEl.innerHTML = `
      <h4><span>${layout.icon}</span>${def.name}</h4>
      <p>${def.description}</p>
      <div class="tree-detail-row">Level <strong>${level}/${def.maxLevel}</strong></div>
      <div class="tree-detail-row">${maxed ? "Maxed out" : `Next: <span class="tree-detail-cost">${cost} gold</span>`}</div>
    `;
    this.detailEl.style.display = "block";

    const r = anchor.getBoundingClientRect();
    const dw = this.detailEl.offsetWidth;
    const dh = this.detailEl.offsetHeight;
    let left = r.right + 10;
    if (left + dw > window.innerWidth - 8) {
      left = r.left - dw - 10;
    }
    left = Math.max(8, left);
    const top = Math.max(8, Math.min(r.top + r.height / 2 - dh / 2, window.innerHeight - dh - 8));
    this.detailEl.style.left = `${left}px`;
    this.detailEl.style.top = `${top}px`;
  }

  private hideDetail(): void {
    if (this.detailEl) {
      this.detailEl.style.display = "none";
    }
  }

  private showConfirm(skillId: SkillId): void {
    const def = SKILL_DEFS[skillId];
    const layout = NODE_LAYOUT[skillId];
    const level = this.save.skills[skillId];
    const maxed = level >= def.maxLevel;
    const cost = getSkillCost(this.save, skillId);
    const affordable = canPurchaseSkill(this.save, skillId);

    const modal = document.createElement("div");
    modal.className = "tree-modal";

    const card = document.createElement("div");
    card.className = "tree-modal-card";
    const action = level > 0 ? "Upgrade" : "Unlock";
    card.innerHTML = `
      <h3>${layout.icon} ${def.name}</h3>
      <p class="panel-copy" style="margin:0 0 8px">${def.description}</p>
      <div class="tree-detail-row">${
        maxed
          ? "Maxed out"
          : `${action} for <span class="tree-detail-cost">${cost} gold</span> (you have ${this.save.totalGold})`
      }</div>
    `;

    const buttons = document.createElement("div");
    buttons.className = "tree-modal-actions";
    const yes = document.createElement("button");
    yes.type = "button";
    yes.textContent = "Yes";
    yes.disabled = !affordable;
    yes.addEventListener("click", () => {
      modal.remove();
      this.buy(skillId);
    });
    const no = document.createElement("button");
    no.type = "button";
    no.className = "secondary-button";
    no.textContent = "No";
    no.addEventListener("click", () => modal.remove());
    buttons.append(yes, no);
    card.appendChild(buttons);

    modal.appendChild(card);
    modal.addEventListener("pointerdown", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    this.layer.appendChild(modal);
  }
}
