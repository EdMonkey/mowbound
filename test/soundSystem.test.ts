import { describe, expect, it } from "vitest";
import { ALL_SOUND_CUES, SoundSystem } from "../src/game/systems/SoundSystem";

describe("SoundSystem", () => {
  it("declares every planned demo cue", () => {
    expect(ALL_SOUND_CUES).toEqual([
      "swing",
      "grass",
      "coin",
      "rock",
      "tree",
      "bomb",
      "purchase",
      "unlock",
      "tool",
      "alienStamp",
      "laser",
      "tractor",
    ]);
  });

  it("acts as a safe no-op hook until real audio assets are added", () => {
    const sound = new SoundSystem();
    expect(sound.lastCue).toBeNull();
    sound.play("laser", { volume: 0.5 });
    expect(sound.lastCue).toBe("laser");
    sound.dispose();
    expect(sound.lastCue).toBeNull();
  });
});
