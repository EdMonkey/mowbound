# How To Destroy A City 업그레이드/경제 분석

작성일: 2026-06-19 KST
대상 프로젝트: Mowbound

## 범위

이 문서는 `How To Destroy A City`의 공개 자료를 모으고, 현재 Mowbound의 경제/스킬 코드와 비교한 뒤, Mowbound에 맞는 새 업그레이드 트리와 골드 곡선 방향을 제안한다.

중요 제약: `How To Destroy A City`의 정확한 비용/수익 수치는 공개 자료가 부족하다. 따라서 수치 곡선을 그대로 복제하지 않고, 확인된 진행 구조와 설계 패턴만 참고한다.

## 출처

공식:

- Steam 상점: https://store.steampowered.com/app/4386090/How_To_Destroy_A_City/

메타데이터 / 제3자:

- SteamDB 게임 페이지: https://steamdb.info/app/4386090/info/
- SteamDB 데모 페이지: https://steamdb.info/app/4478600/info/
- Steam 데모 리뷰 API: https://store.steampowered.com/appreviews/4478600?json=1&language=all&filter=recent&purchase_type=all&num_per_page=20

커뮤니티 / 영상:

- Reddit 개발자 글: https://www.reddit.com/r/incremental_games/comments/1u2805h/how_to_destroy_a_city_an_incremental_game/
- Sronmar 플레이 영상: https://www.youtube.com/watch?v=SnD2GYIXCbc
- 리키리킹 플레이 영상: https://www.youtube.com/watch?v=yfM-ScFFCnw
- 수개 SUGAE 플레이 영상: https://www.youtube.com/watch?v=V8ttkefpUJU
- DHP 노코멘트 데모 영상: https://www.youtube.com/watch?v=cV3Yao__WZw
- Studio LEF 공식 트레일러: https://www.youtube.com/watch?v=T7naSKy5Wzg
- Studio LEF 데모 트레일러: https://www.youtube.com/watch?v=tpOgXa6qs4M

보조 출처는 약했다. SteamDB, SteamPeek, GG.deals, PCGamingWiki, SteamHunters는 앱 메타데이터 외에 진행/업그레이드 정보를 거의 제공하지 않았다.

## 에이전트 교차 검증

서브 에이전트 4개가 역할을 나눠 조사했다.

- 공식 자료 에이전트: Steam 상점 사실 + SteamDB 메타데이터 확인. Steam 상점 주장은 신뢰도 높음, SteamDB는 중간, 비용 데이터 부재는 낮음.
- 영상 에이전트: 여러 플레이 영상을 찾음. 영상 존재는 신뢰도 높음. 프레임 단위 비용/골드 분석은 완료하지 못했으므로 영상 기반 수치 주장은 제외.
- 보조 출처 에이전트: 위키/기사/커뮤니티 정보가 희소함. 신뢰할 만한 외부 비용 곡선 없음.
- 로컬 코드 에이전트: Mowbound의 현재 경제/스킬 구조를 소스 코드 기준으로 확인.

종합 결론: `How To Destroy A City`는 진행 구조, 업그레이드 카테고리, 커뮤니티 피드백 리스크를 참고하기 좋다. 하지만 숫자 비용식을 도출하기에는 공개 자료가 부족하다.

## How To Destroy A City: 확인된 루프

공식 확인:

- 제한 시간 안에 거대 로봇을 조종해 도시를 파괴한다.
- 보상 기준은 발생시킨 사상자 수에 비례한다.
- 메타 루프는 도시 파괴 -> 보상 획득 -> 업그레이드 트리 투자 -> 다음 런 강화다.
- 공식 상점은 300개 이상의 업그레이드를 언급한다.
- 업그레이드 구조는 트리 형태다.
- 공식 설명의 업그레이드 효과 예시는 로봇 크기, 속도, 힘/파괴력 강화다.
- 특수무기는 지진, 번개, 미사일, 파괴 광선이 언급된다.
- 도시를 완전히 파괴하고 실력을 증명하면 새 로봇을 얻는다.
- 로봇이 강해질수록 적도 강하게 반격한다.
- 적 유형은 헬기, 전투기, 공중 전함이다.
- 방어/대응 업그레이드로 두꺼운 장갑, 요격 미사일이 언급된다.

