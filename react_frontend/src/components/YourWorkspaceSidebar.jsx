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
  FaChevronLeft,
  FaEnvelope,
  FaSearch,
  FaBell,
} from 'react-icons/fa';

const YourWorkspaceSidebar = ({ workspace, chats }) => {
  const { workspaceId } = useParams();
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
    <div
      className={`sticky top-0 h-screen bg-[#18181b] border-r border-gray-800 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* ── Header ── */}
      <div
        className={`flex items-center border-b border-gray-800 min-h-[56px] flex-shrink-0 ${
          isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'
        }`}
      >
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

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-100 truncate text-sm">
              {workspace?.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {members.length} members · {onlineCount} online
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <div
        className={`py-2 border-b border-gray-800 flex-shrink-0 ${
          isCollapsed ? 'px-2' : 'px-3'
        }`}
      >
        {navOptions.map((opt) => {
          const Icon = opt.icon;
          const active = isActive(opt.path);
          return (
            <Link
              key={opt.id}
              to={opt.path}
              title={isCollapsed ? opt.label : undefined}
              className={`flex items-center rounded-lg transition-all text-sm ${
                isCollapsed
                  ? 'justify-center p-2.5 mb-1'
                  : 'gap-3 px-3 py-1.5 mb-0.5'
              } ${
                active
                  ? 'text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
              style={active ? { backgroundColor: brandColor } : {}}
            >
              <Icon
                className={`${active ? 'text-white' : ''} ${
                  isCollapsed ? 'text-lg' : ''
                }`}
              />
              {!isCollapsed && <span className="font-medium">{opt.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* ─── Scrollable Content ─── */}
      {isCollapsed ? (
        <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-2 flex flex-col items-center gap-3">
          <Link
            to={`/workspace/${workspaceId}/channels`}
            title="Channels"
            className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
          >
            <FaHashtag className="text-lg" />
            {channels.some((c) => c.unreadCount > 0) && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: brandColor }}
              />
            )}
          </Link>

          <Link
            to={`/workspace/${workspaceId}/dms`}
            title="Direct Messages"
            className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
          >
            <FaEnvelope className="text-lg" />
            {directMessages.some((c) => c.unreadCount > 0) && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: brandColor }}
              />
            )}
          </Link>

          <Link
            to={`/workspace/${workspaceId}/members`}
            title="Members"
            className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
          >
            <FaUsers className="text-lg" />
            {onlineCount > 0 && (
              <span className="absolute bottom-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full border-2 border-[#18181b]" />
            )}
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Channels */}
          <div className="px-3 py-2 border-b border-gray-800/50">
            <button
              onClick={() => toggleSection('channels')}
              className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-800 rounded-lg transition-colors text-xs font-semibold text-gray-500 uppercase tracking-wider"
            >
              {expandedSections.channels ? (
                <FaChevronDown className="text-[10px]" />
              ) : (
                <FaChevronRight className="text-[10px]" />
              )}
              <span>Channels</span>
            </button>
            {expandedSections.channels && (
              <div className="mt-1 space-y-0.5">
                {channels.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-600">No channels yet</p>
                ) : (
                  channels.slice(0, 6).map((chat) => (
                    <Link
                      key={chat._id}
                      to={`/workspace/${workspaceId}/chat/${chat._id}`}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors text-sm group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FaHashtag className="text-gray-500 text-xs" />
                        <span className="truncate text-gray-400 group-hover:text-gray-200">
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
                    className="block px-3 py-1 text-xs text-gray-600 hover:text-gray-400 hover:bg-gray-800 rounded-lg"
                  >
                    +{channels.length - 6} more
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Direct Messages */}
          <div className="px-3 py-2 border-b border-gray-800/50">
            <button
              onClick={() => toggleSection('dms')}
              className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-800 rounded-lg transition-colors text-xs font-semibold text-gray-500 uppercase tracking-wider"
            >
              {expandedSections.dms ? (
                <FaChevronDown className="text-[10px]" />
              ) : (
                <FaChevronRight className="text-[10px]" />
              )}
              <span>Direct Messages</span>
            </button>
            {expandedSections.dms && (
              <div className="mt-1 space-y-0.5">
                {directMessages.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-600">No DMs</p>
                ) : (
                  directMessages.slice(0, 6).map((chat) => {
                    const participant = getDMParticipant(chat);
                    const unread = getDMUnread(chat);
                    const isOnline = participant?.online || false;
                    return (
                      <Link
                        key={chat._id}
                        to={`/workspace/${workspaceId}/chat/${chat._id}`}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors group"
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
                              <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-[#18181b]" />
                            )}
                          </div>
                          <span className="truncate text-gray-400 group-hover:text-gray-200 text-sm">
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
                    className="block px-3 py-1 text-xs text-gray-600 hover:text-gray-400 hover:bg-gray-800 rounded-lg"
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
              className="flex items-center gap-2 px-2 py-1 w-full hover:bg-gray-800 rounded-lg transition-colors text-xs font-semibold text-gray-500 uppercase tracking-wider"
            >
              {expandedSections.members ? (
                <FaChevronDown className="text-[10px]" />
              ) : (
                <FaChevronRight className="text-[10px]" />
              )}
              <span>Members</span>
              <span className="ml-auto text-xs text-gray-600">{onlineCount} online</span>
            </button>
            {expandedSections.members && (
              <div className="mt-1 space-y-0.5">
                {displayMembers.map((member) => {
                  const m = member.user || member;
                  const isOwner =
                    m._id === workspace?.owner?._id || m._id === workspace?.owner;
                  const isOnline = member.status === 'active';
                  return (
                    <div
                      key={m._id}
                      className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      <div className="relative flex-shrink-0">
                        {m?.profile ? (
                          <img
                            src={m.profile}
                            alt={m.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: brandColor }}
                          >
                            {getInitials(m?.name)}
                          </div>
                        )}
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-[#18181b]" />
                        )}
                      </div>
                      <span className="truncate flex-1 text-sm text-gray-400">
                        {m?.name || 'Unknown'}
                        {isOwner && <span className="text-xs text-amber-500 ml-1">👑</span>}
                      </span>
                    </div>
                  );
                })}
                {members.length > 6 && (
                  <Link
                    to={`/workspace/${workspaceId}/members`}
                    className="block px-3 py-1.5 text-sm text-gray-600 hover:text-gray-400 hover:bg-gray-800 rounded-lg"
                  >
                    View all {members.length} members →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Collapse Toggle ── */}
      <div className="flex-shrink-0 border-t border-gray-800 p-2 flex justify-center">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <FaChevronRight className="text-xs" />
          ) : (
            <FaChevronLeft className="text-xs" />
          )}
        </button>
      </div>

      {/* ── User Footer ── */}
      <div
        className={`border-t border-gray-800 flex-shrink-0 bg-[#18181b] ${
          isCollapsed ? 'p-2 flex justify-center' : 'p-3'
        }`}
      >
        {isCollapsed ? (
          <div className="relative">
            {userInfo?.profile ? (
              <img
                src={userInfo.profile}
                alt={userInfo.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: brandColor }}
              >
                {getInitials(userInfo?.name)}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
            {userInfo?.profile ? (
              <img
                src={userInfo.profile}
                alt={userInfo.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: brandColor }}
              >
                {getInitials(userInfo?.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">
                {userInfo?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{userRole}</p>
            </div>
            <div className="flex gap-1">
              <button className="p-1.5 rounded-lg hover:bg-gray-700 transition text-gray-500 hover:text-gray-300">
                <FaSearch className="text-xs" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-gray-700 transition text-gray-500 hover:text-gray-300">
                <FaBell className="text-xs" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default YourWorkspaceSidebar;