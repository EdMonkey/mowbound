import { describe, expect, it } from "vitest";
import { CARDS, CARD_ROOT_ID } from "../src/game/config/cards";
import {
  parseUpgradePrototypeLayoutOverrides,
  serializeUpgradePrototypeLayoutOverrides,
  type UpgradePrototypePositionOverrides,
} from "../src/game/ui/upgradePrototypeLayoutStorage";

const validCardIds = CARDS.map((card) => card.id);

describe("upgrade prototype layout storage", () => {
  it("keeps only known node ids with finite coordinates", () => {
    const parsed = parseUpgradePrototypeLayoutOverrides(
      JSON.stringify({
        version: 1,
        positions: {
          [CARD_ROOT_ID]: { x: 320.5, y: 640 },
          missing_node: { x: 10, y: 20 },
          market_cart_1: { x: "bad", y: 120 },
          sharp_edge_1: { x: 200, y: Number.NaN },
        },
      }),
      validCardIds,
    );

    expect(parsed).toEqual({
      [CARD_ROOT_ID]: { x: 320.5, y: 640 },
    });
  });

  it("round-trips editor positions in a stable versioned shape", () => {
    const positions: UpgradePrototypePositionOverrides = {
      [CARD_ROOT_ID]: { x: 410, y: 720 },
      market_cart_1: { x: 420, y: 560 },
    };

    const serialized = serializeUpgradePrototypeLayoutOverrides(positions);
    const parsed = parseUpgradePrototypeLayoutOverrides(serialized, validCardIds);

    expect(JSON.parse(serialized)).toEqual({ version: 1, positions });
    expect(parsed).toEqual(positions);
  });

  it("returns an empty object for malformed saved data", () => {
    expect(parseUpgradePrototypeLayoutOverrides("{", validCardIds)).toEqual({});
    expect(parseUpgradePrototypeLayoutOverrides(null, validCardIds)).toEqual({});
    expect(parseUpgradePrototypeLayoutOverrides(JSON.stringify({ version: 1, positions: [] }), validCardIds)).toEqual({});
  });
});
