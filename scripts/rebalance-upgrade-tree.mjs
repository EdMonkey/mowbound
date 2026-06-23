import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsPath = path.resolve(__dirname, "../src/game/config/cards.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
validateUniqueIds();
const byId = new Map(cards.map((card) => [card.id, card]));
const assignedIds = new Set();

const STEP_Y = 220;
const LANE_ROW_START_Y = -330;
const LANE_ROW_STEP_Y = 220;

const x = {
  root: 0,
  equipmentMain: -620,
  equipmentLeft: -820,
  equipmentOuter: -1120,
  harvest: 0,
  harvestLeft: -160,
  harvestRight: 160,
  environmentMain: 620,
  environmentRight: 820,
  environmentOuter: 1120,
};

function layer(minute) {
  return -(minute / 5) * STEP_Y;
}

function requireCard(id) {
  const card = byId.get(id);
  if (!card) {
    throw new Error(`Missing card id: ${id}`);
  }
  return card;
}

function patch(id, update) {
  const card = requireCard(id);
  if (assignedIds.has(id)) {
    throw new Error(`Card assigned more than once: ${id}`);
  }
  assignedIds.add(id);
  Object.assign(card, update);
  if (update.layout) {
    card.layout = update.layout;
  }
}

function assignPath(ids, sortBase) {
  ids.forEach((id, index) => {
    patch(id, {
      sort: sortBase + index,
    });
  });
}

const exact = {
  root_sharpen: { tier: 0, cost: 10, prereq: [], layout: { x: x.root, y: layer(0) }, sort: 0 },

  clean_rows_1: { tier: 1, cost: 34, prereq: ["root_sharpen"], layout: { x: x.harvest, y: layer(5) }, sort: 100 },
  ember: { tier: 2, cost: 90, prereq: ["sharp_edge_1"], layout: { x: x.equipmentMain, y: layer(10) }, sort: 200 },
  survey_rock: { tier: 2, cost: 130, prereq: ["root_sharpen"], layout: { x: x.environmentMain, y: layer(10) }, sort: 201 },
  seed_bombs: { tier: 3, cost: 220, prereq: ["survey_rock"], layout: { x: x.environmentOuter, y: layer(15) }, sort: 300 },
  golden_field: { tier: 4, cost: 420, prereq: ["market_cart_2", "clean_rows_2"], layout: { x: x.harvest, y: layer(20) }, sort: 400 },
  survey_tree: { tier: 4, cost: 360, prereq: ["survey_rock"], layout: { x: x.environmentMain, y: layer(20) }, sort: 401 },
  open_acre: { tier: 5, cost: 420, prereq: ["wide_lands_1"], layout: { x: x.environmentMain, y: layer(25) }, sort: 500 },
  wide_sickle: { tier: 6, cost: 600, prereq: ["open_acre", "clean_sweep_2"], layout: { x: x.equipmentMain - 120, y: layer(30) }, sort: 600 },
  fast_sickle: { tier: 6, cost: 600, prereq: ["open_acre", "quick_recovery_2"], layout: { x: x.equipmentMain + 120, y: layer(30) }, sort: 601 },
  alien_crop_mark: { tier: 7, cost: 1300, prereq: ["seed_bombs", "chain_payout_1"], layout: { x: x.equipmentOuter, y: layer(35) }, sort: 700 },
  tractor_license: { tier: 8, cost: 1900, prereq: ["open_acre", "wide_sickle", "long_day"], layout: { x: x.equipmentOuter, y: layer(40) }, sort: 800 },
  mower_laser: { tier: 9, cost: 1700, prereq: ["alien_crop_mark", "sharp_edge_2"], layout: { x: x.equipmentOuter, y: layer(45) }, sort: 900 },
  summon_codex: { tier: 10, cost: 1600, prereq: ["mower_laser", "golden_field"], layout: { x: x.environmentOuter, y: layer(50) }, sort: 1000 },
  summon_drone: { tier: 10, cost: 2100, prereq: ["summon_codex"], layout: { x: x.environmentOuter + 170, y: layer(50) }, sort: 1001 },
  summon_lightning: { tier: 10, cost: 2200, prereq: ["summon_codex"], layout: { x: x.environmentOuter + 340, y: layer(50) }, sort: 1002 },
  summon_tornado: { tier: 11, cost: 3000, prereq: ["summon_codex"], layout: { x: x.environmentOuter + 520, y: layer(55) }, sort: 1100 },
  summon_tractor: { tier: 11, cost: 3200, prereq: ["tractor_license", "summon_codex"], layout: { x: x.equipmentOuter, y: layer(55) }, sort: 1101 },
};

for (const [id, update] of Object.entries(exact)) {
  patch(id, update);
}

const fixedLayoutIds = new Set(Object.keys(exact));

assignPath([
  "sharp_edge_1",
  "sharp_edge_2",
  "heavy_edge",
  "clean_sweep_1",
  "clean_sweep_2",
  "wide_arc_1",
  "wide_arc_2",
  "wide_arc_3",
  "grand_sweep_1",
  "grand_sweep_2",
  "quick_recovery_1",
  "quick_recovery_2",
], 110);

assignPath([
  "burn1",
  "spread1",
  "kindle1",
  "burn2",
  "spread2",
  "kindle2",
  "burn3",
  "spread3",
  "kindle3",
  "cyclone_cut",
], 230);

assignPath([
  "light_boots_1",
  "field_rhythm_1",
  "light_boots_2",
  "field_rhythm_2",
  "sprint_harvest",
  "long_day",
], 150);

assignPath([
  "market_cart_1",
  "market_cart_2",
  "clean_rows_2",
  "bulk_buyer_1",
  "bulk_buyer_2",
  "accountant",
], 220);

assignPath([
  "wide_lands_1",
  "wide_lands_2",
  "wide_lands_3",
  "wide_lands_4",
], 320);

assignPath([
  "dense_growth",
  "fertile_soil",
], 520);

assignPath([
  "grasslore",
  "bluefoot",
  "timerboon",
  "fastgrowth",
  "tallbounty",
  "grow_speed_1",
  "grow_speed_2",
  "grow_speed_3",
  "grow_speed_4",
  "grow_speed_5",
], 410);

assignPath([
  "stone_chips",
  "wood_haul",
  "stump_grinder",
  "recoil_training",
  "quarry_blade",
  "clearcut",
  "lumberjack",
  "field_churn_1",
  "field_churn_2",
  "boulder_lore_1",
  "boulder_lore_2",
], 430);

assignPath([
  "fuse_training_1",
  "blast_control_1",
  "chain_payout_1",
  "fuse_training_2",
  "blast_control_2",
  "harvest_detonation",
], 460);

assignPath([
  "bomb_sickle",
], 620);

assignPath([
  "summon_shadow",
  "shadow_count_2",
  "shadow_count_3",
  "shadow_dmg_1",
  "shadow_dmg_2",
  "shadow_dmg_3",
  "shadow_cd_1",
  "shadow_cd_2",
  "shadow_cd_3",
], 1200);

assignPath([
  "summon_scythe",
  "scythe_count_2",
  "scythe_count_3",
  "scythe_count_4",
  "scythe_count_5",
  "scythe_dmg_1",
  "scythe_dmg_2",
  "scythe_dmg_3",
  "scythe_radius_1",
  "scythe_radius_2",
  "scythe_spin_1",
  "scythe_spin_2",
], 1300);

assignPath([
  "summon_boomerang",
  "boom_count_2",
  "boom_count_3",
  "boom_dmg_1",
  "boom_dmg_2",
  "boom_range_1",
  "boom_range_2",
], 1400);

assignPath([
  "drone_count_2",
  "drone_radius_1",
  "drone_radius_2",
  "drone_dur_1",
  "drone_dur_2",
  "drone_dmg_1",
], 1500);

assignPath([
  "light_count_2",
  "light_count_3",
  "light_radius_1",
  "light_radius_2",
  "light_cd_1",
  "light_cd_2",
], 1600);

assignPath([
  "tractor_width_1",
  "tractor_width_2",
  "tractor_dmg_1",
  "tractor_dmg_2",
  "tractor_cd_1",
  "tractor_cd_2",
], 1700);

assignPath([
  "torn_size_1",
  "torn_size_2",
  "torn_dur_1",
  "torn_dur_2",
  "torn_dmg_1",
  "torn_dmg_2",
], 1800);

const laneGrids = {
  equipment: [-960, -810, -660, -510, -360],
  harvest: [-160, 0, 160],
  environment: [360, 510, 660, 810, 960],
  outerLeft: [-1760, -1600, -1440, -1280, -1120],
  outerRight: [1120, 1280, 1440, 1600, 1760],
};

function isOuterFruit(card) {
  return card.branch === "summon" || card.branch === "spectacle" || card.effects.some((effect) => effect.kind === "bombCount10m");
}

function outerLaneKey(card) {
  if (
    card.id.includes("scythe") ||
    card.id.includes("boom") ||
    card.id.includes("tractor") ||
    card.branch === "spectacle"
  ) {
    return "outerLeft";
  }
  return "outerRight";
}

function laneKey(card) {
  if (isOuterFruit(card)) {
    return outerLaneKey(card);
  }
  if (card.category === "equipment") {
    return "equipment";
  }
  if (card.category === "harvest") {
    return "harvest";
  }
  if (card.category === "environment") {
    return "environment";
  }
  if (card.category === "ability") {
    return "outerRight";
  }
  throw new Error(`No lane for card: ${card.id}`);
}

function applyLaneGridLayout() {
  const counts = Object.fromEntries(Object.keys(laneGrids).map((key) => [key, 0]));
  const movable = cards
    .filter((card) => !fixedLayoutIds.has(card.id))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));

  for (const card of movable) {
    const key = laneKey(card);
    const xs = laneGrids[key];
    const index = counts[key];
    const row = Math.floor(index / xs.length);
    const col = index % xs.length;
    card.layout = {
      x: xs[col],
      y: LANE_ROW_START_Y - row * LANE_ROW_STEP_Y,
    };
    counts[key] += 1;
  }
}

