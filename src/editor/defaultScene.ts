import type { Scene } from "../types";

export function makeDefaultScene(): Scene {
  return {
    artboards: [],
    nodes: [],
    selection: { kind: "none" },
  };
}