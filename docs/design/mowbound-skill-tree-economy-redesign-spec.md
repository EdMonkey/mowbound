# Mowbound 스킬트리/경제 리디자인 기획서

작성일: 2026-06-19 KST
기반 문서:

- `docs/research/how-to-destroy-a-city-upgrade-economy-analysis.md`
- 세 전문가 검토: 시니어 게임 디자이너, 시니어 게임 프로그래머, 시니어 게임 아티스트

## 최종 판단

1시간 분량 데모는 **조건부 가능**하다.

기존 기획의 방향은 맞다. 짧은 런, 점수/골드, 업그레이드, 새 메커니즘 언락 구조는 1시간 데모 뼈대가 된다.

보강해야 하는 조건:

- 폭탄/30m 해금 게이트를 낮춘다.
- 후반 capstone 비용을 올려 1시간 안에 트리가 너무 빨리 소진되지 않게 한다.
- Movement 브랜치도 메인 진행 루트가 되게 만든다.
- 새 낫 선택 UI와 시각 차이를 1시간 데모 범위에 넣는다.
- 외계 문양, 예초 광선, 트랙터를 후반 spectacle 스킬로 넣어 “숫자만 커지는 게임”을 피한다.
- 결과 화면에 score breakdown과 다음 목표를 보여준다.
- 스킬별 시각/오디오 피드백을 기획 범위에 포함한다.
- progression simulation 테스트로 1시간 페이싱을 검증한다.

## 1시간 데모 목표

플레이어가 60분 동안 경험해야 할 변화:

| 시간 | 목표 경험 | 주요 언락 | 기대 상태 |
|---|---|---|---|
| 0-5분 | 첫 성장, 잔디 1타 컷 | `root_sharpen`, `sharp_edge_1` | 초반 답답함 제거 |
| 5-15분 | 범위/속도/골드 선택 | Blade, Movement, Harvest 초반 | 실제 분기 선택 시작 |
| 15-25분 | 바위/나무가 보상원이 됨 | `stone_chips`, `wood_haul` | 장애물이 마찰에서 목표로 전환 |
| 25-35분 | 폭탄/체인 장난감 | `seed_bombs`, `chain_payout_1` | 광역 파괴 체감 |
| 35-45분 | 30m 맵 진입 | `open_acre` | 공간 확장, 목표 재설정 |
| 45-60분 | 새 낫/후반 spectacle 목표 | `alien_crop_mark`, `mower_laser`, `tractor_license` 중 1개 체험, 1-2개 목표 노출 | 화면을 바꾸는 후반 스킬 체감 |

## 현재 문제

- 보상 공식이 너무 단순하다: `gold = goldPerGrass * destroyedGrassCount`.
- 바위/나무는 마찰만 있고 보상이 없다.
- 폭탄은 30m 테스트 콘텐츠이며 스킬트리에 연결되어 있지 않다.
- 현재 코드의 base attack arc는 360도인데 기존 arc 업그레이드가 있다.
- 경제 업그레이드가 깊은 경로 뒤에 있어 초반 선택감이 약하다.
- 30m 맵이 기본 메뉴에서 바로 선택 가능해 장기 목표로 기능하지 않는다.
- 기존 50%/70% 클리어 게이트는 너무 높아 폭탄/30m 언락이 막힐 수 있다.
- 아트/오디오 피드백 계획이 없으면 40분 이후 “숫자만 커진 같은 게임”이 된다.

## 새 경제 구조

런 중에는 `score`를 쌓고, 라운드 종료 시 `score -> gold`로 변환한다.

기본 공식:

```txt
runScore = grassScore
         + cleanPatchScore
         + obstacleScore
         + bombChainScore
         + clearPercentScore
         + timeBonusScore

goldEarned = floor(runScore / goldDivisor) * goldMultiplier
```

초기값:

- `grassScore`: 잔디 1개당 1점.
- `goldDivisor`: 4.0.
- `goldMultiplier`: 1.0.
- `cleanPatchScore`: 3초 안에 40개 이상 베면 보너스.
- `obstacleScore`: 스킬 해금 전 0.
- `bombChainScore`: 스킬 해금 전 0.
- `clearPercentScore`: 5/10/20/35/50% 클리어 단계 보너스.
- 75/90/100% 클리어 보너스는 1시간 데모 후반 업적 또는 정식판용이다.

클리어 보너스:

| 클리어율 | 기본 점수 |
|---:|---:|
| 5% | 10 |
| 10% | 25 |
| 20% | 60 |
| 35% | 130 |
| 50% | 240 |

30m 맵 보상 제한:

- 30m는 잔디 수가 9배라 gold/run 폭증 위험이 있다.
- 30m에서는 clear bonus에 `largeMapBonusCap`을 둔다.
- 첫 30m 진입 구간의 gold/run 목표는 10m 후반의 1.8-2.4배 안에 둔다.

## 언락 규칙

- 모든 스킬은 골드 비용을 가진다.
- 일부 스킬은 골드 외에 마일스톤 게이트가 있다.
- 게이트는 “막는 벽”이 아니라 “다음 목표 안내”로 표시한다.
- Movement 브랜치도 30m 진입에 기여할 수 있어야 한다.
- 연결 노드는 비싼 무효과 노드로 만들지 않는다.

게이트 완화:

- `seed_bombs`: 10m 12-15% 클리어 또는 lifetime grass 500.
- `open_acre`: 10m 25-30% 클리어 또는 bomb chain 2+.
- `open_acre`는 Harvest 전용 병목이 아니다. `root_sharpen` 이후 게이트와 비용으로 통제한다.

## 스킬 종류 요약

브랜치:

- Root: 첫 성장.
- Bladecraft: damage, range, attack speed, obstacle threshold.
- Movement/Time: move speed, round duration, sprint.
- Harvest Value: score/gold conversion, clean patch, clear bonus.
- Obstacles: rocks/trees reward, stump, recoil.
- Bombs/Tools: bomb spawn, blast, chain payout.
- Land/Tools: 30m map, density, soil value, new sickle identities.
- Spectacle: alien crop mark, laser sweep, tractor mowing.

총 노드 수: 46개.

총 비용: 21,593g.

티어 분포:

| 티어 | 비용 범위 | 노드 수 | 총비용 |
|---|---:|---:|---:|
| T0 | 0-20g | 4 | 62g |
| T1 | 21-60g | 6 | 236g |
| T2 | 61-160g | 12 | 1,325g |
| T3 | 161-420g | 10 | 2,640g |
| T4 | 421-900g | 4 | 2,930g |
| T5 | 901-2000g | 9 | 12,200g |
| T6 | 2001-3000g | 1 | 2,200g |

## 전체 스킬 목록과 필요 골드

