// src/database/repositories/syncQueueRepository.js
import { getDatabase } from '../database';
import { parseJSON, stringifyJSON } from './utils';

export const syncQueueRepository = {
  async add(operation, entityType, entityId, payload) {
    const db = await getDatabase();
    // FIX: execute → run (has bind values)
    await db.run(
      `INSERT INTO sync_queue (operation, entity_type, entity_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [operation, entityType, entityId, stringifyJSON(payload), Date.now()]
    );
  },

  async getPending(limit = 50) {
    const db = await getDatabase();
    const res = await db.query( // query() already binds correctly — fine as-is
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
      [limit]
    );
    return (res.values || []).map(row => ({
      id: row.id,
      operation: row.operation,
      entityType: row.entity_type,
      entityId: row.entity_id,
      payload: parseJSON(row.payload),
      createdAt: row.created_at,
      attempts: row.attempts,
      status: row.status,
    }));
  },

  async markDone(id) {
    const db = await getDatabase();
    // FIX: execute → run
    await db.run(`UPDATE sync_queue SET status = 'done' WHERE id = ?`, [id]);
  },

  async markFailed(id) {
    const db = await getDatabase();
    // FIX: execute → run
    await db.run(
      `UPDATE sync_queue SET status = 'failed', attempts = attempts + 1 WHERE id = ?`,
      [id]
    );
  },

  async resetPending() {
    const db = await getDatabase();
    // No bind values here — execute() is fine
    await db.execute(
      `UPDATE sync_queue SET status = 'pending' WHERE status = 'failed' AND attempts < 5`
    );
  },

  async clearDone() {
    const db = await getDatabase();
    // No bind values here — execute() is fine
    await db.execute(`DELETE FROM sync_queue WHERE status = 'done'`);
  },
};