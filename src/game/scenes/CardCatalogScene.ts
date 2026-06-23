import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import {
  CARD_CATEGORIES,
  CARD_CATEGORY_LABELS_EN,
  CARD_CATEGORY_LABELS_KO,
  CARD_EFFECT_KINDS,
  CARD_TIERS,
  CARDS,
  compareCardsForCatalog,
  filterCards,
  type CardCatalogFilters,
  type CardCategory,
  type CardEffect,
  type CardNode,
} from "../config/cards";
import { clearElement, createButton } from "../ui/Menu";
import {
  CARD_DETAIL_LONG_PRESS_MS,
  CARD_DETAIL_TAP_MOVE_PX,
  shouldOpenCardDetailFromClick,
  shouldOpenCardDetailFromLongPress,
} from "../ui/cardCatalogInteraction";

interface CardCatalogPress {
  pointerId: number;
  pointerType: string;
  card: CardNode;
  x: number;
  y: number;
  moved: boolean;
  longFired: boolean;
  startedAt: number;
  timer: number;
}

function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function formatAmount(amount?: number): string {
  if (amount === undefined) {
    return "";
  }
  return amount > 0 ? `+${amount}` : `${amount}`;
}

function effectLabel(effect: CardEffect): string {
  switch (effect.kind) {
    case "summon":
      return `${effect.ability}.${effect.stat} ${formatAmount(effect.amount)}`;
    case "special":
      return `special:${effect.id}`;
    case "toolUnlock":
      return `tool:${effect.tool}`;
    case "unlockMap":
      return `map:${effect.mapSize}m`;
    case "obstacleSurvey":
      return `obstacle:${effect.obstacle}`;
    case "stumpNoCollision":
      return "stumpNoCollision";
    default:
      return `${effect.kind} ${formatAmount(effect.amount)}`.trim();
  }
}

function cardName(card: CardNode, language: "ko" | "en"): string {
  return language === "ko" ? card.nameKo : card.nameEn;
}

function cardDescription(card: CardNode, language: "ko" | "en"): string {
  return language === "ko" ? card.descriptionKo : card.descriptionEn;
}

