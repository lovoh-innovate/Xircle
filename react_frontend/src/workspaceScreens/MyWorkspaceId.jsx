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
  FaCheck,
  FaUserPlus,
  FaCog,
  FaHashtag,
  FaCircle,
  FaEnvelope,
  FaFolder,
  FaEye,
  FaEyeSlash,
  FaThLarge,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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
  const [hideStats, setHideStats] = useState(false);

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
  const totalMessages = chartData.reduce((sum, d) => sum + d.messages, 0);

  // ── Dark identity card — balance-style stat, masked invite code, invite CTA ──
  const HeroCard = () => (
    <div className="relative overflow-hidden bg-gray-900 text-white rounded-3xl p-5 sm:p-6 shadow-lg shadow-gray-900/20">
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-25"
        style={{ backgroundColor: brandColor }}
      />

      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {workspace.logo ? (
            <img
              src={workspace.logo}
              alt={workspace.name}
              className="w-11 h-11 rounded-full object-cover border-2 border-white/15 flex-shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold border-2 border-white/15 flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {workspace.initials || workspace.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] text-white/50 leading-none mb-1">Workspace</p>
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
              {workspace.name}
            </h1>
          </div>
        </div>
        <Link
          to={`/my-workspace/${workspaceId}/settings`}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition flex-shrink-0"
          aria-label="Workspace settings"
        >
          <FaCog className="text-sm" />
        </Link>
      </div>

      <div className="relative flex items-end justify-between mb-4">
        <div>
          <button
            onClick={() => setHideStats((v) => !v)}
            className="flex items-center gap-2 text-white/60 text-xs mb-1.5"
          >
            <FaUsers className="text-[10px]" />
            Active members
            {hideStats ? <FaEyeSlash className="text-[11px]" /> : <FaEye className="text-[11px]" />}
          </button>
          <p className="text-3xl sm:text-4xl font-bold tracking-tight">
            {hideStats ? '••••' : activeMembers.length}
          </p>
        </div>
        <button
          onClick={copyInviteCode}
          className="flex items-center gap-1.5 bg-white text-gray-900 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold hover:bg-white/90 transition flex-shrink-0"
        >
          {copied ? <FaCheck className="text-xs" /> : <FaUserPlus className="text-xs" />}
          {copied ? 'Copied' : 'Invite'}
        </button>
      </div>

      <div className="relative flex items-center justify-between bg-white/10 rounded-2xl px-4 py-2.5">
        <span className="text-xs text-white/70 flex items-center gap-2">
          <FaCircle className="text-[6px] text-green-400" />
          {onlineCount} online now
        </span>
        <span className="text-xs font-mono tracking-wider text-white/80">
          {hideStats ? '••••••••' : workspace.inviteCode || '—'}
        </span>
      </div>
    </div>
  );

  // ── Core action tile — row on mobile, vertical list on desktop ──
  const QuickActionTile = ({ icon: Icon, label, to }) => (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 lg:flex-row lg:justify-start lg:gap-3 bg-white rounded-2xl border border-gray-200/60 py-3.5 lg:py-3 lg:px-4 hover:border-gray-300 hover:shadow-sm transition"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
      >
        <Icon className="text-sm" />
      </div>
      <span className="text-xs lg:text-sm font-medium text-gray-700">{label}</span>
    </Link>
  );

  // ── Quick-access grid tile with optional badge ──
  const StatTile = ({ icon: Icon, label, value, badge, badgeColor }) => (
    <div className="relative bg-white rounded-2xl border border-gray-200/60 px-3 py-4 flex flex-col items-center text-center gap-2">
      {badge && (
        <span
          className={`absolute -top-1.5 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${badgeColor}`}
        >
          {badge}
        </span>
      )}
      <div
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
      >
        <Icon className="text-base" />
      </div>
      <div>
        <p className="text-base sm:text-lg font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 fixed top-0 left-0 z-20">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Main content */}
      <div className="flex-1 md:ml-64">
        {/* Mobile-only greeting bar — fixed at top */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-gray-50 px-4 pt-4 pb-2 border-b border-gray-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Welcome back</p>
              <h2 className="text-base font-bold text-gray-900">
                Hi, {userInfo?.name?.split(' ')[0] || 'there'}
              </h2>
            </div>
            <Link
              to="/my-workspaces"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition"
              aria-label="All workspaces"
            >
              <FaThLarge className="text-sm" />
            </Link>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6 mt-16 md:mt-0">
          {/* Hero + core actions — stacked on mobile, split 2/3 + 1/3 on desktop */}
          <div className="lg:grid lg:grid-cols-3 lg:gap-6 mb-4 sm:mb-6">
            <div className="lg:col-span-2">
              <HeroCard />
            </div>
            <div className="mt-4 lg:mt-0 grid grid-cols-3 lg:grid-cols-1 gap-2 sm:gap-3">
              <QuickActionTile
                icon={FaFolder}
                label="Projects"
                to={`/my-workspace/${workspaceId}/projects`}
              />
              <QuickActionTile
                icon={FaUsers}
                label="Members"
                to={`/my-workspace/${workspaceId}/members`}
              />
              <QuickActionTile
                icon={FaHashtag}
                label="Channels"
                to={`/my-workspace/${workspaceId}/channels`}
              />
            </div>
          </div>

          {/* Quick-access grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <StatTile icon={FaHashtag} label="Channels" value={channelCount} />
            <StatTile icon={FaEnvelope} label="DMs" value={dmCount} />
            <StatTile icon={FaUsers} label="Members" value={activeMembers.length} />
            <StatTile
              icon={FaCircle}
              label="Online"
              value={onlineCount}
              badge={onlineCount > 0 ? 'LIVE' : null}
              badgeColor="bg-green-500"
            />
          </div>

          {/* Gradient signature card — weekly activity */}
          <div
            className="relative overflow-hidden rounded-3xl p-5 sm:p-6 mb-4 sm:mb-6 text-white"
            style={{ background: `linear-gradient(135deg, ${brandColor} 0%, #111827 100%)` }}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-xs text-white/70">This week</p>
                <h2 className="text-lg sm:text-xl font-bold">{totalMessages} messages</h2>
              </div>
              <Link
                to={`/my-workspace/${workspaceId}/channels`}
                className="bg-white/15 hover:bg-white/25 transition text-xs font-semibold px-3.5 py-2 rounded-full"
              >
                View report
              </Link>
            </div>
            <div className="h-32 sm:h-40 w-full -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`${value} messages`, '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    stroke="#ffffff"
                    strokeWidth={2}
                    fill="url(#colorMessages)"
                    dot={{ r: 2, fill: '#ffffff' }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two‑column responsive grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left – conversations */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-gray-100">
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
                    <div className="px-4 py-8 text-center text-xs sm:text-sm text-gray-400">
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
                          className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 transition"
                        >
                          {isGroup ? (
                            <div
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border border-gray-200"
                              style={{ backgroundColor: `${brandColor}10` }}
                            >
                              <FaHashtag className="text-xs sm:text-sm" style={{ color: brandColor }} />
                            </div>
                          ) : participant?.profile ? (
                            <img
                              src={participant.profile}
                              alt={name}
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm border border-gray-200"
                              style={{ backgroundColor: brandColor }}
                            >
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                {name}
                              </p>
                              <span className="text-[10px] sm:text-xs text-gray-400 flex-shrink-0">
                                {time}
                              </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">
                              {lastMessage}
                            </p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right column – members + about */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-gray-100">
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
                        className="flex items-center gap-3 px-4 sm:px-5 py-2 sm:py-2.5 hover:bg-gray-50 transition"
                      >
                        {memberUser?.profile ? (
                          <img
                            src={memberUser.profile}
                            alt={memberUser.name}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-bold"
                            style={{ backgroundColor: brandColor }}
                          >
                            {memberUser?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-gray-700 truncate flex items-center gap-1">
                            {memberUser?.name || 'Unknown'}
                            {isOwner && <span className="text-[10px]" title="Owner">👑</span>}
                          </p>
                        </div>
                        {member.status === 'active' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {activeMembers.length > 6 && (
                    <Link
                      to={`/my-workspace/${workspaceId}/members`}
                      className="block text-xs font-medium px-4 sm:px-5 py-2.5 hover:bg-gray-50 transition border-t border-gray-100"
                      style={{ color: brandColor }}
                    >
                      +{activeMembers.length - 6} more
                    </Link>
                  )}
                </div>
              </div>

              {(workspace.description || workspace.industry || workspace.location || workspace.website) && (
                <div className="bg-white rounded-2xl border border-gray-200/60 p-4 sm:p-5">
                  <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    About
                  </h2>
                  {workspace.description && (
                    <p className="text-xs sm:text-sm text-gray-700 mb-4">{workspace.description}</p>
                  )}
                  <div className="space-y-1.5 text-[11px] sm:text-sm text-gray-600">
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