SteamDB 메타데이터:

- 데모 앱이 존재한다.
- 데모 출시일은 SteamDB 기준 2026-06-09 UTC다.
- 조사 시점에 SteamDB 데모 페이지는 리뷰 20개, 80%를 표시했다.

미검증 미디어 관찰:

- 에이전트가 공식 미디어/스크린샷에서 사상자 배율 `+25%`, 결과 수치 등을 보고했지만 안정적인 스크린샷 ID나 타임코드를 확보하지 못했다.
- 이 수치들은 Mowbound 비용 튜닝에는 사용하지 않는다.

Reddit 개발자 코멘트:

- 개발자는 데모에 100개 이상의 업그레이드 노드가 있다고 말했다.
- 개발자는 `x2.75` 팝업이 기본 사상자 수의 2.75배를 보너스 사상자로 지급했다는 뜻이라고 설명했다.
- 개발자는 데모에서 다양한 스킬과 업그레이드를 짧은 시간 안에 경험시키기 위해 일부 업그레이드를 강하게 만들었다고 말했다.
- 초기 피드백에서 업그레이드 트리 탐색에 WASD가 필요하다는 지적이 있었고, 개발자는 WASD 트리 탐색을 패치했다고 말했다.
- 정식판에는 breaking news 이벤트가 예정되어 있으며, 랜드마크 파괴가 뉴스 세그먼트와 임시 버프를 줄 수 있다고 말했다.

커뮤니티 관찰:

- 일부 유저는 가격이 너무 가파르면 분기형 트리가 사실상 강제 선형 루트가 된다고 지적했다.
- 이것은 Mowbound 스킬트리 개편에서 특히 피해야 할 리스크다.

Steam 데모 리뷰 API 스냅샷:

- 2026-06-19 KST 기준 Steam appreviews API를 조회했다.
- `query_summary`는 총 리뷰 21개, 긍정 21개, 부정 0개를 반환했다.
- 응답으로 받은 리뷰 11개에서 `playtime_at_review`는 17-72분 범위였고, 다수는 30-53분대였다.
- Reddit에서는 별도로 1.5시간 플레이했다는 유저도 있었다.
- 리뷰들은 의미 있는 업그레이드, 만족스러운 파괴감을 긍정적으로 언급했다.
- 반복 피드백은 사운드/피드백 명확성, 커서 가시성, 목표/결과 명확성이었다.
- 한 리뷰는 헬기 파괴 시 시간 증가가 원래 1.5초여야 하는데, 많은 업그레이드 후 20초가 지급되는 버그를 언급했다.

## HTDAC 업그레이드 구조 분석

공식 확인 업그레이드 계열:

- 기본 스탯: 크기, 속도, 힘/파괴력.
- 액티브/특수무기: 지진, 번개, 미사일, 광선.
- 방어/카운터플레이: 장갑, 요격 미사일.
- 메타 언락: 도시 완전 파괴 후 새 로봇.

개발자/커뮤니티 기반 계열:

- 경제 배율: 사상자 배율, 보너스 사상자.
- 콘텐츠 규모: 도시 크기, 건물 재생.
- 연쇄 반응: 폭발 건물, 폭발 반경.
- 이벤트/버프 계층: 랜드마크, 뉴스 이벤트, 임시 버프.

설계 교훈:

- 업그레이드는 즉시 체감되어야 한다. 여러 리뷰가 강한 업그레이드를 긍정적으로 봤다.
- 분기는 실제 선택이어야 한다. 가장 싼 루트만 계속 사게 되면 트리는 가짜가 된다.
- 숫자 변화는 `5 -> 8`처럼 읽기 쉬워야 한다.
- 후반에는 큰 장난감을 줘도 되지만, 초반 업그레이드는 마찰을 빠르게 제거해야 한다.

