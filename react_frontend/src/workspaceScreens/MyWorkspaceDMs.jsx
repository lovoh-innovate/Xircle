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
import { toast } from 'react-toastify';

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

// ─── New Chat Modal ──────────────────────────────────────────────────────
const NewChatModal = ({ isOpen, onClose, members, brandColor, currentUserId, onStartDM }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredMembers = members
    .filter((m) => {
      const user = m.user || m;
      return user._id !== currentUserId;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200/80">
          <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200/80">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm bg-gray-50"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
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
                  className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 rounded-xl transition"
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
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // ── Fetch data ──
  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);
  const { data: membersData, isLoading: membersLoading } = useGetMembersQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } = useGetUserChatsQuery(workspaceId);
  const [createDirectChat, { isLoading: creatingChat }] = useCreateDirectChatMutation();

  // ── Derive DMs ──
  const dms = useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats
      .filter((chat) => chat.type === 'direct')
      .map((chat) => {
        // Find the other participant
        const other = chat.participants.find(
          (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
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
  }, [chatsData, userInfo]);

  // ── Filter DMs by search ──
  const filteredDMs = dms.filter((dm) => {
    const name = dm.participant?.name?.toLowerCase() || '';
    const msg = dm.lastMessage?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || msg.includes(query);
  });

  // ── Handlers ──
  const handleStartDM = async (targetUserId) => {
    if (targetUserId === userInfo?._id) {
      toast.info("You can't start a DM with yourself");
      return;
    }

    try {
      const existingChat = chatsData?.chats?.find(
        (chat) =>
          chat.type === 'direct' &&
          chat.participants.some((p) => p.user?._id === targetUserId || p.user === targetUserId)
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

  // ── Loading state ──
  if (workspaceLoading || membersLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }}
          />
          <p className="mt-4 text-gray-500">Loading messages...</p>
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
  const brandColor = workspace?.color || '#4F46E5';

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col lg:flex-row">
      {/* ── New Chat Modal ── */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        members={members}
        brandColor={brandColor}
        currentUserId={userInfo?._id}
        onStartDM={handleStartDM}
      />

      {/* ── Left Sidebar ── */}
      <div className="hidden lg:block lg:w-64 lg:h-screen lg:flex-shrink-0 lg:sticky lg:top-0">
        <MyWorkspaceSidebar workspace={workspace} chats={chatsData?.chats || []} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col bg-white lg:bg-[#f0f2f5] h-screen overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/80 bg-white flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate(`/my-workspace/${workspaceId}`)}
              className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition"
            >
              <FaArrowLeft className="text-gray-500 text-sm" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
            <span className="text-xs text-gray-400 ml-1">{dms.length}</span>
          </div>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-lg transition hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            <FaPlus className="text-xs" /> New
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-4 py-2 bg-white border-b border-gray-200/80 flex-shrink-0">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm bg-gray-50"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>
        </div>

        {/* ── DM List ── */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {filteredDMs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FaComment className="text-3xl mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No conversations yet</p>
              <p className="text-xs mt-1">Start a new message with a team member</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-3 px-4 py-1.5 text-white rounded-lg text-sm font-medium transition hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                New Message
              </button>
            </div>
          ) : (
            filteredDMs.map((dm) => {
              const participant = dm.participant;
              const name = participant?.name || 'Unknown';
              const avatar = participant?.profile;
              const isOnline = dm.isOnline;
              const lastMsg = dm.lastMessage || 'No messages yet';
              const time = dm.timestamp ? formatTime(dm.timestamp) : '';
              const unread = dm.unread;

              return (
                <Link
                  key={dm.chatId}
                  to={`/my-workspace/${workspaceId}/chat/${dm.chatId}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white transition-all duration-200 group border border-transparent hover:border-gray-200/80 hover:shadow-sm"
                >
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(name)}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {time && <span className="text-[10px] text-gray-400 flex-shrink-0">{time}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500 truncate">{lastMsg}</p>
                      {unread > 0 && (
                        <span
                          className="text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-medium flex-shrink-0"
                          style={{ backgroundColor: brandColor }}
                        >
                          {unread}
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

      {/* ── Bottom Navigation ── */}
      <MyWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default MyWorkspaceDMs;