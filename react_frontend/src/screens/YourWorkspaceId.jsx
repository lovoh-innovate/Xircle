// src/workspaceScreens/YourWorkspaceId.jsx
import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaUsers,
  FaComment,
  FaFolder,
  FaUserPlus,
  FaHashtag,
  FaBell,
  FaCheckCircle,
  FaChevronRight,
  FaSearch,
  FaArrowRight,
  FaCircle,
  FaEnvelope,
} from 'react-icons/fa';

const YourWorkspaceId = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const { data, isLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData } = useGetUserChatsQuery(workspaceId);

  useEffect(() => {
    if (error) {
      navigate('/my-workspaces');
    }
  }, [error, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: data?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }}
          />
          <p className="mt-4 text-gray-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const workspace = data?.workspace;
  const chats = chatsData?.chats || [];

  if (!workspace) {
    return null;
  }

  const activeMembers = workspace.members?.filter(m => m.status === 'active') || [];
  const onlineCount = activeMembers.filter(m => m.status === 'active').length || 0;
  const channelCount = chats.filter(c => c.type === 'group').length || 0;
  const dmCount = chats.filter(c => c.type === 'direct').length || 0;
  const brandColor = workspace.color || '#4F46E5';

  // Get user's role
  const userMembership = workspace.members?.find(
    (m) => m.user?._id === userInfo?._id || m.user === userInfo?._id
  );
  const userRole = userMembership?.role || 'Member';

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      {/* ── Desktop Sidebar ── */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 fixed top-0 left-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 md:ml-64">
        {/* ─── Sticky Top Bar ─── */}
        <div className="sticky top-0 z-10 bg-[#f0f2f5] px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {workspace.logo ? (
                <img
                  src={workspace.logo}
                  alt={workspace.name}
                  className="w-11 h-11 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base border border-gray-200"
                  style={{ backgroundColor: brandColor }}
                >
                  {workspace.initials || workspace.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 leading-tight truncate">{workspace.name}</h1>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <FaUsers className="text-[10px]" />
                  {activeMembers.length} members · {onlineCount} online
                </p>
              </div>
            </div>

            {/* Search - hidden on small screens */}
            <div className="hidden sm:flex items-center bg-white border border-gray-200/80 rounded-full px-4 py-1.5 flex-1 max-w-xs">
              <FaSearch className="text-gray-400 text-xs mr-2" />
              <input
                type="text"
                placeholder="Search workspace..."
                className="bg-transparent border-none outline-none text-sm text-gray-700 w-full placeholder-gray-400"
              />
            </div>

            <button className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white hover:bg-gray-800 transition">
              <FaBell className="text-sm" />
            </button>
          </div>
        </div>

        {/* ─── Scrollable Content ─── */}
        <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-0">
          {/* ─── Stats Row ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Members', value: activeMembers.length, icon: FaUsers },
              { label: 'Channels', value: channelCount, icon: FaHashtag },
              { label: 'Direct Messages', value: dmCount, icon: FaEnvelope },
              { label: 'Online', value: onlineCount, icon: FaCircle },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 border border-gray-200/60"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}10` }}
                >
                  <stat.icon className="text-sm" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Quick Navigation Cards ─── */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Link
              to={`/workspace/${workspaceId}/channels`}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-200/60 hover:border-gray-300 hover:shadow-md transition group"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition"
                style={{ backgroundColor: `${brandColor}10` }}
              >
                <FaComment className="text-lg" style={{ color: brandColor }} />
              </div>
              <span className="text-sm font-medium text-gray-700">Chats</span>
            </Link>
            <Link
              to={`/workspace/${workspaceId}/members`}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-200/60 hover:border-gray-300 hover:shadow-md transition group"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition"
                style={{ backgroundColor: `${brandColor}10` }}
              >
                <FaUsers className="text-lg" style={{ color: brandColor }} />
              </div>
              <span className="text-sm font-medium text-gray-700">Members</span>
            </Link>
            <Link
              to={`/workspace/${workspaceId}/projects`}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-200/60 hover:border-gray-300 hover:shadow-md transition group"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition"
                style={{ backgroundColor: `${brandColor}10` }}
              >
                <FaFolder className="text-lg" style={{ color: brandColor }} />
              </div>
              <span className="text-sm font-medium text-gray-700">Projects</span>
            </Link>
          </div>

          {/* ─── Recent Chats ─── */}
          <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden mb-6">
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FaComment className="text-sm" style={{ color: brandColor }} />
                Recent Chats
              </h3>
              <Link
                to={`/workspace/${workspaceId}/channels`}
                className="text-xs font-medium hover:underline"
                style={{ color: brandColor }}
              >
                View all <FaArrowRight className="inline text-[10px] ml-1" />
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {chats.slice(0, 3).map((chat) => {
                const isGroup = chat.type === 'group';
                const otherParticipant = isGroup ? null : chat.participants.find(
                  (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
                );
                const participant = otherParticipant?.user || otherParticipant;
                const name = isGroup ? chat.name : participant?.name || 'Unknown';
                const unread = chat.unreadCount || 0;
                const lastMessage = chat.lastMessage?.content || 'No messages yet';
                const time = chat.updatedAt ? new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                return (
                  <Link
                    key={chat._id}
                    to={`/workspace/${workspaceId}/chat/${chat._id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition group"
                  >
                    {isGroup ? (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200"
                        style={{ backgroundColor: `${brandColor}10` }}
                      >
                        <FaHashtag className="text-sm" style={{ color: brandColor }} />
                      </div>
                    ) : (
                      participant?.profile ? (
                        <img
                          src={participant.profile}
                          alt={participant.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border border-gray-200"
                          style={{ backgroundColor: brandColor }}
                        >
                          {participant?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                        {unread > 0 && (
                          <span
                            className="text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center"
                            style={{ backgroundColor: brandColor }}
                          >
                            {unread}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{time}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{lastMessage}</p>
                    </div>
                    <FaChevronRight className="text-gray-300 text-xs flex-shrink-0 group-hover:text-gray-500 transition" />
                  </Link>
                );
              })}
              {chats.length === 0 && (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">
                  No chats yet. Start a conversation with a member!
                </div>
              )}
            </div>
          </div>

          {/* ─── Members Preview ─── */}
          <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FaUsers className="text-sm" style={{ color: brandColor }} />
                Members
              </h3>
              <Link
                to={`/workspace/${workspaceId}/members`}
                className="text-xs font-medium hover:underline"
                style={{ color: brandColor }}
              >
                See All
              </Link>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {activeMembers.slice(0, 6).map((member) => {
                  const memberUser = member.user || member;
                  const isWorkspaceOwner = memberUser._id === workspace.owner?._id || memberUser._id === workspace.owner;
                  return (
                    <div
                      key={memberUser._id}
                      className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2"
                    >
                      {memberUser?.profile ? (
                        <img
                          src={memberUser.profile}
                          alt={memberUser.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: brandColor }}
                        >
                          {memberUser?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="text-sm text-gray-700 truncate max-w-[80px]">
                        {memberUser?.name || 'Unknown'}
                        {isWorkspaceOwner && <span className="text-xs text-amber-500 ml-1" title="Owner">👑</span>}
                      </span>
                      {member.status === 'active' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
                {activeMembers.length > 6 && (
                  <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-500">
                      +{activeMembers.length - 6} more
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Workspace Description ── */}
          {workspace.description && (
            <div className="mt-6 bg-white rounded-2xl border border-gray-200/60 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">About</h3>
              <p className="text-sm text-gray-700">{workspace.description}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                {workspace.industry && <span>🏢 {workspace.industry}</span>}
                {workspace.location && <span>📍 {workspace.location}</span>}
                {workspace.website && (
                  <a href={workspace.website} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: brandColor }}>
                    🌐 {workspace.website}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <YourWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default YourWorkspaceId;