## HTDAC 경제 분석

확인됨:

- 보상은 사상자 수에 비례한다.
- 보너스 사상자 배율이 존재한다.
- 건물 파괴는 배율과 연쇄 반응을 만들 수 있다.
- 도시 완전 파괴는 새 로봇 언락으로 연결된다.

미확인:

- 정확한 화폐명.
- 업그레이드 노드 비용.
- 런당 골드.
- 비용 증가 공식.
- 런 길이.
- 건물별 보상값.

안전한 추론:

- HTDAC는 결과 점수를 spectacle이자 화폐 동력으로 사용한다.
- 좋은 런은 즉시 보상과 다음 언락 접근성을 함께 개선한다.
- 경제 업그레이드는 액션 수치만이 아니라 점수 산출층에도 영향을 준다.

복제 금지:

- 정확한 비용 수치. 신뢰 가능한 공개 데이터가 없다.
- 데모의 과한 업그레이드 파워. 개발자가 데모 밸런스는 짧은 체험을 위해 압축했다고 직접 말했다.

## 현재 Mowbound 경제

관련 파일:

- `src/game/systems/EconomySystem.ts`
- `src/game/config/balance.ts`
- `src/game/systems/SaveSystem.ts`
- `src/game/scenes/GameScene.ts`

현재 공식:

```ts
gold = goldPerGrass * floor(destroyedGrassCount)
```

현재 사실:

- 기본 `goldPerGrass = 1`.
- 골드는 라운드 종료 시에만 저장된다.
- 코인은 시각 효과다. 수집 로직은 없다.
- 장애물은 보상을 주지 않는다.
- 폭탄은 파괴한 잔디 수만큼만 보상한다.
- 저장 구조는 `totalGold + unlocked[]`다.
- 스킬 노드는 1회성 언락이며 최대 1개 효과를 가진다. 연결 노드는 `effect: null`이다.

현재 스킬 총비용: 534g.

최소 경로 비용:

- `dmg1`: 6g
- `dmg1 + dmg2`: 20g
- `field` 브랜치 진입: 124g
- `gold1`: 최소 152g
- `gold2`: 최소 200g

현재 리스크:

- `baseAttackArcDegrees = 360`인데 arc 업그레이드가 +15/+15를 더한다. 360도를 넘는 arc는 의미가 약하고 동작도 이상해질 수 있다.
- 경제 업그레이드가 combat/field 경로 깊숙이 잠겨 있다.
- 바위/나무 보상이 없어서 새 장애물 시스템이 경제적 재미보다 마찰로 느껴질 수 있다.
- 폭탄은 30x30 테스트 콘텐츠이며 스킬트리와 연결되어 있지 않다.
- 30x30은 잔디가 9배, 시간이 3배지만, 실제 처리량은 주로 공격/시간에 제한된다.
- `dense +60`은 맵 면적 스케일과 정사각 그리드 반올림을 거치므로 설명보다 실제 추가 잔디 수가 커질 수 있다.

## Mowbound 재설계 목표

1. 골드 곡선을 읽기 쉽게 만든다.
2. 첫 1-2런 안에 의미 있는 구매가 가능해야 한다.
3. 가짜 분기를 피한다.
4. 새 메커니즘을 경제 소스로 바꾼다: 바위, 나무, 폭탄, 체인, 맵 클리어.
5. 짧은 런 감각은 유지한다.
6. 모든 브랜치에 단순 스탯 증가가 아닌 "새 행동"을 최소 1개 넣는다.
7. 골드 가격만이 아니라 업적/마일스톤도 게이트로 사용한다.
8. 결정론적 시스템과 Vitest 테스트 가능성을 유지한다.

