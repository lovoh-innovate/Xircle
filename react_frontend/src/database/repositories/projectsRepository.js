// src/database/repositories/projectsRepository.js
import { getDatabase } from '../database';
import { parseJSON, stringifyJSON, toTimestamp } from './utils';

export const projectsRepository = {
  async getProjectById(id) {
    const db = await getDatabase();
    const res = await db.query(`SELECT * FROM projects WHERE id = ?`, [id]);
    if (!res.values || res.values.length === 0) return null;
    return this._deserialize(res.values[0]);
  },

  async getProjectsByWorkspace(workspaceId) {
    const db = await getDatabase();
    const res = await db.query(
      `SELECT * FROM projects WHERE workspace_id = ? AND is_trash = 0 ORDER BY created_at DESC`,
      [workspaceId]
    );
    return (res.values || []).map(this._deserialize);
  },

  async saveProject(project) {
    const db = await getDatabase();
    const serialized = this._serialize(project);
    const {
      id, workspace_id, name, description, detailed_description,
      links, documents, cover_image, created_by, project_managers,
      team_members, start_date, end_date, priority, status,
      progress, project_type, daily_report_time, tags,
      team_chat_id, attachments, ready_for_completion,
      completed_at, completed_by, archived_by, is_trash,
      trashed_at, created_at, updated_at, sync_status
    } = serialized;

    await db.execute(
      `INSERT OR REPLACE INTO projects (
        id, workspace_id, name, description, detailed_description,
        links, documents, cover_image, created_by, project_managers,
        team_members, start_date, end_date, priority, status,
        progress, project_type, daily_report_time, tags,
        team_chat_id, attachments, ready_for_completion,
        completed_at, completed_by, archived_by, is_trash,
        trashed_at, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, workspace_id, name, description, detailed_description,
        links, documents, cover_image, created_by, project_managers,
        team_members, start_date, end_date, priority, status,
        progress, project_type, daily_report_time, tags,
        team_chat_id, attachments, ready_for_completion,
        completed_at, completed_by, archived_by, is_trash,
        trashed_at, created_at, updated_at, sync_status
      ]
    );
    return this.getProjectById(id);
  },

  async saveProjects(projects) {
    for (const p of projects) {
      await this.saveProject(p);
    }
  },

  async updateProjectStatus(id, status) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE projects SET status = ?, updated_at = ? WHERE id = ?`,
      [status, Date.now(), id]
    );
  },

  async moveToTrash(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE projects SET is_trash = 1, trashed_at = ?, updated_at = ? WHERE id = ?`,
      [Date.now(), Date.now(), id]
    );
  },

  async restoreFromTrash(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE projects SET is_trash = 0, trashed_at = NULL, updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  },

  async markSynced(id) {
    const db = await getDatabase();
    await db.execute(
      `UPDATE projects SET sync_status = 'synced', updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  },

  _serialize(data) {
    if (!data) return data;
    return {
      id: data.id,
      workspace_id: data.workspace_id || data.workspace,
      name: data.name,
      description: data.description || '',
      detailed_description: data.detailed_description || '',
      links: stringifyJSON(data.links),
      documents: stringifyJSON(data.documents),
      cover_image: data.cover_image || data.coverImage || '',
      created_by: data.created_by || data.createdBy,
      project_managers: stringifyJSON(data.project_managers || data.projectManagers),
      team_members: stringifyJSON(data.team_members || data.teamMembers),
      start_date: toTimestamp(data.start_date || data.startDate || Date.now()),
      end_date: toTimestamp(data.end_date || data.endDate),
      priority: data.priority || 'medium',
      status: data.status || 'planning',
      progress: data.progress ?? 0,
      project_type: data.project_type || data.projectType || 'general',
      daily_report_time: data.daily_report_time || data.dailyReportTime || '17:00',
      tags: stringifyJSON(data.tags),
      team_chat_id: data.team_chat_id || data.teamChatId,
      attachments: stringifyJSON(data.attachments),
      ready_for_completion: data.ready_for_completion ? 1 : 0,
      completed_at: toTimestamp(data.completed_at || data.completedAt),
      completed_by: data.completed_by || data.completedBy,
      archived_by: stringifyJSON(data.archived_by || data.archivedBy),
      is_trash: data.is_trash ? 1 : 0,
      trashed_at: toTimestamp(data.trashed_at),
      created_at: toTimestamp(data.created_at || data.createdAt || Date.now()),
      updated_at: toTimestamp(data.updated_at || data.updatedAt || Date.now()),
      sync_status: data.sync_status || 'synced',
    };
  },

  _deserialize(row) {
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description,
      detailedDescription: row.detailed_description,
      links: parseJSON(row.links),
      documents: parseJSON(row.documents),
      coverImage: row.cover_image,
      createdBy: row.created_by,
      projectManagers: parseJSON(row.project_managers),
      teamMembers: parseJSON(row.team_members),
      startDate: row.start_date,
      endDate: row.end_date,
      priority: row.priority,
      status: row.status,
      progress: row.progress,
      projectType: row.project_type,
      dailyReportTime: row.daily_report_time,
      tags: parseJSON(row.tags),
      teamChatId: row.team_chat_id,
      attachments: parseJSON(row.attachments),
      readyForCompletion: row.ready_for_completion === 1,
      completedAt: row.completed_at,
      completedBy: row.completed_by,
      archivedBy: parseJSON(row.archived_by),
      isTrash: row.is_trash === 1,
      trashedAt: row.trashed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncStatus: row.sync_status,
    };
  },
};