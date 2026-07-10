import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Pool } from "pg";
import { createInitialState } from "../data/initialState.js";
import { MemoryStore, type ShipShapeState } from "./memoryStore.js";

const defaultDataFile = join(process.cwd(), ".shipshape", "shipshape-state.json");
const stateKey = "default";

export async function createPersistentStore(dataFile = process.env.SHIPSHAPE_DATA_FILE ?? defaultDataFile): Promise<MemoryStore> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return createPostgresStore(databaseUrl);
  }

  const state = loadState(dataFile);
  return new MemoryStore(state, (nextState) => saveState(dataFile, nextState));
}

async function createPostgresStore(databaseUrl: string): Promise<MemoryStore> {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipshape_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await pool.query<{ value: ShipShapeState }>("SELECT value FROM shipshape_state WHERE key = $1", [stateKey]);
  const state = existing.rows[0]?.value ?? createInitialState();
  if (!existing.rows[0]) {
    await savePostgresState(pool, state);
  }

  let writeQueue = Promise.resolve();
  return new MemoryStore(state, (nextState) => {
    const snapshot = JSON.parse(JSON.stringify(nextState)) as ShipShapeState;
    writeQueue = writeQueue
      .catch((error: unknown) => console.error("Previous ShipShape database write failed", error))
      .then(async () => {
        await savePostgresState(pool, snapshot);
      })
      .catch((error: unknown) => console.error("ShipShape database write failed", error));
  });
}

function savePostgresState(pool: Pool, state: ShipShapeState) {
  return pool.query(
    `
      INSERT INTO shipshape_state (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [stateKey, JSON.stringify(state)]
  );
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
