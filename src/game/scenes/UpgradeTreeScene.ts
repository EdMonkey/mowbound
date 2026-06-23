import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { CARD_BY_ID, CARD_ROOT_ID, CARDS, type CardCategory, type CardGate, type CardNode } from "../config/cards";
import { cardDescription, cardName, gateLabel } from "../i18n";
import {
  canUnlockCard,
  getRevealedCards,
  isCardUnlocked,
  unlockCard,
} from "../systems/CardProgressionSystem";
import { loadSave, saveGame, unlockAllCardsForTest, type SaveData } from "../systems/SaveSystem";
import { createButton } from "../ui/Menu";
import {
  getUpgradePrototypeEditedNodePosition,
  getUpgradePrototypePinchZoom,
  getUpgradePrototypeTooltipPosition,
  shouldKeepUpgradePrototypePanAfterPointerEnd,
  shouldPanUpgradePrototype,
  shouldShowUpgradeHoverDetail,
  shouldShowUpgradeLongPressDetail,
  UPGRADE_LONG_PRESS_MS,
} from "../ui/upgradePrototypeInteraction";
import {
  clearUpgradePrototypeLayoutOverrides,
  readUpgradePrototypeLayoutOverrides,
  serializeUpgradePrototypeLayoutOverrides,
  writeUpgradePrototypeLayoutOverrides,
  type UpgradePrototypePositionOverrides,
} from "../ui/upgradePrototypeLayoutStorage";

const SVG_NS = "http://www.w3.org/2000/svg";
const WORLD_MARGIN = 260;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.4;
const TAP_MOVE = 8;
const NODE_DRAG_MARGIN = 80;

interface Point {
  x: number;
  y: number;
}

interface UpgradeTreePress {
  pointerId: number;
  nodeId: string;
  anchor: HTMLElement;
  x: number;
  y: number;
  moved: boolean;
  longFired: boolean;
  timer: number;
}

interface UpgradeTreeEditDrag {
  pointerId: number;
  nodeId: string;
  startPointerX: number;
  startPointerY: number;
  startWorldX: number;
  startWorldY: number;
  moved: boolean;
}

const CATEGORY_LABEL_KO: Record<CardCategory, string> = {
  equipment: "장비",
  harvest: "수확",
  environment: "환경",
  ability: "능력",
};

const CATEGORY_LABEL_EN: Record<CardCategory, string> = {
  equipment: "Equipment",
  harvest: "Harvest",
  environment: "Environment",
  ability: "Ability",
};

export function getUpgradeTreeEdgeClass(card: CardNode, grown: boolean): string {
  return [
    "upgrade-graph-edge",
    `category-${card.category}`,
    `branch-${card.branch}`,
    grown ? "is-grown" : "is-visible",
  ].join(" ");
}

export function shouldDrawUpgradeTreeEdge(card: CardNode, prereq: string, revealedIds: ReadonlySet<string>): boolean {
  return revealedIds.has(card.id) && revealedIds.has(prereq);
}