## 제안 경제 모델

순수 잔디 개수 보상에서 이벤트 기반 수확 점수로 바꾼다.

이벤트:

- `grassCut`: 기본 잔디 가치.
- `cleanPatch`: 짧은 시간에 밀집 잔디를 많이 베면 보너스.
- `obstacleBroken`: 바위/나무 파괴 보상.
- `bombChain`: 폭탄 체인 길이에 따른 보상.
- `mapClearPercent`: 라운드 종료 시 25/50/75/90/100% 클리어 보너스.
- `timeRemaining`: 충분히 강해진 뒤에만 작은 시간 보너스.

초기 변환안:

```txt
runScore = grassCut
         + cleanPatchBonus
         + obstacleValue
         + bombChainValue
         + clearBonus

goldEarned = floor(runScore / 4) * goldMultiplier
```

이유:

- 큰 수확 숫자를 화면에 보여줄 수 있다.
- 골드 비용은 관리 가능한 크기로 유지된다.
- 점수와 화폐를 따로 튜닝할 수 있다.
- 첫 런에 트리 절반을 사는 문제를 막는다.

목표 골드 페이싱:

| 단계 | 목표 런 수 | 예상 골드/런 | 업그레이드 비용대 | 새 체감 |
|---|---:|---:|---:|---|
| 시작 | 1-2 | 12-30g | 8-35g | 첫 원킬/범위/속도 선택 |
| 초반 | 3-8 | 30-80g | 35-120g | 실제 분기 선택, 첫 장애물 보상 |
| 중반 | 8-18 | 80-220g | 120-450g | 폭탄/체인/30m 준비 |
| 확장 | 18-35 | 220-700g | 450-1600g | 대형 맵, 도구 정체성, capstone |
| 장기 | 35+ | 700g+ | 1600g+ | 새 mower/프레스티지 후보 |

비용 곡선 규칙:

- 같은 티어 선택지의 비용은 대략 1.0x-1.6x 안에 둔다.
- 한 브랜치가 모든 형제 노드 구매를 강제하면 안 된다.
- 각 업그레이드는 좋은 런 1-3회 안에 회수되거나 새 메커니즘을 열어야 한다.
- 연결 노드는 싸거나 마일스톤 게이트여야 한다. 비싼 무효과 노드는 피한다.

## 제안 스킬트리 형태

허브형 트리 + 실제 병렬 브랜치를 사용한다.

Root:

- `First Sharpening`: 싼 첫 구매. 즉시 성장감 제공.
- Blade, Movement, Harvest Value 3개 브랜치를 동시에 연다.

Branch A: Bladecraft

- `Sharp Edge I`: damage +2. grass HP가 5라면 기본 잔디를 한 번에 벨 수 있게 한다.
- `Clean Sweep`: range +0.10m.
- `Fan Control`: 공격이 다시 부채꼴 설계로 돌아갈 때만 arc +25도. 현재 360도 원형을 유지한다면 제거한다.
- `Quick Recovery`: attack interval -100ms.
- `Heavy Edge`: 바위 파괴 threshold 달성.
- Capstone `Cyclone Cut`: N회 공격마다 짧은 광역 베기 또는 임시 360도 sweep.

Branch B: Movement/Time

- `Light Boots`: move speed +0.15.
- `Field Rhythm`: 10m 맵 +2초, 30m 맵에서는 낮게 스케일.
- `Cornering`: 나중에 이동 물리가 생기면 방향 전환 손실 감소.
- `Long Day`: 고정 초가 아니라 round duration +10%. 맵 스케일 공정성 유지.
- Capstone `Sprint Harvest`: 패치 클리어 후 짧은 속도 버프.

Branch C: Harvest Value

