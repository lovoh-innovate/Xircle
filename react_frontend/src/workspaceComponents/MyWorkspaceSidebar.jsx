// src/components/MyWorkspaceSidebar.jsx
import React, { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FaHashtag,
  FaUsers,
  FaHome,
  FaComment,
  FaChevronDown,
  FaChevronRight,
  FaSearch,
  FaBell,
  FaCog,
  FaPlus,
  FaEnvelope,
  FaGlobe,
} from 'react-icons/fa';

const MyWorkspaceSidebar = ({ workspace, chats }) => {
  const { workspaceId } = useParams();
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);
  const [expandedSections, setExpandedSections] = useState({
    channels: true,
    members: false,
    admin: true,
  });

  const brandColor = workspace?.color || '#4F46E5'; // fallback indigo

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  // ─── Navigation Options ───
  const navOptions = [
    { id: 'home', label: 'Home', icon: FaHome, path: `/my-workspace/${workspaceId}` },
    { id: 'channels', label: 'Channels', icon: FaComment, path: `/my-workspace/${workspaceId}/channels` },
    { id: 'dms', label: 'Messages', icon: FaEnvelope, path: `/my-workspace/${workspaceId}/dms` },
    { id: 'members', label: 'Members', icon: FaUsers, path: `/my-workspace/${workspaceId}/members` },
  ];

  const adminOptions = [
    { id: 'settings', label: 'Settings', icon: FaCog, path: `/my-workspace/${workspaceId}/settings` },
  ];

  const members = workspace?.members || [];
  const onlineCount = members.filter((m) => m.status === 'active').length || 0;
  const displayMembers = members.slice(0, 6);

  const channels = chats?.filter(chat => chat.type === 'group') || [];

  const isActive = (path) => {
    if (path === `/my-workspace/${workspaceId}`) {
      return location.pathname === path;
    }
    return location.pathname.includes(path.split('/').pop());
  };

  // ─── Inline styles for dynamic brand glow ───
  const glowStyle = {
    boxShadow: `0 0 20px ${brandColor}66, 0 0 60px ${brandColor}33`,
    borderColor: brandColor,
  };

  const textGlowStyle = {
    textShadow: `0 0 10px ${brandColor}99`,
  };

  return (
    <div
      className="sticky top-0 h-screen w-64 flex flex-col bg-gray-900/80 backdrop-blur-xl border-r border-gray-700/50 overflow-hidden transition-all duration-300 relative"
      style={{
        borderImage: `linear-gradient(180deg, ${brandColor}44, ${brandColor}88, ${brandColor}44) 1`,
        borderImageSlice: 1,
      }}
    >
      {/* Animated border glow overlay */}
      <div
        className="absolute inset-0 pointer-events-none border-r border-transparent"
        style={{
          borderImage: `linear-gradient(180deg, ${brandColor}22, ${brandColor}AA, ${brandColor}22) 1`,
          borderImageSlice: 1,
          animation: 'borderPulse 4s ease-in-out infinite',
        }}
      />

      {/* ── Workspace Header ── */}
      <div className="relative flex items-center justify-between px-3 py-3 border-b border-gray-700/50 flex-shrink-0 bg-gray-800/30 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          {workspace?.logo ? (
            <img
              src={workspace.logo}
              alt={workspace.name}
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0 shadow-lg"
              style={{ boxShadow: `0 0 20px ${brandColor}66` }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg"
              style={{ backgroundColor: brandColor, boxShadow: `0 0 20px ${brandColor}66` }}
            >
              {workspace?.initials || getInitials(workspace?.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate text-sm leading-tight drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]">
              {workspace?.name}
            </p>
            <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
              <FaGlobe className="text-[9px] text-gray-500" />
              {members.length} members · {onlineCount} online
            </p>
          </div>
        </div>
        <button
          className="p-1.5 rounded-full hover:bg-gray-700/50 transition-colors duration-200 text-gray-400 hover:text-white hover:scale-110"
          title="Create"
          style={{ '--tw-ring-color': brandColor }}
        >
          <FaPlus className="text-sm" />
        </button>
      </div>

      {/* ── Navigation ── */}
      <div className="px-3 py-2 border-b border-gray-700/50 flex-shrink-0 bg-gray-800/20">
        {navOptions.map((option) => {
          const Icon = option.icon;
          const active = isActive(option.path);
          return (
            <Link
              key={option.id}
              to={option.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group relative ${
                active
                  ? 'bg-gray-800/60 text-white'
                  : 'text-gray-400 hover:bg-gray-800/40 hover:text-white hover:scale-[1.02]'
              }`}
              style={active ? { boxShadow: `inset 0 0 30px ${brandColor}22, 0 0 15px ${brandColor}44` } : {}}
            >
              {/* Active left neon bar */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                  style={{ backgroundColor: brandColor, boxShadow: `0 0 20px ${brandColor}` }}
                />
              )}
              <Icon
                className={`transition-all duration-300 ${
                  active ? 'text-white' : 'text-gray-500 group-hover:text-white'
                } group-hover:scale-110 group-hover:rotate-6`}
                size={18}
                style={active ? { filter: `drop-shadow(0 0 8px ${brandColor})` } : {}}
              />
              <span className="font-medium text-sm">{option.label}</span>
              {active && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}` }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 bg-gray-900/40">
        {/* ── Admin Section ── */}
        <div className="px-3 py-2">
          <button
            onClick={() => toggleSection('admin')}
            className="flex items-center gap-2 px-2 py-1.5 w-full hover:bg-gray-800/40 rounded-xl transition-colors duration-200 text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >
            <span className={`transition-transform duration-300 ${expandedSections.admin ? 'rotate-90' : ''}`}>
              <FaChevronRight className="text-[10px]" />
            </span>
            <span>Admin</span>
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              expandedSections.admin ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-0.5">
              {adminOptions.map((option) => {
                const Icon = option.icon;
                const active = isActive(option.path);
                return (
                  <Link
                    key={option.id}
                    to={option.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group relative ${
                      active
                        ? 'bg-gray-800/60 text-white'
                        : 'text-gray-400 hover:bg-gray-800/40 hover:text-white hover:scale-[1.02]'
                    }`}
                    style={active ? { boxShadow: `inset 0 0 30px ${brandColor}22` } : {}}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                        style={{ backgroundColor: brandColor, boxShadow: `0 0 20px ${brandColor}` }}
                      />
                    )}
                    <Icon
                      className={`transition-all duration-300 ${
                        active ? 'text-white' : 'text-gray-500 group-hover:text-white'
                      } group-hover:scale-110`}
                      size={16}
                      style={active ? { filter: `drop-shadow(0 0 8px ${brandColor})` } : {}}
                    />
                    <span className="text-sm">{option.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Channels ── */}
        <div className="px-3 py-2 border-t border-gray-700/30">
          <button
            onClick={() => toggleSection('channels')}
            className="flex items-center gap-2 px-2 py-1.5 w-full hover:bg-gray-800/40 rounded-xl transition-colors duration-200 text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >
            <span className={`transition-transform duration-300 ${expandedSections.channels ? 'rotate-90' : ''}`}>
              <FaChevronRight className="text-[10px]" />
            </span>
            <span>Channels</span>
            <Link
              to={`/my-workspace/${workspaceId}/channels`}
              className="ml-auto text-gray-500 hover:text-white transition p-1 rounded-lg hover:bg-gray-700/50 hover:scale-110"
            >
              <FaPlus className="text-xs" />
            </Link>
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              expandedSections.channels ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-0.5">
              {channels.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500 italic">No channels yet</p>
              ) : (
                channels.slice(0, 6).map((chat) => (
                  <Link
                    key={chat._id}
                    to={`/my-workspace/${workspaceId}/chat/${chat._id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-800/40 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaHashtag className="text-gray-500 text-xs group-hover:text-white transition" />
                      <span className="truncate text-sm text-gray-300 group-hover:text-white transition">
                        {chat.name || 'Unnamed'}
                      </span>
                    </div>
                    {chat.unreadCount > 0 && (
                      <span
                        className="text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center font-medium shadow-lg animate-pulse"
                        style={{ backgroundColor: brandColor, boxShadow: `0 0 20px ${brandColor}` }}
                      >
                        {chat.unreadCount}
                      </span>
                    )}
                  </Link>
                ))
              )}
              {channels.length > 6 && (
                <Link
                  to={`/my-workspace/${workspaceId}/channels`}
                  className="block px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-xl transition-all duration-200"
                >
                  +{channels.length - 6} more channels
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Members ── */}
        <div className="px-3 py-2 border-t border-gray-700/30">
          <button
            onClick={() => toggleSection('members')}
            className="flex items-center gap-2 px-2 py-1.5 w-full hover:bg-gray-800/40 rounded-xl transition-colors duration-200 text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >
            <span className={`transition-transform duration-300 ${expandedSections.members ? 'rotate-90' : ''}`}>
              <FaChevronRight className="text-[10px]" />
            </span>
            <span>Members</span>
            <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: brandColor }}
                ></span>
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: brandColor }}
                ></span>
              </span>
              {onlineCount}
            </span>
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              expandedSections.members ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-0.5">
              {displayMembers.map((member) => {
                const memberUser = member.user || member;
                const isWorkspaceOwner = memberUser._id === workspace?.owner?._id || memberUser._id === workspace?.owner;
                const isOnline = member.status === 'active';
                return (
                  <div
                    key={memberUser._id}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-800/40 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="relative flex-shrink-0">
                      {memberUser?.profile ? (
                        <img
                          src={memberUser.profile}
                          alt={memberUser.name}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-700 group-hover:ring-white transition-all duration-300"
                          style={isOnline ? { boxShadow: `0 0 20px ${brandColor}88` } : {}}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
                          style={{
                            backgroundColor: brandColor,
                            boxShadow: isOnline ? `0 0 20px ${brandColor}` : 'none',
                          }}
                        >
                          {getInitials(memberUser?.name)}
                        </div>
                      )}
                      {isOnline && (
                        <span
                          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 animate-pulse"
                          style={{ backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}` }}
                        />
                      )}
                    </div>
                    <span className="truncate flex-1 text-sm text-gray-300 group-hover:text-white transition">
                      {memberUser?.name || 'Unknown'}
                      {isWorkspaceOwner && (
                        <span className="text-[10px] text-amber-400 ml-1">👑</span>
                      )}
                    </span>
                  </div>
                );
              })}
              {members.length > 6 && (
                <Link
                  to={`/my-workspace/${workspaceId}/members`}
                  className="block px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-xl transition-all duration-200"
                >
                  See all {members.length} members
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="h-4" />
      </div>

      {/* ── User Footer ── */}
      <div className="border-t border-gray-700/50 p-3 flex-shrink-0 bg-gray-800/30 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-gray-800/40 transition-all duration-200 cursor-pointer group">
          {userInfo?.profile ? (
            <img
              src={userInfo.profile}
              alt={userInfo.name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-600 group-hover:ring-white transition-all duration-300"
              style={{ boxShadow: `0 0 20px ${brandColor}44` }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
              style={{ backgroundColor: brandColor, boxShadow: `0 0 20px ${brandColor}66` }}
            >
              {getInitials(userInfo?.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userInfo?.name}</p>
            <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: brandColor, boxShadow: `0 0 10px ${brandColor}` }}
              />
              Active now
            </p>
          </div>
          <div className="flex gap-0.5">
            <button className="p-2 rounded-full hover:bg-gray-700/50 transition-all duration-200 text-gray-400 hover:text-white hover:scale-110 hover:rotate-12">
              <FaSearch className="text-sm" />
            </button>
            <button className="p-2 rounded-full hover:bg-gray-700/50 transition-all duration-200 text-gray-400 hover:text-white hover:scale-110 hover:rotate-12 relative">
              <FaBell className="text-sm" />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: brandColor, boxShadow: `0 0 12px ${brandColor}` }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── CSS Keyframes for border animation ── */}
      <style>{`
        @keyframes borderPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 20px;
        }
        .scrollbar-thin:hover::-webkit-scrollbar-thumb {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
};

export default MyWorkspaceSidebar;