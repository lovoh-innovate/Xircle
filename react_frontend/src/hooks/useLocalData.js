// src/hooks/useLocalData.js
import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { messagesRepository } from '../database/repositories/messagesRepository';
import { chatsRepository } from '../database/repositories/chatsRepository';
import { messagingApiSlice } from '../slices/messagingApiSlice';

// ─── Helper: ensure chat has _id = id ──────────────────────────
const mapChat = (chat) => {
  if (!chat) return chat;
  return {
    ...chat,
    _id: chat.id,      // make _id equal to id for UI compatibility
  };
};

const mapChats = (chats) => (chats || []).map(mapChat);

// ─── Messages ──────────────────────────────────────────────────
export const useMessages = (chatId, limit = 50) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await messagesRepository.getMessages(chatId, limit);
      // Map each message to have _id = id for UI
      const mapped = data.map(m => ({ ...m, _id: m.id }));
      console.log(`📨 useMessages: loaded ${mapped.length} messages from SQLite`);
      setMessages(mapped);
    } catch (err) {
      console.error('useMessages error:', err);
    } finally {
      setLoading(false);
    }
  }, [chatId, limit]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('message-updated', handler);
    return () => window.removeEventListener('message-updated', handler);
  }, [load]);

  return { messages, loading, refresh: load };
};

// ─── Chat details with fallback to RTK Query ──────────────────
export const useChatDetails = (chatId) => {
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);

  const rtkChats = useSelector(
    messagingApiSlice.endpoints.getUserChats.select({ archived: false })
  )?.data?.chats || [];

  useEffect(() => {
    if (!chatId) {
      setChat(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        // 1️⃣ Try SQLite first
        let data = await chatsRepository.getChatById(chatId);
        if (data) {
          console.log(`✅ useChatDetails: found chat in SQLite: ${chatId}`);
          if (mounted) setChat(mapChat(data));
          if (mounted) setLoading(false);
          return;
        }

        // 2️⃣ Fallback: find in RTK Query cache
        const rtkChat = rtkChats.find((c) => c._id === chatId);
        if (rtkChat) {
          console.log(`✅ useChatDetails: found chat in RTK cache: ${chatId}`);
          // Save to SQLite for next time
          await chatsRepository.saveChat(rtkChat);
          if (mounted) setChat(mapChat(rtkChat));
          if (mounted) setLoading(false);
          return;
        }

        console.warn(`❌ useChatDetails: chat not found anywhere: ${chatId}`);
        if (mounted) setChat(null);
        if (mounted) setLoading(false);
      } catch (err) {
        console.error('useChatDetails error:', err);
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [chatId, rtkChats]);

  return { chat, loading };
};

// ─── Public chats ─────────────────────────────────────────────
export const usePublicChats = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const userId = userInfo?._id;
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setChats([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await chatsRepository.getChatsByUser(userId);
      const publicDirect = all.filter(c => c.scope === 'public' && c.type === 'direct');
      setChats(mapChats(publicDirect));
    } catch (err) {
      console.error('usePublicChats error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('chat-updated', handler);
    return () => window.removeEventListener('chat-updated', handler);
  }, [load]);

  return { chats, loading, refresh: load };
};

// ─── Workspace chats ──────────────────────────────────────────
export const useWorkspaceChats = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const userId = userInfo?._id;
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await chatsRepository.getChatsByUser(userId);
      const wsDirect = all.filter(c => c.scope === 'workspace' && c.type === 'direct');
      const map = {};
      for (const chat of wsDirect) {
        const wsId = chat.workspaceId;
        if (!wsId) continue;
        if (!map[wsId]) map[wsId] = [];
        map[wsId].push(mapChat(chat)); // map each chat
      }
      const groupsArray = Object.entries(map).map(([wsId, chats]) => ({
        workspaceId: wsId,
        workspaceName: `Workspace ${wsId.slice(-4)}`,
        chats: mapChats(chats),
      }));
      setGroups(groupsArray);
    } catch (err) {
      console.error('useWorkspaceChats error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('chat-updated', handler);
    return () => window.removeEventListener('chat-updated', handler);
  }, [load]);

  return { groups, loading, refresh: load };
};