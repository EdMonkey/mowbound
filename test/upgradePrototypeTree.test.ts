import { describe, expect, it } from "vitest";
import {
  BRANCH_LAYOUT,
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

  it("keeps every non-root node connected to an existing prerequisite", () => {
    const ids = new Set(UPGRADE_PROTOTYPE_NODES.map((node) => node.id));

    for (const node of UPGRADE_PROTOTYPE_NODES) {
      for (const prereq of node.prereq) {
        expect(ids.has(prereq), `${node.id} prereq ${prereq}`).toBe(true);
      }
    }
  });

  it("contains roughly one hundred fifty upgrades across three main lanes", () => {
    expect(UPGRADE_PROTOTYPE_NODES.length).toBeGreaterThanOrEqual(145);
    expect(UPGRADE_PROTOTYPE_NODES.length).toBeLessThanOrEqual(155);

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
});