function validateUniqueIds() {
  const seen = new Set();
  const duplicates = [];
  for (const card of cards) {
    if (seen.has(card.id)) {
      duplicates.push(card.id);
    }
    seen.add(card.id);
  }
  if (duplicates.length > 0) {
    throw new Error(`Duplicate card ids: ${duplicates.join(", ")}`);
  }
}

function validateAssignments() {
  const missing = cards.filter((card) => !assignedIds.has(card.id)).map((card) => card.id);
  if (missing.length > 0) {
    throw new Error(`Cards without explicit rebalance assignment: ${missing.join(", ")}`);
  }
}

function validateSorts() {
  const invalid = cards.filter((card) => !Number.isFinite(card.sort)).map((card) => card.id);
  if (invalid.length > 0) {
    throw new Error(`Cards with invalid sort: ${invalid.join(", ")}`);
  }

  const bySort = new Map();
  const duplicates = [];
  for (const card of cards) {
    const existing = bySort.get(card.sort);
    if (existing) {
      duplicates.push(`${card.sort}: ${existing}/${card.id}`);
    }
    bySort.set(card.sort, card.id);
  }
  if (duplicates.length > 0) {
    throw new Error(`Duplicate card sorts: ${duplicates.join(", ")}`);
  }
}

function validateReachability() {
  const reachable = new Set(["root_sharpen"]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const card of cards) {
      if (reachable.has(card.id)) {
        continue;
      }
      if (card.prereq.every((id) => reachable.has(id))) {
        reachable.add(card.id);
        changed = true;
      }
    }
  }

  const unreachable = cards.filter((card) => !reachable.has(card.id)).map((card) => card.id);
  if (unreachable.length > 0) {
    throw new Error(`Cards unreachable from root_sharpen: ${unreachable.join(", ")}`);
  }
}

