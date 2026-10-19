// src/screens/workspace/WorkspaceDMs.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useGetWorkspaceQuery } from '../../slices/workspaceApiSlice.js';
import {
  useGetUserChatsQuery,
  useCreateDirectChatMutation,
  messagingApiSlice,
} from '../../slices/messagingApiSlice.js';
import { useSocket } from '../../components/SocketContext.jsx';
import WorkspaceSidebar from '../../components/WorkspaceSidebar.jsx';
import WorkspaceBottombar from '../../components/WorkspaceBottombar.jsx';
import {
  FaArrowLeft,
  FaSearch,
  FaComment,
  FaTimes,
  FaPlus,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Base path (keep in sync with WorkspaceSidebar / WorkspaceBottombar / WorkspaceId / WorkspaceChannels) ──
const WORKSPACE_BASE_PATH = '/workspace';

// ─── Helper: get initials ────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return String(name)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

// ─── Helper: format last message preview ─────────────────────────────
const getLastMessagePreview = (message, currentUserId) => {
  if (!message) return 'No messages yet';

  let preview = '';
  if (message.messageType === 'text') preview = message.content || 'Message';
  else if (message.messageType === 'image') preview = '📷 Photo';
  else if (message.messageType === 'audio') preview = '🎤 Voice note';
  else if (message.messageType === 'video') preview = '🎬 Video';
  else if (message.messageType === 'file') preview = `📎 ${message.mediaName || 'File'}`;
  else if (message.messageType === 'sticker') preview = '📌 Sticker';
  else preview = 'Message';

  const senderId = String(message.sender?._id || message.sender || '');
  if (senderId && senderId === String(currentUserId)) {
    preview = `You: ${preview}`;
  }
  return preview;
};

// ─── Helper: format last message time ────────────────────────────────
const formatLastMessageTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
};

// ─── Helper: belongs to workspace ────────────────────────────────────
const belongsToWorkspace = (chat, workspaceId) => {
  if (!chat) return false;
  const chatWsId =
    typeof chat.workspace === 'object' && chat.workspace !== null
      ? chat.workspace._id
      : chat.workspace;
  if (chat.scope && chat.scope !== 'workspace') return false;
  if (chatWsId) return String(chatWsId) === String(workspaceId);
  return true;
};

// ─── Helper: force unique by id ──────────────────────────────────────
const forceUniqueById = (arr, getId = (item) => item?._id) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    if (!item) continue;
    const id = getId(item);
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    out.push(item);
  }
  return out;
};

