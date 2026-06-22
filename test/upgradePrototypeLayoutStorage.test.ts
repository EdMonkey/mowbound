import { describe, expect, it } from "vitest";
import { getAllPrototypeNodeIds } from "../src/game/config/upgradePrototypeTree";
import {
  parseUpgradePrototypeLayoutOverrides,
  serializeUpgradePrototypeLayoutOverrides,
  type UpgradePrototypePositionOverrides,
} from "../src/game/ui/upgradePrototypeLayoutStorage";

describe("upgrade prototype layout storage", () => {
  it("keeps only known node ids with finite coordinates", () => {
    const parsed = parseUpgradePrototypeLayoutOverrides(
      JSON.stringify({
        version: 1,
        positions: {
          rusty_scythe: { x: 320.5, y: 640 },
          missing_node: { x: 10, y: 20 },
          harvest_t01_core: { x: "bad", y: 120 },
          equipment_t01_core: { x: 200, y: Number.NaN },
        },
      }),
      getAllPrototypeNodeIds(),
    );

    expect(parsed).toEqual({
      rusty_scythe: { x: 320.5, y: 640 },
    });
  });

  it("round-trips editor positions in a stable versioned shape", () => {
    const positions: UpgradePrototypePositionOverrides = {
      rusty_scythe: { x: 410, y: 720 },
      harvest_t01_core: { x: 420, y: 560 },
    };

    const serialized = serializeUpgradePrototypeLayoutOverrides(positions);
    const parsed = parseUpgradePrototypeLayoutOverrides(serialized, getAllPrototypeNodeIds());

    expect(JSON.parse(serialized)).toEqual({ version: 1, positions });
    expect(parsed).toEqual(positions);
  });

  it("returns an empty object for malformed saved data", () => {
    expect(parseUpgradePrototypeLayoutOverrides("{", getAllPrototypeNodeIds())).toEqual({});
    expect(parseUpgradePrototypeLayoutOverrides(null, getAllPrototypeNodeIds())).toEqual({});
    expect(parseUpgradePrototypeLayoutOverrides(JSON.stringify({ version: 1, positions: [] }), getAllPrototypeNodeIds())).toEqual({});
  });
});
