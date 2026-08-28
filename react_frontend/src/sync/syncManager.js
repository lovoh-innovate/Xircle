// src/sync/syncManager.js

import { messagesRepository } from '../database/repositories/messagesRepository';
import { chatsRepository } from '../database/repositories/chatsRepository';
import { syncQueueRepository } from '../database/repositories/syncQueueRepository';
import { getDatabase } from '../database/database';

import { messagingApiSlice } from '../slices/messagingApiSlice';
import { store } from '../store';

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // INITIAL SYNC
  // ───────────────────────────────────────────────────────────────────────────

  async initialSync() {
    if (this.isSyncing) {
      console.log('⏳ Initial sync already running');
      return;
    }

    this.isSyncing = true;

    try {
      console.log('🔄 Starting initial messaging sync...');

      const chatsResponse = await store
        .dispatch(
          messagingApiSlice.endpoints.getUserChats.initiate(
            {},
            { forceRefetch: true }
          )
        )
        .unwrap();

      const chats =
        Array.isArray(chatsResponse)
          ? chatsResponse
          : chatsResponse?.chats ||
            chatsResponse?.data ||
            [];

      console.log(`📥 Initial sync: received ${chats.length} chats`);

      for (const chat of chats) {
        try {
          await chatsRepository.saveChat(chat);
        } catch (error) {
          console.error('❌ Failed to save chat to SQLite:', chat?.id, error);
        }
      }

      for (const chat of chats) {
        const chatId = chat?._id || chat?.id;
        if (!chatId) {
          console.warn('⚠️ Skipping chat without ID:', chat);
          continue;
        }

        try {
          console.log(`📨 Syncing messages for chat: ${chatId}`);

          const messagesResponse = await store
            .dispatch(
              messagingApiSlice.endpoints.getChatMessages.initiate(
                { chatId, page: 1, limit: 50 },
                { forceRefetch: true }
              )
            )
            .unwrap();

          const messages =
            Array.isArray(messagesResponse)
              ? messagesResponse
              : messagesResponse?.messages ||
                messagesResponse?.data ||
                [];

          if (messages.length > 0) {
            await messagesRepository.saveMessages(messages);
            console.log(`✅ Synced ${messages.length} messages for chat ${chatId}`);

            // ─── NEW: Notify UI to refresh this chat ──────────────
            window.dispatchEvent(
              new CustomEvent('message-updated', { detail: { chatId } })
            );
            console.log(`📤 Dispatched message-updated for chat ${chatId}`);
          } else {
            console.log(`✅ Synced 0 messages for chat ${chatId}`);
          }
        } catch (error) {
          console.error(`❌ Failed to sync messages for chat ${chatId}:`, error);
        }
      }

      // ─── NEW: Global refresh after all chats ──────────────────────
      window.dispatchEvent(
        new CustomEvent('message-updated', { detail: { all: true } })
      );

      await this.setLastSyncTime(Date.now());
      console.log('✅ Initial messaging sync completed successfully');
    } catch (error) {
      console.error('❌ Initial messaging sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BACKGROUND SYNC
  // ───────────────────────────────────────────────────────────────────────────

  async backgroundSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      console.log('🔄 Running background messaging sync...');

      const chatsResponse = await store
        .dispatch(
          messagingApiSlice.endpoints.getUserChats.initiate(
            {},
            { forceRefetch: true }
          )
        )
        .unwrap();

      const chats =
        Array.isArray(chatsResponse)
          ? chatsResponse
          : chatsResponse?.chats ||
            chatsResponse?.data ||
            [];

      for (const chat of chats) {
        try {
          await chatsRepository.saveChat(chat);
        } catch (error) {
          console.error('❌ Background chat save failed:', chat?.id, error);
        }
      }

      for (const chat of chats) {
        const chatId = chat?._id || chat?.id;
        if (!chatId) continue;

        try {
          const messagesResponse = await store
            .dispatch(
              messagingApiSlice.endpoints.getChatMessages.initiate(
                { chatId, page: 1, limit: 50 },
                { forceRefetch: true }
              )
            )
            .unwrap();

          const messages =
            Array.isArray(messagesResponse)
              ? messagesResponse
              : messagesResponse?.messages ||
                messagesResponse?.data ||
                [];

          if (messages.length > 0) {
            await messagesRepository.saveMessages(messages);
            console.log(`✅ Background synced ${messages.length} messages for chat ${chatId}`);

            // ─── NEW: Notify UI to refresh this chat ──────────────
            window.dispatchEvent(
              new CustomEvent('message-updated', { detail: { chatId } })
            );
            console.log(`📤 Dispatched message-updated for chat ${chatId}`);
          }
        } catch (error) {
          console.error(`❌ Background message sync failed for ${chatId}:`, error);
        }
      }

      // ─── NEW: Global refresh after all chats ──────────────────────
      window.dispatchEvent(
        new CustomEvent('message-updated', { detail: { all: true } })
      );

      await this.setLastSyncTime(Date.now());
      console.log('✅ Background messaging sync completed');
    } catch (error) {
      console.error('❌ Background sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PROCESS OUTBOX
  // ───────────────────────────────────────────────────────────────────────────

  async processOutbox() {
    try {
      const pending = await syncQueueRepository.getPending();

      if (!pending || pending.length === 0) {
        return;
      }

      console.log(`📤 Processing ${pending.length} pending operations`);

      for (const item of pending) {
        try {
          if (
            item.entity_type === 'message' &&
            item.operation === 'create'
          ) {
            const payload =
              typeof item.payload === 'string'
                ? JSON.parse(item.payload)
                : item.payload;

            const chatId =
              payload?.chatId ||
              payload?.chat_id;

            if (!chatId) {
              throw new Error('Pending message has no chatId');
            }

            const data =
              payload?.data ||
              payload;

            await store
              .dispatch(
                messagingApiSlice.endpoints.sendMessage.initiate(
                  { chatId, data }
                )
              )
              .unwrap();
          }

          await syncQueueRepository.markDone(item.id);
          console.log(`✅ Outbox item ${item.id} processed`);
        } catch (error) {
          console.error(`❌ Failed to process outbox item ${item.id}:`, error);
          await syncQueueRepository.markFailed(item.id);
        }
      }
    } catch (error) {
      console.error('❌ Outbox processing failed:', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // START / STOP BACKGROUND SYNC
  // ───────────────────────────────────────────────────────────────────────────

  startBackgroundSync(intervalMs = 30000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    console.log(`⏱️ Background sync started (${intervalMs}ms)`);

    this.syncInterval = setInterval(() => {
      this.backgroundSync();
      this.processOutbox();
    }, intervalMs);
  }

  stopBackgroundSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Background sync stopped');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LAST SYNC TIME HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  async getLastSyncTime() {
    try {
      const db = await getDatabase();
      const res = await db.query(
        `SELECT value FROM meta WHERE key = 'lastSync'`
      );
      return parseInt(res.values?.[0]?.value, 10) || 0;
    } catch (error) {
      console.error('❌ Failed to get last sync time:', error);
      return 0;
    }
  }

  async setLastSyncTime(time) {
    try {
      const db = await getDatabase();
      await db.run(
        `INSERT OR REPLACE INTO meta (key, value) VALUES ('lastSync', ?)`,
        [String(time)]
      );
    } catch (error) {
      console.error('❌ Failed to save last sync time:', error);
    }
  }
}

export const syncManager = new SyncManager();