import type { App } from "../App";
import {
  CARD_BY_ID,
  CARD_CATEGORIES,
  CARD_CATEGORY_LABELS_KO,
  CARDS,
} from "../config/cards";
import { addGold, loadSave, saveGame, unlockAllCardsForTest } from "../systems/SaveSystem";

interface CheatCategory {
  label: string;
  cardIds: string[];
}

const BRANCH_LABELS: Record<string, string> = {
  blade: "칼날 카드",
  movement: "이동 카드",
  harvest: "수확 카드",
  obstacles: "장애물 카드",
  bombs: "폭탄 카드",
  land: "땅 카드",
  spectacle: "특수 카드",
};

/** Build selectable cheat unlock groups from card categories and branches. */
export function buildCheatCategories(): CheatCategory[] {
  const categories: CheatCategory[] = [];

  for (const category of CARD_CATEGORIES) {
    const cardIds = CARDS.filter((card) => card.category === category).map((card) => card.id);
    if (cardIds.length > 0) {
      categories.push({ label: `${CARD_CATEGORY_LABELS_KO[category]} 카드`, cardIds });
    }
  }

  for (const [branch, label] of Object.entries(BRANCH_LABELS)) {
    const cardIds = CARDS.filter((card) => card.branch === branch).map((card) => card.id);
    if (cardIds.length > 0) {
      categories.push({ label, cardIds });
    }
  }

  return categories;
}

export function unlockCheatCardCategory(cardIds: readonly string[]): Record<string, number> {
  const toUnlock = new Set<string>();
  const visit = (id: string): void => {
    if (toUnlock.has(id)) {
      return;
    }
    const card = CARD_BY_ID[id];
    if (!card) {
      return;
    }
    toUnlock.add(id);
    card.prereq.forEach(visit);
  };

  cardIds.forEach(visit);
  return Object.fromEntries([...toUnlock].map((id) => [id, 1]));
}

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
    btn.addEventListener("pointerdown", (event) => event.stopPropagation());
    btn.addEventListener("click", () => this.open());
    return btn;
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "cheat-overlay";
    overlay.style.display = "none";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        this.close();
      }
    });

    const card = document.createElement("div");
    card.className = "cheat-card";

    const title = document.createElement("h3");
    title.className = "cheat-title";
    title.textContent = "Cheat Menu";
    card.appendChild(title);

    const actions: Array<{ label: string; fn: () => void }> = [
      { label: "카드 목록 보기", fn: () => this.openCardCatalog() },
      { label: "모든 카드 해금", fn: () => this.unlockAll() },
      { label: "카드 리셋", fn: () => this.resetCards() },
      { label: "골드 +99999", fn: () => this.giveGold() },
    ];

    for (const { label, fn } of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cheat-action-btn";
      btn.textContent = label;
      btn.addEventListener("pointerdown", (event) => event.stopPropagation());
      btn.addEventListener("click", fn);
      card.appendChild(btn);
    }

    const catLabel = document.createElement("div");
    catLabel.className = "cheat-section-label";
    catLabel.textContent = "카테고리별 해금";
    card.appendChild(catLabel);

    const catGrid = document.createElement("div");
    catGrid.className = "cheat-cat-grid";
    for (const category of buildCheatCategories()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cheat-cat-btn";
      btn.textContent = category.label;
      btn.addEventListener("pointerdown", (event) => event.stopPropagation());
      btn.addEventListener("click", () => this.unlockCategory(category));
      catGrid.appendChild(btn);
    }
    card.appendChild(catGrid);

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
    this.mapInput.addEventListener("pointerdown", (event) => event.stopPropagation());

    const mapApplyBtn = document.createElement("button");
    mapApplyBtn.type = "button";
    mapApplyBtn.className = "cheat-action-btn";
    mapApplyBtn.textContent = "적용 후 재시작";
    mapApplyBtn.addEventListener("pointerdown", (event) => event.stopPropagation());
    mapApplyBtn.addEventListener("click", () => this.applyMapSize());

    mapRow.append(mapLabel, this.mapInput, mapApplyBtn);
    card.appendChild(mapRow);

    this.statusEl.className = "cheat-status";
    card.appendChild(this.statusEl);

    const footer = document.createElement("div");
    footer.className = "cheat-footer";

    const restartBtn = document.createElement("button");
    restartBtn.type = "button";
    restartBtn.className = "cheat-restart-btn";
    restartBtn.textContent = "게임 재시작";
    restartBtn.addEventListener("pointerdown", (event) => event.stopPropagation());
    restartBtn.addEventListener("click", () => {
      this.close();
      this.app.show("game");
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "cheat-close-btn";
    closeBtn.textContent = "닫기";
    closeBtn.addEventListener("pointerdown", (event) => event.stopPropagation());
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

  private setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  private openCardCatalog(): void {
    this.close();
    this.app.show("cardCatalog");
  }

  private unlockAll(): void {
    saveGame(unlockAllCardsForTest(loadSave()));
    this.setStatus(`✓ ${CARDS.length}개 카드 해금 — 재시작 후 적용`);
  }

  private unlockCategory(category: CheatCategory): void {
    const save = loadSave();
    const unlockedCards = {
      ...save.unlockedCards,
      ...unlockCheatCardCategory(category.cardIds),
    };
    saveGame({ ...save, unlockedCards, levels: { ...unlockedCards } });
    this.setStatus(`✓ ${category.label} 해금 (${category.cardIds.length}개+) — 재시작 후 적용`);
  }

  private resetCards(): void {
    const save = loadSave();
    saveGame({ ...save, unlockedCards: {}, levels: {} });
    this.setStatus("✓ 카드 초기화 — 재시작 후 적용");
  }

  private giveGold(): void {
    saveGame(addGold(loadSave(), 99999));
    this.setStatus("✓ 골드 +99999 지급 — 재시작 후 적용");
  }

  private applyMapSize(): void {
    const value = parseInt(this.mapInput.value, 10);
    if (isNaN(value) || value < 10 || value > 500) {
      this.setStatus("10~500 사이 값을 입력하세요");
      return;
    }
    this.app.mapSizeMeters = value;
    this.app.bypassMapLock = true;
    this.close();
    this.app.show("game");
  }

  dispose(): void {
    this.toggleBtn.remove();
    this.overlay.remove();
  }
}
