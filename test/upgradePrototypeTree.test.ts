import { describe, expect, it } from "vitest";
import {
  getPrototypeNode,
  getRevealedPrototypeNodes,
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

  it("has stable positions for graph rendering", () => {
    for (const node of UPGRADE_PROTOTYPE_NODES) {
      expect(Number.isFinite(node.x), `${node.id} x`).toBe(true);
      expect(Number.isFinite(node.y), `${node.id} y`).toBe(true);
    }
    expect(getPrototypeNode("missing")).toBeUndefined();
  });
});
