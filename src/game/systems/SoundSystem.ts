export const ALL_SOUND_CUES = [
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
] as const;

export type SoundCue = (typeof ALL_SOUND_CUES)[number];

export interface SoundOptions {
  volume?: number;
}

export class SoundSystem {
  private _lastCue: SoundCue | null = null;

  get lastCue(): SoundCue | null {
    return this._lastCue;
  }

  play(cue: SoundCue, options: SoundOptions = {}): void {
    this._lastCue = cue;
    void options;
  }

  dispose(): void {
    this._lastCue = null;
  }
}
