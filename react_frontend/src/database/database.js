// src/database/database.js
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { migrate } from './migrations';

const DB_NAME = 'xircle_db';

let dbInstance = null;
let dbPromise = null;

const openConnection = async (sqlite) => {
  try {
    const isConn = await sqlite.isConnection(DB_NAME, false);
    if (isConn.result) {
      return await sqlite.retrieveConnection(DB_NAME, false);
    }
    return await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  } catch (err) {
    // Defensive: if the plugin says "already exists" even though
    // isConnection() told us it didn't, fall back to retrieving it
    // instead of crashing.
    if (String(err?.message || err).includes('already exists')) {
      return await sqlite.retrieveConnection(DB_NAME, false);
    }
    throw err;
  }
};

const initDatabase = async () => {
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  const db = await openConnection(sqlite);

  const isOpen = await db.isDBOpen();
  if (!isOpen.result) {
    await db.open();
  }

  // FIX: assign dbInstance right here, BEFORE migrate() runs.
  // The native connection is already live at this point — if migrate()
  // throws below, we must not lose the JS reference to it, or the next
  // getDatabase() call will try createConnection() again and get
  // "Connection xircle_db already exists".
  dbInstance = db;

  await migrate(db);

  return db;
};

export const getDatabase = async () => {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = initDatabase();

  try {
    return await dbPromise;
  } catch (error) {
    // Note: dbInstance may already be set here (connection succeeded,
    // only migrate() failed) — that's intentional, don't null it out.
    // Only dbPromise needs resetting so a retry doesn't reuse a dead promise.
    dbPromise = null;
    throw error;
  }
};

export const isNative = Capacitor.isNativePlatform();