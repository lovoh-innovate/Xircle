// src/database/repositories/tasksRepository.js
import { getDatabase } from '../database';
import { parseJSON, stringifyJSON, toTimestamp } from './utils';

export const tasksRepository = {
  async getTaskById(id) {
    const db = await getDatabase();
    const res = await db.query(`SELECT * FROM tasks WHERE id = ?`, [id]);
    if (!res.values || res.values.length === 0) return null;
    return this._deserialize(res.values[0]);
  },

  async getTasksByProject(projectId) {
    const db = await getDatabase();
    const res = await db.query(
      `SELECT * FROM tasks WHERE project_id = ? AND is_trash = 0 ORDER BY task_order ASC, created_at ASC`,
      [projectId]
    );
    return (res.values || []).map(this._deserialize);
  },

  async getTasksByWorkspace(workspaceId) {
    const db = await getDatabase();
    const res = await db.query(
      `SELECT * FROM tasks WHERE workspace_id = ? AND is_trash = 0 ORDER BY created_at DESC`,
      [workspaceId]
    );
    return (res.values || []).map(this._deserialize);
  },

  async getTasksByAssignee(userId) {
    const db = await getDatabase();
    const res = await db.query(
      `SELECT * FROM tasks WHERE assignee = ? AND is_trash = 0 ORDER BY due_date ASC`,
      [userId]
    );
    return (res.values || []).map(this._deserialize);
  },

  async saveTask(task) {
    const db = await getDatabase();
    const serialized = this._serialize(task);
    const {
      id, project_id, workspace_id, folder_id, title, description,
      detailed_description, task_type, assignee, created_by, status,
      priority, start_date, due_date, buffer_time, estimated_hours,
      actual_hours, progress, sub_tasks, allow_assignee_edit_subtasks,
      dependencies, links, attachments, reminder_sent,
      daily_reminder_time, last_daily_reminder_sent,
      recurrence_type, recurrence_days, recurrence_end_date,
      task_order, is_archived, archived_at, is_trash, trashed_at,
      completed_by, completed_at, completion_notes,
      confirmed_by, confirmed_at, completion_feedback,
      final_links, final_attachments, submitted_progress,
      approved, approved_by, approved_at, stages, current_stage,
      comments, reassignment_history, is_deleted,
      created_at, updated_at, sync_status
    } = serialized;

    await db.execute(
      `INSERT OR REPLACE INTO tasks (
        id, project_id, workspace_id, folder_id, title, description,
        detailed_description, task_type, assignee, created_by, status,
        priority, start_date, due_date, buffer_time, estimated_hours,
        actual_hours, progress, sub_tasks, allow_assignee_edit_subtasks,
        dependencies, links, attachments, reminder_sent,
        daily_reminder_time, last_daily_reminder_sent,
        recurrence_type, recurrence_days, recurrence_end_date,
        task_order, is_archived, archived_at, is_trash, trashed_at,
        completed_by, completed_at, completion_notes,
        confirmed_by, confirmed_at, completion_feedback,
        final_links, final_attachments, submitted_progress,
        approved, approved_by, approved_at, stages, current_stage,
        comments, reassignment_history, is_deleted,
        created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, project_id, workspace_id, folder_id, title, description,
        detailed_description, task_type, assignee, created_by, status,
        priority, start_date, due_date, buffer_time, estimated_hours,
        actual_hours, progress, sub_tasks, allow_assignee_edit_subtasks,
        dependencies, links, attachments, reminder_sent,
        daily_reminder_time, last_daily_reminder_sent,
        recurrence_type, recurrence_days, recurrence_end_date,
        task_order, is_archived, archived_at, is_trash, trashed_at,
        completed_by, completed_at, completion_notes,
        confirmed_by, confirmed_at, completion_feedback,
        final_links, final_attachments, submitted_progress,
        approved, approved_by, approved_at, stages, current_stage,
        comments, reassignment_history, is_deleted,
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
      `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`,
      [status, Date.now(), id]
    );
    return this.getTaskById(id);
  },

  async moveToTrash(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE tasks SET is_trash = 1, trashed_at = ?, updated_at = ? WHERE id = ?`,
      [Date.now(), Date.now(), id]
    );
  },

  async restoreFromTrash(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE tasks SET is_trash = 0, trashed_at = NULL, updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  },

  async markSynced(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE tasks SET sync_status = 'synced', updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  },

  _serialize(data) {
    if (!data) return data;
    return {
      id: data.id,
      project_id: data.project_id || data.project,
      workspace_id: data.workspace_id || data.workspace,
      folder_id: data.folder_id || data.folder,
      title: data.title,
      description: data.description || '',
      detailed_description: data.detailed_description || '',
      task_type: data.task_type || data.taskType || 'general',
      assignee: data.assignee,
      created_by: data.created_by || data.createdBy,
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      start_date: toTimestamp(data.start_date || data.startDate),
      due_date: toTimestamp(data.due_date || data.dueDate),
      buffer_time: data.buffer_time ?? 0,
      estimated_hours: data.estimated_hours ?? null,
      actual_hours: data.actual_hours ?? null,
      progress: data.progress ?? 0,
      sub_tasks: stringifyJSON(data.sub_tasks || data.subTasks),
      allow_assignee_edit_subtasks: data.allow_assignee_edit_subtasks ? 1 : 0,
      dependencies: stringifyJSON(data.dependencies),
      links: stringifyJSON(data.links),
      attachments: stringifyJSON(data.attachments),
      reminder_sent: data.reminder_sent ? 1 : 0,
      daily_reminder_time: data.daily_reminder_time || null,
      last_daily_reminder_sent: toTimestamp(data.last_daily_reminder_sent),
      recurrence_type: data.recurrence_type || 'none',
      recurrence_days: stringifyJSON(data.recurrence_days),
      recurrence_end_date: toTimestamp(data.recurrence_end_date),
      task_order: data.task_order ?? data.order ?? 0,
      is_archived: data.is_archived ? 1 : 0,
      archived_at: toTimestamp(data.archived_at),
      is_trash: data.is_trash ? 1 : 0,
      trashed_at: toTimestamp(data.trashed_at),
      completed_by: data.completed_by || data.completedBy,
      completed_at: toTimestamp(data.completed_at || data.completedAt),
      completion_notes: data.completion_notes || '',
      confirmed_by: data.confirmed_by || data.confirmedBy,
      confirmed_at: toTimestamp(data.confirmed_at || data.confirmedAt),
      completion_feedback: data.completion_feedback || '',
      final_links: stringifyJSON(data.final_links || data.finalLinks),
      final_attachments: stringifyJSON(data.final_attachments || data.finalAttachments),
      submitted_progress: data.submitted_progress ?? 0,
      approved: data.approved ? 1 : 0,
      approved_by: data.approved_by || data.approvedBy,
      approved_at: toTimestamp(data.approved_at || data.approvedAt),
      stages: stringifyJSON(data.stages),
      current_stage: data.current_stage || '',
      comments: stringifyJSON(data.comments),
      reassignment_history: stringifyJSON(data.reassignment_history),
      is_deleted: data.is_deleted ? 1 : 0,
      created_at: toTimestamp(data.created_at || data.createdAt || Date.now()),
      updated_at: toTimestamp(data.updated_at || data.updatedAt || Date.now()),
      sync_status: data.sync_status || 'synced',
    };
  },

  _deserialize(row) {
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      workspaceId: row.workspace_id,
      folderId: row.folder_id,
      title: row.title,
      description: row.description,
      detailedDescription: row.detailed_description,
      taskType: row.task_type,
      assignee: row.assignee,
      createdBy: row.created_by,
      status: row.status,
      priority: row.priority,
      startDate: row.start_date,
      dueDate: row.due_date,
      bufferTime: row.buffer_time,
      estimatedHours: row.estimated_hours,
      actualHours: row.actual_hours,
      progress: row.progress,
      subTasks: parseJSON(row.sub_tasks),
      allowAssigneeEditSubtasks: row.allow_assignee_edit_subtasks === 1,
      dependencies: parseJSON(row.dependencies),
      links: parseJSON(row.links),
      attachments: parseJSON(row.attachments),
      reminderSent: row.reminder_sent === 1,
      dailyReminderTime: row.daily_reminder_time,
      lastDailyReminderSent: row.last_daily_reminder_sent,
      recurrenceType: row.recurrence_type,
      recurrenceDays: parseJSON(row.recurrence_days),
      recurrenceEndDate: row.recurrence_end_date,
      order: row.task_order,
      isArchived: row.is_archived === 1,
      archivedAt: row.archived_at,
      isTrash: row.is_trash === 1,
      trashedAt: row.trashed_at,
      completedBy: row.completed_by,
      completedAt: row.completed_at,
      completionNotes: row.completion_notes,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at,
      completionFeedback: row.completion_feedback,
      finalLinks: parseJSON(row.final_links),
      finalAttachments: parseJSON(row.final_attachments),
      submittedProgress: row.submitted_progress,
      approved: row.approved === 1,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      stages: parseJSON(row.stages),
      currentStage: row.current_stage,
      comments: parseJSON(row.comments),
      reassignmentHistory: parseJSON(row.reassignment_history),
      isDeleted: row.is_deleted === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncStatus: row.sync_status,
    };
  },
};