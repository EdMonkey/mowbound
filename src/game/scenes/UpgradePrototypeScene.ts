import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import { createButton } from "../ui/Menu";

interface PrototypeCard {
  id: string;
  label: string;
  title: string;
  description: string;
}

const ROOT_CARD: PrototypeCard = {
  id: "rusty_scythe",
  label: "시작",
  title: "녹슨 낫 갈기",
  description: "오래 묵은 날을 갈아 첫 업그레이드 가지를 엽니다.",
};

const BRANCH_CARDS: PrototypeCard[] = [
  {
    id: "equipment_branch",
    label: "장비",
    title: "튼튼한 손잡이",
    description: "낫, 큰낫, 예초기, 트랙터처럼 플레이 방식을 바꾸는 장비 계열입니다.",
  },
  {
    id: "harvest_branch",
    label: "수확",
    title: "수확 장부",
    description: "골드, 깔끔한 잔디 보너스, 이동 효율, 플레이타임을 키우는 수확 계열입니다.",
  },
  {
    id: "environment_branch",
    label: "환경",
    title: "밭 가장자리 살피기",
    description: "신규 풀, 돌, 나무, 폭탄, 맵 확장처럼 새 목표를 여는 환경 계열입니다.",
  },
];

export class UpgradePrototypeScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly layer = document.createElement("div");
  private rootUnlocked = false;

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

  private render(): void {
    this.layer.remove();
    this.layer.replaceChildren();
    this.layer.className = "upgrade-prototype-layer";

    const panel = document.createElement("div");
    panel.className = "upgrade-prototype-panel";

    const header = document.createElement("header");
    header.className = "upgrade-prototype-header";
    header.innerHTML = `
      <div>
        <h2 class="panel-title">업그레이드 프로토타입</h2>
      </div>
    `;
    panel.appendChild(header);

    const tree = document.createElement("div");
    tree.className = `upgrade-prototype-tree${this.rootUnlocked ? " is-open" : ""}`;
    tree.appendChild(this.buildRootCard());

    const branches = document.createElement("div");
    branches.className = "upgrade-prototype-branches";
    for (const card of BRANCH_CARDS) {
      branches.appendChild(this.buildBranchCard(card));
    }
    tree.appendChild(branches);

    panel.appendChild(tree);

    const actions = document.createElement("div");
    actions.className = "skill-actions";
    actions.append(
      createButton("메인 메뉴", () => this.app.show("menu"), "secondary-button"),
    );
    panel.appendChild(actions);

    this.layer.appendChild(panel);
    this.app.uiRoot.appendChild(this.layer);
  }

  private buildRootCard(): HTMLDivElement {
    const card = document.createElement("div");
    card.className = `upgrade-prototype-card upgrade-prototype-root${this.rootUnlocked ? " is-unlocked" : " is-locked"}`;
    card.innerHTML = `
      <span class="upgrade-prototype-label">${ROOT_CARD.label}</span>
      <h3>${ROOT_CARD.title}</h3>
      <p>${ROOT_CARD.description}</p>
    `;

    const button = createButton(
      this.rootUnlocked ? "해금됨" : "잠금 해제",
      () => {
        if (this.rootUnlocked) {
          return;
        }
        this.rootUnlocked = true;
        this.render();
      },
      this.rootUnlocked ? "secondary-button" : "",
    );
    button.disabled = this.rootUnlocked;
    card.appendChild(button);
    return card;
  }

  private buildBranchCard(cardData: PrototypeCard): HTMLDivElement {
    const card = document.createElement("div");
    card.className = "upgrade-prototype-card upgrade-prototype-branch";
    card.innerHTML = `
      <span class="upgrade-prototype-label">${cardData.label}</span>
      <h3>${cardData.title}</h3>
      <p>${cardData.description}</p>
      <span class="upgrade-prototype-state">다음 단계 준비 중</span>
    `;
    return card;
  }
}
