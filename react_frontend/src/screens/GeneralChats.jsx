// pages/GeneralChats.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useGetUserChatsQuery,
  useSearchUsersQuery,
  useCreatePublicDirectChatMutation,
  messagingApiSlice,
} from '../slices/messagingApiSlice';
import { useSocket } from '../components/SocketContext.jsx';
import { toast } from 'react-hot-toast';
import {
  FaComments,
  FaSearch,
  FaPlus,
  FaSpinner,
  FaUser,
  FaCheck,
  FaTimes,
  FaUserPlus,
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Bottom Sheet ──────────────────────────────────────────────────
const BottomSheet = ({ isOpen, onClose, children }) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: animating ? 0 : '100%', opacity: animating ? 1 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full md:max-w-md md:rounded-2xl rounded-t-2xl bg-white dark:bg-[#1a1a1a] shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── New Chat Content ────────────────────────────────────────────
const NewChatContent = ({ onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: searchResults, isLoading: searchLoading } = useSearchUsersQuery(
    { scope: 'public', query: searchQuery },
    { skip: !searchQuery || searchQuery.length < 2 }
  );

  const [createPublicDirectChat] = useCreatePublicDirectChatMutation();

  const users = searchResults?.users || [];

  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  const handleCreateChat = async () => {
    if (!selectedUser) return;
    try {
      setIsCreating(true);
      const result = await createPublicDirectChat({
        userId: selectedUser._id,
      }).unwrap();
      toast.success('Chat started!');
      onSuccess(result.chat._id);
      onClose();
      navigate(`/chats/${result.chat._id}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start chat.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          <FaUserPlus className="inline mr-2 text-teal-500" /> New Chat
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
        >
          <FaTimes />
        </button>
      </div>

      <div className="relative mb-4">
        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
        />
      </div>

      {searchLoading && (
        <div className="flex justify-center py-4">
          <FaSpinner className="animate-spin text-teal-500 text-2xl" />
        </div>
      )}

      {!searchLoading && searchQuery.length >= 2 && users.length === 0 && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <FaUser className="text-3xl mx-auto mb-2 opacity-30" />
          <p className="text-sm">No users found.</p>
        </div>
      )}

      {users.length > 0 && (
        <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {users.map((user) => (
            <div
              key={user._id}
              onClick={() => handleUserSelect(user)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                selectedUser?._id === user._id
                  ? 'bg-teal-50 dark:bg-teal-900/30'
                  : 'hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
              }`}
            >
              {user.profile ? (
                <img
                  src={user.profile}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 dark:text-white truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  @{user.username || 'user'}
                </p>
              </div>
              {selectedUser?._id === user._id && (
                <FaCheck className="text-teal-500" />
              )}
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-xl">
          <div className="flex items-center gap-3">
            {selectedUser.profile ? (
              <img
                src={selectedUser.profile}
                alt={selectedUser.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm">
                {selectedUser.name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <span className="font-medium text-gray-800 dark:text-white">
              {selectedUser.name}
            </span>
          </div>
          <button
            onClick={handleCreateChat}
            disabled={isCreating}
            className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
          >
            {isCreating ? <FaSpinner className="animate-spin" /> : 'Chat'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── DM Item ─────────────────────────────────────────────────────
const DirectChatItem = ({ chat, userId, onNavigate }) => {
  const otherParticipant = chat.participants?.find(
    (p) => p.user?._id !== userId && p.user !== userId
  );
  const displayName = otherParticipant?.user?.name || 'Unknown';
  const avatar = otherParticipant?.user?.profile || null;

  const lastMessage = chat.lastMessage;
  const lastMessageText = lastMessage
    ? lastMessage.messageType === 'text'
      ? lastMessage.content
      : lastMessage.messageType === 'image'
      ? '📷 Image'
      : lastMessage.messageType === 'audio'
      ? '🎵 Audio'
      : lastMessage.messageType === 'video'
      ? '🎬 Video'
      : '📎 File'
    : 'No messages yet';
  const lastMessageTime = lastMessage?.createdAt
    ? new Date(lastMessage.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const unreadCount = chat.unreadCount || 0;

  return (
    <div
      onClick={() => onNavigate(chat._id)}
      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors cursor-pointer"
    >
      {avatar ? (
        <img
          src={avatar}
          alt={displayName}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-800 dark:text-white truncate">
            {displayName}
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
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
const GeneralChats = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);
  const userId = userInfo?._id;
  const { socket, isConnected } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  // The query arg MUST match exactly what GeneralChatId.jsx passes
  // ({ archived: false }) so both pages share the same cache entry.
  const chatsQueryArg = { archived: false };

  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useGetUserChatsQuery(chatsQueryArg, {
    // Socket events (below) handle instant updates. This is just a
    // safety-net fallback in case a socket event is ever missed
    // (e.g. brief disconnect), so it doesn't need to be aggressive.
    pollingInterval: 25000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // ─── Instant, targeted cache patch — no network round trip ──────
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
    [dispatch]
  );

  // ─── Socket listeners ────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Fired by the backend on every new message AND every message
    // deletion, for every participant's personal room — so it reaches
    // this list even for chats the user hasn't opened.
    const handleChatListUpdate = ({ chatId, lastMessage, lastMessageAt, unreadCount }) => {
      if (!chatId) return;
      patchChatInCache(chatId, {
        lastMessage: lastMessage ?? null,
        lastMessageAt: lastMessageAt ?? new Date().toISOString(),
        ...(typeof unreadCount === 'number' ? { unreadCount } : {}),
      });
    };

    socket.on('chat-list-update', handleChatListUpdate);

    return () => {
      socket.off('chat-list-update', handleChatListUpdate);
    };
  }, [socket, patchChatInCache]);

  // If the socket reconnects after being down, do one quiet refetch
  // to reconcile anything that could have been missed.
  useEffect(() => {
    if (isConnected) refetchChats();
  }, [isConnected, refetchChats]);

  // ─── Filter, deduplicate, and sort ─────────────────────────────
  const filteredChats = useMemo(() => {
    if (!chatsData?.chats) return [];

    let directChats = chatsData.chats.filter(
      (chat) => chat.scope === 'public' && chat.type === 'direct'
    );

    // Deduplicate per user pair (keep most recent)
    const directMap = new Map();
    for (const chat of directChats) {
      const other = chat.participants?.find(
        (p) => p.user?._id !== userId && p.user !== userId
      );
      if (!other) continue;
      const otherId = other.user?._id || other.user;
      if (!otherId) continue;
      const key = [userId, otherId].sort().join('_');
      const existing = directMap.get(key);
      if (
        !existing ||
        new Date(chat.lastMessageAt) > new Date(existing.lastMessageAt)
      ) {
        directMap.set(key, chat);
      }
    }
    let deduped = Array.from(directMap.values());

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      deduped = deduped.filter((chat) => {
        const other = chat.participants?.find(
          (p) => p.user?._id !== userId && p.user !== userId
        );
        return other?.user?.name?.toLowerCase().includes(query);
      });
    }

    // Sort by lastMessageAt descending
    deduped.sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );

    return deduped;
  }, [chatsData, searchQuery, userId]);

  const handleNavigate = (chatId) => {
    navigate(`/chats/${chatId}`);
  };

  const handleNewChatSuccess = () => {
    refetchChats();
  };

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 dark:text-gray-500">
      <FaComments className="text-5xl mb-4 opacity-30" />
      <p className="text-lg font-medium">No private conversations yet</p>
      <p className="text-sm">Start a new chat by tapping the + button.</p>
    </div>
  );

  if (chatsLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
                Direct Messages
              </h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 w-40 sm:w-56 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {filteredChats.length === 0 ? (
              renderEmpty()
            ) : (
              filteredChats.map((chat) => (
                <DirectChatItem
                  key={chat._id}
                  chat={chat}
                  userId={userId}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </main>

          <GeneralBottombar />

          <button
            onClick={() => setShowNewChat(true)}
            className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-14 h-14 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
            aria-label="New chat"
          >
            <FaPlus className="text-2xl" />
          </button>
        </div>
      </div>

      <BottomSheet
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
      >
        <NewChatContent
          onClose={() => setShowNewChat(false)}
          onSuccess={handleNewChatSuccess}
        />
      </BottomSheet>
    </>
  );
};

export default GeneralChats;