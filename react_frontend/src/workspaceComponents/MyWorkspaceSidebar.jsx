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
  FaCircle,
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

  const brandColor = workspace?.color || '#0d9488'; // teal default

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
    if (path === `/my-workspace/${workspaceId}`) return location.pathname === path;
    return location.pathname.includes(path.split('/').pop());
  };

  return (
    <div className="sticky top-0 h-screen w-64 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
      {/* ── Workspace Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {workspace?.logo ? (
            <img
              src={workspace.logo}
              alt={workspace.name}
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {workspace?.initials || getInitials(workspace?.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm">{workspace?.name}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <FaUsers className="text-[10px]" />
              {members.length} members · {onlineCount} online
            </p>
          </div>
        </div>
        <Link
          to={`/my-workspace/${workspaceId}/channels`}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600"
        >
          <FaPlus className="text-sm" />
        </Link>
      </div>

      {/* ── Navigation ── */}
      <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
        {navOptions.map((option) => {
          const Icon = option.icon;
          const active = isActive(option.path);
          return (
            <Link
              key={option.id}
              to={option.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition group ${
                active
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon
                className={`text-lg transition ${
                  active ? 'text-teal-600' : 'text-gray-400 group-hover:text-gray-600'
                }`}
              />
              <span className="text-sm">{option.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* ── Admin Section ── */}
        <div className="px-3 py-2">
          <button
            onClick={() => toggleSection('admin')}
            className="flex items-center gap-2 px-2 py-1.5 w-full hover:bg-gray-50 rounded-xl transition text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            <span className={`transition-transform duration-200 ${expandedSections.admin ? 'rotate-90' : ''}`}>
              <FaChevronRight className="text-[10px]" />
            </span>
            Admin
          </button>

          {expandedSections.admin && (
            <div className="mt-1 space-y-0.5">
              {adminOptions.map((option) => {
                const Icon = option.icon;
                const active = isActive(option.path);
                return (
                  <Link
                    key={option.id}
                    to={option.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                      active
                        ? 'bg-gray-100 text-gray-900 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`text-lg ${active ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span className="text-sm">{option.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Channels Section ── */}
        <div className="px-3 py-2 border-t border-gray-100">
          <button
            onClick={() => toggleSection('channels')}
            className="flex items-center gap-2 px-2 py-1.5 w-full hover:bg-gray-50 rounded-xl transition text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            <span className={`transition-transform duration-200 ${expandedSections.channels ? 'rotate-90' : ''}`}>
              <FaChevronRight className="text-[10px]" />
            </span>
            Channels
            <Link
              to={`/my-workspace/${workspaceId}/channels`}
              className="ml-auto text-gray-400 hover:text-gray-600 transition"
            >
              <FaPlus className="text-xs" />
            </Link>
          </button>

          {expandedSections.channels && (
            <div className="mt-1 space-y-0.5">
              {channels.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 italic">No channels yet</p>
              ) : (
                channels.slice(0, 6).map((chat) => (
                  <Link
                    key={chat._id}
                    to={`/my-workspace/${workspaceId}/chat/${chat._id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 transition group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaHashtag className="text-gray-400 text-xs group-hover:text-gray-600" />
                      <span className="truncate text-sm text-gray-700 group-hover:text-gray-900">
                        {chat.name || 'Unnamed'}
                      </span>
                    </div>
                    {chat.unreadCount > 0 && (
                      <span
                        className="bg-teal-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
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
                  className="block px-3 py-1.5 text-xs text-teal-600 hover:bg-gray-50 rounded-xl"
                >
                  +{channels.length - 6} more channels
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Members Section ── */}
        <div className="px-3 py-2 border-t border-gray-100">
          <button
            onClick={() => toggleSection('members')}
            className="flex items-center gap-2 px-2 py-1.5 w-full hover:bg-gray-50 rounded-xl transition text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            <span className={`transition-transform duration-200 ${expandedSections.members ? 'rotate-90' : ''}`}>
              <FaChevronRight className="text-[10px]" />
            </span>
            Members
            <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
              <FaCircle className="text-[8px] text-green-500" />
              {onlineCount}
            </span>
          </button>

          {expandedSections.members && (
            <div className="mt-1 space-y-0.5">
              {displayMembers.map((member) => {
                const memberUser = member.user || member;
                const isWorkspaceOwner = memberUser._id === workspace?.owner?._id || memberUser._id === workspace?.owner;
                const isOnline = member.status === 'active';
                return (
                  <div
                    key={memberUser._id}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="relative flex-shrink-0">
                      {memberUser?.profile ? (
                        <img
                          src={memberUser.profile}
                          alt={memberUser.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: brandColor }}
                        >
                          {getInitials(memberUser?.name)}
                        </div>
                      )}
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <span className="truncate flex-1 text-sm text-gray-700">
                      {memberUser?.name || 'Unknown'}
                      {isWorkspaceOwner && <span className="text-[10px] text-amber-500 ml-1">👑</span>}
                    </span>
                  </div>
                );
              })}
              {members.length > 6 && (
                <Link
                  to={`/my-workspace/${workspaceId}/members`}
                  className="block px-3 py-1.5 text-xs text-teal-600 hover:bg-gray-50 rounded-xl"
                >
                  See all {members.length} members
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>

      {/* ── User Footer ── */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition cursor-pointer">
          {userInfo?.profile ? (
            <img
              src={userInfo.profile}
              alt={userInfo.name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: brandColor }}
            >
              {getInitials(userInfo?.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userInfo?.name}</p>
            <p className="text-xs text-gray-500">Active now</p>
          </div>
          <div className="flex gap-0.5">
            <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
              <FaSearch className="text-sm" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition relative">
              <FaBell className="text-sm" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyWorkspaceSidebar;