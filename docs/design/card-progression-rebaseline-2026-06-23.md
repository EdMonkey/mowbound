# Card Progression Rebaseline - 2026-06-23

Task 8 rebaseline keeps `cards.json` as the upgrade source of truth and validates progression through `unlockedCards`.

60-minute demo route gates:

- Unlock count: 39 / 138 cards.
- Lower gate: greater than 26 cards.
- Upper gate: less than 45 cards.
- Special experience gate: at least one card from `CARDS.filter(card => card.category === "ability" || card.branch === "spectacle")`.
- Full-tree gate: route must not complete all cards.

No card cost changes were needed. The current route reaches summon/ability cards through `summon_codex`, `seed_bombs`, and early summon chains within the target window while leaving late-game cards locked.