function validatePrereqSortOrder() {
  const inversions = [];
  for (const card of cards) {
    for (const prereq of card.prereq) {
      const parent = requireCard(prereq);
      if (card.sort < parent.sort) {
        inversions.push(`${card.id}(${card.sort}) before ${parent.id}(${parent.sort})`);
      }
    }
  }
  if (inversions.length > 0) {
    throw new Error(`Cards sorted before prerequisites: ${inversions.join(", ")}`);
  }
}

function validateLaneLayout() {
  const invalid = [];
  for (const card of cards) {
    if (card.id === "root_sharpen") {
      if (card.layout.x !== 0) {
        invalid.push(`${card.id}: root x ${card.layout.x}`);
      }
    } else if (isOuterFruit(card)) {
      if (Math.abs(card.layout.x) < 1050) {
        invalid.push(`${card.id}: outer x ${card.layout.x}`);
      }
    } else if (card.category === "equipment") {
      if (card.layout.x < -1000 || card.layout.x > -350) {
        invalid.push(`${card.id}: equipment x ${card.layout.x}`);
      }
    } else if (card.category === "harvest") {
      if (card.layout.x < -180 || card.layout.x > 220) {
        invalid.push(`${card.id}: harvest x ${card.layout.x}`);
      }
    } else if (card.category === "environment") {
      if (card.layout.x < 350 || card.layout.x > 1000) {
        invalid.push(`${card.id}: environment x ${card.layout.x}`);
      }
    }
  }
  if (invalid.length > 0) {
    throw new Error(`Cards outside lanes: ${invalid.join(", ")}`);
  }
}

function validateLayoutSpacing() {
  const overlaps = [];
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const a = cards[i];
      const b = cards[j];
      const dx = Math.abs(a.layout.x - b.layout.x);
      const dy = Math.abs(a.layout.y - b.layout.y);
      if (dx < 135 && dy < 95) {
        overlaps.push(
          `${a.id}(${a.layout.x},${a.layout.y})/${b.id}(${b.layout.x},${b.layout.y}) dx=${dx} dy=${dy}`,
        );
      }
    }
  }
  if (overlaps.length > 0) {
    throw new Error(`Cards too close: ${overlaps.join(", ")}`);
  }
}

validateAssignments();
validateSorts();
validateReachability();
validatePrereqSortOrder();
applyLaneGridLayout();

const missing = cards.filter((card) => !Number.isFinite(card.layout?.x) || !Number.isFinite(card.layout?.y));
if (missing.length > 0) {
  throw new Error(`Cards with invalid layout: ${missing.map((card) => card.id).join(", ")}`);
}

for (const card of cards) {
  for (const prereq of card.prereq) {
    if (!byId.has(prereq)) {
      throw new Error(`${card.id} has missing prereq ${prereq}`);
    }
  }
}

validateLaneLayout();
validateLayoutSpacing();

cards.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
fs.writeFileSync(cardsPath, `${JSON.stringify(cards, null, 2)}\n`);
const displayPath = path.relative(process.cwd(), cardsPath).replaceAll(path.sep, "/");
console.log(`Rebalanced ${cards.length} cards at ${displayPath}`);