| 브랜치 | ID | 스킬명 | 필요 골드 | 선행/게이트 | 효과 |
|---|---|---|---:|---|---|
| Root | `root_sharpen` | 첫 날갈이 | 10g | 없음 | damage +1 |
| Blade | `sharp_edge_1` | 예리한 날 I | 18g | `root_sharpen` | damage +1. 기본 잔디 1타 컷 도달 |
| Blade | `sharp_edge_2` | 예리한 날 II | 60g | `sharp_edge_1` | damage +1. 장애물 파괴 가능 damage 6 도달 |
| Blade | `clean_sweep_1` | 깔끔한 반경 I | 28g | `root_sharpen` | attack range +0.10m |
| Blade | `clean_sweep_2` | 깔끔한 반경 II | 90g | `clean_sweep_1` | attack range +0.12m |
| Blade | `quick_recovery_1` | 빠른 회수 I | 35g | `root_sharpen` | attack interval -100ms |
| Blade | `quick_recovery_2` | 빠른 회수 II | 130g | `quick_recovery_1` | attack interval -100ms |
| Blade | `heavy_edge` | 묵직한 낫날 | 110g | `sharp_edge_2` | damage +1, obstacle damage +1 |
| Blade | `cyclone_cut` | 회오리 베기 | 1200g | `clean_sweep_2`, `quick_recovery_2` | 6번째 공격마다 0.85m 원형 베기 |
| Movement | `light_boots_1` | 가벼운 장화 I | 14g | `root_sharpen` | move speed +0.12 |
| Movement | `light_boots_2` | 가벼운 장화 II | 55g | `light_boots_1` | move speed +0.14 |
| Movement | `field_rhythm_1` | 밭 리듬 I | 32g | `root_sharpen` | round duration +8% |
| Movement | `field_rhythm_2` | 밭 리듬 II | 125g | `field_rhythm_1` | round duration +8% |
| Movement | `sprint_harvest` | 수확 질주 | 260g | `light_boots_2`, `clean_rows_1` | clean patch 후 2초간 speed +20% |
| Movement | `long_day` | 긴 하루 | 700g | `field_rhythm_2` | round duration +12% |
| Harvest | `market_cart_1` | 시장 수레 I | 20g | `root_sharpen` | gold divisor 4.0 -> 3.7 |
| Harvest | `market_cart_2` | 시장 수레 II | 80g | `market_cart_1` | gold divisor 3.7 -> 3.4 |
| Harvest | `clean_rows_1` | 반듯한 줄 I | 26g | `root_sharpen` | clean patch 보너스 +8 score |
| Harvest | `clean_rows_2` | 반듯한 줄 II | 110g | `clean_rows_1` | clean patch 보너스 +14 score |
| Harvest | `bulk_buyer_1` | 대량 납품 I | 75g | `market_cart_1` | clear percent 보너스 +10% |
| Harvest | `bulk_buyer_2` | 대량 납품 II | 210g | `bulk_buyer_1` | clear percent 보너스 +15% |
| Harvest | `golden_field` | 황금 들판 | 380g | `market_cart_2`, `clean_rows_2` | 런 시작 10초간 harvest score +25% |
| Harvest | `accountant` | 정산 장부 | 1200g | `bulk_buyer_2` | 최종 gold +10% |
| Obstacles | `stone_chips` | 돌 조각 판매 | 70g | `sharp_edge_2` | rock 파괴 시 +25 score |
| Obstacles | `wood_haul` | 목재 운반 | 95g | `sharp_edge_2` | tree 파괴 시 +40 score |
| Obstacles | `stump_grinder` | 그루터기 분쇄 | 160g | `wood_haul` | tree 파괴 후 stump가 충돌하지 않음 |
| Obstacles | `recoil_training` | 반동 훈련 | 120g | `stone_chips` | failed chop stun -25% |
| Obstacles | `quarry_blade` | 채석 낫날 | 240g | `stone_chips` | obstacle damage +2 |
| Obstacles | `clearcut` | 벌목 연쇄 | 360g | `wood_haul`, `clean_sweep_2` | obstacle 파괴 시 주변 grass 보너스 처리 |
| Obstacles | `lumberjack` | 벌목꾼 장부 | 1400g | `clearcut` | obstacle score +50% |
| Bombs | `seed_bombs` | 씨앗 폭탄 | 160g | `root_sharpen`, 10m 15% clear 또는 lifetime grass 500 | 10m 맵에 폭탄 3개 스폰 |
| Bombs | `fuse_training_1` | 도화선 훈련 I | 190g | `seed_bombs` | bomb chain radius +0.35m |
| Bombs | `blast_control_1` | 폭발 조율 I | 220g | `seed_bombs` | bomb blast radius +0.20m |
| Bombs | `chain_payout_1` | 연쇄 보상 I | 260g | `seed_bombs` | chain 추가 폭탄당 +30 score |
| Bombs | `fuse_training_2` | 도화선 훈련 II | 780g | `fuse_training_1` | bomb chain radius +0.35m |
| Bombs | `blast_control_2` | 폭발 조율 II | 850g | `blast_control_1` | bomb blast radius +0.25m |
| Bombs | `harvest_detonation` | 수확 폭발 | 1800g | `fuse_training_2`, `blast_control_2`, `chain_payout_1` | 매 런 첫 폭탄 score +50% |
| Land/Tools | `open_acre` | 넓은 밭 계약 | 600g | `root_sharpen`, 10m 30% clear 또는 bomb chain 2+ | 30m 맵 선택 해금 |
| Land/Tools | `dense_growth` | 우거진 성장 | 220g | `open_acre` | base grass +120. 실제 생성 수 UI 표시 |
| Land/Tools | `fertile_soil` | 비옥한 흙 | 300g | `open_acre` | grass score +10% |
| Land/Tools | `wide_sickle` | 넓은 낫 | 1200g | `open_acre`, `clean_sweep_2` | 선택형 도구. range +0.25m, interval +150ms |
| Land/Tools | `fast_sickle` | 빠른 낫 | 1200g | `open_acre`, `quick_recovery_2` | 선택형 도구. interval -150ms, range -0.05m |
| Land/Tools | `bomb_sickle` | 폭탄 낫 | 1500g | `open_acre`, `harvest_detonation` | 선택형 도구. bombs +2, chain payout +20% |
| Spectacle | `alien_crop_mark` | 외계 문양 낙인 | 1200g | `clean_sweep_2`, `chain_payout_1` | 12초마다 다음 공격 위치에 2.4m 문양 예고 후 0.4초 뒤 문양 안 잔디 절단 |
| Spectacle | `mower_laser` | 예초 광선 | 1500g | `sharp_edge_2`, `alien_crop_mark` | 8번째 공격마다 전방 6m, 폭 0.3m 광선 절단. 닿은 폭탄은 즉시 기폭 |
| Spectacle | `tractor_license` | 트랙터 면허 | 2200g | `open_acre`, `wide_sickle`, `long_day` | 선택형 도구. 이동 중 전방 1.2m 폭 지속 예초, 회전 반응 -15% |