- `Market Cart`: 골드 변환율을 score/4에서 score/3.5로 개선.
- `Clean Rows`: 짧은 시간 안에 여러 잔디를 베면 보너스.
- `Coin Shine`: 코인/가치 피드백 강화. 코인 수집이 생기지 않는 한 실제 수집 로직은 넣지 않는다.
- `Bulk Buyer`: 라운드 종료 클리어율 보너스.
- Capstone `Golden Field`: 런 시작 후 첫 10초 동안 수확 가치 +X%.

Branch D: Obstacles

- 게이트: 첫 바위 파괴 또는 `Heavy Edge` 구매.
- `Stone Chips`: 바위가 score/gold를 준다.
- `Wood Haul`: 나무가 score/gold를 준다.
- `Stump Grinder`: 부러진 나무 stump를 추가 타격 또는 업그레이드로 통과 가능하게 한다.
- `No Recoil`: 실패한 장애물 타격 stun -25%.
- Capstone `Clearcut`: 장애물 파괴가 주변 잔디 절단 또는 debris 보너스를 유발한다.

Branch E: Bombs/Tools

- 게이트: 중반 도달 또는 10m 맵 50% 클리어.
- `Seed Bombs`: 10m 맵에도 낮은 개수의 폭탄이 스폰된다.
- `Fuse Training`: chain radius +0.4m.
- `Blast Control`: blast radius +0.25m.
- `Chain Payout`: chain length가 score 보너스를 준다.
- `Bomb Magnet`: 폭탄이 플레이어 쪽으로 약간 끌리거나 trigger가 쉬워진다.
- Capstone `Harvest Detonation`: 매 런 첫 폭탄은 더 큰 보상 burst를 보장한다.

Branch F: Land/Map Expansion

- `Open Acre`: 30m 맵을 기본 메뉴 선택이 아니라 마일스톤으로 연다. 현재는 30m가 기본 선택 가능하므로 메뉴 게이트 변경이 필요하다.
- `Dense Growth`: 잔디 증가. 단, 면적 스케일 후 실제 생성 수를 텍스트에 표시해야 한다.
- `Fertile Soil`: 잔디 가치 소폭 증가.
- `Landmarks`: 희귀 큰 목표물 또는 황금 잔디 군집.
- Capstone `New Plot`: 이후 새 맵 변형 언락.

Branch G: Tool Identity / New Mowers

- 게이트: 30m 마일스톤 클리어 또는 중반 트리 완료.
- `Wide Sickle`: 넓지만 느린 스타일.
- `Fast Sickle`: 빠르지만 작은 스타일.
- `Bomb Sickle`: 체인 중심 스타일.
- HTDAC의 "새 로봇"을 Mowbound식 "새 도구/새 낫/새 mower"로 번역한 구조다.

## 첫 개편 권장 노드 수

처음부터 300개를 만들지 않는다. 첫 구현은 35-45개 노드가 적절하다.

권장 초기 브랜치:

| 브랜치 | 노드 수 | 목적 |
|---|---:|---|
| Root | 2 | 첫 구매, 브랜치 오픈 |
| Blade | 8 | damage/range/cadence/rock threshold |
| Movement/Time | 6 | 이동, 맵 스케일 시간 |
| Harvest Value | 8 | score-to-gold, clear bonus, combo |
| Obstacles | 7 | 바위/나무를 보상 구조로 편입 |
| Bombs | 7 | 폭탄을 스킬트리 콘텐츠로 편입 |
| Map/Tools | 5 | 30m와 mower identity 언락 |

## 제안 비용대

정수 비용을 쓰되, 티어별 비용 밴드에서 생성한다.

| 티어 | 비용 범위 | 예상 획득 시점 |
|---|---:|---|
| T0 | 8-20g | 첫 1-2런 |
| T1 | 25-60g | 초반 브랜치 선택 |
| T2 | 70-160g | 장애물/폭탄 정체성 |
| T3 | 180-420g | 30m 준비와 경제 스케일링 |
| T4 | 500-1200g | mower/tool capstone |
| T5 | 1500g+ | 장기 목표 |