// ═════════════════════════════════════════════════════════════════════
//  Search-existing-DMs modal
// ═════════════════════════════════════════════════════════════════════
const SearchDMModal = ({ isOpen, onClose, dms, brandColor, workspaceId }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;

  const filtered = dms.filter((dm) => {
    const name = (dm.participant?.name || '').toLowerCase();
    const msg = (dm.lastMessagePreview || '').toLowerCase();
    const q = query.toLowerCase();
    return name.includes(q) || msg.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50 dark:bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft />
        </button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-200 dark:border-gray-800/40 focus-within:border-teal-500 dark:focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
          <input
            type="text"
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search conversations</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">No results for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="space-y-1">
            {filtered.map((dm) => (
              <Link
                key={dm.chatId}
                to={`${WORKSPACE_BASE_PATH}/${workspaceId}/chat/${dm.chatId}`}
                onClick={onClose}
                className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
              >
                <div className="relative flex-shrink-0">
                  {dm.participant?.profile ? (
                    <img src={dm.participant.profile} alt={dm.participant.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: brandColor }}
                    >
                      {getInitials(dm.participant?.name)}
                    </div>
                  )}
                  {dm.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#0b0b10]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition truncate">
                      {dm.participant?.name || 'Unknown'}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {formatLastMessageTime(dm.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{dm.lastMessagePreview}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  New DM modal — pick any workspace member
// ═════════════════════════════════════════════════════════════════════
const NewChatModal = ({ isOpen, onClose, members, brandColor, currentUserId, onStartDM }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setSearchQuery('');
  }, [isOpen]);

  const filteredMembers = (members || [])
    .filter((m) => {
      const user = m.user || m;
      return String(user._id) !== String(currentUserId);
    })
    .filter((m) => {
      const user = m.user || m;
      const name = (user?.name || '').toLowerCase();
      const email = (user?.email || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return !q || name.includes(q) || email.includes(q);
    });

  const handleSelect = async (userId) => {
    setIsLoading(true);
    try {
      await onStartDM(userId);
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">New Message</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-500 text-sm">
              {searchQuery ? 'No members found' : 'No members available'}
            </div>
          ) : (
            filteredMembers.map((member) => {
              const user = member.user || member;
              const isOnline = member.status === 'active';
              return (
                <button
                  key={user._id}
                  onClick={() => handleSelect(user._id)}
                  disabled={isLoading}
                  className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-xl transition disabled:opacity-50"
                >
                  <div className="relative flex-shrink-0">
                    {user?.profile ? (
                      <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#0b0b10]" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                      {isOnline ? 'Online' : 'Offline'}
                      {user.email && ` · ${user.email}`}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Main
// ═════════════════════════════════════════════════════════════════════
const WorkspaceDMs = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);
  const { socket, isConnected } = useSocket();

  const [searchOpen, setSearchOpen] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const {
    data: workspaceData,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useGetWorkspaceQuery(workspaceId);

  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useGetUserChatsQuery(workspaceId, {
    skip: !workspaceId,
    pollingInterval: 25000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const [createDirectChat] = useCreateDirectChatMutation();

  // ─── Instant cache patch ──────────────────────────────────────────
  const patchChatInCache = useCallback(
    (chatId, patch) => {
      dispatch(
        messagingApiSlice.util.updateQueryData('getUserChats', workspaceId, (draft) => {
          if (!draft?.chats) return;
          const chat = draft.chats.find((c) => c._id === chatId);
          if (chat) Object.assign(chat, patch);
        })
      );
    },
    [dispatch, workspaceId]
  );

  // ─── Socket listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return;
    const handleChatListUpdate = ({ chatId, lastMessage, lastMessageAt, unreadCount }) => {
      if (!chatId) return;
      patchChatInCache(chatId, {
        lastMessage: lastMessage ?? null,
        lastMessageAt: lastMessageAt ?? new Date().toISOString(),
        ...(typeof unreadCount === 'number' ? { unreadCount } : {}),
      });
    };
    socket.on('chat-list-update', handleChatListUpdate);
    return () => socket.off('chat-list-update', handleChatListUpdate);
  }, [socket, isConnected, patchChatInCache]);

  useEffect(() => {
    if (isConnected) refetchChats();
  }, [isConnected, refetchChats]);

  useEffect(() => {
    if (workspaceError) navigate('/my-workspaces', { replace: true });
  }, [workspaceError, navigate]);

  // ─── Dedupe raw chats → workspace DMs by participant ─────────────
  const rawChats = useMemo(() => {
    return forceUniqueById(chatsData?.chats || [], (c) => c?._id);
  }, [chatsData]);

  const dms = useMemo(() => {
    if (!rawChats.length) return [];
    const myId = String(userInfo?._id || '');
    const byParticipant = new Map();

    for (const chat of rawChats) {
      if (!belongsToWorkspace(chat, workspaceId)) continue;
      if (chat.type !== 'direct') continue;

      const other = chat.participants?.find(
        (p) => String(p.user?._id || p.user) !== myId
      );
      const pid = String(other?.user?._id || other?.user);
      if (!pid || pid === 'undefined') continue;

      const existing = byParticipant.get(pid);
      const chatTs = new Date(chat.lastMessageAt || chat.updatedAt || 0);
      const existingTs = existing
        ? new Date(existing.lastMessageAt || existing.updatedAt || 0)
        : 0;
      if (!existing || chatTs > existingTs) {
        byParticipant.set(pid, chat);
      }
    }

    return Array.from(byParticipant.values())
      .map((chat) => {
        const other = chat.participants.find(
          (p) => String(p.user?._id || p.user) !== myId
        );
        const participant = other?.user || other;
        const lastMessage = chat.lastMessage || null;
        return {
          chatId: chat._id,
          participant,
          lastMessageAt: chat.lastMessageAt || chat.updatedAt,
          lastMessagePreview: getLastMessagePreview(lastMessage, userInfo?._id),
          unreadCount: chat.unreadCount || 0,
          isOnline: !!participant?.online,
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  }, [rawChats, userInfo, workspaceId]);

  // ─── Start DM ──────────────────────────────────────────────────────
  const handleStartDM = async (targetUserId) => {
    if (String(targetUserId) === String(userInfo?._id)) {
      toast.info("You can't start a DM with yourself");
      return;
    }
    try {
      const existing = rawChats.find(
        (chat) =>
          chat.type === 'direct' &&
          belongsToWorkspace(chat, workspaceId) &&
          chat.participants?.some(
            (p) => String(p.user?._id || p.user) === String(targetUserId)
          )
      );
      if (existing) {
        navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/chat/${existing._id}`);
        return;
      }

      const result = await createDirectChat({ workspaceId, targetUserId }).unwrap();
      const newChat = result.chat;

      // Instant cache update — prevents "Chat not found" on first navigation
      dispatch(
        messagingApiSlice.util.updateQueryData('getUserChats', workspaceId, (draft) => {
          if (!draft?.chats) draft.chats = [];
          if (!draft.chats.some((c) => c._id === newChat._id)) {
            draft.chats.unshift(newChat);
          }
        })
      );

      toast.success('Chat started!');
      navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/chat/${newChat._id}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start chat');
    }
  };

  // ─── Loading / error states ───────────────────────────────────────
  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{
              borderColor: workspaceData?.workspace?.color || '#0d9488',
              borderTopColor: 'transparent',
            }}
          />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading messages...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  if (!workspace) return null;

  const brandColor = workspace.color || '#0d9488';
  const members = workspace.members || [];

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block md:w-[260px] md:min-h-screen md:flex-shrink-0 fixed top-0 left-0 z-20">
        <WorkspaceSidebar workspace={workspace} chats={rawChats} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0f0f12] lg:bg-gray-50 dark:lg:bg-[#0b0b10] h-full overflow-hidden md:ml-[260px] workspace-shell-main">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}`)}
                className="md:hidden p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Messages</h1>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40">
                {dms.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
                aria-label="Search messages"
              >
                <FaSearch className="text-sm" />
              </button>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
                aria-label="New message"
              >
                <FaPlus className="text-sm" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12] divide-y divide-gray-100 dark:divide-gray-800/30">
          {dms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <FaComment className="text-4xl mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-3 px-4 py-1.5 text-white rounded-lg text-sm font-medium transition hover:opacity-80"
                style={{ backgroundColor: brandColor }}
              >
                New Message
              </button>
            </div>
          ) : (
            dms.map((dm) => {
              const name = dm.participant?.name || 'Unknown';
              const avatar = dm.participant?.profile;
              return (
                <Link
                  key={dm.chatId}
                  to={`${WORKSPACE_BASE_PATH}/${workspaceId}/chat/${dm.chatId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition group"
                >
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-12 h-12 rounded-2xl object-cover" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(name)}
                      </div>
                    )}
                    {dm.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#0f0f12] group-hover:border-gray-50 dark:group-hover:border-[#1a1a24]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
                        {name}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">
                        {formatLastMessageTime(dm.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">
                        {dm.lastMessagePreview}
                      </p>
                      {dm.unreadCount > 0 && (
                        <span
                          className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex-shrink-0"
                          style={{ backgroundColor: brandColor }}
                        >
                          {dm.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile bottombar */}
      <WorkspaceBottombar workspace={workspace} />

      {/* Modals */}
      <SearchDMModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        dms={dms}
        brandColor={brandColor}
        workspaceId={workspaceId}
      />

      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        members={members}
        brandColor={brandColor}
        currentUserId={userInfo?._id}
        onStartDM={handleStartDM}
      />
    </div>
  );
};

export default WorkspaceDMs;