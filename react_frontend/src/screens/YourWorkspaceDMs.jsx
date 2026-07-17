// src/workspaceScreens/YourWorkspaceDMs.jsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery, useCreateDirectChatMutation } from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaArrowLeft,
  FaSearch,
  FaComment,
  FaUser,
  FaCheckCircle,
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

// ─── Member Item ──────────────────────────────────────────────────────
const MemberItem = ({ member, brandColor, onClick }) => {
  const user = member.user || member;
  const isOnline = member.status === 'active';
  const name = user?.name || 'Unknown';

  return (
    <button
      onClick={() => onClick && onClick(user._id)}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 rounded-xl transition border-b border-gray-100 last:border-0"
    >
      <div className="relative flex-shrink-0">
        {user?.profile ? (
          <img src={user.profile} alt={name} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: brandColor }}
          >
            {getInitials(name)}
          </div>
        )}
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
        )}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-400 truncate">
          {isOnline ? 'Online' : 'Offline'}
          {user?.email && ` · ${user.email}`}
        </p>
      </div>
      <FaComment className="text-gray-400 hover:text-gray-600 transition text-sm" />
    </button>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────

const YourWorkspaceDMs = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Fetch workspace data ──
  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId);
  const [createDirectChat, { isLoading: creatingChat }] = useCreateDirectChatMutation();

  // ── Derive members from workspace ──
  const workspace = workspaceData?.workspace;
  const members = workspace?.members || [];
  const currentUserId = userInfo?._id;

  // ── Filter out current user and apply search ──
  const filteredMembers = members
    .filter((member) => {
      const user = member.user || member;
      return user._id !== currentUserId;
    })
    .filter((member) => {
      const user = member.user || member;
      const name = user?.name?.toLowerCase() || '';
      const email = user?.email?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return name.includes(query) || email.includes(query);
    });

  // ── Start DM handler ──
  const handleStartDM = async (targetUserId) => {
    if (targetUserId === currentUserId) {
      toast.info("You can't start a DM with yourself");
      return;
    }

    try {
      // Check if a DM already exists
      const existingChat = chatsData?.chats?.find(
        (chat) =>
          chat.type === 'direct' &&
          chat.participants.some((p) => p.user?._id === targetUserId || p.user === targetUserId)
      );

      if (existingChat) {
        navigate(`/workspace/${workspaceId}/chat/${existingChat._id}`);
        return;
      }

      // Create new DM
      const result = await createDirectChat({
        workspaceId,
        targetUserId,
      }).unwrap();

      toast.success('Direct chat created!');
      navigate(`/workspace/${workspaceId}/chat/${result.chat._id}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start DM');
    }
  };

  // ── Loading state ──
  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-500">Loading members...</p>
        </div>
      </div>
    );
  }

  if (workspaceError) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (!workspace) return null;

  const brandColor = workspace.color || '#4F46E5';

  return (
    <div className="h-screen bg-gray-100 flex flex-col md:flex-row overflow-hidden">
      {/* ── Left Sidebar ── */}
      <div className="hidden md:block md:w-64 md:h-screen md:flex-shrink-0 md:sticky md:top-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chatsData?.chats || []} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 bg-white md:min-h-screen overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-6">
          
          {/* ── Header ── */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <button
              onClick={() => navigate(`/workspace/${workspaceId}`)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <FaArrowLeft className="text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FaComment className="text-sm" style={{ color: brandColor }} /> Direct Messages
              </h1>
              <p className="text-sm text-gray-500">
                {filteredMembers.length} members available to message
              </p>
            </div>
          </div>

          {/* ── Search ── */}
          <div className="relative mb-6">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>

          {/* ── Members List ── */}
          <div className="space-y-1">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FaUser className="text-3xl mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No members found</p>
                {searchQuery && <p className="text-xs mt-1">Try a different search term</p>}
              </div>
            ) : (
              filteredMembers.map((member) => (
                <MemberItem
                  key={member.user?._id || member._id}
                  member={member}
                  brandColor={brandColor}
                  onClick={handleStartDM}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <YourWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default YourWorkspaceDMs;