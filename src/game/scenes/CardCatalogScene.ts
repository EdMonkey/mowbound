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
  private selectedId = CARDS[0]?.id ?? "";

  private tableBody!: HTMLTableSectionElement;
  private detail!: HTMLElement;
  private countLabel!: HTMLElement;

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
    this.layer.remove();
    clearElement(this.layer);
    this.layer.className = "card-catalog-layer";

    const panel = document.createElement("div");
    panel.className = "card-catalog-panel";

    const header = document.createElement("header");
    header.className = "card-catalog-header";
    header.innerHTML = `
      <div>
        <h2 class="panel-title">${this.app.language === "ko" ? "카드 목록" : "Card Catalog"}</h2>
        <p class="panel-copy">${this.app.language === "ko" ? "분류, 티어, 효과 기준으로 카드 데이터를 확인합니다." : "Inspect cards by category, tier, and effect."}</p>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "card-catalog-actions";
    actions.append(
      createButton(this.app.language === "ko" ? "업그레이드" : "Upgrades", () => this.app.show("upgradePrototype"), "secondary-button"),
      createButton(this.app.language === "ko" ? "메인 메뉴" : "Main Menu", () => this.app.show("menu"), "secondary-button"),
    );
    header.appendChild(actions);
    panel.appendChild(header);

    panel.appendChild(this.buildFilters());

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

    this.detail = document.createElement("aside");
    this.detail.className = "card-detail";

    body.append(tableWrap, this.detail);
    panel.appendChild(body);
    this.layer.appendChild(panel);
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

    this.countLabel = document.createElement("strong");
    this.countLabel.className = "card-count-label";

    controls.append(search, category, tier, effect, reset, this.countLabel);
    return controls;
  }

  private updateList(): void {
    const cards = filterCards(this.filters).sort(compareCardsForCatalog);

    this.countLabel.textContent = this.app.language === "ko"
      ? `${cards.length}/${CARDS.length}장`
      : `${cards.length}/${CARDS.length}`;

    if (!cards.some((card) => card.id === this.selectedId)) {
      this.selectedId = cards[0]?.id ?? CARDS[0]?.id ?? "";
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
      row.innerHTML = `
        <td><span class="card-tier-badge">${card.tier}</span></td>
        <td><span class="card-category-badge category-${card.category}">${this.categoryLabel(card.category)}</span></td>
        <td><strong>${cardName(card, this.app.language)}</strong><small>${card.id}</small></td>
        <td><span class="card-cost">${card.cost}g</span></td>
        <td>${this.effectsSummary(card)}</td>
        <td>${card.prereq.length ? card.prereq.join(", ") : "-"}</td>
      `;
      row.addEventListener("click", () => {
        this.selectedId = card.id;
        this.updateList();
      });
      this.tableBody.appendChild(row);
    }

    this.updateDetail();
  }

  private updateDetail(): void {
    const card = CARDS.find((item) => item.id === this.selectedId);
    if (!card) {
      this.detail.replaceChildren();
      return;
    }

    this.detail.innerHTML = `
      <span class="card-category-badge category-${card.category}">${this.categoryLabel(card.category)}</span>
      <h3>${cardName(card, this.app.language)}</h3>
      <p>${cardDescription(card, this.app.language)}</p>
      <dl>
        <div><dt>ID</dt><dd>${card.id}</dd></div>
        <div><dt>${this.app.language === "ko" ? "티어" : "Tier"}</dt><dd>${card.tier}</dd></div>
        <div><dt>${this.app.language === "ko" ? "비용" : "Cost"}</dt><dd>${card.cost}g</dd></div>
        <div><dt>${this.app.language === "ko" ? "브랜치" : "Branch"}</dt><dd>${card.branch}</dd></div>
        <div><dt>${this.app.language === "ko" ? "선행" : "Prereq"}</dt><dd>${card.prereq.length ? card.prereq.join(", ") : "-"}</dd></div>
        <div><dt>${this.app.language === "ko" ? "태그" : "Tags"}</dt><dd>${card.tags.join(", ")}</dd></div>
        <div><dt>${this.app.language === "ko" ? "효과" : "Effects"}</dt><dd>${this.effectsSummary(card)}</dd></div>
        <div><dt>${this.app.language === "ko" ? "트리 좌표" : "Tree Position"}</dt><dd>${card.layout.x}, ${card.layout.y}</dd></div>
      </dl>
    `;
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
