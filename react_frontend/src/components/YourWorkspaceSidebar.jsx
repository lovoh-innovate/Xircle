// src/components/YourWorkspaceSidebar.jsx
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
  FaEnvelope,
  FaSearch,
  FaBell,
} from 'react-icons/fa';

const YourWorkspaceSidebar = ({ workspace, chats }) => {
  const { workspaceId } = useParams();
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);
  const [expandedSections, setExpandedSections] = useState({
    channels: true,
    members: false,
    dms: true,
  });

  const brandColor = workspace?.color || '#4F46E5';

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

  // ─── Navigation ───
  const navOptions = [
    { id: 'home', label: 'Home', icon: FaHome, path: `/workspace/${workspaceId}` },
    { id: 'channels', label: 'Channels', icon: FaComment, path: `/workspace/${workspaceId}/channels` },
    { id: 'dms', label: 'Direct Messages', icon: FaEnvelope, path: `/workspace/${workspaceId}/dms` },
    { id: 'members', label: 'Members', icon: FaUsers, path: `/workspace/${workspaceId}/members` },
  ];

  // ─── Real Data ───
  const members = workspace?.members || [];
  const onlineCount = members.filter((m) => m.status === 'active').length || 0;
  const displayMembers = members.slice(0, 6);

  const channels = chats?.filter((chat) => chat.type === 'group') || [];
  const directMessages = chats?.filter((chat) => chat.type === 'direct') || [];

  const isActive = (path) => {
    if (path === `/workspace/${workspaceId}`) {
      return location.pathname === path;
    }
    return location.pathname.includes(path.split('/').pop());
  };

  const getDMParticipant = (chat) => {
    const other = chat.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    );
    return other?.user || other;
  };

  const getDMUnread = (chat) => chat.unreadCount || 0;

  const userMembership = members.find(
    (m) => m.user?._id === userInfo?._id || m.user === userInfo?._id
  );
  const userRole = userMembership?.role || 'Member';

  return (
    <div className="sticky top-0 h-screen bg-white border-r border-gray-200 flex flex-col w-64 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 min-h-[56px] flex-shrink-0">
        {workspace?.logo ? (
          <img
            src={workspace.logo}
            alt={workspace.name}
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {workspace?.initials || getInitials(workspace?.name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate text-sm">
            {workspace?.name}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {members.length} members · {onlineCount} online
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
        {navOptions.map((opt) => {
          const Icon = opt.icon;
          const active = isActive(opt.path);
          return (
            <Link
              key={opt.id}
              to={opt.path}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all text-sm ${
                active ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
              style={active ? { backgroundColor: brandColor } : {}}
            >
              <Icon className={active ? 'text-white' : 'text-gray-400'} />
              <span className="font-medium">{opt.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Channels */}
        <div className="px-3 py-2 border-b border-gray-100">
          <button
            onClick={() => toggleSection('channels')}
            className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-100 rounded-lg transition-colors text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            {expandedSections.channels ? <FaChevronDown className="text-[10px]" /> : <FaChevronRight className="text-[10px]" />}
            <span>Channels</span>
          </button>
          {expandedSections.channels && (
            <div className="mt-1 space-y-0.5">
              {channels.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">No channels yet</p>
              ) : (
                channels.slice(0, 6).map((chat) => (
                  <Link
                    key={chat._id}
                    to={`/workspace/${workspaceId}/chat/${chat._id}`}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaHashtag className="text-gray-400 text-xs" />
                      <span className="truncate text-gray-700 group-hover:text-gray-900">
                        {chat.name || 'Unnamed'}
                      </span>
                    </div>
                    {chat.unreadCount > 0 && (
                      <span
                        className="text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center font-medium"
                        style={{ backgroundColor: brandColor }}
                      >
                        {chat.unreadCount}
                      </span>
                    )}
                  </Link>
                ))
              )}
              {channels.length > 6 && (
                <Link
                  to={`/workspace/${workspaceId}/channels`}
                  className="block px-3 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  +{channels.length - 6} more
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Direct Messages */}
        <div className="px-3 py-2 border-b border-gray-100">
          <button
            onClick={() => toggleSection('dms')}
            className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-100 rounded-lg transition-colors text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            {expandedSections.dms ? <FaChevronDown className="text-[10px]" /> : <FaChevronRight className="text-[10px]" />}
            <span>Direct Messages</span>
          </button>
          {expandedSections.dms && (
            <div className="mt-1 space-y-0.5">
              {directMessages.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">No DMs</p>
              ) : (
                directMessages.slice(0, 6).map((chat) => {
                  const participant = getDMParticipant(chat);
                  const unread = getDMUnread(chat);
                  const isOnline = participant?.online || false;
                  return (
                    <Link
                      key={chat._id}
                      to={`/workspace/${workspaceId}/chat/${chat._id}`}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                          {participant?.profile ? (
                            <img
                              src={participant.profile}
                              alt={participant.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: brandColor }}
                            >
                              {getInitials(participant?.name)}
                            </div>
                          )}
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        <span className="truncate text-gray-700 group-hover:text-gray-900 text-sm">
                          {participant?.name || 'Unknown'}
                        </span>
                      </div>
                      {unread > 0 && (
                        <span
                          className="text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center font-medium"
                          style={{ backgroundColor: brandColor }}
                        >
                          {unread}
                        </span>
                      )}
                    </Link>
                  );
                })
              )}
              {directMessages.length > 6 && (
                <Link
                  to={`/workspace/${workspaceId}/dms`}
                  className="block px-3 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  +{directMessages.length - 6} more
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="px-3 py-2">
          <button
            onClick={() => toggleSection('members')}
            className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-100 rounded-lg transition-colors text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            {expandedSections.members ? <FaChevronDown className="text-[10px]" /> : <FaChevronRight className="text-[10px]" />}
            <span>Members</span>
            <span className="ml-auto text-xs text-gray-400">{onlineCount} online</span>
          </button>
          {expandedSections.members && (
            <div className="mt-1 space-y-0.5">
              {displayMembers.map((member) => {
                const m = member.user || member;
                const isOwner = m._id === workspace?.owner?._id || m._id === workspace?.owner;
                const isOnline = member.status === 'active';
                return (
                  <div
                    key={m._id}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="relative flex-shrink-0">
                      {m?.profile ? (
                        <img src={m.profile} alt={m.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: brandColor }}
                        >
                          {getInitials(m?.name)}
                        </div>
                      )}
                      {isOnline && <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-white" />}
                    </div>
                    <span className="truncate flex-1 text-sm text-gray-700">
                      {m?.name || 'Unknown'}
                      {isOwner && <span className="text-xs text-amber-500 ml-1">👑</span>}
                    </span>
                  </div>
                );
              })}
              {members.length > 6 && (
                <Link
                  to={`/workspace/${workspaceId}/members`}
                  className="block px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  View all {members.length} members →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── User Footer ── */}
      <div className="border-t border-gray-200 p-3 flex-shrink-0 bg-white">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
          {userInfo?.profile ? (
            <img src={userInfo.profile} alt={userInfo.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: brandColor }}
            >
              {getInitials(userInfo?.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userInfo?.name}</p>
            <p className="text-xs text-gray-400 truncate">{userRole}</p>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 rounded-lg hover:bg-gray-200 transition text-gray-400 hover:text-gray-600">
              <FaSearch className="text-xs" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-gray-200 transition text-gray-400 hover:text-gray-600">
              <FaBell className="text-xs" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YourWorkspaceSidebar;