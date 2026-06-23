export const TOOL_IDS = ["default", "wide_sickle", "fast_sickle", "bomb_sickle", "tractor"] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export const SELECTABLE_TOOL_IDS = TOOL_IDS;
