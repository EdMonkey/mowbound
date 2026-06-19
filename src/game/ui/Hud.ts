import type { SkillNode } from "../config/skillTree";
import type { RunSummary } from "../systems/RunSummarySystem";

interface DamageText {
  element: HTMLDivElement;
  x: number;
  y: number;
  age: number;
}

interface ResultCallbacks {
  onRetry: () => void;
  onSkills: () => void;
  onMenu: () => void;
}

export class Hud {
  readonly element = document.createElement("div");
  private readonly values = new Map<string, HTMLSpanElement>();
  private readonly damageTexts: DamageText[] = [];
  private resultOverlay?: HTMLDivElement;

  constructor(private readonly parent: HTMLElement) {
    this.element.className = "hud-layer";
    this.parent.appendChild(this.element);

    const top = document.createElement("div");
    top.className = "hud-top";
    this.element.appendChild(top);

    const fields = [
      ["time", "Time"],
      ["roundGold", "Run Gold"],
      ["totalGold", "Total"],
      ["damage", "Damage"],
      ["speed", "Rate"],
      ["range", "Range"],
    ] as const;

    for (const [id, label] of fields) {
      const chip = document.createElement("div");
      chip.className = "hud-chip";

      const labelElement = document.createElement("span");
      labelElement.className = "hud-label";
      labelElement.textContent = label;
      chip.appendChild(labelElement);

      const value = document.createElement("span");
      value.className = "hud-value";
      value.textContent = "-";
      chip.appendChild(value);

      this.values.set(id, value);
      top.appendChild(chip);
    }
  }

  updateGame(data: {
    timeMs: number;
    roundGold: number;
    totalGold: number;
    damage: number;
    attackIntervalMs: number;
    range: number;
  }): void {
    this.values.get("time")!.textContent = `${Math.max(0, data.timeMs / 1000).toFixed(1)}s`;
    this.values.get("roundGold")!.textContent = `${data.roundGold}`;
    this.values.get("totalGold")!.textContent = `${data.totalGold}`;
    this.values.get("damage")!.textContent = `${data.damage}`;
    this.values.get("speed")!.textContent = `${(1000 / data.attackIntervalMs).toFixed(1)}/s`;
    this.values.get("range")!.textContent = `${data.range.toFixed(2)}m`;
  }

  spawnDamageText(x: number, y: number, value: number): void {
    const element = document.createElement("div");
    element.className = "damage-text";
    element.textContent = `-${value}`;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    this.element.appendChild(element);
    this.damageTexts.push({ element, x, y, age: 0 });
  }

  update(deltaSeconds: number): void {
    for (let index = this.damageTexts.length - 1; index >= 0; index -= 1) {
      const text = this.damageTexts[index];
      text.age += deltaSeconds;
      const t = text.age / 0.7;
      text.element.style.opacity = `${Math.max(0, 1 - t)}`;
      text.element.style.transform = `translate(-50%, calc(-50% - ${t * 54}px)) scale(${1 + t * 0.75})`;

      if (t >= 1) {
        text.element.remove();
        this.damageTexts.splice(index, 1);
      }
    }
  }

  showResult(roundGold: number, callbacks: ResultCallbacks, summary?: RunSummary, goals: SkillNode[] = []): void {
    this.resultOverlay?.remove();

    const overlay = document.createElement("div");
    overlay.className = "result-overlay";

    const panel = document.createElement("div");
    panel.className = "result-panel";
    panel.innerHTML = `
      <h2 class="panel-title">Run Complete</h2>
      <p class="panel-copy">Earned <strong>${roundGold}</strong> gold.</p>
    `;

    if (summary) {
      const breakdown = document.createElement("div");
      breakdown.className = "result-breakdown";
      const rows = [
        ["Grass", summary.score.breakdown.grass],
        ["Clean Rows", summary.score.breakdown.cleanRows],
        ["Obstacles", summary.score.breakdown.obstacles],
        ["Bomb Chains", summary.score.breakdown.bombChains],
        ["Clear Bonus", summary.score.breakdown.clearBonus],
        ["Total Score", summary.score.totalScore],
      ] as const;

      for (const [label, value] of rows) {
        const row = document.createElement("div");
        row.className = "result-breakdown-row";
        row.innerHTML = `<span>${label}</span><strong>${Math.floor(value)}</strong>`;
        breakdown.appendChild(row);
      }
      panel.appendChild(breakdown);
    }

    if (goals.length > 0) {
      const next = document.createElement("div");
      next.className = "next-goals";
      next.innerHTML = "<h3>Next Goals</h3>";
      for (const goal of goals) {
        const row = document.createElement("div");
        row.className = "result-breakdown-row";
        row.innerHTML = `<span>${goal.name}</span><strong>${goal.cost}g</strong>`;
        next.appendChild(row);
      }
      panel.appendChild(next);
    }

    if (summary) {
      const milestones = document.createElement("div");
      milestones.className = "next-goals";
      milestones.innerHTML = "<h3>Milestones</h3>";
      const clear = Math.floor(summary.clearPercent);
      const rows = [
        ["Bombs", `${Math.min(clear, 15)}/15%`],
        ["Open Acre", `${Math.min(clear, 30)}/30%`],
      ] as const;
      for (const [label, value] of rows) {
        const row = document.createElement("div");
        row.className = "milestone-row";
        row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
        milestones.appendChild(row);
      }
      panel.appendChild(milestones);
    }

    const stack = document.createElement("div");
    stack.className = "button-stack";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", callbacks.onRetry);
    stack.appendChild(retry);

    const skills = document.createElement("button");
    skills.type = "button";
    skills.className = "secondary-button";
    skills.textContent = "Skill Tree";
    skills.addEventListener("click", callbacks.onSkills);
    stack.appendChild(skills);

    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "secondary-button";
    menu.textContent = "Main Menu";
    menu.addEventListener("click", callbacks.onMenu);
    stack.appendChild(menu);

    panel.appendChild(stack);
    overlay.appendChild(panel);
    this.element.appendChild(overlay);
    this.resultOverlay = overlay;
  }

  dispose(): void {
    this.element.remove();
  }
}
