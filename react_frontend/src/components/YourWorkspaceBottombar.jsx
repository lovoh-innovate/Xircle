// src/components/YourWorkspaceBottombar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useLogoutMutation } from '../slices/userApiSlice';
import { logout } from '../slices/authSlice';
import { toast } from 'react-toastify';
import {
  FiHome,
  FiMessageCircle,
  FiUsers,
  FiUser,
  FiMenu,
  FiX,
  FiFolder,
  FiLogOut,
  FiClock,
} from 'react-icons/fi';
import { useGetUserChatsQuery, messagingApiSlice } from '../slices/messagingApiSlice';
import { useSocket } from '../components/SocketContext.jsx';

// ─── Helper: filter chats belonging to this workspace ──────────────
const belongsToWorkspace = (chat, workspaceId) => {
  if (!chat) return false;
  const chatWorkspaceId =
    typeof chat.workspace === 'object' && chat.workspace !== null
      ? chat.workspace._id
      : chat.workspace;
  return chat.scope === 'workspace' && String(chatWorkspaceId) === String(workspaceId);
};

const YourWorkspaceBottombar = ({ workspace }) => {
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { socket, isConnected } = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);
  const refetchTimeoutRef = useRef(null);

  const [logoutUser] = useLogoutMutation();
  const brandColor = workspace?.color || '#0d9488';

  // ── Query with aggressive refresh options ──
  const { data: chatsData, refetch: refetchChats } = useGetUserChatsQuery(workspaceId, {
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const allChats = chatsData?.chats || [];
  const workspaceChats = allChats.filter(chat => belongsToWorkspace(chat, workspaceId));

  // ── Socket listener for real‑time unread updates ──
  useEffect(() => {
    if (!socket || !isConnected || !workspaceId) return;

    const handleChatListUpdate = ({ chatId, unreadCount }) => {
      if (!chatId) return;

      dispatch(
        messagingApiSlice.util.updateQueryData('getUserChats', workspaceId, draft => {
          if (!draft?.chats) return;
          const chat = draft.chats.find(c => c._id === chatId);
          if (chat && typeof unreadCount === 'number') chat.unreadCount = unreadCount;
        })
      );

      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = setTimeout(() => {
        refetchChats();
        refetchTimeoutRef.current = null;
      }, 500);
    };

    socket.on('chat-list-update', handleChatListUpdate);

    return () => {
      socket.off('chat-list-update', handleChatListUpdate);
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    };
  }, [socket, isConnected, workspaceId, dispatch, refetchChats]);

  // ── Refetch when page becomes visible ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetchChats();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetchChats]);

  // ── Refetch when socket connects ──
  useEffect(() => {
    if (isConnected) refetchChats();
  }, [isConnected, refetchChats]);

  // ── Totals ──
  const unreadChannels = workspaceChats
    .filter(c => c.type === 'group')
    .reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const unreadDMs = workspaceChats
    .filter(c => c.type === 'direct')
    .reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // ── Navigation helpers ──
  const isActive = pathPattern => {
    if (pathPattern === 'home') return location.pathname === `/workspace/${workspaceId}`;
    return location.pathname.includes(pathPattern);
  };

  const handleLogout = async () => {
    try {
      await logoutUser().unwrap();
      dispatch(logout());
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (err) {
      toast.error(err?.data?.message || 'Logout failed');
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: FiHome, path: `/workspace/${workspaceId}`, activeCheck: 'home' },
    { id: 'dms', label: 'Messages', icon: FiMessageCircle, path: `/workspace/${workspaceId}/dms`, activeCheck: '/dms' },
    { id: 'channels', label: 'Channels', icon: FiUsers, path: `/workspace/${workspaceId}/channels`, activeCheck: '/channels' },
    { id: 'projects', label: 'Projects', icon: FiFolder, path: `/workspace/${workspaceId}/projects`, activeCheck: '/projects' },
    { id: 'members', label: 'Members', icon: FiUser, path: `/workspace/${workspaceId}/members`, activeCheck: '/members' },
  ];

  const menuItems = [
    { id: 'clockin', label: 'Clock‑in', icon: FiClock, path: `/workspace/${workspaceId}/clockin` },
    { id: 'profile', label: 'Profile', icon: FiUser, path: '/profile' },
    { id: 'logout', label: 'Logout', icon: FiLogOut, action: handleLogout },
  ];

  // ─── Reusable renderer for a single bottom-bar tab ───
  const renderTab = ({ key, icon: Icon, label, active, badgeCount = 0, onClick, to }) => {
    const content = (
      <>
        <span
          className={`relative flex items-center justify-center w-[46px] h-8 rounded-full transition-all duration-300 ease-out ${
            active
              ? 'shadow-sm'
              : 'group-hover:bg-gray-100/80 dark:group-hover:bg-white/[0.06] group-active:scale-95'
          }`}
          style={active ? { backgroundColor: `${brandColor}1a` } : undefined}
        >
          <Icon
            className={`w-[20px] h-[20px] transition-all duration-300 ${
              active
                ? ''
                : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
            }`}
            style={active ? { color: brandColor } : undefined}
            strokeWidth={active ? 2.4 : 1.9}
          />
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-[#0f0f12]">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </span>

        <span
          className={`text-[10px] leading-none font-semibold tracking-tight transition-colors duration-300 ${
            active
              ? ''
              : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
          }`}
          style={active ? { color: brandColor } : undefined}
        >
          {label}
        </span>
      </>
    );

    const baseClass =
      'group relative flex flex-1 flex-col items-center justify-center gap-[5px] pt-1 pb-1 select-none transition-transform active:scale-95';

    if (to) {
      return (
        <Link key={key} to={to} className={baseClass} aria-label={label}>
          {content}
        </Link>
      );
    }
    return (
      <button key={key} onClick={onClick} className={baseClass} aria-label={label}>
        {content}
      </button>
    );
  };

  return (
    <>
      {/* ─── Bottom Bar (mobile only) ──────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/85 dark:bg-[#0f0f12]/85 backdrop-blur-xl border-t border-gray-200/70 dark:border-white/[0.06] shadow-[0_-6px_24px_-8px_rgba(0,0,0,0.12)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around h-[62px] px-1 max-w-lg mx-auto">
          {navItems.map(item => {
            let badgeCount = 0;
            if (item.id === 'channels') badgeCount = unreadChannels;
            if (item.id === 'dms') badgeCount = unreadDMs;

            return renderTab({
              key: item.id,
              icon: item.icon,
              label: item.label,
              active: isActive(item.activeCheck),
              badgeCount,
              to: item.path,
            });
          })}

          {renderTab({
            key: 'menu',
            icon: FiMenu,
            label: 'Menu',
            active: menuOpen,
            onClick: () => setMenuOpen(true),
          })}
        </div>
      </div>

      {/* ─── Slide‑out overlay ──────────────────────────────────────── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-sm md:hidden animate-[fadeIn_.2s_ease-out]"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ─── Slide‑out panel ────────────────────────────────────────── */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[280px] bg-white dark:bg-[#14141a] border-r border-gray-200/70 dark:border-white/[0.06] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderRadius: '0 24px 24px 0' }}
      >
        {/* Header */}
        <div className="px-5 py-5 flex items-center justify-between border-b border-gray-200/70 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            {workspace?.logo ? (
              <img
                src={workspace.logo}
                alt={workspace.name}
                className="w-10 h-10 rounded-2xl object-cover border border-gray-200 dark:border-gray-700/60"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                style={{ backgroundColor: brandColor }}
              >
                {workspace?.initials || workspace?.name?.charAt(0).toUpperCase() || 'W'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                {workspace?.name || 'Workspace'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Member</p>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition active:scale-95"
          >
            <FiX className="text-lg" strokeWidth={2} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="py-3 px-3 overflow-y-auto" style={{ maxHeight: 'calc(100% - 170px)' }}>
          {menuItems.map(item => {
            const Icon = item.icon;
            const rowClass =
              'group flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/[0.05] transition w-full active:scale-[0.98]';

            const inner = (
              <>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: `${brandColor}1a` }}
                >
                  <Icon className="w-[20px] h-[20px]" style={{ color: brandColor }} strokeWidth={2} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition">
                  {item.label}
                </span>
              </>
            );

            if (item.action) {
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setMenuOpen(false);
                    item.action();
                  }}
                  className={rowClass}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={rowClass}
              >
                {inner}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-gray-200/70 dark:border-white/[0.06] bg-white/80 dark:bg-[#14141a]/80 backdrop-blur-sm">
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
            Xircle · {workspace?.name}
          </p>
        </div>
      </div>
    </>
  );
};

export default YourWorkspaceBottombar;