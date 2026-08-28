// src/database/repositories/chatsRepository.js
import { getDatabase } from '../database';
import { parseJSON, stringifyJSON, toTimestamp } from './utils';

export const chatsRepository = {
  // ─── BULLETPROOF getChatById ──────────────────────────────────────
  async getChatById(id) {
    if (!id) {
      console.warn('⚠️ getChatById called with null/undefined id');
      return null;
    }

    // Normalize the ID: trim and convert to string
    const normalizedId = String(id).trim();
    console.log(`🔍 getChatById: looking for "${normalizedId}"`);

    const db = await getDatabase();

    // 1. Try exact match (case‑sensitive, as SQLite is by default)
    let res = await db.query(`SELECT * FROM chats WHERE id = ?`, [normalizedId]);
    if (res.values && res.values.length > 0) {
      console.log(`✅ Found chat by exact match: ${normalizedId}`);
      return this._deserialize(res.values[0]);
    }

    // 2. Try case‑insensitive match (COLLATE NOCASE)
    res = await db.query(
      `SELECT * FROM chats WHERE id COLLATE NOCASE = ?`,
      [normalizedId]
    );
    if (res.values && res.values.length > 0) {
      console.log(`✅ Found chat by case‑insensitive match: ${normalizedId}`);
      return this._deserialize(res.values[0]);
    }

    // 3. Fallback: scan all chats and compare trimmed IDs
    console.warn(`⚠️ Direct query failed, scanning all chats...`);
    const allRes = await db.query(`SELECT * FROM chats`);
    const allChats = (allRes.values || []).map(this._deserialize);
    console.log(`📋 Total chats in DB: ${allChats.length}`);

    const found = allChats.find((chat) => {
      const chatId = String(chat.id).trim();
      // Compare case‑insensitively
      return chatId.toLowerCase() === normalizedId.toLowerCase();
    });

    if (found) {
      console.log(`✅ Found chat by fallback scan: ${normalizedId}`);
      return found;
    }

    console.warn(`❌ Chat not found: ${normalizedId}`);
    return null;
  },

  async getChatsByWorkspace(workspaceId) {
    const db = await getDatabase();
    const res = await db.query(
      `SELECT * FROM chats WHERE workspace_id = ? ORDER BY last_message_at DESC`,
      [workspaceId]
    );
    return (res.values || []).map(this._deserialize);
  },

  async getChatsByUser(userId) {
    const db = await getDatabase();
    const res = await db.query(`SELECT * FROM chats`);
    const chats = (res.values || []).map(this._deserialize);
    return chats.filter((chat) => {
      const participants = Array.isArray(chat.participants) ? chat.participants : [];
      return participants.some((p) => {
        const pUser = p?.user?._id ?? p?.user ?? p?._id ?? p?.id;
        return String(pUser) === String(userId);
      });
    });
  },

  async saveChat(chat) {
    if (!chat) {
      console.warn('⚠️ saveChat called without a chat');
      return null;
    }

    const db = await getDatabase();
    const serialized = this._serialize(chat);

    if (!serialized.id) {
      console.error('❌ Cannot save chat: chat id is missing', chat);
      return null;
    }

    console.log(`💾 Saving chat with id: ${serialized.id}`);

    if (!serialized.type) {
      console.error('❌ Cannot save chat: chat type is missing', chat);
      return null;
    }

    const {
      id,
      workspace_id,
      type,
      scope,
      name,
      description,
      avatar,
      is_public,
      participants,
      created_by,
      last_message_id,
      last_message_at,
      archived_by,
      join_requests,
      created_at,
      updated_at,
      unread_count,
      sync_status,
    } = serialized;

    await db.run(
      `INSERT OR REPLACE INTO chats (
        id, workspace_id, type, scope, name, description, avatar,
        is_public, participants, created_by, last_message_id,
        last_message_at, archived_by, join_requests,
        created_at, updated_at, unread_count, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        workspace_id,
        type,
        scope,
        name,
        description,
        avatar,
        is_public,
        participants,
        created_by,
        last_message_id,
        last_message_at,
        archived_by,
        join_requests,
        created_at,
        updated_at,
        unread_count,
        sync_status,
      ]
    );

    console.log(`✅ Chat ${id} saved successfully`);
    return this.getChatById(id);
  },

  async updateLastMessage(chatId, lastMessageId, lastMessageAt) {
    const db = await getDatabase();
    const normalizedLastMessageId =
      lastMessageId?._id ?? lastMessageId?.id ?? lastMessageId ?? null;
    await db.run(
      `UPDATE chats SET last_message_id = ?, last_message_at = ?, updated_at = ? WHERE id = ?`,
      [normalizedLastMessageId, toTimestamp(lastMessageAt), Date.now(), chatId]
    );
  },

  async incrementUnread(chatId, delta = 1) {
    const db = await getDatabase();
    await db.run(`UPDATE chats SET unread_count = unread_count + ? WHERE id = ?`, [delta, chatId]);
  },

  async resetUnread(chatId) {
    const db = await getDatabase();
    await db.run(`UPDATE chats SET unread_count = 0 WHERE id = ?`, [chatId]);
  },

  async addParticipant(chatId, user, role = 'member') {
    const chat = await this.getChatById(chatId);
    if (!chat) return;
    let participants = Array.isArray(chat.participants) ? [...chat.participants] : [];
    const userId = user?._id ?? user?.id ?? user;
    if (!participants.some((p) => String(p?.user?._id ?? p?.user ?? p?._id ?? p?.id) === String(userId))) {
      participants.push({ user: userId, role, joinedAt: Date.now(), lastReadAt: Date.now() });
      await this.saveChat({ ...chat, participants });
    }
  },

  async removeParticipant(chatId, userId) {
    const chat = await this.getChatById(chatId);
    if (!chat) return;
    let participants = Array.isArray(chat.participants) ? [...chat.participants] : [];
    participants = participants.filter((p) => {
      const pUser = p?.user?._id ?? p?.user ?? p?._id ?? p?.id;
      return String(pUser) !== String(userId);
    });
    await this.saveChat({ ...chat, participants });
  },

  async markSynced(id) {
    const db = await getDatabase();
    await db.run(`UPDATE chats SET sync_status = 'synced', updated_at = ? WHERE id = ?`, [Date.now(), id]);
  },

  // ─── Serialization / Deserialization ──────────────────────────────
  _serialize(data) {
    if (!data) return null;

    // Use the server's _id as the primary key
    const id = data.id ?? data._id ?? null;
    console.log(`🔍 Serializing chat: data.id=${data.id}, data._id=${data._id}, using id=${id}`);

    if (!id) {
      console.error('❌ Cannot serialize chat: no id or _id found', data);
      return null;
    }

    const workspaceValue = data.workspace_id ?? data.workspaceId ?? data.workspace ?? null;
    const workspace_id = workspaceValue?._id ?? workspaceValue?.id ?? workspaceValue ?? null;

    const type = data.type ?? 'direct';
    const scope = data.scope ?? 'workspace';

    const createdByValue = data.created_by ?? data.createdBy ?? null;
    const created_by = createdByValue?._id ?? createdByValue?.id ?? createdByValue ?? null;

    const lastMessageValue = data.last_message_id ?? data.lastMessageId ?? data.lastMessage ?? null;
    const last_message_id = lastMessageValue?._id ?? lastMessageValue?.id ?? lastMessageValue ?? null;

    // Preserve full participant objects
    let participants = Array.isArray(data.participants) ? data.participants : [];

    const archivedBy = data.archived_by ?? data.archivedBy ?? [];
    const joinRequests = data.join_requests ?? data.joinRequests ?? [];
    const isPublic = data.is_public ?? data.isPublic ?? false;
    const unreadCount = data.unread_count ?? data.unreadCount ?? 0;
    const syncStatus = data.sync_status ?? data.syncStatus ?? 'synced';

    return {
      id,
      workspace_id,
      type,
      scope,
      name: data.name ?? '',
      description: data.description ?? '',
      avatar: data.avatar ?? null,
      is_public: isPublic ? 1 : 0,
      participants: stringifyJSON(participants),
      created_by,
      last_message_id,
      last_message_at: toTimestamp(data.last_message_at ?? data.lastMessageAt ?? data.lastMessage?.createdAt ?? Date.now()),
      archived_by: stringifyJSON(archivedBy),
      join_requests: stringifyJSON(joinRequests),
      created_at: toTimestamp(data.created_at ?? data.createdAt ?? Date.now()),
      updated_at: toTimestamp(data.updated_at ?? data.updatedAt ?? Date.now()),
      unread_count: Number(unreadCount) || 0,
      sync_status: syncStatus,
    };
  },

  _deserialize(row) {
    if (!row) return null;

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      type: row.type,
      scope: row.scope,
      name: row.name,
      description: row.description,
      avatar: row.avatar,
      isPublic: row.is_public === 1,
      participants: parseJSON(row.participants) || [],
      createdBy: row.created_by,
      lastMessageId: row.last_message_id,
      lastMessageAt: row.last_message_at,
      archivedBy: parseJSON(row.archived_by) || [],
      joinRequests: parseJSON(row.join_requests) || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      unreadCount: Number(row.unread_count) || 0,
      syncStatus: row.sync_status,
    };
  },
};