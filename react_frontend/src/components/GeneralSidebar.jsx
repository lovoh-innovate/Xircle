// src/components/GeneralSidebar.jsx
import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../slices/authSlice';
import { apiSlice } from '../slices/apiSlice';
import {
  useGetPersonalTasksQuery,
  personalTaskApiSlice,
} from '../slices/personalTaskApiSlice';
import {
  useGetUserChatsQuery,
  messagingApiSlice,
} from '../slices/messagingApiSlice';
import { useCheckAppUpdateQuery } from '../slices/appApiSlice';
import { personalNoteApiSlice } from '../slices/personalNoteApiSlice';
import {
  FiHome,
  FiCheckSquare,
  FiUsers,
  FiUpload,
  FiPackage,
  FiFile,
} from 'react-icons/fi';
import {
  FaExclamationCircle,
  FaClock,
  FaUserCircle,
  FaCog,
  FaSignOutAlt,
  FaExclamationTriangle,
} from 'react-icons/fa';

const LOGO = '/logo.jpeg';

// ─── Custom WhatsApp‑style Chat Icon ──────────────────────────────
const ChatIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ width: '1.2rem', height: '1.2rem' }}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 10h8" />
    <path d="M8 14h6" />
  </svg>
);

const GeneralSidebar = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);
  const isAdmin = userInfo?.role === 'admin' || userInfo?.role === 'super_admin';

  // ── App update check for ALL users ──
  const token = userInfo?.token;
  const currentVersion = userInfo?.appVersion;
  const { data: updateData, isLoading: updateLoading } = useCheckAppUpdateQuery(
    {
      platform: 'android',
      currentVersion: currentVersion || undefined,
      token,
    },
    {
      skip: !token,
      refetchOnMountOrArgChange: true,
    }
  );

  const hasUpdate = updateData?.hasUpdate || false;
  const isRequired = updateData?.isRequired || false;
  const updateBadgeColor = hasUpdate ? (isRequired ? 'bg-red-500' : 'bg-orange-400') : null;

  const handleLogout = async () => {
    try {
      dispatch(logout());
      dispatch(apiSlice.util.resetApiState());
      localStorage.clear();
      sessionStorage.clear();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login');
    }
  };

  const { data: personalTasksData, isLoading: tasksLoading } = useGetPersonalTasksQuery({
    status: 'pending',
    limit: 3,
  });
  const personalTasks = personalTasksData?.tasks || [];
  const pendingCount = personalTasksData?.count || 0;

  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery({
    archived: false,
  });

  // ─── Prefetch hooks ──────────────────────────────────────────────
  const prefetchAllTasks = personalTaskApiSlice.usePrefetch('getPersonalTasks');
  const prefetchAllChats = messagingApiSlice.usePrefetch('getUserChats');
  const prefetchAllNotes = personalNoteApiSlice.usePrefetch('getNotes');

  const recentChats = useMemo(() => {
    if (!chatsData?.chats) return [];

    const publicChats = chatsData.chats.filter((chat) => chat.scope === 'public');
    const directChats = publicChats.filter((chat) => chat.type === 'direct');
    const groupChats = publicChats.filter((chat) => chat.type === 'group');

    const directMap = new Map();
    for (const chat of directChats) {
      const other = chat.participants?.find(
        (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
      );
      if (!other) continue;
      const otherId = other.user?._id || other.user;
      if (!otherId) continue;
      const key = [userInfo?._id, otherId].sort().join('_');
      const existing = directMap.get(key);
      if (
        !existing ||
        new Date(chat.lastMessageAt) > new Date(existing.lastMessageAt)
      ) {
        directMap.set(key, chat);
      }
    }
    const dedupedDirect = Array.from(directMap.values());

    let combined = [...dedupedDirect, ...groupChats];
    combined.sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );
    return combined.slice(0, 3);
  }, [chatsData, userInfo]);

  const getChatDisplay = (chat) => {
    if (chat.type === 'group') {
      return {
        name: chat.name || 'Group',
        avatar: chat.avatar || null,
        unreadCount: chat.unreadCount || 0,
      };
    }
    const other = chat.participants?.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    );
    return {
      name: other?.user?.name || 'Unknown',
      avatar: other?.user?.profile || null,
      unreadCount: chat.unreadCount || 0,
    };
  };

  const getLastMessagePreview = (chat) => {
    if (!chat.lastMessage) return 'No messages';
    const msg = chat.lastMessage;
    if (msg.messageType === 'image') return '📷 Image';
    if (msg.messageType === 'video') return '🎬 Video';
    if (msg.messageType === 'audio') return '🎵 Audio';
    if (msg.messageType === 'file') return `📎 ${msg.mediaName || 'File'}`;
    return msg.content?.substring(0, 40) || 'Message';
  };

  const timeAgo = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <aside className="fixed top-0 left-0 w-72 h-full bg-[#0f0f12]/90 backdrop-blur-xl border-r border-white/10 shadow-xl flex flex-col overflow-y-auto z-40">
      {/* ─── Logo ───────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 sticky top-0 bg-inherit z-10">
        <img src={LOGO} alt="Xircle" className="h-8 w-8 object-contain rounded-lg" />
        <span className="text-xl font-bold text-white tracking-tight">Xircle</span>
      </div>

      {/* ─── Navigation ─────────────────────────────── */}
      <nav className="px-3 py-4 border-b border-white/10">
        <ul className="space-y-1">
          {[
            { to: '/my-workspaces', icon: FiHome, label: 'Home' },
            { to: '/personal-tasks', icon: FiCheckSquare, label: 'My Tasks', onHover: prefetchAllTasks },
            { to: '/notes', icon: FiFile, label: 'Notes', onHover: prefetchAllNotes }, // ✅ NEW
            { to: '/chat', icon: ChatIcon, label: 'Chat', onHover: prefetchAllChats },
            { to: '/channels', icon: FiUsers, label: 'Channels' },
            { to: '/app-versions', icon: FiPackage, label: 'App Versions' },
          ].map(({ to, icon: Icon, label, onHover }) => (
            <li key={to}>
              <NavLink
                to={to}
                onMouseEnter={onHover}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-cyan-300'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <div className="relative">
                  <Icon className="text-lg w-6 text-center" />
                  {to === '/app-versions' && hasUpdate && !updateLoading && (
                    <span
                      className={`absolute -top-1 -right-2 w-2.5 h-2.5 rounded-full ${updateBadgeColor} shadow-[0_0_8px_currentColor]`}
                      style={{ color: isRequired ? '#ef4444' : '#fb923c' }}
                    />
                  )}
                </div>
                <span>{label}</span>
                {({ isActive }) => isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
                {to === '/app-versions' && hasUpdate && !updateLoading && (
                  <span
                    className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${updateBadgeColor} text-white`}
                  >
                    {isRequired ? 'Required' : 'New'}
                  </span>
                )}
              </NavLink>
            </li>
          ))}

          {/* ─── Admin: Upload App ────────────────── */}
          {isAdmin && (
            <li>
              <NavLink
                to="/admin/upload"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-cyan-300'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <FiUpload className="text-lg w-6 text-center" />
                <span>Upload App</span>
                {({ isActive }) => isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </NavLink>
            </li>
          )}
        </ul>
      </nav>

      {/* ─── Tasks Overview ────────────────────────── */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Tasks Overview
          </h3>
          <span className="text-xs text-cyan-400">{pendingCount} pending</span>
        </div>
        {tasksLoading ? (
          <div className="flex justify-center py-2">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : personalTasks.length === 0 ? (
          <p className="text-xs text-gray-500">No pending tasks 🎉</p>
        ) : (
          <ul className="space-y-1.5">
            {personalTasks.map((task) => (
              <li key={task._id} className="flex items-center gap-2 text-sm text-gray-300">
                {task.priority === 'urgent' ? (
                  <FaExclamationCircle className="text-red-400 text-xs" />
                ) : task.priority === 'high' ? (
                  <FaExclamationCircle className="text-orange-400 text-xs" />
                ) : (
                  <FaClock className="text-gray-500 text-xs" />
                )}
                <span className="truncate flex-1">{task.title}</span>
                {task.dueDate && (
                  <span className="text-xs text-gray-400">{timeAgo(task.dueDate)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── Recent Messages ────────────────────────── */}
      <div className="px-4 py-3 border-b border-white/10 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Recent Messages
          </h3>
          <NavLink to="/chat" className="text-xs text-cyan-400 hover:underline">
            View all
          </NavLink>
        </div>
        {chatsLoading ? (
          <div className="flex justify-center py-2">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentChats.length === 0 ? (
          <p className="text-xs text-gray-500">No public chats yet</p>
        ) : (
          <ul className="space-y-2">
            {recentChats.map((chat) => {
              const { name, avatar, unreadCount } = getChatDisplay(chat);
              const chatPath = chat.type === 'direct' ? `/chats/${chat._id}` : `/channels/${chat._id}`;
              return (
                <li key={chat._id}>
                  <NavLink
                    to={chatPath}
                    className="block p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative w-7 h-7 flex-shrink-0">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-400/30 flex items-center justify-center text-xs font-bold text-white">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-200 truncate">
                            {name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {timeAgo(chat.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {getLastMessagePreview(chat)}
                        </p>
                      </div>
                    </div>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ─── User Profile ────────────────────────────── */}
      <div className="border-t border-white/10 p-4 sticky bottom-0 bg-inherit">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:bg-white/5 rounded-lg p-1 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 p-[2px] flex-shrink-0">
              <div className="w-full h-full rounded-full bg-[#0f0f12] flex items-center justify-center overflow-hidden">
                {userInfo?.profile ? (
                  <img src={userInfo.profile} alt={userInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <FaUserCircle className="w-7 h-7 text-gray-400" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {userInfo?.name || 'User'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {userInfo?.email || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition-colors"
              title="Settings"
            >
              <FaCog className="text-lg" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              title="Logout"
            >
              <FaSignOutAlt className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default GeneralSidebar;