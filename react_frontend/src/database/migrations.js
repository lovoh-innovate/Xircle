// src/database/migrations.js
import { TABLES, INDEXES } from './schema';

const MIGRATIONS = [
  {
    version: 1,
    up: async (db) => {
      for (const [name, sql] of Object.entries(TABLES)) {
        if (name === 'meta') continue;
        await db.execute(sql); // no bind values here — raw DDL, execute() is correct
      }
      for (const idx of INDEXES) {
        await db.execute(idx); // raw DDL, execute() is correct
      }
    },
  },
];

export const migrate = async (db) => {
  await db.execute(TABLES.meta);

  const res = await db.query(`SELECT value FROM meta WHERE key = ?`, ['version']);
  let currentVersion = Number(res.values?.[0]?.value || 0);

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await migration.up(db);
      // FIX: execute → run, because this has bind values
      await db.run(
        `INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`,
        ['version', String(migration.version)]
      );
      currentVersion = migration.version;
    }
  }
};