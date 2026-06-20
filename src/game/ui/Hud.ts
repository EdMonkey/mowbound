import type { SkillNode } from "../config/skillTree";
import { skillName, type Language } from "../i18n";
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
  private readonly resultTimers: number[] = [];
  private readonly resultFrames: number[] = [];
  private resultOverlay?: HTMLDivElement;

  constructor(private readonly parent: HTMLElement, private readonly language: Language) {
    this.element.className = "hud-layer";
    this.parent.appendChild(this.element);

    const top = document.createElement("div");
    top.className = "hud-top";
    this.element.appendChild(top);

    const fields = [
      ["time", language === "ko" ? "시간" : "Time"],
      ["roundGold", language === "ko" ? "런 골드" : "Run Gold"],
      ["totalGold", language === "ko" ? "보유" : "Total"],
      ["damage", language === "ko" ? "피해" : "Damage"],
      ["speed", language === "ko" ? "속도" : "Rate"],
      ["range", language === "ko" ? "범위" : "Range"],
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

  showResult(
    roundGold: number,
    callbacks: ResultCallbacks,
    summary?: RunSummary,
    goals: SkillNode[] = [],
    snapshotUrl?: string,
  ): void {
    this.clearResultAnimations();
    this.resultOverlay?.remove();

    const overlay = document.createElement("div");
    overlay.className = "result-overlay";

    const panel = document.createElement("div");
    panel.className = `result-panel${snapshotUrl ? " has-snapshot" : ""}`;
    panel.innerHTML = `
      <h2 class="panel-title">${this.language === "ko" ? "라운드 완료" : "Run Complete"}</h2>
      <p class="panel-copy">${this.language === "ko" ? "획득 골드" : "Earned"} <strong>${roundGold}</strong>${this.language === "ko" ? "" : " gold"}.</p>
    `;

    const detailsRoot = document.createElement("div");
    detailsRoot.className = "result-details";
    const appendRoot: HTMLElement = snapshotUrl ? detailsRoot : panel;

    if (snapshotUrl) {
      const content = document.createElement("div");
      content.className = "result-content";

      const figure = document.createElement("figure");
      figure.className = "result-snapshot";

      const image = document.createElement("img");
      image.src = snapshotUrl;
      image.alt = this.language === "ko" ? "라운드 종료 화면" : "End-of-run field snapshot";
      figure.appendChild(image);

      const caption = document.createElement("figcaption");
      caption.textContent = this.language === "ko" ? "라운드 종료 순간" : "End of run";
      figure.appendChild(caption);

      content.append(figure, detailsRoot);
      panel.appendChild(content);
    }

    if (summary) {
      const breakdown = document.createElement("div");
      breakdown.className = "result-breakdown is-score-reveal";
      const rows = [
        [this.language === "ko" ? "풀" : "Grass", summary.score.breakdown.grass],
        [this.language === "ko" ? "깔끔한 줄" : "Clean Rows", summary.score.breakdown.cleanRows],
        [this.language === "ko" ? "장애물" : "Obstacles", summary.score.breakdown.obstacles],
        [this.language === "ko" ? "폭탄 연쇄" : "Bomb Chains", summary.score.breakdown.bombChains],
        [this.language === "ko" ? "클리어 보너스" : "Clear Bonus", summary.score.breakdown.clearBonus],
        [this.language === "ko" ? "총점" : "Total Score", summary.score.totalScore],
      ] as const;

      const rowDelayMs = 140;
      for (let index = 0; index < rows.length; index += 1) {
        const [label, value] = rows[index];
        const isTotal = index === rows.length - 1;
        const delayMs = 180 + index * rowDelayMs;
        const row = document.createElement("div");
        row.className = `result-breakdown-row result-score-row${isTotal ? " is-total-score" : ""}`;
        row.style.setProperty("--score-delay", `${delayMs}ms`);

        const labelElement = document.createElement("span");
        labelElement.textContent = label;
        row.appendChild(labelElement);

        const valueElement = document.createElement("strong");
        valueElement.className = "result-score-value";
        valueElement.textContent = "0";
        row.appendChild(valueElement);

        breakdown.appendChild(row);
        this.animateResultValue(valueElement, Math.floor(value), delayMs + 120, isTotal ? 620 : 420, isTotal);
      }
      appendRoot.appendChild(breakdown);
    }

    if (goals.length > 0) {
      const next = document.createElement("div");
      next.className = "next-goals";
      next.innerHTML = `<h3>${this.language === "ko" ? "다음 목표" : "Next Goals"}</h3>`;
      for (const goal of goals) {
        const row = document.createElement("div");
        row.className = "result-breakdown-row";
        row.innerHTML = `<span>${skillName(goal, this.language)}</span><strong>${goal.cost}g</strong>`;
        next.appendChild(row);
      }
      appendRoot.appendChild(next);
    }

    if (summary) {
      const milestones = document.createElement("div");
      milestones.className = "next-goals";
      milestones.innerHTML = `<h3>${this.language === "ko" ? "마일스톤" : "Milestones"}</h3>`;
      const clear = Math.floor(summary.clearPercent);
      const rows = [
        [this.language === "ko" ? "폭탄" : "Bombs", `${Math.min(clear, 15)}/15%`],
        [this.language === "ko" ? "넓은 밭 계약" : "Open Acre", `${Math.min(clear, 30)}/30%`],
      ] as const;
      for (const [label, value] of rows) {
        const row = document.createElement("div");
        row.className = "milestone-row";
        row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
        milestones.appendChild(row);
      }
      appendRoot.appendChild(milestones);
    }

    const stack = document.createElement("div");
    stack.className = "button-stack";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = this.language === "ko" ? "다시 하기" : "Retry";
    retry.addEventListener("click", callbacks.onRetry);
    stack.appendChild(retry);

    const skills = document.createElement("button");
    skills.type = "button";
    skills.className = "secondary-button";
    skills.textContent = this.language === "ko" ? "스킬 트리" : "Skill Tree";
    skills.addEventListener("click", callbacks.onSkills);
    stack.appendChild(skills);

    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "secondary-button";
    menu.textContent = this.language === "ko" ? "메인 메뉴" : "Main Menu";
    menu.addEventListener("click", callbacks.onMenu);
    stack.appendChild(menu);

    appendRoot.appendChild(stack);
    overlay.appendChild(panel);
    this.element.appendChild(overlay);
    this.resultOverlay = overlay;
  }

  private animateResultValue(
    element: HTMLElement,
    target: number,
    delayMs: number,
    durationMs: number,
    boom = false,
  ): void {
    const finalValue = Math.floor(target);
    const reducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      element.textContent = `${finalValue}`;
      return;
    }

    element.textContent = "0";
    const timer = window.setTimeout(() => {
      const start = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs);
        const eased = 1 - (1 - progress) ** 3;
        element.textContent = `${Math.floor(finalValue * eased)}`;

        if (progress < 1) {
          this.resultFrames.push(window.requestAnimationFrame(step));
          return;
        }

        element.textContent = `${finalValue}`;
        if (boom) {
          element.classList.add("score-value-boom");
        }
      };

      this.resultFrames.push(window.requestAnimationFrame(step));
    }, delayMs);

    this.resultTimers.push(timer);
  }

  private clearResultAnimations(): void {
    for (const timer of this.resultTimers) {
      window.clearTimeout(timer);
    }
    this.resultTimers.length = 0;

    for (const frame of this.resultFrames) {
      window.cancelAnimationFrame(frame);
    }
    this.resultFrames.length = 0;
  }

  dispose(): void {
    this.clearResultAnimations();
    this.element.remove();
  }
}
