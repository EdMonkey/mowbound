import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import {
  canUnlockPrototypeNode,
  getPrototypeNode,
  getRevealedPrototypeNodes,
  UPGRADE_PROTOTYPE_NODES,
  UPGRADE_PROTOTYPE_ROOT_ID,
  type UpgradePrototypeBranch,
  type UpgradePrototypeNode,
} from "../config/upgradePrototypeTree";
import { createButton } from "../ui/Menu";
import {
  getUpgradePrototypePinchZoom,
  getUpgradePrototypeTooltipPosition,
  shouldKeepUpgradePrototypePanAfterPointerEnd,
  shouldPanUpgradePrototype,
  shouldShowUpgradeHoverDetail,
  shouldShowUpgradeLongPressDetail,
  UPGRADE_LONG_PRESS_MS,
} from "../ui/upgradePrototypeInteraction";

const SVG_NS = "http://www.w3.org/2000/svg";
const WORLD_MARGIN = 260;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.4;
const TAP_MOVE = 8;

interface Point {
  x: number;
  y: number;
}

interface UpgradePrototypePress {
  pointerId: number;
  nodeId: string;
  anchor: HTMLElement;
  x: number;
  y: number;
  moved: boolean;
  longFired: boolean;
  timer: number;
}

const BRANCH_LABEL: Record<UpgradePrototypeBranch, string> = {
  root: "시작",
  equipment: "장비",
  harvest: "수확",
  environment: "환경",
};

