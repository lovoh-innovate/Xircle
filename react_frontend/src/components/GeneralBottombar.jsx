// src/components/GeneralBottombar.jsx
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FaHome,
  FaTasks,
  FaUsers,
  FaTimes,
  FaBars,
  FaCog,
  FaUser,
  FaUpload,
} from 'react-icons/fa';

// ─── Custom Chat Icon (WhatsApp‑style) ──────────────────────────
const ChatIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ width: '1.5rem', height: '1.5rem' }}
  >
    {/* Bubble */}
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    {/* Dashes (lines of text) */}
    <path d="M8 10h8" />
    <path d="M8 14h6" />
  </svg>
);

const GeneralBottombar = () => {
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);
  const isAdmin = userInfo?.role === 'admin' || userInfo?.role === 'super_admin';

  const [showDrawer, setShowDrawer] = useState(false);

  const isHomeActive = () => location.pathname === '/my-workspaces';

  const drawerItems = [
    ...(isAdmin ? [{ to: '/admin/upload', icon: FaUpload, label: 'Upload App' }] : []),
  ];

  return (
    <>
      {/* ─── Bottom Bar ───────────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f0f12]/80 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around h-16 px-2 z-50">
        {/* Channels (left) */}
        <NavLink
          to="/channels"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-xs font-medium transition-all duration-300 ${
              isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <FaUsers className="text-xl" />
          <span>Channels</span>
        </NavLink>

        {/* Chat (left) – custom WhatsApp‑style icon */}
        <NavLink
          to="/chat"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-xs font-medium transition-all duration-300 ${
              isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <ChatIcon className="text-xl" />
          <span>Chat</span>
        </NavLink>

        {/* Home (center – stands out) */}
        <div className="relative -mt-8">
          <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />
          <NavLink
            to="/my-workspaces"
            className={() =>
              `relative w-14 h-14 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:shadow-[0_0_50px_rgba(6,182,212,0.8)] transition-all duration-300 text-white ${
                isHomeActive() ? 'scale-110' : ''
              }`
            }
          >
            <FaHome className="text-2xl" />
          </NavLink>
        </div>

        {/* Tasks (right) */}
        <NavLink
          to="/personal-tasks"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-xs font-medium transition-all duration-300 ${
              isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <FaTasks className="text-xl" />
          <span>Tasks</span>
        </NavLink>

        {/* More (right) */}
        <button
          onClick={() => setShowDrawer(true)}
          className="flex flex-col items-center justify-center text-xs font-medium text-gray-400 hover:text-white transition-all duration-300"
        >
          <FaBars className="text-xl" />
          <span>More</span>
        </button>
      </div>

      {/* ─── Bottom Drawer ────────────────────────────────────────── */}
      {showDrawer && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowDrawer(false)}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-[#14141a]/95 backdrop-blur-2xl border-t border-white/10 shadow-2xl shadow-cyan-500/10 p-4 pb-8 transition-transform duration-300 ease-out">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-300">Menu</h3>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            <div className="space-y-1">
              {drawerItems.map(({ to, icon: Icon, label }) => (
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
                  <Icon className="text-lg" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
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
                <FaCog className="text-lg" />
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
                <FaUser className="text-lg" />
                <span>Profile</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GeneralBottombar;