규칙: 구매 후 한 브랜치에 비현실적으로 비싼 노드만 남으면 안 된다. 항상 현실적인 다음 목표를 최소 2개 보여준다.

## 업그레이드 관계 규칙

좋은 관계:

- Damage가 바위 파괴를 연다.
- 바위가 장애물 경제를 연다.
- 장애물 경제가 폭탄 투자를 지원한다.
- 폭탄이 체인 경제를 연다.
- 체인 경제가 30m 맵을 지원한다.
- 30m 맵이 mower identity를 연다.

피해야 할 것:

- 골드 배율이 단일 필수 combat 경로 깊숙이 묻히는 구조.
- 비싼데 효과 없는 연결 노드.
- 기본 공격 arc가 이미 360도인데 arc를 더 올리는 업그레이드.
- 10m에서는 너무 강하고 30m에서는 약한 flat round duration 보너스.
- 스킬트리에서 보이지 않는 테스트 전용 메커니즘.

## 구현 방향

데이터 모델 변경:

```ts
interface SkillNodeV2 {
  id: string;
  name: string;
  branch: "blade" | "movement" | "value" | "obstacle" | "bomb" | "map" | "tool";
  maxLevel: number;
  costs: number[];
  prereq: string[];
  gates?: UnlockGate[];
  effects: SkillEffect[];
}
```

저장 구조 변경:

```ts
interface SaveDataV2 {
  schemaVersion: 2;
  gold: number;
  unlocked: string[];
  levels: Record<string, number>;
  lifetimeStats: {
    grassCut: number;
    rocksBroken: number;
    treesCut: number;
    bombsTriggered: number;
    bestClearPercentByMap: Record<string, number>;
  };
}
```

경제 변경:

- `EconomySystem`에 순수 함수 `scoreRun(events, stats)` 추가.
- 시각 효과 코인과 실제 화폐 로직을 분리 유지.
- 예상 gold/run 밴드를 테스트로 고정.
- `mowbound-save-v1`에서 v2 마이그레이션을 추가하거나, 의도적으로 새 key를 사용해 초기화한다.

UI 변경:

- 스킬 노드는 `old -> new` 형태로 수치 변화를 보여준다.
- 브랜치별 색/아이콘을 보여준다.
- unlock gate와 비용을 분리 표시한다.
- 결과 화면에 다음 구매 가능한 목표를 보여준다.
- 라운드 종료 시 `score`, `gold`, `bonus breakdown`을 보여준다.

## 테스트 계획

순수 테스트:

- 잔디/장애물/폭탄 이벤트별 골드 계산.
- score-to-gold 변환.
- 티어별 비용 총합.
- lifetime stats 기반 unlock gate.
- v1 -> v2 save migration.
- 맵 스케일 시간/경제.
- arc clamp 또는 fan 동작.

브라우저 / smoke:

- 스킬트리가 desktop/mobile에서 읽히는지.
- 결과 화면이 보상 breakdown을 설명하는지.
- 모바일 joystick 유지.
- 10m/30m 런 정상 종료.

## 최종 권장안

`How To Destroy A City`의 수치를 복제하지 않는다. 공개 숫자 데이터가 너무 부족하다.

가장 강한 패턴만 가져온다.

```txt
짧은 런 -> 보이는 점수 -> 화폐 지급 -> 의미 있는 업그레이드 -> 더 큰 대상/도구 -> 더 강한 방해 -> 새 장난감
```

Mowbound는 다음 축으로 재구성한다.

- 이벤트 기반 점수.
- 마일스톤 기반 브랜치 언락.
- 실제 병렬 브랜치.
- 장애물과 폭탄 경제.
- 맵/도구 identity 언락.
- 명확한 보상 breakdown.

첫 구현 목표는 v2 save/economy 모델과 35-45개 노드다. 이후 콘텐츠를 늘리기 전에 시뮬레이션 테스트로 gold/run 곡선을 먼저 고정한다.
