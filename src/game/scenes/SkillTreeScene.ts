import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { SKILL_NODES, SKILL_NODE_BY_ID, SKILL_ROOT, type SkillNode } from "../config/balance";
import {
  addGold,
  canUnlockNode,
  getNodeCost,
  isNodeRevealed,
  isNodeUnlocked,
  loadSave,
  saveGame,
  unlockNode,
} from "../systems/SaveSystem";
import { createButton } from "../ui/Menu";

const SVG_NS = "http://www.w3.org/2000/svg";
const RADIUS_STEP = 195;
const LAYOUT_MARGIN = 120;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const TAP_MOVE = 8;
const LONG_PRESS_MS = 450;

interface Pos {
  x: number;
  y: number;
}

interface PressState {
  id: number;
  nodeId: string | null;
  x: number;
  y: number;
  type: string;
  button: number;
  moved: boolean;
  longFired: boolean;
  timer: number;
}

function effectLabel(node: SkillNode): string {
  const e = node.effect;
  if (!e) {
    return "Opens a branch";
  }
  switch (e.kind) {
    case "damage":
      return `Damage +${e.amount}`;
    case "range":
      return `Range +${e.amount}m`;
    case "arc":
      return `Fan +${e.amount}°`;
    case "attackInterval":
      return `Attack speed +${(Math.abs(e.amount) / 1000).toFixed(2)}s`;
    case "moveSpeed":
      return `Move speed +${e.amount}`;
    case "gold":
      return `Gold +${e.amount}/grass`;
    case "grassCount":
      return `Grass +${e.amount}`;
    case "roundDuration":
      return `Round time +${(e.amount / 1000).toFixed(0)}s`;
  }
}

