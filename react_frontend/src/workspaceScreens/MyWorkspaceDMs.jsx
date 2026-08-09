// src/workspaceScreens/MyWorkspaceDMs.jsx
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetMembersQuery } from '../slices/teamApiSlice';
import { useGetUserChatsQuery, useCreateDirectChatMutation } from '../slices/messagingApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaArrowLeft,
  FaSearch,
  FaUserCircle,
  FaComment,
  FaCheckCircle,
  FaSpinner,
  FaUser,
  FaPlus,
  FaTimes,
  FaCircle,
  FaCheck,
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

// ─── Helper: format time ──────────────────────────────────────────────
const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return 'Yesterday';
  if (diff < 604800000) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── FORCE DEDUPLICATION HELPER ────────────────────────────────────────
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

// ─── Search DM Modal ────────────────────────────────────────────────────
const SearchDMModal = ({ isOpen, onClose, dms, brandColor, workspaceId, userInfo }) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = dms.filter((dm) => {
    const name = dm.participant?.name?.toLowerCase() || '';
    const msg = dm.lastMessage?.toLowerCase() || '';
    const q = query.toLowerCase();
    return name.includes(q) || msg.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      {/* Modal Header */}
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

      {/* Results */}
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
                to={`/my-workspace/${workspaceId}/chat/${dm.chatId}`}
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
                    <span className="text-xs text-gray-500 dark:text-gray-500">{formatTime(dm.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{dm.lastMessage}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── New Chat Modal ──────────────────────────────────────────────────────
const NewChatModal = ({ isOpen, onClose, members, brandColor, currentUserId, onStartDM }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredMembers = members
    .filter((m) => {
      const user = m.user || m;
      return String(user._id) !== String(currentUserId);
    })
    .filter((m) => {
      const user = m.user || m;
      const name = user?.name?.toLowerCase() || '';
      const email = user?.email?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return name.includes(query) || email.includes(query);
    });

  const handleSelect = async (userId) => {
    setIsLoading(true);
    await onStartDM(userId);
    setIsLoading(false);
    onClose();
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
                  className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-xl transition"
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

// ─── Main Component ──────────────────────────────────────────────────────
const MyWorkspaceDMs = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);
  const { data: membersData, isLoading: membersLoading } = useGetMembersQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } = useGetUserChatsQuery(workspaceId);
  const [createDirectChat, { isLoading: creatingChat }] = useCreateDirectChatMutation();

  // ─── FORCE: deduplicate raw chats by _id first ─────────────────────────
  const rawChats = useMemo(() => {
    const list = chatsData?.chats || [];
    const unique = forceUniqueById(list, (c) => c?._id);
    if (unique.length !== list.length) {
      console.warn(`🛡️ BLOCKED ${list.length - unique.length} duplicate chat _id(s)`);
    }
    return unique;
  }, [chatsData]);

  // ─── NUCLEAR: one entry per participant, keep most recent ────────────
  const dms = useMemo(() => {
    if (!rawChats.length) return [];

    const myId = String(userInfo?._id);
    const byParticipant = new Map();

    for (const chat of rawChats) {
      if (chat.type !== 'direct') continue;

      // FIX: String() comparison because API returns ObjectId, Redux stores string
      const other = chat.participants?.find(
        (p) => String(p.user?._id || p.user) !== myId
      );

      const participantId = String(other?.user?._id || other?.user);
      if (!participantId || participantId === 'undefined') continue;

      const existing = byParticipant.get(participantId);
      if (!existing || new Date(chat.updatedAt) > new Date(existing.updatedAt)) {
        byParticipant.set(participantId, chat);
      }
    }

    return Array.from(byParticipant.values())
      .map((chat) => {
        const other = chat.participants.find(
          (p) => String(p.user?._id || p.user) !== myId
        );
        const participant = other?.user || other;
        return {
          chatId: chat._id,
          participant,
          lastMessage: chat.lastMessage?.content || 'No messages yet',
          timestamp: chat.updatedAt,
          unread: chat.unreadCount || 0,
          isOnline: participant?.online || false,
        };
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [rawChats, userInfo]);

  const handleStartDM = async (targetUserId) => {
    if (String(targetUserId) === String(userInfo?._id)) {
      toast.info("You can't start a DM with yourself");
      return;
    }
    try {
      const myId = String(userInfo?._id);
      const existingChat = rawChats.find(
        (chat) =>
          chat.type === 'direct' &&
          chat.participants.some((p) => String(p.user?._id || p.user) === String(targetUserId))
      );
      if (existingChat) {
        navigate(`/my-workspace/${workspaceId}/chat/${existingChat._id}`);
        return;
      }
      const result = await createDirectChat({
        workspaceId,
        targetUserId,
      }).unwrap();
      toast.success('Direct chat created!');
      navigate(`/my-workspace/${workspaceId}/chat/${result.chat._id}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start DM');
    }
  };

  if (workspaceLoading || membersLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (workspaceError) {
    navigate(`/my-workspace/${workspaceId}`);
    return null;
  }

  const workspace = workspaceData?.workspace;
  const members = membersData?.members || [];
  const brandColor = workspace?.color || '#0d9488';

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left Sidebar (desktop) ── */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={rawChats} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0f0f12] lg:bg-gray-50 dark:lg:bg-[#0b0b10] h-full overflow-hidden">
        {/* ── Fixed Header ── */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/my-workspace/${workspaceId}`)}
                className="lg:hidden p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
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
              >
                <FaSearch className="text-sm" />
              </button>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
              >
                <FaPlus className="text-sm" />
              </button>
            </div>
          </div>
        </header>

        {/* ── DM List (scrollable) ── */}
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
                  to={`/my-workspace/${workspaceId}/chat/${dm.chatId}`}
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
                      <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">{formatTime(dm.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{dm.lastMessage}</p>
                      {dm.unread > 0 && (
                        <span
                          className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex-shrink-0"
                          style={{ backgroundColor: brandColor }}
                        >
                          {dm.unread}
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

      {/* ── Bottom Navigation (mobile) ── */}
      <MyWorkspaceBottombar workspace={workspace} />

      {/* Modals */}
      <SearchDMModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        dms={dms}
        brandColor={brandColor}
        workspaceId={workspaceId}
        userInfo={userInfo}
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

export default MyWorkspaceDMs;