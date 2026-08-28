// src/database/repositories/messagesRepository.js

import { getDatabase } from '../database';

import {
  parseJSON,
  stringifyJSON,
  toTimestamp,
} from './utils';

export const messagesRepository = {
  async getMessages(
    chatId,
    limit = 50,
    offset = 0
  ) {
    const db = await getDatabase();

    const res = await db.query(
      `SELECT * FROM messages
       WHERE chat_id = ?
         AND is_deleted = 0
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?`,
      [chatId, limit, offset]
    );

    return (res.values || []).map(this._deserialize);
  },

  async getMessageById(id) {
    const db = await getDatabase();

    const res = await db.query(
      `SELECT * FROM messages WHERE id = ?`,
      [id]
    );

    if (!res.values || res.values.length === 0) {
      return null;
    }

    return this._deserialize(res.values[0]);
  },

  async saveMessage(message) {
    if (!message) {
      console.warn(
        '⚠️ saveMessage called without a message'
      );
      return null;
    }

    const db = await getDatabase();

    const serialized = this._serialize(message);

    if (!serialized.id) {
      console.error(
        '❌ Cannot save message: message id is missing',
        message
      );
      return null;
    }

    if (!serialized.chat_id) {
      console.error(
        '❌ Cannot save message: chat_id is missing',
        message
      );
      return null;
    }

    const {
      id,
      workspace_id,
      chat_id,
      sender_id,
      content,
      message_type,
      media_url,
      media_name,
      media_size,
      media_duration,
      mentions,
      reply_to,
      is_deleted,
      deleted_by,
      deleted_at,
      edited,
      edited_at,
      read_by,
      archived_by,
      starred_by,
      created_at,
      updated_at,
      status,
      sync_status,
    } = serialized;

    // ─── FIX: db.execute() does NOT bind a values array — it only runs
    // raw SQL. Every "?" placeholder below was silently inserting NULL
    // for every write. db.run() is the correct parameterized-statement
    // method that actually binds `values` to the placeholders.
    await db.run(
      `INSERT OR REPLACE INTO messages (
        id,
        workspace_id,
        chat_id,
        sender_id,
        content,
        message_type,
        media_url,
        media_name,
        media_size,
        media_duration,
        mentions,
        reply_to,
        is_deleted,
        deleted_by,
        deleted_at,
        edited,
        edited_at,
        read_by,
        archived_by,
        starred_by,
        created_at,
        updated_at,
        status,
        sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        id,
        workspace_id,
        chat_id,
        sender_id,
        content,
        message_type,
        media_url,
        media_name,
        media_size,
        media_duration,
        mentions,
        reply_to,
        is_deleted,
        deleted_by,
        deleted_at,
        edited,
        edited_at,
        read_by,
        archived_by,
        starred_by,
        created_at,
        updated_at,
        status,
        sync_status,
      ]
    );

    return this.getMessageById(id);
  },

  async saveMessages(messages) {
    if (!Array.isArray(messages)) {
      return;
    }

    for (const message of messages) {
      await this.saveMessage(message);
    }
  },

  async updateMessageStatus(id, status) {
    const db = await getDatabase();

    // ─── FIX: execute → run (parameterized UPDATE)
    await db.run(
      `UPDATE messages
       SET status = ?,
           updated_at = ?
       WHERE id = ?`,
      [status, Date.now(), id]
    );

    return this.getMessageById(id);
  },

  async addReadReceipt(
    id,
    userId,
    readAt = Date.now()
  ) {
    const msg = await this.getMessageById(id);

    if (!msg) {
      return null;
    }

    const readBy = Array.isArray(msg.readBy)
      ? [...msg.readBy]
      : [];

    const existing = readBy.find(
      (r) =>
        String(
          r?.user?._id ??
          r?.user?.id ??
          r?.user
        ) === String(userId)
    );

    if (existing) {
      existing.readAt = readAt;
    } else {
      readBy.push({
        user: userId,
        readAt,
      });
    }

    return this.saveMessage({
      ...msg,
      readBy,
      updatedAt: Date.now(),
    });
  },

  async deleteMessage(
    id,
    deletedBy = null
  ) {
    const db = await getDatabase();

    // ─── FIX: execute → run (parameterized UPDATE)
    await db.run(
      `UPDATE messages
       SET is_deleted = 1,
           deleted_by = ?,
           deleted_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        deletedBy,
        Date.now(),
        Date.now(),
        id,
      ]
    );
  },

  async markSynced(id) {
    const db = await getDatabase();

    // ─── FIX: execute → run (parameterized UPDATE)
    await db.run(
      `UPDATE messages
       SET sync_status = 'synced',
           updated_at = ?
       WHERE id = ?`,
      [Date.now(), id]
    );
  },

  async getPendingSync() {
    const db = await getDatabase();

    const res = await db.query(
      `SELECT *
       FROM messages
       WHERE sync_status != 'synced'`
    );

    return (res.values || []).map(
      this._deserialize
    );
  },

  _serialize(data) {
    if (!data) {
      return null;
    }

    const id =
      data.id ??
      data._id ??
      null;

    const workspaceValue =
      data.workspace_id ??
      data.workspaceId ??
      data.workspace ??
      null;

    const workspace_id =
      workspaceValue?._id ??
      workspaceValue?.id ??
      workspaceValue ??
      null;

    const chatValue =
      data.chat_id ??
      data.chatId ??
      data.chat ??
      null;

    const chat_id =
      chatValue?._id ??
      chatValue?.id ??
      chatValue ??
      null;

    const senderValue =
      data.sender_id ??
      data.senderId ??
      data.sender ??
      null;

    const sender_id =
      senderValue?._id ??
      senderValue?.id ??
      senderValue ??
      null;

    const replyValue =
      data.reply_to ??
      data.replyTo ??
      null;

    const reply_to =
      replyValue?._id ??
      replyValue?.id ??
      replyValue ??
      null;

    const deletedByValue =
      data.deleted_by ??
      data.deletedBy ??
      null;

    const deleted_by =
      deletedByValue?._id ??
      deletedByValue?.id ??
      deletedByValue ??
      deletedByValue;

    const messageType =
      data.message_type ??
      data.messageType ??
      'text';

    const isDeleted =
      data.is_deleted ??
      data.isDeleted ??
      false;

    const edited =
      data.edited ??
      false;

    const status =
      data.status ??
      'sent';

    const syncStatus =
      data.sync_status ??
      data.syncStatus ??
      'synced';

    return {
      id,

      workspace_id,

      chat_id,

      sender_id,

      content:
        data.content ??
        null,

      message_type:
        messageType,

      media_url:
        data.media_url ??
        data.mediaUrl ??
        null,

      media_name:
        data.media_name ??
        data.mediaName ??
        null,

      media_size:
        data.media_size ??
        data.mediaSize ??
        null,

      media_duration:
        data.media_duration ??
        data.mediaDuration ??
        null,

      mentions:
        stringifyJSON(
          data.mentions
        ),

      reply_to,

      is_deleted:
        isDeleted ? 1 : 0,

      deleted_by,

      deleted_at:
        toTimestamp(
          data.deleted_at ??
          data.deletedAt
        ),

      edited:
        edited ? 1 : 0,

      edited_at:
        toTimestamp(
          data.edited_at ??
          data.editedAt
        ),

      read_by:
        stringifyJSON(
          data.read_by ??
          data.readBy
        ),

      archived_by:
        stringifyJSON(
          data.archived_by ??
          data.archivedBy
        ),

      starred_by:
        stringifyJSON(
          data.starred_by ??
          data.starredBy
        ),

      created_at:
        toTimestamp(
          data.created_at ??
          data.createdAt ??
          data.createdAt ??
          Date.now()
        ),

      updated_at:
        toTimestamp(
          data.updated_at ??
          data.updatedAt ??
          Date.now()
        ),

      status,

      sync_status:
        syncStatus,
    };
  },

  _deserialize(row) {
    if (!row) {
      return null;
    }

    return {
      id:
        row.id,

      workspaceId:
        row.workspace_id,

      chatId:
        row.chat_id,

      senderId:
        row.sender_id,

      content:
        row.content,

      messageType:
        row.message_type,

      mediaUrl:
        row.media_url,

      mediaName:
        row.media_name,

      mediaSize:
        row.media_size,

      mediaDuration:
        row.media_duration,

      mentions:
        parseJSON(row.mentions),

      replyTo:
        row.reply_to,

      isDeleted:
        row.is_deleted === 1,

      deletedBy:
        row.deleted_by,

      deletedAt:
        row.deleted_at,

      edited:
        row.edited === 1,

      editedAt:
        row.edited_at,

      readBy:
        parseJSON(row.read_by),

      archivedBy:
        parseJSON(row.archived_by),

      starredBy:
        parseJSON(row.starred_by),

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,

      status:
        row.status,

      syncStatus:
        row.sync_status,
    };
  },
};