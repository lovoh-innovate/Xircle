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
  FaFolder,
  FaCopy,
  FaCheck,
  FaRocket,
  FaUserPlus,
  FaPlus,
  FaCog,
  FaHashtag,
  FaBell,
  FaChevronRight,
  FaCalendarAlt,
  FaClock,
  FaEllipsisV,
  FaRegClock,
  FaCircle,
  FaHome,
  FaEnvelope,
  FaGlobe,
  FaShieldAlt,
  FaSearch,
  FaArrowRight,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

// Mock data for the chart – replace with real data later
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
    if (error) {
      navigate('/my-workspaces');
    }
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
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }}
          />
          <p className="mt-4 text-gray-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const chats = chatsData?.chats || [];

  if (!workspace) {
    return null;
  }

  const activeMembers = workspace.members?.filter(m => m.status === 'active') || [];
  const onlineCount = activeMembers.filter(m => m.status === 'active').length || 0;
  const channelCount = chats.filter(c => c.type === 'group').length || 0;
  const dmCount = chats.filter(c => c.type === 'direct').length || 0;
  const brandColor = workspace.color || '#4F46E5';

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      {/* ── Desktop Sidebar (fixed) ── */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 fixed top-0 left-0">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
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
          {/* ─── Black Summary Card ─── */}
          <div className="bg-black rounded-3xl p-5 mb-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Active Members</p>
                <p className="text-3xl font-bold">{activeMembers.length}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs bg-white/10 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {onlineCount} online
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <button
                onClick={copyInviteCode}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-white text-black text-sm font-medium py-2.5 rounded-full hover:bg-gray-100 transition"
              >
                {copied ? <FaCheck className="text-xs" /> : <FaUserPlus className="text-xs" />}
                {copied ? 'Invite Copied' : 'Invite'}
              </button>
              <Link
                to={`/my-workspace/${workspaceId}/projects`}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-white/10 text-white text-sm font-medium py-2.5 rounded-full hover:bg-white/20 transition"
              >
                <FaFolder className="text-xs" />
                Projects
              </Link>
              <Link
                to={`/my-workspace/${workspaceId}/settings`}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-white/5 text-white text-sm font-medium py-2.5 rounded-full hover:bg-white/10 transition"
              >
                <FaCog className="text-xs" />
                Settings
              </Link>
            </div>
          </div>

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

          {/* ─── Two Column Layout ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left / Center – Feed */}
            <div className="lg:col-span-2 space-y-6">

              {/* Chart (Desktop only) */}
              <div className="hidden lg:block bg-white rounded-2xl border border-gray-200/60 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FaBell className="text-sm" style={{ color: brandColor }} />
                    Weekly Activity
                  </h3>
                  <span className="text-xs text-gray-400">Last 7 days</span>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={brandColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          backgroundColor: 'white',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        }}
                        labelStyle={{ fontWeight: 'bold' }}
                        formatter={(value) => [`${value} messages`, '']}
                      />
                      <Area
                        type="monotone"
                        dataKey="messages"
                        stroke={brandColor}
                        strokeWidth={2}
                        fill="url(#colorMessages)"
                        dot={{ r: 4, fill: brandColor, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Activity Feed */}
              <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FaComment className="text-sm" style={{ color: brandColor }} />
                    Recent Conversations
                  </h2>
                  <span className="text-xs text-gray-400">Latest</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {chats.length === 0 ? (
                    <div className="px-5 py-10 text-center text-gray-400 text-sm">
                      No activity yet — start a conversation!
                    </div>
                  ) : (
                    chats.slice(0, 5).map((chat) => {
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
                          to={`/my-workspace/${workspaceId}/chat/${chat._id}`}
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
                    })
                  )}
                </div>
                {chats.length > 5 && (
                  <Link
                    to={`/my-workspace/${workspaceId}/channels`}
                    className="block text-center text-sm font-medium py-3 hover:bg-gray-50 transition border-t border-gray-100"
                    style={{ color: brandColor }}
                  >
                    View all conversations <FaArrowRight className="inline text-xs ml-1" />
                  </Link>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">

              {/* Members */}
              <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FaUsers className="text-sm" style={{ color: brandColor }} />
                    Members
                  </h3>
                  <Link
                    to={`/my-workspace/${workspaceId}/members`}
                    className="text-xs font-medium hover:underline"
                    style={{ color: brandColor }}
                  >
                    See All
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {activeMembers.slice(0, 6).map((member) => {
                    const memberUser = member.user || member;
                    const isWorkspaceOwner = memberUser._id === workspace.owner?._id || memberUser._id === workspace.owner;
                    return (
                      <div key={memberUser._id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition">
                        {memberUser?.profile ? (
                          <img
                            src={memberUser.profile}
                            alt={memberUser.name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border border-gray-200"
                            style={{ backgroundColor: brandColor }}
                          >
                            {memberUser?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate flex items-center gap-1">
                            {memberUser?.name || 'Unknown'}
                            {isWorkspaceOwner && <span className="text-xs text-amber-500" title="Owner">👑</span>}
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

              {/* About */}
              {workspace.description && (
                <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">About</h3>
                  <p className="text-sm text-gray-700">{workspace.description}</p>
                  <div className="mt-4 space-y-1.5 text-xs text-gray-500">
                    {workspace.industry && (
                      <p className="flex items-center gap-2">
                        <span className="w-4 text-center">🏢</span>
                        <span>{workspace.industry}</span>
                      </p>
                    )}
                    {workspace.location && (
                      <p className="flex items-center gap-2">
                        <span className="w-4 text-center">📍</span>
                        <span>{workspace.location}</span>
                      </p>
                    )}
                    {workspace.website && (
                      <a
                        href={workspace.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline"
                        style={{ color: brandColor }}
                      >
                        <span className="w-4 text-center">🌐</span>
                        <span>{workspace.website}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Navigation (mobile & tablet) ── */}
      <MyWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default MyWorkspaceId;