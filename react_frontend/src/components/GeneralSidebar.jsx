// src/components/GeneralSidebar.jsx
import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../slices/authSlice';
import { useGetPersonalTasksQuery } from '../slices/personalTaskApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import {
  FaHome,
  FaTasks,
  FaCommentDots,
  FaHashtag,
  FaUserCircle,
  FaCog,
  FaSignOutAlt,
  FaExclamationCircle,
  FaClock,
} from 'react-icons/fa';

// Logo from public folder
const LOGO = '/logo.png';

const GeneralSidebar = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    dispatch(logout());
    navigate('/login');
  };

  // ─── Personal Tasks ──────────────────────────────
  const { data: personalTasksData, isLoading: tasksLoading } = useGetPersonalTasksQuery({
    status: 'pending',
    limit: 3,
  });
  const personalTasks = personalTasksData?.tasks || [];
  const pendingCount = personalTasksData?.count || 0;

  // ─── Recent Chats (ONLY public chats) ──────────────────
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery({
    archived: false,
  });
  const recentChats = useMemo(() => {
    if (!chatsData?.chats) return [];
    // 🔥 Filter: keep only public chats (outside workspaces)
    const publicChats = chatsData.chats.filter((chat) => chat.scope === 'public');
    return publicChats
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      .slice(0, 3);
  }, [chatsData]);

  const getChatName = (chat) => {
    if (chat.type === 'group') return chat.name || 'Group';
    // Direct chat – find the other participant
    const other = chat.participants?.find((p) => p.user._id !== userInfo?._id);
    return other?.user?.name || 'Unknown';
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
        <img src={LOGO} alt="Xircle" className="h-8 w-8 object-contain" />
        <span className="text-xl font-bold text-white tracking-tight">Xircle</span>
      </div>

      {/* ─── Navigation ─────────────────────────────── */}
      <nav className="px-3 py-4 border-b border-white/10">
        <ul className="space-y-1">
          {[
            { to: '/dashboard', icon: FaHome, label: 'Home' },
            { to: '/workspaces', icon: FaHashtag, label: 'Workspaces' },
            { to: '/personal-tasks', icon: FaTasks, label: 'My Tasks' },
            { to: '/chat', icon: FaCommentDots, label: 'Chat' },
            { to: '/channels', icon: FaHashtag, label: 'Channels' },
          ].map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-cyan-300'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon className="text-lg w-6 text-center" />
                <span>{label}</span>
                {({ isActive }) => isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </NavLink>
            </li>
          ))}
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

      {/* ─── Recent Messages (Public chats only) ────────── */}
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
            {recentChats.map((chat) => (
              <li key={chat._id}>
                <NavLink
                  to={`/chat/${chat._id}`}
                  className="block p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-400/30 flex items-center justify-center text-xs font-bold text-white">
                      {getChatName(chat).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {getChatName(chat)}
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
            ))}
          </ul>
        )}
      </div>

      {/* ─── User Profile ────────────────────────────── */}
      <div className="border-t border-white/10 p-4 sticky bottom-0 bg-inherit">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 p-[2px]">
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
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            title="Logout"
          >
            <FaSignOutAlt className="text-lg" />
          </button>
        </div>
        <div className="mt-3 flex justify-around">
          <button className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition-colors">
            <FaCog className="text-lg" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default GeneralSidebar;