export class UpgradePrototypeScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private readonly unlocked = new Set<string>();
  private selectedId = UPGRADE_PROTOTYPE_ROOT_ID;

  private readonly positions: Record<string, Point> = {};
  private worldW = 0;
  private worldH = 0;

  private viewport!: HTMLDivElement;
  private world!: HTMLDivElement;
  private detail!: HTMLElement;

  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private fitted = false;
  private readonly pointers = new Map<number, Point>();
  private panning = false;
  private lastPan: Point = { x: 0, y: 0 };
  private touchGestureMid: Point | null = null;
  private touchPinchDist = 0;
  private press: UpgradePrototypePress | null = null;
  private suppressNextClick = false;

  constructor(private readonly app: App) {
    this.scene.background = new THREE.Color("#102018");
    this.app.setOrthoSize(8);
    this.app.camera.position.set(4.5, 6, 4.5);
    this.app.camera.lookAt(0, 0, 0);
    this.addWorld();
    this.computeBounds();
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
    const sun = new THREE.DirectionalLight("#fff1c5", 1.7);
    sun.position.set(4, 7, 2);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshStandardMaterial({ color: "#244d35", roughness: 0.96 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
  }

  private computeBounds(): void {
    const xs = UPGRADE_PROTOTYPE_NODES.map((node) => node.x);
    const ys = UPGRADE_PROTOTYPE_NODES.map((node) => node.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    this.worldW = maxX - minX + WORLD_MARGIN * 2;
    this.worldH = maxY - minY + WORLD_MARGIN * 2;

    for (const node of UPGRADE_PROTOTYPE_NODES) {
      this.positions[node.id] = {
        x: node.x - minX + WORLD_MARGIN,
        y: node.y - minY + WORLD_MARGIN,
      };
    }
  }

  private render(): void {
    this.layer.remove();
    this.layer.replaceChildren();
    this.layer.className = "upgrade-prototype-layer";

    const panel = document.createElement("div");
    panel.className = "upgrade-prototype-panel upgrade-prototype-graph-panel";

    const header = document.createElement("header");
    header.className = "upgrade-prototype-header";
    header.innerHTML = `
      <div>
        <h2 class="panel-title">업그레이드 트리</h2>
      </div>
      <div class="upgrade-prototype-toolbar"></div>
    `;
    const toolbar = header.querySelector(".upgrade-prototype-toolbar");
    toolbar?.append(
      createButton("-", () => this.zoomBy(0.86), "secondary-button upgrade-zoom-button"),
      createButton("+", () => this.zoomBy(1.16), "secondary-button upgrade-zoom-button"),
      createButton("맞춤", () => this.fitView(false), "secondary-button"),
      createButton("메인 메뉴", () => this.app.show("menu"), "secondary-button"),
    );
    panel.appendChild(header);

    this.viewport = document.createElement("div");
    this.viewport.className = "upgrade-graph-viewport";

    this.world = document.createElement("div");
    this.world.className = "upgrade-graph-world";
    this.world.style.width = `${this.worldW}px`;
    this.world.style.height = `${this.worldH}px`;
    this.world.appendChild(this.buildBranches());

    for (const node of getRevealedPrototypeNodes(this.unlocked)) {
      this.world.appendChild(this.buildNode(node));
    }

    this.detail = document.createElement("aside");
    this.detail.className = "upgrade-detail-panel";
    this.hideDetail();

    this.viewport.append(this.world, this.detail);
    this.attachViewportEvents();
    panel.appendChild(this.viewport);

    this.layer.appendChild(panel);
    this.app.uiRoot.appendChild(this.layer);

    if (!this.fitted) {
      this.fitView(false);
      this.fitted = true;
    } else {
      this.applyTransform();
    }
  }

  private buildBranches(): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "upgrade-graph-branches");
    svg.setAttribute("width", `${this.worldW}`);
    svg.setAttribute("height", `${this.worldH}`);

    const revealed = new Set(getRevealedPrototypeNodes(this.unlocked).map((node) => node.id));
    for (const node of UPGRADE_PROTOTYPE_NODES) {
      if (!revealed.has(node.id)) {
        continue;
      }
      for (const prereq of node.prereq) {
        const parent = getPrototypeNode(prereq);
        const from = this.positions[prereq];
        const to = this.positions[node.id];
        if (!parent || !from || !to) {
          continue;
        }
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", `${from.x}`);
        line.setAttribute("y1", `${from.y}`);
        line.setAttribute("x2", `${to.x}`);
        line.setAttribute("y2", `${to.y}`);
        line.setAttribute("class", [
          "upgrade-graph-edge",
          `branch-${node.branch}`,
          this.unlocked.has(parent.id) && this.unlocked.has(node.id) ? "is-grown" : "is-visible",
        ].join(" "));
        svg.appendChild(line);
      }
    }

    return svg;
  }

  private buildNode(node: UpgradePrototypeNode): HTMLDivElement {
    const unlocked = this.unlocked.has(node.id);
    const canUnlock = canUnlockPrototypeNode(node, this.unlocked);
    const selected = this.selectedId === node.id;
    const pos = this.positions[node.id];
    const button = document.createElement("div");
    button.role = "button";
    button.tabIndex = -1;
    button.className = [
      "upgrade-graph-node",
      `branch-${node.branch}`,
      node.major ? "is-major" : "",
      unlocked ? "is-unlocked" : "is-locked",
      canUnlock ? "can-unlock" : "",
      selected ? "is-selected" : "",
    ].join(" ");
    button.dataset.node = node.id;
    button.style.left = `${pos.x}px`;
    button.style.top = `${pos.y}px`;
    button.innerHTML = `
      <span class="upgrade-node-label">${node.shortTitle}</span>
      <span class="upgrade-node-cost">${unlocked ? "완료" : `${node.cost}g`}</span>
    `;

    button.addEventListener("pointerenter", (event) => {
      if (!shouldShowUpgradeHoverDetail(event.pointerType)) {
        return;
      }
      this.selectedId = node.id;
      this.showDetail(node.id, button, { x: event.clientX, y: event.clientY });
    });
    button.addEventListener("pointerleave", (event) => {
      if (shouldShowUpgradeHoverDetail(event.pointerType)) {
        this.hideDetail();
      }
    });
    button.addEventListener("click", (event) => {
      button.blur();
      if (this.suppressNextClick) {
        this.suppressNextClick = false;
        event.preventDefault();
        return;
      }
      this.selectedId = node.id;
      if (canUnlockPrototypeNode(node, this.unlocked)) {
        this.unlocked.add(node.id);
        this.hideDetail();
        this.resetGestures();
        this.render();
      } else {
        this.hideDetail();
      }
    });

    return button;
  }

  private showDetail(nodeId: string, anchor: HTMLElement, point?: Point): void {
    if (!this.detail) {
      return;
    }
    const node = getPrototypeNode(nodeId) ?? getPrototypeNode(UPGRADE_PROTOTYPE_ROOT_ID);
    if (!node) {
      this.detail.replaceChildren();
      return;
    }

    const unlocked = this.unlocked.has(node.id);
    const available = canUnlockPrototypeNode(node, this.unlocked);
    const prereqNames = node.prereq
      .map((id) => getPrototypeNode(id)?.title)
      .filter(Boolean)
      .join(", ");

    this.detail.innerHTML = `
      <span class="upgrade-detail-branch branch-${node.branch}">${BRANCH_LABEL[node.branch]}</span>
      <h3>${node.title}</h3>
      <p>${node.description}</p>
      <dl>
        <div><dt>비용</dt><dd>${node.cost}g</dd></div>
        <div><dt>상태</dt><dd>${unlocked ? "해금됨" : available ? "해금 가능" : "잠김"}</dd></div>
        <div><dt>선행</dt><dd>${prereqNames || "없음"}</dd></div>
      </dl>
    `;
    this.detail.style.display = "block";
    this.detail.style.left = "";
    this.detail.style.right = "auto";
    this.detail.style.top = "";
    this.detail.style.bottom = "auto";

    const viewportRect = this.viewport.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const detailWidth = this.detail.offsetWidth;
    const detailHeight = this.detail.offsetHeight;
    const pointX = point ? point.x - viewportRect.left : anchorRect.left - viewportRect.left + anchorRect.width / 2;
    const pointY = point ? point.y - viewportRect.top : anchorRect.top - viewportRect.top;
    const position = getUpgradePrototypeTooltipPosition({
      pointX,
      pointY,
      detailWidth,
      detailHeight,
      viewportWidth: viewportRect.width,
      viewportHeight: viewportRect.height,
      offset: 12,
    });
    this.detail.style.left = `${position.left}px`;
    this.detail.style.top = `${position.top}px`;
  }

  private hideDetail(): void {
    if (this.detail) {
      this.detail.style.display = "none";
    }
  }

  private clearPressTimer(): void {
    if (this.press?.timer) {
      window.clearTimeout(this.press.timer);
      this.press.timer = 0;
    }
  }

  private resetGestures(): void {
    this.clearPressTimer();
    this.pointers.clear();
    this.setPanning(false);
    this.touchGestureMid = null;
    this.touchPinchDist = 0;
    this.press = null;
  }

  private attachViewportEvents(): void {
    this.viewport.addEventListener("pointerdown", (event) => {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const nodeEl = (event.target as HTMLElement).closest(".upgrade-graph-node") as HTMLElement | null;
      const nodeId = nodeEl?.dataset.node;

      if (this.pointers.size >= 2) {
        this.clearPressTimer();
        this.press = null;
        this.hideDetail();
        this.setPanning(shouldPanUpgradePrototype({
          pointerType: event.pointerType,
          button: event.button,
          pointerCount: this.pointers.size,
          startedOnNode: false,
        }));
        if (this.panning) {
          this.captureActivePointers();
        }
        this.touchGestureMid = this.getPointerMidpoint();
        this.touchPinchDist = this.getPointerDistance();
        return;
      }

      if (shouldPanUpgradePrototype({
        pointerType: event.pointerType,
        button: event.button,
        pointerCount: this.pointers.size,
        startedOnNode: Boolean(nodeId),
      })) {
        this.clearPressTimer();
        this.press = null;
        this.hideDetail();
        this.setPanning(true);
        this.capturePointer(event.pointerId);
        this.lastPan = { x: event.clientX, y: event.clientY };
        return;
      }

      if (!nodeId || !nodeEl || !shouldShowUpgradeLongPressDetail(event.pointerType)) {
        return;
      }

      this.press = {
        pointerId: event.pointerId,
        nodeId,
        anchor: nodeEl,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        longFired: false,
        timer: window.setTimeout(() => {
          if (!this.press || this.press.moved) {
            return;
          }
          this.press.longFired = true;
          this.selectedId = this.press.nodeId;
          this.showDetail(this.press.nodeId, this.press.anchor, { x: this.press.x, y: this.press.y });
        }, UPGRADE_LONG_PRESS_MS),
      };
    });

    this.viewport.addEventListener("pointermove", (event) => {
      if (!this.pointers.has(event.pointerId)) {
        return;
      }
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointers.size >= 2 && this.panning) {
        const mid = this.getPointerMidpoint();
        const dist = this.getPointerDistance();
        if (mid && dist > 0 && this.touchGestureMid && this.touchPinchDist > 0) {
          const rect = this.viewport.getBoundingClientRect();
          this.zoomAt(getUpgradePrototypePinchZoom(this.touchPinchDist, dist), {
            x: mid.x - rect.left,
            y: mid.y - rect.top,
          });
          this.panX += mid.x - this.touchGestureMid.x;
          this.panY += mid.y - this.touchGestureMid.y;
          this.applyTransform();
        }
        this.touchGestureMid = mid;
        this.touchPinchDist = dist;
        return;
      }

      if (this.panning) {
        this.panX += event.clientX - this.lastPan.x;
        this.panY += event.clientY - this.lastPan.y;
        this.lastPan = { x: event.clientX, y: event.clientY };
        this.applyTransform();
        return;
      }

      if (this.press && event.pointerId === this.press.pointerId && !this.press.moved) {
        if (Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > TAP_MOVE) {
          this.press.moved = true;
          this.clearPressTimer();
          this.hideDetail();
        }
      }
    });

    const endPointer = (event: PointerEvent) => {
      const wasPinching = this.touchPinchDist > 0;
      try {
        this.viewport.releasePointerCapture(event.pointerId);
      } catch {
        /* pointer already released */
      }
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) {
        this.touchGestureMid = null;
        this.touchPinchDist = 0;
        this.setPanning(shouldKeepUpgradePrototypePanAfterPointerEnd({
          pointerType: event.pointerType,
          remainingPointerCount: this.pointers.size,
          wasPinching,
        }));
      }
      if (this.pointers.size === 0) {
        this.setPanning(false);
      }

      if (this.press && event.pointerId === this.press.pointerId) {
        const longFired = this.press.longFired;
        this.clearPressTimer();
        if (longFired) {
          this.hideDetail();
          this.suppressNextClick = true;
          window.setTimeout(() => {
            this.suppressNextClick = false;
          }, 350);
        }
        this.press = null;
      }
    };
    this.viewport.addEventListener("pointerup", endPointer);
    this.viewport.addEventListener("pointercancel", endPointer);
    this.viewport.addEventListener("contextmenu", (event) => event.preventDefault());

    this.viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = this.viewport.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      this.zoomAt(event.deltaY < 0 ? 1.12 : 0.88, point);
    }, { passive: false });
  }

  private getPointerMidpoint(): Point | null {
    const points = [...this.pointers.values()];
    if (points.length < 2) {
      return null;
    }
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }

  private getPointerDistance(): number {
    const points = [...this.pointers.values()];
    if (points.length < 2) {
      return 0;
    }
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  private setPanning(active: boolean): void {
    this.panning = active;
    this.viewport?.classList.toggle("is-panning", active);
  }

  private capturePointer(pointerId: number): void {
    try {
      this.viewport.setPointerCapture(pointerId);
    } catch {
      /* synthetic or already captured */
    }
  }

  private captureActivePointers(): void {
    for (const pointerId of this.pointers.keys()) {
      this.capturePointer(pointerId);
    }
  }

  private fitView(fitAll = false): void {
    if (!this.viewport) {
      return;
    }
    const rect = this.viewport.getBoundingClientRect();
    const nodes = fitAll ? UPGRADE_PROTOTYPE_NODES : getRevealedPrototypeNodes(this.unlocked);
    const points = nodes.map((node) => this.positions[node.id]).filter(Boolean);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs) - 160;
    const maxX = Math.max(...xs) + 160;
    const minY = Math.min(...ys) - 120;
    const maxY = Math.max(...ys) + 120;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const maxZoom = fitAll ? MAX_ZOOM : 1.25;
    const zoom = Math.min(
      maxZoom,
      Math.max(MIN_ZOOM, Math.min((rect.width - 80) / width, (rect.height - 80) / height)),
    );
    this.zoom = zoom;
    this.panX = rect.width / 2 - centerX * zoom;
    this.panY = rect.height / 2 - centerY * zoom;
    this.applyTransform();
  }

  private zoomBy(multiplier: number): void {
    const rect = this.viewport.getBoundingClientRect();
    this.zoomAt(multiplier, { x: rect.width / 2, y: rect.height / 2 });
  }

  private zoomAt(multiplier: number, screenPoint: Point): void {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * multiplier));
    const worldX = (screenPoint.x - this.panX) / this.zoom;
    const worldY = (screenPoint.y - this.panY) / this.zoom;
    this.zoom = nextZoom;
    this.panX = screenPoint.x - worldX * nextZoom;
    this.panY = screenPoint.y - worldY * nextZoom;
    this.applyTransform();
  }

  private applyTransform(): void {
    this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }
}
