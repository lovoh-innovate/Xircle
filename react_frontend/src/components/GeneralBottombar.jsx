// src/components/GeneralBottombar.jsx
import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetUserNotificationsQuery } from "../slices/notificationApiSlice";
import { useCheckAppUpdateQuery } from "../slices/appApiSlice";
import {
  FiHome,
  FiUsers,
  FiCheckSquare,
  FiMenu,
  FiSettings,
  FiUser,
  FiUpload,
  FiBell,
  FiPackage,
  FiAlertCircle,
  FiArrowUp,
  FiFile, // ✅ Added for Notes
} from "react-icons/fi";
import { FaTimes, FaExclamationTriangle } from "react-icons/fa";

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
    style={{ width: "1.5rem", height: "1.5rem" }}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 10h8" />
    <path d="M8 14h6" />
  </svg>
);

// ─── Small unread‑count pill ─────────────────────────────────────
const UnreadBadge = ({ count, className = "" }) => {
  if (!count) return null;
  return (
    <span
      className={`min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(6,182,212,0.6)] ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};

// ─── Update Badge ─────────────────────────────────────────────────
const UpdateBadge = ({ hasUpdate, isRequired, loading }) => {
  if (!hasUpdate || loading) return null;
  const color = isRequired
    ? "bg-red-500 text-white"
    : "bg-orange-400 text-white";
  const label = isRequired ? "Required" : "New";
  return (
    <span
      className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}
    >
      {label}
    </span>
  );
};

const GeneralBottombar = () => {
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);
  const isAdmin =
    userInfo?.role === "admin" || userInfo?.role === "super_admin";

  const [showDrawer, setShowDrawer] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // ── App update check for ALL users ──
  const token = userInfo?.token;
  const currentVersion = userInfo?.appVersion;
  const { data: updateData, isLoading: updateLoading } = useCheckAppUpdateQuery(
    {
      platform: "android",
      currentVersion: currentVersion || undefined,
      token,
    },
    {
      skip: !token,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      pollingInterval: 60000,
    },
  );
  const hasUpdate = updateData?.hasUpdate || false;
  const isRequired = updateData?.isRequired || false;
  const latestVersion = updateData?.version || null;

  // ── Unread notifications ──
  const { data: notifData } = useGetUserNotificationsQuery(
    { page: 1, limit: 1, unreadOnly: true },
    { pollingInterval: 30000, refetchOnFocus: true, refetchOnReconnect: true },
  );
  const unreadCount = notifData?.pagination?.total || 0;

  // ── Pulse animation for update indicator ──
  useEffect(() => {
    if (hasUpdate) {
      setPulseAnimation(true);
      const interval = setInterval(() => {
        setPulseAnimation(prev => !prev);
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setPulseAnimation(false);
    }
  }, [hasUpdate]);

  // ── Drawer items ──
  const drawerItems = [
    // ✅ Notes link added here
    {
      to: "/notes",
      icon: FiFile,
      label: "Notes",
    },
    {
      to: "/notifications",
      icon: FiBell,
      label: "Notifications",
      badge: unreadCount,
    },
    {
      to: "/app-versions",
      icon: FiPackage,
      label: "App Versions",
      updateBadge: hasUpdate,
      isRequired,
      latestVersion,
    },
    ...(isAdmin
      ? [{ to: "/admin/upload", icon: FiUpload, label: "Upload App" }]
      : []),
  ];

  return (
    <>
      {/* ─── Bottom Bar ────────────────────────────────────────────── */}
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
                className={`text-xl ${isActive ? "text-cyan-400" : "text-gray-400 hover:text-white"}`}
              />
              <span
                className={`mt-0.5 text-[10px] tracking-wide ${isActive ? "text-cyan-400" : "text-gray-400"}`}
              >
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
                className={`text-xl ${isActive ? "text-cyan-400" : "text-gray-400 hover:text-white"}`}
                strokeWidth={1.75}
              />
              <span
                className={`mt-0.5 text-[10px] tracking-wide ${isActive ? "text-cyan-400" : "text-gray-400"}`}
              >
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
                className={`text-xl ${isActive ? "text-cyan-400" : "text-gray-400 hover:text-white"}`}
                strokeWidth={1.75}
              />
              <span
                className={`mt-0.5 text-[10px] tracking-wide ${isActive ? "text-cyan-400" : "text-gray-400"}`}
              >
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
                className={`text-xl ${isActive ? "text-cyan-400" : "text-gray-400 hover:text-white"}`}
                strokeWidth={1.75}
              />
              <span
                className={`mt-0.5 text-[10px] tracking-wide ${isActive ? "text-cyan-400" : "text-gray-400"}`}
              >
                Tasks
              </span>
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
              )}
            </div>
          )}
        </NavLink>

        {/* More – opens the side drawer with update indicator */}
        <button
          onClick={() => setShowDrawer(true)}
          className="relative flex flex-col items-center justify-center text-xs font-medium transition-all duration-300"
        >
          <div className="relative">
            <FiMenu 
              className={`text-xl transition-all duration-300 ${
                hasUpdate ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
              }`} 
              strokeWidth={1.75} 
            />
            
            {/* Update indicator dot with pulse */}
            {hasUpdate && !updateLoading && (
              <>
                <span
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                    isRequired ? "bg-red-500" : "bg-orange-400"
                  } shadow-[0_0_12px_currentColor] transition-all duration-500 ${
                    pulseAnimation ? "scale-110 opacity-100" : "scale-100 opacity-80"
                  }`}
                  style={{ color: isRequired ? "#ef4444" : "#fb923c" }}
                />
                <span
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                    isRequired ? "border-red-500" : "border-orange-400"
                  } border-2 transition-all duration-500 ${
                    pulseAnimation ? "scale-150 opacity-0" : "scale-100 opacity-100"
                  }`}
                />
              </>
            )}

            {/* Arrow up indicator */}
            {hasUpdate && !updateLoading && (
              <FiArrowUp 
                className={`absolute -top-4 -right-2 text-[10px] ${
                  isRequired ? "text-red-400" : "text-orange-400"
                } transition-all duration-500 ${
                  pulseAnimation ? "transform -translate-y-0.5" : "transform translate-y-0"
                }`}
              />
            )}

            {/* Notification badge */}
            {!showDrawer && unreadCount > 0 && !hasUpdate && (
              <UnreadBadge
                count={unreadCount}
                className="absolute -top-1.5 -right-2"
              />
            )}
          </div>
          
          <span className={`mt-0.5 text-[10px] tracking-wide flex items-center gap-1 ${
            hasUpdate ? 'text-cyan-400' : 'text-gray-400'
          }`}>
            More
            {hasUpdate && !updateLoading && (
              <span className={`text-[8px] font-bold ${
                isRequired ? 'text-red-400' : 'text-orange-400'
              }`}>
                ●
              </span>
            )}
          </span>
        </button>
      </div>

      {/* ─── Side Drawer ────────────────────────────────────────────── */}
      {showDrawer && (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowDrawer(false)}
        >
          <div className="h-full w-full max-w-[280px] bg-[#14141a]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl shadow-cyan-500/10 flex flex-col animate-[slideInRight_0.25s_ease-out]">
            <div className="flex justify-between items-center px-4 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                Menu
                {hasUpdate && !updateLoading && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isRequired ? 'bg-red-500/20 text-red-400' : 'bg-orange-400/20 text-orange-400'
                  } flex items-center gap-1`}>
                    <FaExclamationTriangle className="text-[8px]" />
                    {isRequired ? 'Required Update' : 'New Update'}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="space-y-1">
                {drawerItems.map(
                  ({
                    to,
                    icon: Icon,
                    label,
                    badge,
                    updateBadge,
                    isRequired: req,
                    latestVersion: latestVer,
                  }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setShowDrawer(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-cyan-500/20 text-cyan-400"
                            : "text-gray-300 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <span className="relative flex-shrink-0">
                        <Icon className="text-lg" />
                        {updateBadge && to === "/app-versions" && (
                          <span
                            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                              req ? "bg-red-500" : "bg-orange-400"
                            } shadow-[0_0_8px_currentColor] animate-pulse`}
                            style={{ color: req ? "#ef4444" : "#fb923c" }}
                          />
                        )}
                      </span>
                      <span className="flex-1">{label}</span>
                      {badge > 0 && <UnreadBadge count={badge} />}
                      {updateBadge && to === "/app-versions" && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              req ? "bg-red-500" : "bg-orange-400"
                            } text-white flex items-center gap-0.5`}
                          >
                            <FaExclamationTriangle className="text-[8px]" />
                            {req ? "Required" : "New"}
                          </span>
                          {latestVer && (
                            <span className="text-[9px] text-gray-400">
                              v{latestVer}
                            </span>
                          )}
                        </div>
                      )}
                    </NavLink>
                  ),
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
                <NavLink
                  to="/settings"
                  onClick={() => setShowDrawer(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
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
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  <FiUser className="text-lg" />
                  <span>Profile</span>
                </NavLink>
              </div>

              {/* Update notification banner at bottom of drawer */}
              {hasUpdate && !updateLoading && (
                <div className={`mt-4 p-3 rounded-xl ${
                  isRequired 
                    ? 'bg-red-500/10 border border-red-500/30' 
                    : 'bg-orange-400/10 border border-orange-400/30'
                }`}>
                  <div className="flex items-start gap-2">
                    <FaExclamationTriangle className={`text-sm mt-0.5 ${
                      isRequired ? 'text-red-400' : 'text-orange-400'
                    }`} />
                    <div>
                      <p className={`text-xs font-medium ${
                        isRequired ? 'text-red-400' : 'text-orange-400'
                      }`}>
                        {isRequired ? '⚠️ Required Update Available' : '📱 New Update Available'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Version {latestVersion || ''} is ready to download
                      </p>
                      <NavLink
                        to="/app-versions"
                        onClick={() => setShowDrawer(false)}
                        className={`text-xs font-medium mt-1 inline-block ${
                          isRequired ? 'text-red-400 hover:text-red-300' : 'text-orange-400 hover:text-orange-300'
                        } underline`}
                      >
                        Tap to view & download →
                      </NavLink>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-in keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </>
  );
};

export default GeneralBottombar;