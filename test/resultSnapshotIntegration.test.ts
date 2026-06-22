import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const gameSceneSourcePath = fileURLToPath(new URL("../src/game/scenes/GameScene.ts", import.meta.url));

describe("result snapshot integration", () => {
  it("captures and passes an end-of-round field snapshot into the result screen", () => {
    const source = readFileSync(gameSceneSourcePath, "utf8");

    expect(source).toContain("private captureResultSnapshot()");
    expect(source).toContain("const snapshotUrl = this.captureResultSnapshot();");
    expect(source).toMatch(/showResult\([\s\S]*snapshotUrl\)/);
  });
});
