// src/components/GeneralBottombar.jsx
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetUserNotificationsQuery } from '../slices/notificationApiSlice';
import {
  FiHome,
  FiUsers,
  FiCheckSquare,
  FiMenu,
  FiSettings,
  FiUser,
  FiUpload,
  FiBell,
} from 'react-icons/fi';
import { FaTimes } from 'react-icons/fa';

// ─── Custom WhatsApp‑style Chat Icon ────────────────────────────
const ChatIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ width: '1.5rem', height: '1.5rem' }}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 10h8" />
    <path d="M8 14h6" />
  </svg>
);

// ─── Small unread-count pill ─────────────────────────────────────
const UnreadBadge = ({ count, className = '' }) => {
  if (!count) return null;
  return (
    <span
      className={`min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(6,182,212,0.6)] ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};

const GeneralBottombar = () => {
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);
  const isAdmin = userInfo?.role === 'admin' || userInfo?.role === 'super_admin';

  const [showDrawer, setShowDrawer] = useState(false);

  // ── Unread notifications count (small poll keeps the badge fresh) ──
  const { data: notifData } = useGetUserNotificationsQuery(
    { page: 1, limit: 1, unreadOnly: true },
    { pollingInterval: 30000, refetchOnFocus: true, refetchOnReconnect: true }
  );
  const unreadCount = notifData?.pagination?.total || 0;

  const drawerItems = [
    { to: '/notifications', icon: FiBell, label: 'Notifications', badge: unreadCount },
    ...(isAdmin ? [{ to: '/admin/upload', icon: FiUpload, label: 'Upload App' }] : []),
  ];

  return (
    <>
      {/* ─── Bottom Bar – Full Width ────────────────────────────── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 
                   bg-[#0f0f12]/80 backdrop-blur-2xl 
                   border-t border-white/10 
                   flex items-center justify-around h-16 px-2 z-50"
      >
        {/* Chat */}
        <NavLink to="/chat">
          {({ isActive }) => (
            <div className="relative flex flex-col items-center justify-center text-xs font-medium transition-all duration-300">
              <ChatIcon
                className={`text-xl ${isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              />
              <span className={`mt-0.5 text-[10px] tracking-wide ${isActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                Chat
              </span>
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
              )}
            </div>
          )}
        </NavLink>

        {/* Channels */}
        <NavLink to="/channels">
          {({ isActive }) => (
            <div className="relative flex flex-col items-center justify-center text-xs font-medium transition-all duration-300">
              <FiUsers
                className={`text-xl ${isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                strokeWidth={1.75}
              />
              <span className={`mt-0.5 text-[10px] tracking-wide ${isActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                Channels
              </span>
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
              )}
            </div>
          )}
        </NavLink>

        {/* Home */}
        <NavLink to="/my-workspaces">
          {({ isActive }) => (
            <div className="relative flex flex-col items-center justify-center text-xs font-medium transition-all duration-300">
              <FiHome
                className={`text-xl ${isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                strokeWidth={1.75}
              />
              <span className={`mt-0.5 text-[10px] tracking-wide ${isActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                Home
              </span>
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
              )}
            </div>
          )}
        </NavLink>

        {/* Tasks */}
        <NavLink to="/personal-tasks">
          {({ isActive }) => (
            <div className="relative flex flex-col items-center justify-center text-xs font-medium transition-all duration-300">
              <FiCheckSquare
                className={`text-xl ${isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                strokeWidth={1.75}
              />
              <span className={`mt-0.5 text-[10px] tracking-wide ${isActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                Tasks
              </span>
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
              )}
            </div>
          )}
        </NavLink>

        {/* More – opens the side drawer. Carries the unread badge
            until the drawer is open, at which point the badge
            "moves" onto the Notifications row inside the drawer. */}
        <button
          onClick={() => setShowDrawer(true)}
          className="relative flex flex-col items-center justify-center text-xs font-medium text-gray-400 hover:text-white transition-all duration-300"
        >
          <div className="relative">
            <FiMenu className="text-xl" strokeWidth={1.75} />
            {!showDrawer && unreadCount > 0 && (
              <UnreadBadge count={unreadCount} className="absolute -top-1.5 -right-2" />
            )}
          </div>
          <span className="mt-0.5 text-[10px] tracking-wide">More</span>
        </button>
      </div>

      {/* ─── Side Drawer (slides in from the right, like a sidebar) ── */}
      {showDrawer && (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowDrawer(false)}
        >
          <div
            className="h-full w-full max-w-[280px] bg-[#14141a]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl shadow-cyan-500/10 flex flex-col animate-[slideInRight_0.25s_ease-out]"
          >
            <div className="flex justify-between items-center px-4 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-300">Menu</h3>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="space-y-1">
                {drawerItems.map(({ to, icon: Icon, label, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setShowDrawer(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }`
                    }
                  >
                    <span className="relative flex-shrink-0">
                      <Icon className="text-lg" />
                    </span>
                    <span className="flex-1">{label}</span>
                    {badge > 0 && <UnreadBadge count={badge} />}
                  </NavLink>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
                <NavLink
                  to="/settings"
                  onClick={() => setShowDrawer(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <FiSettings className="text-lg" />
                  <span>Settings</span>
                </NavLink>
                <NavLink
                  to="/profile"
                  onClick={() => setShowDrawer(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <FiUser className="text-lg" />
                  <span>Profile</span>
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in keyframes for the side drawer */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
};

export default GeneralBottombar;