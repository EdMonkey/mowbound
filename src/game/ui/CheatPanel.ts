import { SKILL_NODES } from "../config/skillTree";
import { addGold, loadSave, saveGame } from "../systems/SaveSystem";
import type { App } from "../App";

export class CheatPanel {
  private readonly toggleBtn: HTMLButtonElement;
  private readonly overlay: HTMLDivElement;
  private readonly mapInput: HTMLInputElement;
  private readonly statusEl: HTMLDivElement;

  constructor(private readonly parent: HTMLElement, private readonly app: App) {
    this.toggleBtn = this.buildToggleButton();
    this.mapInput = document.createElement("input");
    this.statusEl = document.createElement("div");
    this.overlay = this.buildOverlay();
    parent.appendChild(this.toggleBtn);
    parent.appendChild(this.overlay);
  }

  private buildToggleButton(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cheat-toggle";
    btn.textContent = "CHEAT";
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", () => this.open());
    return btn;
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "cheat-overlay";
    overlay.style.display = "none";
    overlay.addEventListener("click", (e) => { if (e.target === overlay) this.close(); });

    const card = document.createElement("div");
    card.className = "cheat-card";

    const title = document.createElement("h3");
    title.className = "cheat-title";
    title.textContent = "Cheat Menu";
    card.appendChild(title);

    const actions: Array<{ label: string; fn: () => void }> = [
      { label: "모든 스킬 해금", fn: () => this.unlockAll() },
      { label: "스킬 리셋", fn: () => this.resetSkills() },
      { label: "골드 +99999", fn: () => this.giveGold() },
    ];

    for (const { label, fn } of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cheat-action-btn";
      btn.textContent = label;
      btn.addEventListener("pointerdown", (e) => e.stopPropagation());
      btn.addEventListener("click", fn);
      card.appendChild(btn);
    }

    // Map size row
    const mapRow = document.createElement("div");
    mapRow.className = "cheat-map-row";

    const mapLabel = document.createElement("label");
    mapLabel.className = "cheat-map-label";
    mapLabel.textContent = "맵 크기 (m)";

    this.mapInput.type = "number";
    this.mapInput.className = "cheat-map-input";
    this.mapInput.min = "10";
    this.mapInput.max = "500";
    this.mapInput.step = "10";
    this.mapInput.addEventListener("pointerdown", (e) => e.stopPropagation());

    const mapApplyBtn = document.createElement("button");
    mapApplyBtn.type = "button";
    mapApplyBtn.className = "cheat-action-btn";
    mapApplyBtn.textContent = "적용 후 재시작";
    mapApplyBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    mapApplyBtn.addEventListener("click", () => this.applyMapSize());

    mapRow.append(mapLabel, this.mapInput, mapApplyBtn);
    card.appendChild(mapRow);

    // Status
    this.statusEl.className = "cheat-status";
    card.appendChild(this.statusEl);

    // Footer
    const footer = document.createElement("div");
    footer.className = "cheat-footer";

    const restartBtn = document.createElement("button");
    restartBtn.type = "button";
    restartBtn.className = "cheat-restart-btn";
    restartBtn.textContent = "게임 재시작";
    restartBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    restartBtn.addEventListener("click", () => { this.close(); this.app.show("game"); });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "cheat-close-btn";
    closeBtn.textContent = "닫기";
    closeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    closeBtn.addEventListener("click", () => this.close());

    footer.append(restartBtn, closeBtn);
    card.appendChild(footer);
    overlay.appendChild(card);
    return overlay;
  }

  private open(): void {
    this.mapInput.value = String(this.app.mapSizeMeters);
    this.statusEl.textContent = "";
    this.overlay.style.display = "grid";
  }

  private close(): void {
    this.overlay.style.display = "none";
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }

  private unlockAll(): void {
    const save = loadSave();
    const levels: Record<string, number> = {};
    for (const node of SKILL_NODES) levels[node.id] = 1;
    saveGame({ ...save, levels });
    this.setStatus(`✓ ${SKILL_NODES.length}개 스킬 해금 — 재시작 후 적용`);
  }

  private resetSkills(): void {
    const save = loadSave();
    saveGame({ ...save, levels: {} });
    this.setStatus("✓ 스킬 초기화 — 재시작 후 적용");
  }

  private giveGold(): void {
    saveGame(addGold(loadSave(), 99999));
    this.setStatus("✓ 골드 +99999 지급 — 재시작 후 적용");
  }

  private applyMapSize(): void {
    const val = parseInt(this.mapInput.value, 10);
    if (isNaN(val) || val < 10 || val > 500) {
      this.setStatus("⚠ 10~500 사이 값을 입력하세요");
      return;
    }
    this.app.mapSizeMeters = val;
    this.app.bypassMapLock = true;
    this.close();
    this.app.show("game");
  }

  dispose(): void {
    this.toggleBtn.remove();
    this.overlay.remove();
  }
}
