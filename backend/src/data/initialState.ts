import type { ShipShapeState } from "../storage/memoryStore.js";

export function createInitialState(): ShipShapeState {
  return {
    projects: [],
    flows: [],
    checks: [],
    issues: [],
    runs: [],
    results: [],
    reports: [],
    loop: []
  };
}