export class UpgradeTreeScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private save: SaveData = loadSave();
  private selectedId = CARD_ROOT_ID;

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
  private press: UpgradeTreePress | null = null;
  private editMode = false;
  private editDrag: UpgradeTreeEditDrag | null = null;
  private layoutOverrides: UpgradePrototypePositionOverrides = {};
  private suppressNextClick = false;

  constructor(private readonly app: App) {
    this.scene.background = new THREE.Color("#102018");
    this.app.setOrthoSize(8);
    this.app.camera.position.set(4.5, 6, 4.5);
    this.app.camera.lookAt(0, 0, 0);
    this.layoutOverrides = this.readSavedLayoutOverrides();
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

  private get language() {
    return this.app.language;
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
    const xs = CARDS.map((card) => card.layout.x);
    const ys = CARDS.map((card) => card.layout.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    this.worldW = maxX - minX + WORLD_MARGIN * 2;
    this.worldH = maxY - minY + WORLD_MARGIN * 2;

    for (const card of CARDS) {
      const basePosition = {
        x: card.layout.x - minX + WORLD_MARGIN,
        y: card.layout.y - minY + WORLD_MARGIN,
      };
      this.positions[card.id] = this.layoutOverrides[card.id] ? this.clampWorldPosition(this.layoutOverrides[card.id]) : basePosition;
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
    const owned = Object.keys(this.save.unlockedCards).length;
    header.innerHTML = `
      <div>
        <h2 class="panel-title">업그레이드 트리</h2>
        <p class="upgrade-prototype-subtitle">${owned} / ${CARDS.length}</p>
      </div>
      <div class="upgrade-gold-badge" aria-label="보유 골드">
        <span>보유 골드</span>
        <strong>${this.save.gold}g</strong>
      </div>
      <div class="upgrade-prototype-toolbar"></div>
    `;
    const toolbar = header.querySelector(".upgrade-prototype-toolbar");
    toolbar?.append(
      createButton("-", () => this.zoomBy(0.86), "secondary-button upgrade-zoom-button"),
      createButton("+", () => this.zoomBy(1.16), "secondary-button upgrade-zoom-button"),
      createButton("맞춤", () => this.fitView(false), "secondary-button"),
      createButton("모두 해금", () => this.unlockAllNodes(), "secondary-button"),
      createButton(this.editMode ? "편집 끄기" : "편집", () => this.toggleEditMode(), `secondary-button ${this.editMode ? "is-active" : ""}`),
      ...(this.editMode
        ? [
            createButton("저장", () => this.saveLayoutOverrides(), "secondary-button"),
            createButton("불러오기", () => this.loadLayoutOverrides(), "secondary-button"),
            createButton("초기화", () => this.resetLayoutOverrides(), "secondary-button"),
            createButton("JSON 복사", () => {
              void this.copyLayoutJson();
            }, "secondary-button"),
          ]
        : []),
      createButton("메인 메뉴", () => this.app.show("menu"), "secondary-button"),
    );
    panel.appendChild(header);

    this.viewport = document.createElement("div");
    this.viewport.className = "upgrade-graph-viewport";
    this.viewport.classList.toggle("is-editing", this.editMode);

    this.world = document.createElement("div");
    this.world.className = "upgrade-graph-world";
    this.world.style.width = `${this.worldW}px`;
    this.world.style.height = `${this.worldH}px`;
    this.world.appendChild(this.buildBranches());

    for (const card of getRevealedCards(this.save)) {
      this.world.appendChild(this.buildNode(card));
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

    const revealed = new Set(getRevealedCards(this.save).map((card) => card.id));
    for (const card of CARDS) {
      if (!revealed.has(card.id)) {
        continue;
      }
      for (const prereq of card.prereq) {
        if (!shouldDrawUpgradeTreeEdge(card, prereq, revealed)) {
          continue;
        }
        const parent = CARD_BY_ID[prereq];
        const from = this.positions[prereq];
        const to = this.positions[card.id];
        if (!parent || !from || !to) {
          continue;
        }
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const branchBias = card.category === "equipment" ? -1 : card.category === "environment" || card.category === "ability" ? 1 : card.tier % 2 === 0 ? 1 : -1;
        const bendSign = dx === 0 ? branchBias : Math.sign(dx);
        const bend = Math.max(22, Math.min(88, Math.abs(dx) * 0.16 + Math.abs(dy) * 0.08));
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute(
          "d",
          [
            `M ${from.x} ${from.y}`,
            `C ${from.x + dx * 0.32 + bendSign * bend} ${from.y + dy * 0.34}`,
            `${from.x + dx * 0.68 - bendSign * bend} ${from.y + dy * 0.72}`,
            `${to.x} ${to.y}`,
          ].join(" "),
        );
        path.setAttribute("class", getUpgradeTreeEdgeClass(card, isCardUnlocked(this.save, parent.id) && isCardUnlocked(this.save, card.id)));
        svg.appendChild(path);
      }
    }

    return svg;
  }

  private unlockAllNodes(): void {
    this.save = unlockAllCardsForTest(loadSave());
    saveGame(this.save);
    this.hideDetail();
    this.resetGestures();
    this.render();
    this.fitView(true);
  }

  private toggleEditMode(): void {
    this.editMode = !this.editMode;
    this.resetGestures();
    this.hideDetail();
    this.render();
  }

  private readSavedLayoutOverrides(): UpgradePrototypePositionOverrides {
    try {
      return readUpgradePrototypeLayoutOverrides(window.localStorage, CARDS.map((card) => card.id));
    } catch {
      return {};
    }
  }

  private collectCurrentLayoutOverrides(): UpgradePrototypePositionOverrides {
    const overrides: UpgradePrototypePositionOverrides = {};
    for (const card of CARDS) {
      const position = this.positions[card.id];
      if (!position) {
        continue;
      }
      overrides[card.id] = {
        x: Math.round(position.x * 100) / 100,
        y: Math.round(position.y * 100) / 100,
      };
    }
    return overrides;
  }

  private saveLayoutOverrides(): void {
    this.layoutOverrides = this.collectCurrentLayoutOverrides();
    try {
      writeUpgradePrototypeLayoutOverrides(window.localStorage, this.layoutOverrides);
    } catch {
      return;
    }
  }

  private loadLayoutOverrides(): void {
    this.layoutOverrides = this.readSavedLayoutOverrides();
    this.computeBounds();
    this.render();
    this.fitView(true);
  }

  private resetLayoutOverrides(): void {
    this.layoutOverrides = {};
    try {
      clearUpgradePrototypeLayoutOverrides(window.localStorage);
    } catch {
      /* local storage can be unavailable */
    }
    this.computeBounds();
    this.render();
    this.fitView(true);
  }

  private async copyLayoutJson(): Promise<void> {
    const json = serializeUpgradePrototypeLayoutOverrides(this.collectCurrentLayoutOverrides());
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      this.downloadLayoutJson(json);
    }
  }

  private downloadLayoutJson(json: string): void {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mowbound-upgrade-layout.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private clampWorldPosition(position: Point): Point {
    return {
      x: Math.max(NODE_DRAG_MARGIN, Math.min(this.worldW - NODE_DRAG_MARGIN, position.x)),
      y: Math.max(NODE_DRAG_MARGIN, Math.min(this.worldH - NODE_DRAG_MARGIN, position.y)),
    };
  }

  private updateEditedNodePosition(nodeId: string, position: Point): void {
    const next = this.clampWorldPosition(position);
    this.positions[nodeId] = next;
    this.layoutOverrides[nodeId] = next;
    const nodeEl = this.world.querySelector<HTMLElement>(`.upgrade-graph-node[data-node="${nodeId}"]`);
    if (nodeEl) {
      nodeEl.style.left = `${next.x}px`;
      nodeEl.style.top = `${next.y}px`;
    }
    const branches = this.world.querySelector(".upgrade-graph-branches");
    branches?.replaceWith(this.buildBranches());
  }

  private buildNode(card: CardNode): HTMLDivElement {
    const unlocked = isCardUnlocked(this.save, card.id);
    const canUnlock = canUnlockCard(this.save, card.id);
    const selected = this.selectedId === card.id;
    const pos = this.positions[card.id];
    const button = document.createElement("div");
    button.role = "button";
    button.tabIndex = -1;
    button.className = [
      "upgrade-graph-node",
      `category-${card.category}`,
      `branch-${card.branch}`,
      card.tier === 0 || card.effects.some((effect) => effect.kind === "special" || effect.kind === "toolUnlock" || effect.kind === "unlockMap") ? "is-major" : "",
      unlocked ? "is-unlocked" : "is-locked",
      canUnlock ? "can-unlock" : "",
      selected ? "is-selected" : "",
    ].join(" ");
    button.dataset.node = card.id;
    button.style.left = `${pos.x}px`;
    button.style.top = `${pos.y}px`;
    button.innerHTML = `
      <span class="upgrade-node-label">${this.shortTitle(card)}</span>
      <span class="upgrade-node-cost">${unlocked ? "완료" : `${card.cost}g`}</span>
    `;

    button.addEventListener("pointerenter", (event) => {
      if (!shouldShowUpgradeHoverDetail(event.pointerType)) {
        return;
      }
      this.selectedId = card.id;
      this.showDetail(card.id, button, { x: event.clientX, y: event.clientY });
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
      this.selectedId = card.id;
      if (this.editMode) {
        this.hideDetail();
        return;
      }
      if (canUnlockCard(this.save, card.id)) {
        this.save = unlockCard(this.save, card.id);
        saveGame(this.save);
        this.hideDetail();
        this.resetGestures();
        this.render();
      } else {
        this.showDetail(card.id, button);
      }
    });

    return button;
  }

  private shortTitle(card: CardNode): string {
    const title = cardName(card, this.language).replace(/\s+/g, "");
    return this.language === "ko" ? [...title].slice(0, 4).join("") : title.slice(0, 8);
  }

  private showDetail(nodeId: string, anchor: HTMLElement, point?: Point): void {
    if (!this.detail) {
      return;
    }
    const card = CARD_BY_ID[nodeId] ?? CARD_BY_ID[CARD_ROOT_ID];
    if (!card) {
      this.detail.replaceChildren();
      return;
    }

    const unlocked = isCardUnlocked(this.save, card.id);
    const available = canUnlockCard(this.save, card.id);
    const prereqNames = card.prereq
      .map((id) => CARD_BY_ID[id] ? cardName(CARD_BY_ID[id], this.language) : id)
      .join(", ");
    const gateRows = this.gateRows(card.gates);
    const categoryLabel = this.language === "ko" ? CATEGORY_LABEL_KO[card.category] : CATEGORY_LABEL_EN[card.category];

    this.detail.innerHTML = `
      <span class="upgrade-detail-branch category-${card.category} branch-${card.branch}">${categoryLabel}</span>
      <h3>${cardName(card, this.language)}</h3>
      <p>${cardDescription(card, this.language)}</p>
      <dl>
        <div><dt>비용</dt><dd>${card.cost}g</dd></div>
        <div><dt>상태</dt><dd>${unlocked ? "해금됨" : available ? "해금 가능" : "잠김"}</dd></div>
        <div><dt>선행</dt><dd>${prereqNames || "없음"}</dd></div>
        ${gateRows}
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

  private gateRows(gates: CardGate[]): string {
    return gates.map((gate) => {
      const current = this.gateProgress(gate);
      return `<div><dt>조건</dt><dd>${gateLabel(gate, this.language)}${current ? ` · ${current}` : ""}</dd></div>`;
    }).join("");
  }

  private gateProgress(gate: CardGate): string {
    switch (gate.kind) {
      case "bestClearPercent":
        return `${this.save.lifetimeStats.bestClearPercentByMap[String(gate.mapSize)] ?? 0}%`;
      case "lifetimeGrass":
        return `${this.save.lifetimeStats.grassCut}`;
      case "bestBombChain":
        return `${this.save.lifetimeStats.bestBombChain}`;
      default:
        return "";
    }
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
    this.editDrag = null;
  }

  private attachViewportEvents(): void {
    this.viewport.addEventListener("pointerdown", (event) => {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const nodeEl = (event.target as HTMLElement).closest(".upgrade-graph-node") as HTMLElement | null;
      const nodeId = nodeEl?.dataset.node;

      if (this.pointers.size >= 2) {
        this.editDrag = null;
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

      if (this.editMode && nodeId && nodeEl && event.button === 0) {
        event.preventDefault();
        this.clearPressTimer();
        this.press = null;
        this.hideDetail();
        const position = this.positions[nodeId];
        if (!position) {
          return;
        }
        this.capturePointer(event.pointerId);
        nodeEl.classList.add("is-edit-dragging");
        this.editDrag = {
          pointerId: event.pointerId,
          nodeId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startWorldX: position.x,
          startWorldY: position.y,
          moved: false,
        };
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

      if (this.editDrag && event.pointerId === this.editDrag.pointerId) {
        if (Math.hypot(event.clientX - this.editDrag.startPointerX, event.clientY - this.editDrag.startPointerY) > TAP_MOVE) {
          this.editDrag.moved = true;
        }
        this.updateEditedNodePosition(this.editDrag.nodeId, getUpgradePrototypeEditedNodePosition({
          startWorldX: this.editDrag.startWorldX,
          startWorldY: this.editDrag.startWorldY,
          pointerStartX: this.editDrag.startPointerX,
          pointerStartY: this.editDrag.startPointerY,
          pointerX: event.clientX,
          pointerY: event.clientY,
          zoom: this.zoom,
          minX: NODE_DRAG_MARGIN,
          maxX: this.worldW - NODE_DRAG_MARGIN,
          minY: NODE_DRAG_MARGIN,
          maxY: this.worldH - NODE_DRAG_MARGIN,
        }));
        return;
      }

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

      if (this.editDrag && event.pointerId === this.editDrag.pointerId) {
        const nodeEl = this.world.querySelector<HTMLElement>(`.upgrade-graph-node[data-node="${this.editDrag.nodeId}"]`);
        nodeEl?.classList.remove("is-edit-dragging");
        if (this.editDrag.moved) {
          this.suppressNextClick = true;
          window.setTimeout(() => {
            this.suppressNextClick = false;
          }, 350);
        }
        this.editDrag = null;
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
    const nodes = fitAll ? CARDS : getRevealedCards(this.save);
    const points = nodes.map((card) => this.positions[card.id]).filter(Boolean);
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
