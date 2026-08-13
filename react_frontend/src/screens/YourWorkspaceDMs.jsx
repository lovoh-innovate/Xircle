// src/workspaceScreens/YourWorkspaceDMs.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetUserChatsQuery,
  useCreateDirectChatMutation,
  messagingApiSlice,
} from '../slices/messagingApiSlice';
import { useSocket } from '../components/SocketContext.jsx';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaArrowLeft,
  FaSearch,
  FaComment,
  FaTimes,
  FaPlus,
  FaSpinner,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';

// ─── Helper: get initials ──────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

// ─── Helper: format last message preview ────────────────────────────
const getLastMessagePreview = (message) => {
  if (!message) return 'No messages yet';
  if (message.messageType === 'text') return message.content || 'Message';
  if (message.messageType === 'image') return '📷 Photo';
  if (message.messageType === 'audio') return '🎤 Voice note';
  if (message.messageType === 'video') return '🎬 Video';
  if (message.messageType === 'file') return `📎 ${message.mediaName || 'File'}`;
  return 'Message';
};

// ─── Helper: belongs to workspace ─────────────────────────────────────
const belongsToWorkspace = (chat, workspaceId) => {
  if (!chat) return false;
  const chatWorkspaceId =
    typeof chat.workspace === 'object' && chat.workspace !== null
      ? chat.workspace._id
      : chat.workspace;
  return chat.scope === 'workspace' && String(chatWorkspaceId) === String(workspaceId);
};