export class SkillTreeScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private save = loadSave();

  private readonly positions: Record<string, Pos> = {};
  private worldW = 0;
  private worldH = 0;

  // pan/zoom camera (persists across re-renders)
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private viewReady = false;

  private viewport!: HTMLDivElement;
  private world!: HTMLDivElement;
  private detailEl!: HTMLDivElement;

  // gesture state (reset each render)
  private readonly pointers = new Map<number, Pos>();
  private panning = false;
  private lastPan: Pos = { x: 0, y: 0 };
  private pinchDist = 0;
  private pinchMid: Pos = { x: 0, y: 0 };
  private press: PressState | null = null;

  constructor(private readonly app: App) {
    this.scene.background = new THREE.Color("#12241b");
    this.app.setOrthoSize(8);
    this.app.camera.position.set(4.5, 6, 4.5);
    this.app.camera.lookAt(0, 0, 0);
    this.addWorld();
    this.computeLayout();
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

  // ----- radial layout -----

  private computeLayout(): void {
    const children = new Map<string, SkillNode[]>();
    for (const node of SKILL_NODES) {
      if (node.prereq) {
        const list = children.get(node.prereq) ?? [];
        list.push(node);
        children.set(node.prereq, list);
      }
    }

    const leaves = new Map<string, number>();
    const countLeaves = (id: string): number => {
      const kids = children.get(id) ?? [];
      if (kids.length === 0) {
        leaves.set(id, 1);
        return 1;
      }
      let sum = 0;
      for (const kid of kids) {
        sum += countLeaves(kid.id);
      }
      leaves.set(id, sum);
      return sum;
    };
    countLeaves(SKILL_ROOT);

    const raw: Record<string, Pos> = {};
    const place = (id: string, a0: number, a1: number, depth: number): void => {
      const angle = (a0 + a1) / 2;
      raw[id] =
        depth === 0
          ? { x: 0, y: 0 }
          : { x: Math.cos(angle) * depth * RADIUS_STEP, y: Math.sin(angle) * depth * RADIUS_STEP };
      const kids = children.get(id) ?? [];
      const total = leaves.get(id) ?? 1;
      let a = a0;
      for (const kid of kids) {
        const span = ((leaves.get(kid.id) ?? 1) / total) * (a1 - a0);
        place(kid.id, a, a + span, depth + 1);
        a += span;
      }
    };
    place(SKILL_ROOT, -Math.PI / 2, Math.PI * 1.5, 0);

    const xs = Object.values(raw).map((p) => p.x);
    const ys = Object.values(raw).map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    this.worldW = Math.max(...xs) - minX + LAYOUT_MARGIN * 2;
    this.worldH = Math.max(...ys) - minY + LAYOUT_MARGIN * 2;
    for (const id of Object.keys(raw)) {
      this.positions[id] = { x: raw[id].x - minX + LAYOUT_MARGIN, y: raw[id].y - minY + LAYOUT_MARGIN };
    }
  }

  // ----- rendering -----

  private render(): void {
    this.resetGestures();
    this.layer.remove();
    this.layer.replaceChildren();
    this.layer.className = "skill-layer";

    const panel = document.createElement("div");
    panel.className = "skill-panel skilltree-panel";

    const header = document.createElement("div");
    header.className = "skill-header";
    const owned = this.save.unlocked.length;
    header.innerHTML = `
      <div>
        <h2 class="panel-title">Skill Tree</h2>
        <p class="panel-copy">Unlock to grow new branches — ${owned}/${SKILL_NODES.length} skills. Total gold: <strong>${this.save.totalGold}</strong></p>
      </div>
      <p class="skill-meta">Drag to pan · scroll / pinch to zoom · hover or long-press for details</p>
    `;
    panel.appendChild(header);

    const viewport = document.createElement("div");
    viewport.className = "tree-viewport";
    this.viewport = viewport;

    const world = document.createElement("div");
    world.className = "tree-world";
    world.style.width = `${this.worldW}px`;
    world.style.height = `${this.worldH}px`;
    world.appendChild(this.buildBranches());
    for (const node of SKILL_NODES) {
      if (isNodeRevealed(this.save, node.id)) {
        world.appendChild(this.buildNode(node));
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
    svg.setAttribute("width", `${this.worldW}`);
    svg.setAttribute("height", `${this.worldH}`);

    for (const node of SKILL_NODES) {
      if (!node.prereq || !isNodeRevealed(this.save, node.id)) {
        continue;
      }
      const from = this.positions[node.prereq];
      const to = this.positions[node.id];
      const grown = isNodeUnlocked(this.save, node.id);

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

  private buildNode(node: SkillNode): HTMLButtonElement {
    const pos = this.positions[node.id];
    const unlocked = isNodeUnlocked(this.save, node.id);
    const affordable = canUnlockNode(this.save, node.id);
    const cost = getNodeCost(node.id);

    const el = document.createElement("button");
    el.type = "button";
    el.dataset.node = node.id;
    const branch = node.effect === null ? " is-branch" : "";
    el.className = `tree-node ${unlocked ? "is-owned" : "is-available"}${affordable ? " can-buy" : ""}${branch}`;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.innerHTML = `
      <span class="tree-node-icon">${node.icon}</span>
      <span class="tree-node-name">${node.name}</span>
      <span class="tree-node-meta">${effectLabel(node)}</span>
      <span class="tree-node-cost">${unlocked ? "✓ Owned" : `${cost}g`}</span>
    `;

    el.addEventListener("mouseenter", () => {
      if (!this.panning && this.pointers.size === 0) {
        this.showDetail(node.id, el);
      }
    });
    el.addEventListener("mouseleave", () => this.hideDetail());
    return el;
  }

  private buildZoomControls(): HTMLDivElement {
    const box = document.createElement("div");
    box.className = "tree-zoom";
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
    const vw = r.width || 600;
    const vh = r.height || 440;
    const revealed = SKILL_NODES.filter((n) => isNodeRevealed(this.save, n.id)).map((n) => this.positions[n.id]);
    const pad = 110;
    const minX = Math.min(...revealed.map((p) => p.x)) - pad;
    const maxX = Math.max(...revealed.map((p) => p.x)) + pad;
    const minY = Math.min(...revealed.map((p) => p.y)) - pad;
    const maxY = Math.max(...revealed.map((p) => p.y)) + pad;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    this.zoom = Math.max(MIN_ZOOM, Math.min(vw / bw, vh / bh, 1.1));
    this.panX = (vw - (minX + maxX) * this.zoom) / 2;
    this.panY = (vh - (minY + maxY) * this.zoom) / 2;
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
    const nodeId = nodeEl?.dataset.node ?? null;

    if (e.pointerType === "mouse" && e.button === 2) {
      this.panning = true;
      this.lastPan = { x: e.clientX, y: e.clientY };
      return;
    }

    this.press = {
      id: e.pointerId,
      nodeId,
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType,
      button: e.button,
      moved: false,
      longFired: false,
      timer: 0,
    };

    if (e.pointerType === "touch" && nodeId && nodeEl) {
      this.press.timer = window.setTimeout(() => {
        if (this.press && !this.press.moved) {
          this.press.longFired = true;
          this.showDetail(nodeId, nodeEl);
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
        if (p.type === "mouse" && p.button === 0 && p.nodeId) {
          this.buy(p.nodeId);
        } else if (p.type === "touch" && !p.longFired && p.nodeId) {
          this.showConfirm(p.nodeId);
        } else if (p.longFired) {
          this.hideDetail();
        }
      }
      this.press = null;
    }
  };

  // ----- actions / popups -----

  private buy(nodeId: string): void {
    if (!canUnlockNode(this.save, nodeId)) {
      return;
    }
    this.save = unlockNode(this.save, nodeId);
    saveGame(this.save);
    this.render();
  }

  private showDetail(nodeId: string, anchor: HTMLElement): void {
    const node = SKILL_NODE_BY_ID[nodeId];
    if (!node) {
      return;
    }
    const unlocked = isNodeUnlocked(this.save, nodeId);
    const cost = getNodeCost(nodeId);

    this.detailEl.innerHTML = `
      <h4><span>${node.icon}</span>${node.name}</h4>
      <p>${node.description}</p>
      <div class="tree-detail-row">${effectLabel(node)}</div>
      <div class="tree-detail-row">${unlocked ? "✓ Unlocked" : `Cost: <span class="tree-detail-cost">${cost} gold</span>`}</div>
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

  private showConfirm(nodeId: string): void {
    const node = SKILL_NODE_BY_ID[nodeId];
    if (!node) {
      return;
    }
    const unlocked = isNodeUnlocked(this.save, nodeId);
    const cost = getNodeCost(nodeId);
    const affordable = canUnlockNode(this.save, nodeId);

    const modal = document.createElement("div");
    modal.className = "tree-modal";

    const card = document.createElement("div");
    card.className = "tree-modal-card";
    card.innerHTML = `
      <h3>${node.icon} ${node.name}</h3>
      <p class="panel-copy" style="margin:0 0 8px">${node.description} (${effectLabel(node)})</p>
      <div class="tree-detail-row">${
        unlocked
          ? "✓ Already unlocked"
          : `Unlock for <span class="tree-detail-cost">${cost} gold</span> (you have ${this.save.totalGold})`
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
      this.buy(nodeId);
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