export class CardCatalogScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private readonly filters: CardCatalogFilters = { category: "all", tier: "all", effectKind: "all", search: "" };
  private filtersOpen = false;
  private selectedId = "";
  private press: CardCatalogPress | null = null;

  private tableBody!: HTMLTableSectionElement;
  private countLabel!: HTMLElement;
  private filterDrawer!: HTMLElement;
  private filterButton!: HTMLButtonElement;
  private detailOverlay!: HTMLDivElement;

  constructor(private readonly app: App) {
    this.scene.background = new THREE.Color("#102018");
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
    this.clearPress();
    this.layer.remove();
    clearElement(this.layer);
  }

  private addWorld(): void {
    this.scene.add(new THREE.AmbientLight("#ffffff", 0.8));
    const sun = new THREE.DirectionalLight("#fff1c5", 1.4);
    sun.position.set(4, 7, 2);
    this.scene.add(sun);
  }

  private render(): void {
    this.clearPress();
    this.layer.remove();
    clearElement(this.layer);
    this.layer.className = "card-catalog-layer";

    const panel = document.createElement("div");
    panel.className = "card-catalog-panel";

    const header = document.createElement("header");
    header.className = "card-catalog-header";
    header.innerHTML = `
      <div class="card-catalog-title-wrap">
        <h2 class="panel-title">${this.app.language === "ko" ? "카드 목록" : "Card Catalog"}</h2>
        <strong class="card-count-label"></strong>
      </div>
    `;
    this.countLabel = header.querySelector(".card-count-label") as HTMLElement;

    const actions = document.createElement("div");
    actions.className = "card-catalog-actions";
    this.filterButton = createButton("☰", () => this.toggleFilters(), "secondary-button card-filter-menu-button");
    this.filterButton.title = this.app.language === "ko" ? "필터" : "Filters";
    this.filterButton.setAttribute("aria-label", this.app.language === "ko" ? "필터" : "Filters");
    this.filterButton.setAttribute("aria-expanded", "false");
    actions.append(
      this.filterButton,
      createButton(this.app.language === "ko" ? "업그레이드" : "Upgrades", () => this.app.show("upgradePrototype"), "secondary-button"),
      createButton(this.app.language === "ko" ? "메인 메뉴" : "Main Menu", () => this.app.show("menu"), "secondary-button"),
    );
    header.appendChild(actions);
    panel.appendChild(header);

    this.filterDrawer = this.buildFilters();
    this.filterDrawer.hidden = !this.filtersOpen;
    panel.appendChild(this.filterDrawer);

    const body = document.createElement("div");
    body.className = "card-catalog-body";

    const tableWrap = document.createElement("div");
    tableWrap.className = "card-table-wrap";
    const table = document.createElement("table");
    table.className = "card-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>${this.app.language === "ko" ? "티어" : "Tier"}</th>
          <th>${this.app.language === "ko" ? "분류" : "Category"}</th>
          <th>${this.app.language === "ko" ? "카드" : "Card"}</th>
          <th>${this.app.language === "ko" ? "비용" : "Cost"}</th>
          <th>${this.app.language === "ko" ? "효과" : "Effect"}</th>
          <th>${this.app.language === "ko" ? "선행" : "Prereq"}</th>
        </tr>
      </thead>
    `;
    this.tableBody = document.createElement("tbody");
    table.appendChild(this.tableBody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);
    panel.appendChild(body);

    this.detailOverlay = this.buildDetailOverlay();
    this.layer.append(panel, this.detailOverlay);
    this.app.uiRoot.appendChild(this.layer);

    this.updateList();
  }

  private buildFilters(): HTMLElement {
    const controls = document.createElement("section");
    controls.className = "card-catalog-filters";

    const search = document.createElement("input");
    search.className = "card-search-input";
    search.type = "search";
    search.placeholder = this.app.language === "ko" ? "이름, id, 효과 검색" : "Search name, id, effect";
    search.value = String(this.filters.search ?? "");
    search.addEventListener("input", () => {
      this.filters.search = search.value;
      this.updateList();
    });

    const category = document.createElement("select");
    category.className = "card-filter-select";
    category.appendChild(option("all", this.app.language === "ko" ? "전체 분류" : "All Categories"));
    for (const id of CARD_CATEGORIES) {
      category.appendChild(option(id, this.categoryLabel(id)));
    }
    category.value = this.filters.category ?? "all";
    category.addEventListener("change", () => {
      this.filters.category = category.value as CardCategory | "all";
      this.updateList();
    });

    const tier = document.createElement("select");
    tier.className = "card-filter-select";
    tier.appendChild(option("all", this.app.language === "ko" ? "전체 티어" : "All Tiers"));
    for (const value of CARD_TIERS) {
      tier.appendChild(option(String(value), value === 0 ? "Tier 0" : `Tier ${value}`));
    }
    tier.value = String(this.filters.tier ?? "all");
    tier.addEventListener("change", () => {
      this.filters.tier = tier.value === "all" ? "all" : Number(tier.value);
      this.updateList();
    });

    const effect = document.createElement("select");
    effect.className = "card-filter-select";
    effect.appendChild(option("all", this.app.language === "ko" ? "전체 효과" : "All Effects"));
    for (const value of CARD_EFFECT_KINDS) {
      effect.appendChild(option(value, value));
    }
    effect.value = this.filters.effectKind ?? "all";
    effect.addEventListener("change", () => {
      this.filters.effectKind = effect.value;
      this.updateList();
    });

    const reset = createButton(this.app.language === "ko" ? "초기화" : "Reset", () => {
      this.filters.category = "all";
      this.filters.tier = "all";
      this.filters.effectKind = "all";
      this.filters.search = "";
      this.render();
    }, "secondary-button");

    controls.append(search, category, tier, effect, reset);
    return controls;
  }

  private buildDetailOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "card-detail-overlay";
    overlay.hidden = true;
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        this.hideDetail();
      }
    });
    return overlay;
  }

  private toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
    this.filterDrawer.hidden = !this.filtersOpen;
    this.filterButton.setAttribute("aria-expanded", String(this.filtersOpen));
  }

  private updateList(): void {
    const cards = filterCards(this.filters).sort(compareCardsForCatalog);

    this.countLabel.textContent = this.app.language === "ko"
      ? `${cards.length}/${CARDS.length}개`
      : `${cards.length}/${CARDS.length}`;

    if (this.selectedId && !cards.some((card) => card.id === this.selectedId)) {
      this.hideDetail();
    }

    this.tableBody.replaceChildren();
    let lastGroup = "";
    for (const card of cards) {
      const group = `${card.category}:${card.tier}`;
      if (group !== lastGroup) {
        const groupRow = document.createElement("tr");
        groupRow.className = "card-group-row";
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = `${this.categoryLabel(card.category)} / Tier ${card.tier}`;
        groupRow.appendChild(cell);
        this.tableBody.appendChild(groupRow);
        lastGroup = group;
      }

      const row = document.createElement("tr");
      row.className = card.id === this.selectedId ? "is-selected" : "";
      row.tabIndex = 0;
      row.innerHTML = `
        <td><span class="card-tier-badge">${card.tier}</span></td>
        <td><span class="card-category-badge category-${card.category}">${this.categoryLabel(card.category)}</span></td>
        <td><strong>${cardName(card, this.app.language)}</strong><small>${card.id}</small></td>
        <td><span class="card-cost">${card.cost}g</span></td>
        <td>${this.effectsSummary(card)}</td>
        <td>${card.prereq.length ? card.prereq.join(", ") : "-"}</td>
      `;
      this.attachRowEvents(row, card);
      this.tableBody.appendChild(row);
    }
  }

  private attachRowEvents(row: HTMLTableRowElement, card: CardNode): void {
    row.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      this.clearPress();
      this.press = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        card,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        longFired: false,
        startedAt: performance.now(),
        timer: window.setTimeout(() => {
          if (!this.press) {
            return;
          }
          const elapsed = performance.now() - this.press.startedAt;
          if (shouldOpenCardDetailFromLongPress(this.press.pointerType, elapsed, this.press.moved)) {
            this.press.longFired = true;
            this.showDetail(this.press.card);
          }
        }, CARD_DETAIL_LONG_PRESS_MS),
      };
    });

    row.addEventListener("pointermove", (event) => {
      if (!this.press || this.press.pointerId !== event.pointerId || this.press.moved) {
        return;
      }
      if (Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > CARD_DETAIL_TAP_MOVE_PX) {
        this.press.moved = true;
        window.clearTimeout(this.press.timer);
      }
    });

    row.addEventListener("pointerup", (event) => {
      if (!this.press || this.press.pointerId !== event.pointerId) {
        return;
      }
      const press = this.press;
      this.clearPress();
      if (press.longFired || press.moved) {
        return;
      }
      if (shouldOpenCardDetailFromClick(press.pointerType)) {
        this.showDetail(card);
      }
    });

    row.addEventListener("pointercancel", () => this.clearPress());
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.showDetail(card);
      }
    });
  }

  private clearPress(): void {
    if (this.press) {
      window.clearTimeout(this.press.timer);
      this.press = null;
    }
  }

  private showDetail(card: CardNode): void {
    this.selectedId = card.id;
    this.detailOverlay.hidden = false;
    this.detailOverlay.innerHTML = `
      <article class="card-detail-card">
        <button type="button" class="card-detail-close">${this.app.language === "ko" ? "닫기" : "Close"}</button>
        <span class="card-category-badge category-${card.category}">${this.categoryLabel(card.category)}</span>
        <h3>${cardName(card, this.app.language)}</h3>
        <p>${cardDescription(card, this.app.language)}</p>
        <dl>
          <div><dt>ID</dt><dd>${card.id}</dd></div>
          <div><dt>${this.app.language === "ko" ? "티어" : "Tier"}</dt><dd>${card.tier}</dd></div>
          <div><dt>${this.app.language === "ko" ? "비용" : "Cost"}</dt><dd>${card.cost}g</dd></div>
          <div><dt>${this.app.language === "ko" ? "가지" : "Branch"}</dt><dd>${card.branch}</dd></div>
          <div><dt>${this.app.language === "ko" ? "선행" : "Prereq"}</dt><dd>${card.prereq.length ? card.prereq.join(", ") : "-"}</dd></div>
          <div><dt>${this.app.language === "ko" ? "태그" : "Tags"}</dt><dd>${card.tags.join(", ")}</dd></div>
          <div><dt>${this.app.language === "ko" ? "효과" : "Effects"}</dt><dd>${this.effectsSummary(card)}</dd></div>
          <div><dt>${this.app.language === "ko" ? "트리 좌표" : "Tree Position"}</dt><dd>${card.layout.x}, ${card.layout.y}</dd></div>
        </dl>
      </article>
    `;
    this.detailOverlay.querySelector(".card-detail-close")?.addEventListener("click", () => this.hideDetail());
    this.updateList();
  }

  private hideDetail(): void {
    this.selectedId = "";
    if (this.detailOverlay) {
      this.detailOverlay.hidden = true;
      this.detailOverlay.replaceChildren();
    }
  }

  private categoryLabel(category: CardCategory): string {
    return this.app.language === "ko" ? CARD_CATEGORY_LABELS_KO[category] : CARD_CATEGORY_LABELS_EN[category];
  }

  private effectsSummary(card: CardNode): string {
    if (this.app.language === "ko") {
      return card.descriptionKo || "연결 카드";
    }
    return card.effects.length > 0 ? card.effects.map(effectLabel).join(", ") : "Connector";
  }
}
