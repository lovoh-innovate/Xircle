// src/database/schema.js

export const TABLES = {
  meta: `
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `,

  // ── Local profile cache ─────────────────────────────────────────
  // Whenever the app receives a populated user object from the server
  // (chat participants, message senders, etc.), we upsert it here.
  // This is what lets the chat list / chat screen show a correct name
  // and avatar when reading from SQLite instead of the server —
  // without it, all we have locally is a bare user id.
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      username TEXT,
      email TEXT,
      profile TEXT,
      updated_at INTEGER
    );
  `,

  messages: `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      chat_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT,
      message_type TEXT DEFAULT 'text',
      media_url TEXT,
      media_name TEXT,
      media_size INTEGER,
      media_duration INTEGER,
      mentions TEXT,               -- JSON array of user IDs
      reply_to TEXT,
      is_deleted INTEGER DEFAULT 0,  -- local soft‑delete
      deleted_by TEXT,
      deleted_at INTEGER,
      edited INTEGER DEFAULT 0,
      edited_at INTEGER,
      read_by TEXT,                 -- JSON array of { user, readAt }
      archived_by TEXT,             -- JSON array of user IDs
      starred_by TEXT,              -- JSON array of user IDs
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      status TEXT DEFAULT 'sent',   -- local delivery status: 'sent','delivered','read','failed'
      sync_status TEXT DEFAULT 'synced'
    );
  `,

  chats: `
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      type TEXT NOT NULL,          -- 'group' | 'direct'
      scope TEXT DEFAULT 'workspace',
      name TEXT,
      description TEXT,
      avatar TEXT,
      is_public INTEGER DEFAULT 0,
      participants TEXT,            -- JSON array of { user, role, joinedAt, lastReadAt, online, lastSeen }
      created_by TEXT NOT NULL,
      last_message_id TEXT,
      last_message_at INTEGER,
      last_message_snapshot TEXT,   -- JSON { content, messageType, mediaName, createdAt } — lets the
                                     -- chat list show a real preview offline without a join
      archived_by TEXT,             -- JSON array of user IDs
      join_requests TEXT,           -- JSON array of { user, status, requestedAt }
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      unread_count INTEGER DEFAULT 0,  -- local
      sync_status TEXT DEFAULT 'synced'
    );
  `,

    tasks: `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      folder_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      detailed_description TEXT,
      task_type TEXT DEFAULT 'general',
      assignee TEXT,
      created_by TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      start_date INTEGER,
      due_date INTEGER,
      buffer_time INTEGER DEFAULT 0,
      estimated_hours REAL,
      actual_hours REAL,
      progress INTEGER DEFAULT 0,
      sub_tasks TEXT,
      allow_assignee_edit_subtasks INTEGER DEFAULT 0,
      dependencies TEXT,
      links TEXT,
      attachments TEXT,
      reminder_sent INTEGER DEFAULT 0,
      daily_reminder_time TEXT,
      last_daily_reminder_sent INTEGER,
      recurrence_type TEXT DEFAULT 'none',
      recurrence_days TEXT,
      recurrence_end_date INTEGER,
      task_order INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      archived_at INTEGER,
      is_trash INTEGER DEFAULT 0,
      trashed_at INTEGER,
      completed_by TEXT,
      completed_at INTEGER,
      completion_notes TEXT,
      confirmed_by TEXT,
      confirmed_at INTEGER,
      completion_feedback TEXT,
      final_links TEXT,
      final_attachments TEXT,
      submitted_progress INTEGER DEFAULT 0,
      approved INTEGER DEFAULT 0,
      approved_by TEXT,
      approved_at INTEGER,
      stages TEXT,
      current_stage TEXT,
      comments TEXT,
      reassignment_history TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      sync_status TEXT DEFAULT 'synced'
    );
  `,

  personal_tasks: `
    CREATE TABLE IF NOT EXISTS personal_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      folder_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      due_date INTEGER,
      recurrence_type TEXT DEFAULT 'none',
      recurrence_days TEXT,         -- JSON array of numbers
      recurrence_end_date INTEGER,
      reminder_sent_at INTEGER,
      daily_reminder_time TEXT,
      last_daily_reminder_sent INTEGER,
      is_trash INTEGER DEFAULT 0,
      trashed_at INTEGER,
      is_archived INTEGER DEFAULT 0,
      archived_at INTEGER,
      subtasks TEXT,                -- JSON array
      notes TEXT,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      sync_status TEXT DEFAULT 'synced'
    );
  `,

  projects: `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      detailed_description TEXT,
      links TEXT,                   -- JSON array of strings
      documents TEXT,               -- JSON array of { name, url, publicId, size, uploadedAt }
      cover_image TEXT,
      created_by TEXT NOT NULL,
      project_managers TEXT,        -- JSON array of user IDs
      team_members TEXT,            -- JSON array of { user, role, status, joinedAt, leftAt }
      start_date INTEGER,
      end_date INTEGER,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'planning',
      progress INTEGER DEFAULT 0,
      project_type TEXT DEFAULT 'general',
      daily_report_time TEXT DEFAULT '17:00',
      tags TEXT,                    -- JSON array of strings
      team_chat_id TEXT,
      attachments TEXT,             -- JSON array of { name, url, uploadedBy, uploadedAt }
      ready_for_completion INTEGER DEFAULT 0,
      completed_at INTEGER,
      completed_by TEXT,
      archived_by TEXT,             -- JSON array of { user, archivedAt }
      is_trash INTEGER DEFAULT 0,
      trashed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      sync_status TEXT DEFAULT 'synced'
    );
  `,

  sync_queue: `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending'
    );
  `,
};

// src/database/schema.js — INDEXES array
export const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);',
  'CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id, created_at);',
  'CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);',
  'CREATE INDEX IF NOT EXISTS idx_chats_workspace ON chats(workspace_id);',
  'CREATE INDEX IF NOT EXISTS idx_chats_participants ON chats(participants);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);',
  'CREATE INDEX IF NOT EXISTS idx_personal_tasks_user ON personal_tasks(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_personal_tasks_status ON personal_tasks(status);',
  'CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);',
  'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);',
];