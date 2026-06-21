# Mowbound — Claude Code Context

Top-down grass mowing game built with Three.js + TypeScript + Vite.

## Quick Commands

```bash
npm run dev          # 로컬 개발 서버 (http://localhost:5173)
npm run build        # 프로덕션 빌드 → dist/
npm test             # 유닛 테스트 (vitest)
npx tsc --noEmit     # 타입 체크만

./run-game.command         # Finder 더블클릭 또는 터미널 — 로컬 게임 실행
./deploy-viverse.command   # Finder 더블클릭 또는 터미널 — VIVERSE 배포
```

## VIVERSE 배포 정보

- **공유 링크 (현재 작동):** https://worlds.viverse.com/WuoBzDs?preview
- **정식 공개 URL:** https://worlds.viverse.com/WuoBzDs (studio.viverse.com에서 리뷰 제출 필요)
- **App ID:** `rpb875u9pr`
- **계정:** pikoloveme@gmail.com
- **CLI 경로:** `/opt/homebrew/lib/node_modules/@viverse/cli/bin/cli.js`
- 업데이트 배포: `./deploy-viverse.command` 실행

## 프로젝트 구조

```
src/game/
  config/
    balance.ts      — 모든 수치 상수 (BALANCE 객체)
    skillTree.ts    — SKILL_NODES 배열, SkillEffect 유니온 타입, SKILL_ROOT
  systems/
    SkillSystem.ts  — getRuntimeStats(), RuntimeStats 인터페이스
    SaveSystem.ts   — loadSave/saveGame, SaveData { levels: Record<string,number>, gold }
    FireSystem.ts   — tickFire(), tryIgniteGrass(), igniteGrassAround()
    GrassSystem.ts  — createGrassBatch(), createGrassState(), hpForKind()
    AttackSystem.ts — resolveAttack()
    InputSystem.ts  — 키보드 + 조이스틱 통합
  entities/
    GrassField.ts   — InstancedMesh 기반 풀 렌더링 (tint/fire/growth 애니메이션)
    Player.ts       — 플레이어 이동/공격
  scenes/
    GameScene.ts    — 메인 게임 루프
    SkillTreeScene.ts — 스킬 트리 UI
    MainMenuScene.ts  — 메인 메뉴
  i18n.ts           — 한/영 텍스트, effectText()
  types.ts          — GrassState, GrassKind, VectorXZ 등 공통 타입
  App.ts            — 씬 전환, 카메라, 렌더러
```

## 아키텍처 핵심 규칙

### 스킬 시스템
- `skillTree.ts`의 `SkillEffect`는 **discriminated union** — 새 효과 추가 시 반드시:
  1. `skillTree.ts` — union에 멤버 추가
  2. `SkillSystem.ts` — `applyRuntimeEffect()` switch에 케이스 추가, `RuntimeStats`/`RuntimeTotals`에 필드 추가
  3. `i18n.ts` — `effectText()` 한/영 switch에 케이스 추가
- `getRuntimeStats(save)` → `RuntimeStats` 반환 (base + 스킬 보너스 합산)
- `SaveData.levels` 는 `Record<string, number>` (노드 ID → 1 if unlocked)

### 스킬 노드 형식
```ts
{
  id: string, name: string, branch: SkillBranch, icon: string,
  cost: number, prereq: string[], gates: UnlockGate[],
  effects: SkillEffect[], description: string
}
```
- **`prereq: []` 금지** — 레이아웃 알고리즘이 `SKILL_ROOT("root_sharpen")`에서 DFS로 순회하므로 부모 없는 노드는 위치값이 undefined가 되어 SkillTreeScene이 crash함
- 새 브랜치 루트는 반드시 `prereq: ["root_sharpen"]` 이상으로 연결

### 풀 시스템 (GrassField)
- `GrassKind`: `"normal" | "tall" | "blue" | "timer"`
- `growthRatio`: 0(베임/재성장중) → 1(완전성장). 베인 뒤 자동 재성장
- `growthRatio < 0.15` → 공격 대상 제외
- `growthRatio < 0.5` → 불 점화 불가
- tall: HP×2, Y스케일×1.5, 노란빛 (`#c8d44a`)
- blue: 플레이어 이동속도 1/3 감속 (growthRatio > 0.5일 때), 청록 (`#4ab8d4`)
- timer: 베면 라운드 타이머 회복, 맵에 7개 고정, 밝은 초록 (`#3de84a`)

### 불 시스템 (FireSystem)
- **세대 감쇠**: `childDuration = sourceDuration * BALANCE.fireSpreadDurationMultiplier(0.65)`
- 약 5세대 후 `spreadMinDuration(0.6s)` 미만이 되어 자연 소멸 → 무한 번짐 방지
- 스킬 최대 투자 시에도 R₀ < 1 유지됨

## 현재 브랜치

`work/ukchoi` — main 머지 후 다음 기능 추가됨:
- 불 번짐 시스템 (FireSystem.ts) + 스킬 트리 노드 10개 (ember, burn1-3, spread1-3, kindle1-3)
- 풀 종류 시스템 (tall/blue/timer + 재성장) + 스킬 트리 노드 5개 (grasslore, bluefoot, timerboon, fastgrowth, tallbounty)

## 주의사항

- `npx tsc --noEmit` 항상 0 에러 유지
- 스킬 효과 추가 시 exhaustive switch 체크 — TypeScript가 누락 케이스 에러로 잡아줌
- `GrassField.destroy(id)` 는 인스턴스를 삭제하지 않고 `growthRatio=0`으로 재성장 트리거
- `SaveData.gold` 사용 (`totalGold` 아님)