## 전문가별 보강 사항

### 시니어 게임 디자이너 기준

수정:

- `seed_bombs` 게이트를 50%에서 15% 또는 lifetime grass 500으로 낮춘다.
- `open_acre` 게이트를 70%에서 30% 또는 bomb chain 2+로 낮춘다.
- `open_acre` 비용을 300g에서 600g로 올려 30m 진입을 중반 목표로 만든다.
- 후반 capstone 비용을 올려 60분 안에 전체 트리가 소진되지 않게 한다.
- Movement 브랜치가 막다른 보조가 되지 않도록 30m 진입 전 플레이 효율에 직접 기여하게 한다.
- `alien_crop_mark`, `mower_laser`, `tractor_license`는 후반 목표로 분리한다. 1시간 데모에서는 1개는 체험 가능, 나머지는 다음 목표로 보이게 한다.
- `alien_crop_mark`는 가장 먼저 구현한다. 화면 기억도가 높고, 기존 잔디 절단 시스템을 원형 판정으로 재사용할 수 있다.
- `mower_laser`는 방향 잡는 숙련도를 만든다. 폭/쿨타임을 제한해 범위 스킬과 폭탄 브랜치를 죽이지 않는다.
- `tractor_license`는 완전 차량 물리가 아니라 선택형 도구로 처리한다. 데모에서는 플레이어 모델/트레일/회전 감속으로 충분하다.

1시간 데모 목표:

- 60분에 전체 트리의 55-74% 정도만 완료.
- 남은 고비용 capstone과 새 낫이 다음 플레이 동기로 남아야 한다.

### 시니어 게임 프로그래머 기준

수정:

- `lifetimeStats` 저장과 갱신을 구현 범위에 포함한다.
- `RunSummary`와 `applyRunResultToSave()` 순수 함수를 추가한다.
- `cleanPatch` 검출 기준을 명시한다: 3초 안에 40개 이상 grass cut.
- `roundGold` 즉시 누적을 제거하고, 런 종료 시 이벤트 기반으로 계산한다.
- v2 save는 `mowbound-save-v2`를 쓰되 `mowbound-save-v1`을 읽어 마이그레이션한다.
- `SkillTreeScene`은 multi-prereq DAG를 지원한다.
- progression simulation 테스트를 구현 계획에 넣는다.

### 시니어 게임 아티스트 기준

수정:

- 스킬별 시각/오디오 피드백을 1차 범위에 포함한다.
- 결과 화면은 score waterfall로 보여준다.
- 새 낫은 반드시 월드 시각 차이를 가진다.
- 30m 맵은 단순 확대가 아니라 경계, 타일 변화, 랜드마크, 희귀 황금 잔디 군집이 필요하다.

핵심 VFX 대상:

