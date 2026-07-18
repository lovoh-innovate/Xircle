// src/workspaceScreens/MyWorkspaceId.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaUsers,
  FaComment,
  FaCopy,
  FaCheck,
  FaUserPlus,
  FaCog,
  FaHashtag,
  FaBell,
  FaSearch,
  FaCircle,
  FaEnvelope,
  FaFolder,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Sample chart data
const chartData = [
  { day: 'Mon', messages: 12 },
  { day: 'Tue', messages: 19 },
  { day: 'Wed', messages: 8 },
  { day: 'Thu', messages: 27 },
  { day: 'Fri', messages: 34 },
  { day: 'Sat', messages: 22 },
  { day: 'Sun', messages: 15 },
];

const MyWorkspaceId = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [copied, setCopied] = useState(false);

  const { data: workspaceData, isLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData } = useGetUserChatsQuery(workspaceId);

  useEffect(() => {
    if (error) navigate('/my-workspaces');
  }, [error, navigate]);

  const copyInviteCode = () => {
    if (workspace?.inviteCode) {
      navigator.clipboard.writeText(workspace.inviteCode);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const chats = chatsData?.chats || [];
  if (!workspace) return null;

  const activeMembers = workspace.members?.filter((m) => m.status === 'active') || [];
  const onlineCount = activeMembers.filter((m) => m.status === 'active').length || 0;
  const channelCount = chats.filter((c) => c.type === 'group').length || 0;
  const dmCount = chats.filter((c) => c.type === 'direct').length || 0;
  const brandColor = workspace.color || '#0d9488';

  const StatCard = ({ icon: Icon, label, value }) => (
    <div className="bg-white rounded-2xl px-5 py-4 border border-gray-200/60 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
      >
        <Icon className="text-lg" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 fixed top-0 left-0 z-20">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      <div className="flex-1 md:ml-64">
        {/* Sticky Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 sm:px-6 lg:px-8 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {workspace.logo ? (
                <img
                  src={workspace.logo}
                  alt={workspace.name}
                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base"
                  style={{ backgroundColor: brandColor }}
                >
                  {workspace.initials || workspace.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">
                  {workspace.name}
                </h1>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <FaUsers className="text-[10px]" />
                  {activeMembers.length} members · {onlineCount} online
                </p>
              </div>
            </div>

            {/* Header actions – now includes Projects */}
            <div className="flex items-center gap-2">
              <button
                onClick={copyInviteCode}
                className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-700 transition"
              >
                {copied ? <FaCheck className="text-xs" /> : <FaUserPlus className="text-xs" />}
                {copied ? 'Copied!' : 'Invite'}
              </button>

              {/* Projects button – restored */}
              <Link
                to={`/my-workspace/${workspaceId}/projects`}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-2 rounded-full text-sm hover:bg-gray-50 transition"
              >
                <FaFolder className="text-xs" />
                <span className="hidden sm:inline">Projects</span>
              </Link>

              <Link
                to={`/my-workspace/${workspaceId}/settings`}
                className="hidden sm:flex items-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-2 rounded-full text-sm hover:bg-gray-50 transition"
              >
                <FaCog className="text-xs" />
                Settings
              </Link>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard icon={FaUsers} label="Members" value={activeMembers.length} />
            <StatCard icon={FaHashtag} label="Channels" value={channelCount} />
            <StatCard icon={FaEnvelope} label="Direct Messages" value={dmCount} />
            <StatCard icon={FaCircle} label="Online Now" value={onlineCount} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <FaBell className="text-sm" style={{ color: brandColor }} />
                    Weekly Activity
                  </h2>
                  <span className="text-xs text-gray-400">Last 7 days</span>
                </div>
                <div className="h-48 sm:h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={brandColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={30} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                          fontSize: '13px',
                        }}
                        formatter={(value) => [`${value} messages`, '']}
                      />
                      <Area
                        type="monotone"
                        dataKey="messages"
                        stroke={brandColor}
                        strokeWidth={2}
                        fill="url(#colorMessages)"
                        dot={{ r: 3, fill: brandColor, stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FaComment className="text-sm" style={{ color: brandColor }} />
                    Recent Conversations
                  </h2>
                  <Link
                    to={`/my-workspace/${workspaceId}/channels`}
                    className="text-xs font-medium hover:underline"
                    style={{ color: brandColor }}
                  >
                    View all
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {chats.length === 0 ? (
                    <div className="px-5 py-8 text-center text-gray-400 text-sm">
                      No activity yet — start a conversation!
                    </div>
                  ) : (
                    chats.slice(0, 5).map((chat) => {
                      const isGroup = chat.type === 'group';
                      const otherParticipant = isGroup
                        ? null
                        : chat.participants.find(
                            (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
                          );
                      const participant = otherParticipant?.user || otherParticipant;
                      const name = isGroup ? chat.name : participant?.name || 'Unknown';
                      const lastMessage = chat.lastMessage?.content || 'No messages yet';
                      const time = chat.updatedAt
                        ? new Date(chat.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '';
                      return (
                        <Link
                          key={chat._id}
                          to={`/my-workspace/${workspaceId}/chat/${chat._id}`}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition"
                        >
                          {isGroup ? (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center border border-gray-200"
                              style={{ backgroundColor: `${brandColor}10` }}
                            >
                              <FaHashtag className="text-sm" style={{ color: brandColor }} />
                            </div>
                          ) : participant?.profile ? (
                            <img
                              src={participant.profile}
                              alt={name}
                              className="w-10 h-10 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border border-gray-200"
                              style={{ backgroundColor: brandColor }}
                            >
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                              <span className="text-xs text-gray-400 flex-shrink-0">{time}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{lastMessage}</p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FaUsers className="text-sm" style={{ color: brandColor }} />
                    Members
                  </h2>
                  <Link
                    to={`/my-workspace/${workspaceId}/members`}
                    className="text-xs font-medium hover:underline"
                    style={{ color: brandColor }}
                  >
                    See all
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {activeMembers.slice(0, 6).map((member) => {
                    const memberUser = member.user || member;
                    const isOwner =
                      memberUser._id === workspace.owner?._id ||
                      memberUser._id === workspace.owner;
                    return (
                      <div
                        key={memberUser._id}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition"
                      >
                        {memberUser?.profile ? (
                          <img
                            src={memberUser.profile}
                            alt={memberUser.name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: brandColor }}
                          >
                            {memberUser?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate flex items-center gap-1">
                            {memberUser?.name || 'Unknown'}
                            {isOwner && <span className="text-xs" title="Owner">👑</span>}
                          </p>
                        </div>
                        {member.status === 'active' && (
                          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {activeMembers.length > 6 && (
                    <Link
                      to={`/my-workspace/${workspaceId}/members`}
                      className="block text-xs font-medium px-5 py-2.5 hover:bg-gray-50 transition border-t border-gray-100"
                      style={{ color: brandColor }}
                    >
                      +{activeMembers.length - 6} more
                    </Link>
                  )}
                </div>
              </div>

              {(workspace.description || workspace.industry || workspace.location || workspace.website) && (
                <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    About this workspace
                  </h2>
                  {workspace.description && (
                    <p className="text-sm text-gray-700 mb-4">{workspace.description}</p>
                  )}
                  <div className="space-y-1.5 text-sm text-gray-600">
                    {workspace.industry && (
                      <div className="flex items-center gap-2">
                        <span>🏢</span>
                        <span>{workspace.industry}</span>
                      </div>
                    )}
                    {workspace.location && (
                      <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span>{workspace.location}</span>
                      </div>
                    )}
                    {workspace.website && (
                      <a
                        href={workspace.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline"
                        style={{ color: brandColor }}
                      >
                        <span>🌐</span>
                        <span>{workspace.website}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <MyWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default MyWorkspaceId;