// ─── Search Members Modal ──────────────────────────────────────────────
const SearchMembersModal = ({ isOpen, onClose, members, brandColor, currentUserId, onStartDM }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;

  const filtered = members
    .filter(m => {
      const user = m.user || m;
      return user._id !== currentUserId;
    })
    .filter(m => {
      const user = m.user || m;
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const q = query.toLowerCase();
      return name.includes(q) || email.includes(q);
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
            placeholder="Search members..."
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
            <p className="text-sm">Search members by name or email</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">No members found for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="space-y-1">
            {filtered.map(member => {
              const user = member.user || member;
              const isOnline = member.status === 'active';
              return (
                <button
                  key={user._id}
                  onClick={() => {
                    onStartDM(user._id);
                    onClose();
                  }}
                  className="flex items-center gap-4 w-full px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
                >
                  <div className="relative flex-shrink-0">
                    {user.profile ? (
                      <img src={user.profile} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#0b0b10]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition truncate">
                      {user.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">{isOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const YourWorkspaceDMs = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);
  const { socket, isConnected } = useSocket();
  const [searchOpen, setSearchOpen] = useState(false);

  // ─── Query argument must match exactly what YourWorkspaceChatId uses ──
  // In YourWorkspaceChatId, useGetUserChatsQuery(workspaceId) is called.
  // So we use workspaceId as the argument to share cache.
  const chatsQueryArg = workspaceId;

  const {
    data: workspaceData,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useGetWorkspaceQuery(workspaceId);

  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useGetUserChatsQuery(chatsQueryArg, {
    // Socket events handle instant updates. This is just a safety-net.
    pollingInterval: 25000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const [createDirectChat, { isLoading: creatingChat }] = useCreateDirectChatMutation();

  // ─── Instant, targeted cache patch — no network round trip ──────────
  const patchChatInCache = useCallback(
    (chatId, patch) => {
      dispatch(
        messagingApiSlice.util.updateQueryData(
          'getUserChats',
          chatsQueryArg,
          (draft) => {
            if (!draft?.chats) return;
            const chat = draft.chats.find((c) => c._id === chatId);
            if (chat) {
              Object.assign(chat, patch);
            }
          }
        )
      );
    },
    [dispatch, chatsQueryArg]
  );

  // ─── Socket listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Fired by the backend on every new message AND every message deletion,
    // for every participant's personal room — so it reaches this list
    // even for chats the user hasn't opened.
    const handleChatListUpdate = ({ chatId, lastMessage, lastMessageAt, unreadCount }) => {
      if (!chatId) return;
      patchChatInCache(chatId, {
        lastMessage: lastMessage ?? null,
        lastMessageAt: lastMessageAt ?? new Date().toISOString(),
        ...(typeof unreadCount === 'number' ? { unreadCount } : {}),
      });
    };

    // Update online status of participants (optional, but nice)
    const handleUserStatusChange = ({ userId, online }) => {
      if (!chatsData?.chats) return;
      // We could patch each chat that contains this user, but it's not critical.
      // We'll rely on the next refetch or let the chat detail page handle it.
    };

    socket.on('chat-list-update', handleChatListUpdate);
    socket.on('user-status-changed', handleUserStatusChange);

    return () => {
      socket.off('chat-list-update', handleChatListUpdate);
      socket.off('user-status-changed', handleUserStatusChange);
    };
  }, [socket, isConnected, patchChatInCache, chatsData]);

  // ─── If socket reconnects, do a quiet refetch ───────────────────────
  useEffect(() => {
    if (isConnected) refetchChats();
  }, [isConnected, refetchChats]);

  // ─── Filter only workspace DMs from cache ────────────────────────────
  const workspaceChats = useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats.filter(
      (chat) => belongsToWorkspace(chat, workspaceId) && chat.type === 'direct'
    );
  }, [chatsData, workspaceId]);

  // ─── Compute display data for each DM ──────────────────────────────────
  const dmList = useMemo(() => {
    return workspaceChats
      .map((chat) => {
        const otherParticipant = chat.participants?.find(
          (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
        )?.user || null;
        if (!otherParticipant) return null;
        return {
          chatId: chat._id,
          otherUser: otherParticipant,
          online: otherParticipant.online || false,
          lastMessage: chat.lastMessage,
          lastMessageAt: chat.lastMessageAt,
          unreadCount: chat.unreadCount || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  }, [workspaceChats, userInfo]);

  // ─── Handle starting a new DM ──────────────────────────────────────
  const handleStartDM = async (targetUserId) => {
    if (targetUserId === userInfo?._id) {
      toast.info("You can't message yourself");
      return;
    }
    try {
      // Check if a DM already exists (in the cached data)
      const existing = workspaceChats.find(
        (chat) =>
          chat.type === 'direct' &&
          chat.participants.some((p) => p.user?._id === targetUserId || p.user === targetUserId)
      );
      if (existing) {
        navigate(`/workspace/${workspaceId}/chat/${existing._id}`);
        return;
      }
      const result = await createDirectChat({ workspaceId, targetUserId }).unwrap();
      toast.success('Chat started!');
      // Refetch to populate the new chat in the list (or we could patch, but refetch is fine)
      refetchChats();
      navigate(`/workspace/${workspaceId}/chat/${result.chat._id}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start chat');
    }
  };

  // ─── Error / loading states ────────────────────────────────────────
  if (workspaceError) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading...</p>
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
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={workspaceChats} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/workspace/${workspaceId}`)}
                className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Direct Messages</h1>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40">
                {dmList.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
                aria-label="New message"
              >
                <FaPlus className="text-sm" />
              </button>
            </div>
          </div>
        </header>

        {/* DM List */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12] divide-y divide-gray-100 dark:divide-gray-800/30">
          {dmList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <FaComment className="text-4xl mb-2 opacity-30" />
              <p className="text-sm">No direct messages yet</p>
              <p className="text-xs mt-1 opacity-60">Start a conversation with a member</p>
            </div>
          ) : (
            dmList.map((dm) => {
              const { otherUser, online, lastMessage, lastMessageAt, chatId, unreadCount } = dm;
              const lastMessageText = getLastMessagePreview(lastMessage);
              const lastMessageTime = lastMessageAt
                ? new Date(lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <button
                  key={chatId}
                  onClick={() => navigate(`/workspace/${workspaceId}/chat/${chatId}`)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition group text-left"
                >
                  <div className="relative flex-shrink-0">
                    {otherUser.profile ? (
                      <img src={otherUser.profile} alt={otherUser.name} className="w-12 h-12 rounded-2xl object-cover" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(otherUser.name)}
                      </div>
                    )}
                    {online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#0f0f12] group-hover:border-gray-50 dark:group-hover:border-[#1a1a24]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition truncate">
                        {otherUser.name}
                      </p>
                      {lastMessageTime && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                          {lastMessageTime}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">
                        {lastMessageText}
                      </p>
                      {unreadCount > 0 && (
                        <span className="ml-2 bg-teal-500 text-white text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      <YourWorkspaceBottombar workspace={workspace} />

      {/* Search Members Modal */}
      <SearchMembersModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        members={members}
        brandColor={brandColor}
        currentUserId={userInfo?._id}
        onStartDM={handleStartDM}
      />
    </div>
  );
};

export default YourWorkspaceDMs;