- `sharp_edge_1`: 잔디 1타 컷 시 더 큰 clipping burst.
- `clean_sweep_1/2`: 공격 링 반경 확대, 흰색 trail.
- `quick_recovery_1/2`: 짧은 slash afterimage.
- `sprint_harvest`: 발밑 speed streak.
- `golden_field`: 첫 10초 황금 tint.
- `stone_chips`: 돌 파편과 무거운 hit spark.
- `wood_haul`: 나무 파편, falling log 강조.
- `stump_grinder`: stump 분쇄 dust.
- `seed_bombs`: 폭탄 스폰 shine.
- `blast_control_1/2`: shockwave ring 크기 증가.
- `open_acre`: 맵 확장 unlock splash.
- `wide_sickle`: 두꺼운 황금 trail.
- `fast_sickle`: 얇은 다중 slash trail.
- `bomb_sickle`: 붉은 fuse/spark trail.
- `alien_crop_mark`: 얇은 청록색 예고 문양, 0.4초 뒤 하늘 낙인 충격파.
- `mower_laser`: 전방 직선 광선, 잔디 절단 라인에 짧은 burn trail.
- `tractor_license`: 낮은 엔진 진동, 넓은 전방 절단 strip, 바퀴 자국 trail.

필수 SFX:

- swing
- grass cut
- coin pop
- rock hit/break
- tree fall
- bomb chain
- skill purchase
- map unlock
- tool switch
- alien stamp
- laser fire
- tractor hum

## Skill Visual Matrix

| 스킬 그룹 | 월드 변화 | VFX | SFX | UI/결과 라벨 |
|---|---|---|---|---|
| Blade | 절단력/범위/공격속도 변화 | attack ring, slash trail, clipping burst | swing, grass cut | Blade score |
| Movement | 이동속도/시간/질주 | foot streak, timer pulse | step rush, timer tick | Rhythm bonus |
| Harvest | 점수/골드 변환 | gold tint, coin sparkle | coin pop, purchase | Harvest value |
| Obstacles | 바위/나무 보상화 | chip burst, stump dust | rock thunk, wood crack | Obstacle score |
| Bombs | 폭탄/체인 | shockwave, chain pulse | explosion, fuse | Chain score |
| Land/Tools | 30m/새 낫 | unlock splash, tool trail | unlock, tool switch | New tool |
| Spectacle | 화면을 바꾸는 후반 스킬 | crop mark, laser beam, tractor strip | alien stamp, laser fire, tractor hum | Spectacle score |

## 결과 화면 요구

라운드 종료 화면에는 다음 순서로 보여준다.

```txt
Run Score
- Grass: 000
- Clean Rows: 000
- Obstacles: 000
- Bomb Chains: 000
- Clear Bonus: 000
- Multipliers: x0.00
= Gold: 000

Next Goals
- 스킬 A: 00g
- 스킬 B: 00g
- 스킬 C: 00g

Milestones
- Bombs: 10m clear 12/15%
- Open Acre: 10m clear 24/30%
```

## 구현 우선순위

1. 새 스킬 데이터와 save v2.
2. event-based economy.
3. `RunSummary`와 lifetime stats.
4. 스킬트리 UI가 새 데이터/게이트를 표시.
5. GameScene에서 점수 이벤트 기록.
6. 결과 화면 score waterfall.
7. 30m 메뉴 게이트.
8. 폭탄/장애물 보상 연결.
9. 새 낫 선택 UI와 도구 효과.
10. 외계 문양/예초 광선/트랙터 효과.
11. 핵심 VFX/SFX.
12. progression simulation test.

## 성공 기준

- 새 게임 기준 첫 2런 안에 1개 이상 업그레이드 가능.
- 10m 15% clear 또는 lifetime grass 500 전에는 폭탄 브랜치가 잠김.
- 10m 30% clear 또는 bomb chain 2+ 전에는 30m 맵이 잠김.
- 60분 시뮬레이션에서 전체 트리 완료율이 55-74% 범위.
- 60분 안에 spectacle 스킬 1개 이상 체험 가능.
- `alien_crop_mark`는 12초 주기 원형 절단으로 동작.
- `mower_laser`는 8번째 공격마다 전방 라인 절단과 폭탄 즉시 기폭이 동작.
- `tractor_license`는 선택형 도구이며 이동 중 전방 strip 절단이 동작.
- 바위/나무 파괴가 보상 breakdown에 표시됨.
- 폭탄 체인이 보상 breakdown에 표시됨.
- 새 낫 선택 UI가 있고, 도구별 플레이 스타일이 다름.
- `npm test`, `npm run build`, `npm run smoke`, 브라우저 확인 통과.
