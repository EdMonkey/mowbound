import { describe, expect, it } from "vitest";
import {
  BRANCH_LAYOUT,
  canUnlockPrototypeNode,
  getAllPrototypeNodeIds,
  getPrototypeNode,
  getRevealedPrototypeNodes,
  layoutPrototypeNode,
  UPGRADE_PROTOTYPE_NODES,
  UPGRADE_PROTOTYPE_ROOT_ID,
} from "../src/game/config/upgradePrototypeTree";

describe("upgrade prototype tree data", () => {
  it("starts with only the root upgrade revealed", () => {
    expect(getRevealedPrototypeNodes([]).map((node) => node.id)).toEqual([UPGRADE_PROTOTYPE_ROOT_ID]);
  });

  it("reveals the three category branches after the rusty scythe is unlocked", () => {
    const revealed = getRevealedPrototypeNodes([UPGRADE_PROTOTYPE_ROOT_ID]).map((node) => node.branch);

    expect(revealed).toContain("equipment");
    expect(revealed).toContain("harvest");
    expect(revealed).toContain("environment");
  });

  it("provides every prototype node id for the debug unlock-all action", () => {
    const ids = getAllPrototypeNodeIds();
    const revealed = getRevealedPrototypeNodes(ids);

    expect(ids).toHaveLength(UPGRADE_PROTOTYPE_NODES.length);
    expect(new Set(ids).size).toBe(UPGRADE_PROTOTYPE_NODES.length);
    expect(revealed).toHaveLength(UPGRADE_PROTOTYPE_NODES.length);
  });

  it("keeps every non-root node connected to an existing prerequisite", () => {
    const ids = new Set(UPGRADE_PROTOTYPE_NODES.map((node) => node.id));

    for (const node of UPGRADE_PROTOTYPE_NODES) {
      for (const prereq of node.prereq) {
        expect(ids.has(prereq), `${node.id} prereq ${prereq}`).toBe(true);
      }
    }
  });

  it("contains roughly one hundred fifty upgrades across three main lanes", () => {
    expect(UPGRADE_PROTOTYPE_NODES.length).toBeGreaterThanOrEqual(140);
    expect(UPGRADE_PROTOTYPE_NODES.length).toBeLessThanOrEqual(160);

    const counts = UPGRADE_PROTOTYPE_NODES.reduce<Record<string, number>>((acc, node) => {
      acc[node.branch] = (acc[node.branch] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts.equipment).toBeGreaterThanOrEqual(45);
    expect(counts.harvest).toBeGreaterThanOrEqual(45);
    expect(counts.environment).toBeGreaterThanOrEqual(45);
  });

  it("uses tier and lane values for scalable graph layout", () => {
    for (const node of UPGRADE_PROTOTYPE_NODES) {
      expect(Number.isFinite(node.tier), `${node.id} tier`).toBe(true);
      expect(Number.isFinite(node.lane), `${node.id} lane`).toBe(true);
      expect(Number.isFinite(node.x), `${node.id} x`).toBe(true);
      expect(Number.isFinite(node.y), `${node.id} y`).toBe(true);
      expect(node.x).toBe(layoutPrototypeNode(node).x);
      expect(node.y).toBe(layoutPrototypeNode(node).y);
    }
    expect(BRANCH_LAYOUT.equipment.x).toBeLessThan(BRANCH_LAYOUT.harvest.x);
    expect(BRANCH_LAYOUT.harvest.x).toBeLessThan(BRANCH_LAYOUT.environment.x);
    expect(getPrototypeNode("missing")).toBeUndefined();
  });

  it("grows upward from the root with organic stem drift", () => {
    const root = getPrototypeNode(UPGRADE_PROTOTYPE_ROOT_ID);
    const firstHarvest = getPrototypeNode("harvest_t01_core");
    const lateHarvest = getPrototypeNode("harvest_t06_core");
    const equipmentStem = [1, 2, 3, 4, 5].map((tier) => getPrototypeNode(`equipment_t${String(tier).padStart(2, "0")}_core`));

    expect(root).toBeDefined();
    expect(firstHarvest).toBeDefined();
    expect(lateHarvest).toBeDefined();
    expect(firstHarvest!.y).toBeLessThan(root!.y);
    expect(lateHarvest!.y).toBeLessThan(firstHarvest!.y);

    const stemDeltas = equipmentStem.slice(1).map((node, index) => node!.x - equipmentStem[index]!.x);
    expect(new Set(stemDeltas.map(Math.sign)).size).toBeGreaterThan(1);
  });

  it("forms a life-tree silhouette with harvest as the compact golden trunk and side branches opening outward", () => {
    const branchWidthAtTier = (branch: string, tier: number) => {
      const xs = UPGRADE_PROTOTYPE_NODES.filter((node) => node.branch === branch && node.tier === tier).map((node) => node.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    const coreX = (id: string) => getPrototypeNode(id)!.x;
    const harvestCoreXs = UPGRADE_PROTOTYPE_NODES.filter((node) => node.branch === "harvest" && node.lane === 0).map((node) => node.x);
    const harvestCoreWidth = Math.max(...harvestCoreXs) - Math.min(...harvestCoreXs);

    expect(coreX("equipment_t10_core")).toBeLessThan(coreX("equipment_t01_core") - 260);
    expect(coreX("environment_t10_core")).toBeGreaterThan(coreX("environment_t01_core") + 260);
    expect(harvestCoreWidth).toBeLessThanOrEqual(56);
    expect(branchWidthAtTier("equipment", 10)).toBeGreaterThan(branchWidthAtTier("harvest", 10) + 120);
    expect(branchWidthAtTier("environment", 10)).toBeGreaterThan(branchWidthAtTier("harvest", 10) + 120);
  });

  it("lets the next tier center unlock from the directly connected previous center only", () => {
    const tier2Center = getPrototypeNode("harvest_t02_core");
    expect(tier2Center?.prereq).toEqual(["harvest_t01_core"]);
    expect(tier2Center && canUnlockPrototypeNode(tier2Center, [UPGRADE_PROTOTYPE_ROOT_ID, "harvest_t01_core"])).toBe(true);
  });

  it("varies the number of cards per tier instead of forcing every tier to five cards", () => {
    const countsByTier = new Map<string, number>();
    for (const node of UPGRADE_PROTOTYPE_NODES) {
      if (node.branch === "root") {
        continue;
      }
      const key = `${node.branch}:${node.tier}`;
      countsByTier.set(key, (countsByTier.get(key) ?? 0) + 1);
    }

    expect(new Set(countsByTier.values()).size).toBeGreaterThan(1);
    expect([...countsByTier.values()].some((count) => count !== 5)).toBe(true);
  });

  it("allows a side branch to open a lower-tier side upgrade without the next center", () => {
    const branchNode = getPrototypeNode("harvest_t02_l1");

    expect(branchNode?.prereq).toEqual(["harvest_t01_l1"]);
    expect(branchNode && canUnlockPrototypeNode(branchNode, ["harvest_t01_l1"])).toBe(true);
  });
});
