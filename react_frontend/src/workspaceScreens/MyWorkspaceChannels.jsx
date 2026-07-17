// src/workspaceScreens/MyWorkspaceChannels.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetUserChatsQuery,
  useCreateGroupChatMutation,
  useAddParticipantMutation,
} from '../slices/messagingApiSlice';
import { useGetMembersQuery } from '../slices/teamApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaHashtag,
  FaUsers,
  FaPlus,
  FaSearch,
  FaArrowLeft,
  FaTimes,
  FaBell,
  FaComment,
  FaUserCheck,
  FaClock,
  FaChevronRight,
  FaLock,
  FaUserCircle,
  FaCog,
  FaEllipsisV,
  FaRocket,
  FaCalendarAlt,
  FaGlobe,
  FaMapMarkerAlt,
  FaBuilding,
  FaLink,
  FaPhone,
  FaEnvelope,
  FaThumbtack,
  FaStar,
  FaRegStar,
  FaCircle,
  FaUserPlus,
  FaCheck,
  FaSpinner,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

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

// ─── Add Participant Modal ──────────────────────────────────────────────
const AddParticipantModal = ({
  isOpen,
  onClose,
  workspaceId,
  chatId,
  brandColor,
  existingParticipantIds,
  onSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addParticipant] = useAddParticipantMutation(); // ✅ correct hook
  const { data: membersData, isLoading: membersLoading } = useGetMembersQuery(workspaceId);

  // Filter members: exclude existing participants and current user (handled by backend)
  const availableMembers = membersData?.members
    ?.filter((m) => {
      const userId = m.user?._id || m._id;
      return !existingParticipantIds.includes(userId);
    })
    .filter((m) => {
      const user = m.user || m;
      const name = user?.name?.toLowerCase() || '';
      const email = user?.email?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return name.includes(query) || email.includes(query);
    }) || [];

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.info('Select at least one member to add.');
      return;
    }

    try {
      setIsLoading(true);
      await addParticipant({
        chatId,
        userIds: selectedUsers,
      }).unwrap();
      toast.success(`${selectedUsers.length} member(s) added!`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to add participants');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200/80">
          <h2 className="text-lg font-semibold text-gray-900">Add Members</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600"
          >
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
          <p className="text-xs text-gray-400 mt-1.5">
            {availableMembers.length} members available
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {membersLoading ? (
            <div className="text-center py-8 text-gray-400">
              <FaSpinner className="animate-spin mx-auto text-lg" />
              <p className="text-xs mt-1">Loading members...</p>
            </div>
          ) : availableMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {searchQuery ? 'No members found' : 'All members are already in this channel'}
            </div>
          ) : (
            availableMembers.map((member) => {
              const user = member.user || member;
              const isSelected = selectedUsers.includes(user._id);
              const isOnline = member.status === 'active';
              return (
                <button
                  key={user._id}
                  onClick={() => toggleUser(user._id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition ${
                    isSelected
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {user?.profile ? (
                      <img
                        src={user.profile}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: brandColor }}
                      >
                        {user?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {isOnline ? 'Online' : 'Offline'}
                      {user?.email && ` · ${user.email}`}
                    </p>
                  </div>
                  {isSelected && (
                    <FaCheck className="text-sm" style={{ color: brandColor }} />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-200/80">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading || selectedUsers.length === 0}
            className="flex-1 py-2.5 text-white rounded-lg transition hover:opacity-90 disabled:opacity-50 text-sm font-medium"
            style={{ backgroundColor: brandColor }}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <FaSpinner className="animate-spin mx-auto" />
            ) : (
              `Add ${selectedUsers.length} member${selectedUsers.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Channel Modal ──────────────────────────────────────────────
const CreateChannelModal = ({ isOpen, onClose, workspaceId, brandColor, onSuccess }) => {
  const [channelName, setChannelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createGroupChat] = useCreateGroupChatMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = channelName.trim();

    if (!trimmedName) {
      toast.error('Channel name is required');
      return;
    }

    const cleanName = trimmedName.toLowerCase().replace(/\s+/g, '-');
    if (cleanName.length > 20) {
      toast.error('Channel name must be 20 characters or less');
      return;
    }

    try {
      setIsLoading(true);
      const result = await createGroupChat({
        workspaceId,
        name: cleanName,
      }).unwrap();

      toast.success(`Channel #${cleanName} created!`);
      setChannelName('');
      onSuccess(result.chat);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create channel');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Create Channel</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Channel Name *</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <FaHashtag className="text-sm" />
              </div>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. general, random"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                style={{ '--tw-ring-color': brandColor }}
                onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">Lowercase, no spaces, max 20 characters</p>
          </div>
          <div className="mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-500 flex items-center gap-2">
              <FaUsers className="text-xs" />
              <span>All workspace members will be added automatically</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700">Cancel</button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 text-white rounded-lg transition hover:opacity-90 disabled:opacity-70 text-sm font-medium"
              style={{ backgroundColor: brandColor }}
            >
              {isLoading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────

const MyWorkspaceChannels = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);

  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading, refetch } = useGetUserChatsQuery(workspaceId);

  // Determine user's role in the workspace
  const userMembership = workspaceData?.workspace?.members?.find(
    (m) => m.user?._id === userInfo?._id || m.user === userInfo?._id
  );
  const userRole = userMembership?.role || 'Member';

  useEffect(() => {
    refetch();
  }, [workspaceId, refetch]);

  const handleChannelCreated = () => refetch();
  const handleParticipantsAdded = () => {
    refetch();
    setSelectedChatId(null);
  };

  if (error) navigate('/my-workspaces');

  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-500">Loading channels...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const chats = chatsData?.chats || [];

  if (!workspace) return null;

  const brandColor = workspace.color || '#4F46E5';
  const activeMembers = workspace.members?.filter(m => m.status === 'active') || [];
  const onlineCount = activeMembers.filter(m => m.status === 'active').length || 0;
  const pendingMembers = workspace.members?.filter(m => m.status === 'pending') || [];

  const groupChats = chats.filter(c => c.type === 'group');
  const directMessages = chats.filter(c => c.type === 'direct');
  const totalUnread = chats.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);

  const filteredChannels = groupChats.filter(channel =>
    channel.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDMs = directMessages.filter(dm => {
    const participant = dm.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    );
    const name = participant?.user?.name || participant?.name || 'Unknown';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getDMParticipant = (chat) => {
    const otherParticipant = chat.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    );
    return otherParticipant?.user || otherParticipant;
  };

  // Get existing participant IDs for a chat
  const getExistingParticipantIds = (chat) => {
    return chat.participants.map(p => p.user?._id || p.user);
  };

  // Check if user can add participants (admin or owner)
  const canAddParticipants = (chat) => {
    const isAdmin = chat.participants?.some(
      (p) => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === 'admin'
    );
    return isAdmin || userRole === 'Owner';
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col lg:flex-row">
      {/* ── Left Sidebar (desktop) ── */}
      <div className="hidden lg:block lg:w-64 lg:h-screen lg:flex-shrink-0 lg:sticky lg:top-0">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
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
            <h1 className="text-lg font-semibold text-gray-900">Channels</h1>
            <span className="text-xs text-gray-400 ml-1">{groupChats.length}</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
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
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm bg-gray-50"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>
        </div>

        {/* ── Channel List ── */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {filteredChannels.length === 0 && filteredDMs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FaHashtag className="text-3xl mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No channels yet</p>
              <p className="text-xs mt-1">Create your first channel</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 px-4 py-1.5 text-white rounded-lg text-sm font-medium transition hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                New Channel
              </button>
            </div>
          ) : (
            <>
              {filteredChannels.map((channel) => {
                const lastMsgTime = channel.updatedAt ? formatTime(channel.updatedAt) : '';
                const memberCount = channel.participants?.length || 0;
                const canAdd = canAddParticipants(channel);
                return (
                  <div
                    key={channel._id}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/50 transition group"
                  >
                    <Link
                      to={`/my-workspace/${workspaceId}/chat/${channel._id}`}
                      className="flex items-center gap-3 flex-1 min-w-0 py-2"
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${brandColor}15` }}
                        >
                          <FaHashtag className="text-sm" style={{ color: brandColor }} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{channel.name}</p>
                          {lastMsgTime && <span className="text-[10px] text-gray-400 flex-shrink-0">{lastMsgTime}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-500 truncate">{memberCount} members</p>
                          {channel.unreadCount > 0 && (
                            <span
                              className="text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-medium flex-shrink-0"
                              style={{ backgroundColor: brandColor }}
                            >
                              {channel.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* Add Members button - only for admins/owners */}
                    {canAdd && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChatId(channel._id);
                          setShowAddParticipantModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Add members"
                      >
                        <FaUserPlus className="text-sm" />
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ─── Right Sidebar (desktop) ─── */}
      <div className="hidden lg:block w-72 flex-shrink-0 bg-white border-l border-gray-200/80 h-screen overflow-y-auto p-4">
        {/* Workspace Profile */}
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200/80 p-4 mb-4">
          <div className="flex items-center gap-3">
            {workspace.logo ? (
              <img src={workspace.logo} alt={workspace.name} className="w-10 h-10 rounded-xl object-cover border border-gray-200" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm border border-gray-200" style={{ backgroundColor: brandColor }}>
                {workspace.initials || workspace.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{workspace.name}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{activeMembers.length} members</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="flex items-center gap-1 text-green-600">
                  <FaCircle className="text-[8px]" /> {onlineCount} online
                </span>
              </div>
            </div>
            <Link to={`/my-workspace/${workspaceId}/settings`} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
              <FaCog className="text-sm" />
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {[
            { label: 'Members', value: activeMembers.length, icon: FaUsers },
            { label: 'Channels', value: groupChats.length, icon: FaHashtag },
            { label: 'Online', value: onlineCount, icon: FaCircle },
            { label: 'Unread', value: totalUnread, icon: FaBell },
          ].map((stat, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-2 text-center border border-gray-200/60">
              <stat.icon className="text-xs mx-auto mb-1" style={{ color: brandColor }} />
              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
              <p className="text-[8px] text-gray-400 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(workspace.inviteCode);
              toast.success('Invite code copied!');
            }}
            className="flex flex-col items-center gap-0.5 p-2 bg-gray-50 rounded-lg border border-gray-200/60 hover:bg-gray-100 transition text-xs text-gray-600"
          >
            <FaRocket className="text-sm" style={{ color: brandColor }} />
            <span>Invite</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex flex-col items-center gap-0.5 p-2 bg-gray-50 rounded-lg border border-gray-200/60 hover:bg-gray-100 transition text-xs text-gray-600"
          >
            <FaPlus className="text-sm" style={{ color: brandColor }} />
            <span>New</span>
          </button>
          <Link
            to={`/my-workspace/${workspaceId}/members`}
            className="flex flex-col items-center gap-0.5 p-2 bg-gray-50 rounded-lg border border-gray-200/60 hover:bg-gray-100 transition text-xs text-gray-600"
          >
            <FaUsers className="text-sm" style={{ color: brandColor }} />
            <span>Manage</span>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="mb-4">
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <FaBell className="text-xs" style={{ color: brandColor }} /> Recent Activity
          </h4>
          <div className="space-y-1">
            {chats.slice(0, 4).map((chat) => {
              const lastMsg = chat.lastMessage;
              if (!lastMsg) return null;
              const sender = workspace.members?.find(m => m.user?._id === lastMsg.sender?._id || m.user === lastMsg.sender)?.user || lastMsg.sender;
              const isGroup = chat.type === 'group';
              const channelName = isGroup ? chat.name : 'DM';
              return (
                <div key={chat._id} className="flex items-start gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition">
                  {sender?.profile ? (
                    <img src={sender.profile} alt={sender.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0" style={{ backgroundColor: brandColor }}>
                      {sender?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-700 truncate">{sender?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-gray-400">in</span>
                      <span className="text-[10px] font-medium text-gray-500 truncate">{channelName}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{lastMsg.content || 'Media'}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatTime(lastMsg.createdAt)}
                  </span>
                </div>
              );
            })}
            {chats.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No recent activity</p>
            )}
          </div>
        </div>

        {/* Top Channels */}
        <div className="mb-4">
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <FaStar className="text-xs" style={{ color: brandColor }} /> Top Channels
          </h4>
          <div className="space-y-1">
            {groupChats.slice(0, 3).map((channel, idx) => {
              const activity = Math.floor(Math.random() * 100) + 10; // mock activity
              const width = Math.min(activity, 100);
              return (
                <Link
                  key={channel._id}
                  to={`/my-workspace/${workspaceId}/chat/${channel._id}`}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition group"
                >
                  <span className="text-xs font-medium text-gray-400 w-4">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 truncate group-hover:text-gray-900 transition">#{channel.name}</span>
                      <span className="text-[10px] text-gray-400">{channel.participants?.length || 0} members</span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 rounded-full mt-0.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${width}%`, backgroundColor: brandColor }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
            {groupChats.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No channels yet</p>
            )}
          </div>
        </div>

        {/* Your Role */}
        <div className="flex items-center gap-2 px-2 py-2 bg-gray-50 rounded-lg border border-gray-200/60">
          <FaUserCircle className="text-gray-400 text-sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 truncate">{userInfo?.name}</p>
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${userRole === 'Owner' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                {userRole}
              </span>
              {userRole === 'Owner' && <span className="text-[9px] text-gray-400">· Full access</span>}
            </div>
          </div>
          <Link to="/profile" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
            Edit
          </Link>
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <MyWorkspaceBottombar workspace={workspace} />

      {/* ── Create Channel Modal ── */}
      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        workspaceId={workspaceId}
        brandColor={brandColor}
        onSuccess={handleChannelCreated}
      />

      {/* ── Add Participant Modal ── */}
      <AddParticipantModal
        isOpen={showAddParticipantModal}
        onClose={() => {
          setShowAddParticipantModal(false);
          setSelectedChatId(null);
        }}
        workspaceId={workspaceId}
        chatId={selectedChatId}
        brandColor={brandColor}
        existingParticipantIds={
          selectedChatId
            ? getExistingParticipantIds(
                groupChats.find((c) => c._id === selectedChatId)
              )
            : []
        }
        onSuccess={handleParticipantsAdded}
      />
    </div>
  );
};

export default MyWorkspaceChannels;