// src/database/repositories/personalTasksRepository.js
import { getDatabase } from '../database';
import { parseJSON, stringifyJSON, toTimestamp } from './utils';

export const personalTasksRepository = {
  async getTaskById(id) {
    const db = await getDatabase();
    const res = await db.query(`SELECT * FROM personal_tasks WHERE id = ?`, [id]);
    if (!res.values || res.values.length === 0) return null;
    return this._deserialize(res.values[0]);
  },

  async getTasksByUser(userId) {
    const db = await getDatabase();
    const res = await db.query(
      `SELECT * FROM personal_tasks WHERE user_id = ? AND is_trash = 0 ORDER BY due_date ASC, created_at ASC`,
      [userId]
    );
    return (res.values || []).map(this._deserialize);
  },

  async getTasksByFolder(folderId) {
    const db = await getDatabase();
    const res = await db.query(
      `SELECT * FROM personal_tasks WHERE folder_id = ? AND is_trash = 0 ORDER BY due_date ASC`,
      [folderId]
    );
    return (res.values || []).map(this._deserialize);
  },

  async saveTask(task) {
    const db = await getDatabase();
    const serialized = this._serialize(task);
    const {
      id, user_id, folder_id, title, description, priority,
      status, due_date, recurrence_type, recurrence_days,
      recurrence_end_date, reminder_sent_at,
      daily_reminder_time, last_daily_reminder_sent,
      is_trash, trashed_at, is_archived, archived_at,
      subtasks, notes, completed_at,
      created_at, updated_at, sync_status
    } = serialized;

    await db.execute(
      `INSERT OR REPLACE INTO personal_tasks (
        id, user_id, folder_id, title, description, priority,
        status, due_date, recurrence_type, recurrence_days,
        recurrence_end_date, reminder_sent_at,
        daily_reminder_time, last_daily_reminder_sent,
        is_trash, trashed_at, is_archived, archived_at,
        subtasks, notes, completed_at,
        created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, user_id, folder_id, title, description, priority,
        status, due_date, recurrence_type, recurrence_days,
        recurrence_end_date, reminder_sent_at,
        daily_reminder_time, last_daily_reminder_sent,
        is_trash, trashed_at, is_archived, archived_at,
        subtasks, notes, completed_at,
        created_at, updated_at, sync_status
      ]
    );
    return this.getTaskById(id);
  },

  async saveTasks(tasks) {
    for (const t of tasks) {
      await this.saveTask(t);
    }
  },

  async updateTaskStatus(id, status) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE personal_tasks SET status = ?, updated_at = ? WHERE id = ?`,
      [status, Date.now(), id]
    );
    return this.getTaskById(id);
  },

  async moveToTrash(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE personal_tasks SET is_trash = 1, trashed_at = ?, updated_at = ? WHERE id = ?`,
      [Date.now(), Date.now(), id]
    );
  },

  async restoreFromTrash(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE personal_tasks SET is_trash = 0, trashed_at = NULL, updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  },

  async markSynced(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE personal_tasks SET sync_status = 'synced', updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  },

  _serialize(data) {
    if (!data) return data;
    return {
      id: data.id,
      user_id: data.user_id || data.user,
      folder_id: data.folder_id || data.folder,
      title: data.title,
      description: data.description || '',
      priority: data.priority || 'medium',
      status: data.status || 'pending',
      due_date: toTimestamp(data.due_date || data.dueDate),
      recurrence_type: data.recurrence_type || 'none',
      recurrence_days: stringifyJSON(data.recurrence_days),
      recurrence_end_date: toTimestamp(data.recurrence_end_date),
      reminder_sent_at: toTimestamp(data.reminder_sent_at),
      daily_reminder_time: data.daily_reminder_time || null,
      last_daily_reminder_sent: toTimestamp(data.last_daily_reminder_sent),
      is_trash: data.is_trash ? 1 : 0,
      trashed_at: toTimestamp(data.trashed_at),
      is_archived: data.is_archived ? 1 : 0,
      archived_at: toTimestamp(data.archived_at),
      subtasks: stringifyJSON(data.subtasks),
      notes: data.notes || '',
      completed_at: toTimestamp(data.completed_at),
      created_at: toTimestamp(data.created_at || data.createdAt || Date.now()),
      updated_at: toTimestamp(data.updated_at || data.updatedAt || Date.now()),
      sync_status: data.sync_status || 'synced',
    };
  },

  _deserialize(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      folderId: row.folder_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      dueDate: row.due_date,
      recurrenceType: row.recurrence_type,
      recurrenceDays: parseJSON(row.recurrence_days),
      recurrenceEndDate: row.recurrence_end_date,
      reminderSentAt: row.reminder_sent_at,
      dailyReminderTime: row.daily_reminder_time,
      lastDailyReminderSent: row.last_daily_reminder_sent,
      isTrash: row.is_trash === 1,
      trashedAt: row.trashed_at,
      isArchived: row.is_archived === 1,
      archivedAt: row.archived_at,
      subtasks: parseJSON(row.subtasks),
      notes: row.notes,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncStatus: row.sync_status,
    };
  },
};