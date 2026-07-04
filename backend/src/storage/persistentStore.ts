import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInitialState } from "../data/initialState.js";
import { MemoryStore, type ShipShapeState } from "./memoryStore.js";

const defaultDataFile = join(process.cwd(), ".shipshape", "shipshape-state.json");

export function createPersistentStore(dataFile = process.env.SHIPSHAPE_DATA_FILE ?? defaultDataFile): MemoryStore {
  const state = loadState(dataFile);
  return new MemoryStore(state, (nextState) => saveState(dataFile, nextState));
}

function loadState(dataFile: string): ShipShapeState {
  if (!existsSync(dataFile)) {
    const initialState = createInitialState();
    saveState(dataFile, initialState);
    return initialState;
  }

  const contents = readFileSync(dataFile, "utf8");
  return JSON.parse(contents) as ShipShapeState;
}

function saveState(dataFile: string, state: ShipShapeState) {
  mkdirSync(dirname(dataFile), { recursive: true });
  const tempFile = `${dataFile}.tmp`;
  writeFileSync(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tempFile, dataFile);
}
