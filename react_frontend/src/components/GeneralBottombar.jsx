// src/components/GeneralBottombar.jsx
import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useGetUserNotificationsQuery } from "../slices/notificationApiSlice";
import { useCheckAppUpdateQuery } from "../slices/appApiSlice";
import { useGetUserChatsQuery, messagingApiSlice } from "../slices/messagingApiSlice";
import { useGetTodayQuery } from "../slices/todayApiSlice";
import { useGetOngoingCallsQuery } from "../slices/callApiSlice"; // ← NEW
import { useSocket } from "../components/SocketContext.jsx";
import {
  FiSun,
  FiUsers,
  FiCheckSquare,
  FiMenu,
  FiSettings,
  FiUser,
  FiUpload,
  FiBell,
  FiPackage,
  FiFile,
  FiGrid,
  FiPhone, // ← NEW
} from "react-icons/fi";
import { FaTimes, FaExclamationTriangle } from "react-icons/fa";

// ─── Custom WhatsApp‑style Chat Icon ────────────────────────────
const ChatIcon = ({ className, strokeWidth = 1.9 }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
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
      className={`min-w-[17px] h-[17px] px-1 rounded-full bg-cyan-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-[#0f0f12] ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};

// ─── Helper: filter chats that are NOT workspace-scoped ─────────
const isGeneralChat = (chat) => {
  if (!chat) return false;
  return chat.scope !== "workspace";
};

const GeneralBottombar = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);
  const { socket, isConnected } = useSocket();
  const isAdmin =
    userInfo?.role === "admin" || userInfo?.role === "super_admin";

  const [showDrawer, setShowDrawer] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const refetchTimeoutRef = useRef(null);

  // ── App update check ──
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
    }
  );
  const hasUpdate = updateData?.hasUpdate || false;
  const isRequired = updateData?.isRequired || false;
  const latestVersion = updateData?.version || null;

  // ── Unread notifications ──
  const { data: notifData } = useGetUserNotificationsQuery(
    { page: 1, limit: 1, unreadOnly: true },
    { pollingInterval: 30000, refetchOnFocus: true, refetchOnReconnect: true }
  );
  const unreadCount = notifData?.pagination?.total || 0;

  // ── Today attention count ──
  const { data: todayData } = useGetTodayQuery(undefined, {
    pollingInterval: 60000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const todayAttention = todayData?.totalAttention || 0;

  // ── Chat unread counts (general chats only) ──
  const { data: chatsData, refetch: refetchChats } = useGetUserChatsQuery(undefined, {
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const allChats = chatsData?.chats || [];
  const generalChats = allChats.filter(isGeneralChat);

  // ── Ongoing calls (for live dot on drawer) ──
  const { data: ongoingCallsData } = useGetOngoingCallsQuery(undefined, {
    skip: !token,
    pollingInterval: 20_000,
    refetchOnFocus: true,
  });
  const hasOngoingCall = (ongoingCallsData?.calls || []).length > 0;

  // ── Socket listener for real‑time unread updates ──
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleChatListUpdate = ({ chatId, unreadCount }) => {
      if (!chatId) return;

      dispatch(
        messagingApiSlice.util.updateQueryData("getUserChats", undefined, (draft) => {
          if (!draft?.chats) return;
          const chat = draft.chats.find((c) => c._id === chatId);
          if (chat && typeof unreadCount === "number") {
            chat.unreadCount = unreadCount;
          }
        })
      );

      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = setTimeout(() => {
        refetchChats();
        refetchTimeoutRef.current = null;
      }, 500);
    };

    socket.on("chat-list-update", handleChatListUpdate);

    return () => {
      socket.off("chat-list-update", handleChatListUpdate);
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    };
  }, [socket, isConnected, dispatch, refetchChats]);

  // ── Refetch on visibility change ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refetchChats();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refetchChats]);

  // ── Refetch on socket connect ──
  useEffect(() => {
    if (isConnected) refetchChats();
  }, [isConnected, refetchChats]);

  // ── Compute unread totals for general chats ──
  const unreadGeneralChannels = generalChats
    .filter((c) => c.type === "group")
    .reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const unreadGeneralDMs = generalChats
    .filter((c) => c.type === "direct")
    .reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // ── Pulse animation for update indicator ──
  useEffect(() => {
    if (hasUpdate) {
      setPulseAnimation(true);
      const interval = setInterval(() => setPulseAnimation((prev) => !prev), 1500);
      return () => clearInterval(interval);
    }
    setPulseAnimation(false);
  }, [hasUpdate]);

  // ── Drawer items ──
  const drawerItems = [
    // Calls sits first — it's the most "real-time" item
    {
      to: "/calls",
      icon: FiPhone,
      label: "Calls",
      live: hasOngoingCall,
    },
    // Tasks moved from bottom bar
    { to: "/personal-tasks", icon: FiCheckSquare, label: "Tasks" },
    { to: "/notes", icon: FiFile, label: "Notes" },
    { to: "/notifications", icon: FiBell, label: "Notifications", badge: unreadCount },
    {
      to: "/app-versions",
      icon: FiPackage,
      label: "App Versions",
      updateBadge: hasUpdate,
      isRequired,
      latestVersion,
    },
    ...(isAdmin ? [{ to: "/admin/upload", icon: FiUpload, label: "Upload App" }] : []),
  ];

  // ─── Reusable tab renderer ───
  const TabButton = ({ to, icon: Icon, label, badge = 0, isMenu = false, onClick }) => {
    const showUpdateDot = isMenu && hasUpdate && !updateLoading;

    const inner = ({ isActive }) => (
      <>
        <span
          className={`relative flex items-center justify-center w-[46px] h-8 rounded-full transition-all duration-300 ease-out ${
            isActive
              ? "shadow-sm"
              : "group-hover:bg-white/[0.07] group-active:scale-95"
          }`}
          style={isActive ? { backgroundColor: "rgba(6,182,212,0.15)" } : undefined}
        >
          <Icon
            className={`w-[20px] h-[20px] transition-all duration-300 ${
              isActive
                ? "text-cyan-400"
                : isMenu && hasUpdate
                ? "text-cyan-400"
                : "text-gray-400 group-hover:text-gray-200"
            }`}
            strokeWidth={isActive ? 2.4 : 1.9}
          />

          {badge > 0 && (
            <UnreadBadge count={badge} className="absolute -top-0.5 right-0.5" />
          )}

          {showUpdateDot && (
            <>
              <span
                className={`absolute -top-0.5 right-0.5 w-2.5 h-2.5 rounded-full ${
                  isRequired ? "bg-red-500" : "bg-orange-400"
                } shadow-[0_0_10px_currentColor] transition-all duration-500 ${
                  pulseAnimation ? "scale-110 opacity-100" : "scale-100 opacity-80"
                }`}
                style={{ color: isRequired ? "#ef4444" : "#fb923c" }}
              />
              <span
                className={`absolute -top-0.5 right-0.5 w-2.5 h-2.5 rounded-full ${
                  isRequired ? "border-red-500" : "border-orange-400"
                } border-2 transition-all duration-500 ${
                  pulseAnimation ? "scale-150 opacity-0" : "scale-100 opacity-100"
                }`}
              />
            </>
          )}
        </span>

        <span
          className={`text-[10px] leading-none font-semibold tracking-tight transition-colors duration-300 ${
            isActive
              ? "text-cyan-400"
              : isMenu && hasUpdate
              ? "text-cyan-400"
              : "text-gray-400 group-hover:text-gray-200"
          }`}
        >
          {label}
        </span>
      </>
    );

    const baseClass =
      "group relative flex flex-1 flex-col items-center justify-center gap-[5px] pt-1 pb-1 select-none transition-transform active:scale-95";

    if (to) {
      return (
        <NavLink to={to} className={baseClass} aria-label={label}>
          {inner}
        </NavLink>
      );
    }
    return (
      <button onClick={onClick} className={baseClass} aria-label={label}>
        {inner({ isActive: showDrawer })}
      </button>
    );
  };

  return (
    <>
      {/* ─── Bottom Bar — 5 slots: Spaces · Chat · Channels · Today · More ─── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f12]/85 backdrop-blur-xl border-t border-white/[0.06] shadow-[0_-6px_24px_-8px_rgba(0,0,0,0.5)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around h-[62px] px-1 max-w-lg mx-auto">
          <TabButton to="/my-workspaces" icon={FiGrid} label="Spaces" />
          <TabButton to="/chat" icon={ChatIcon} label="Chat" badge={unreadGeneralDMs} />
          <TabButton to="/channels" icon={FiUsers} label="Channels" badge={unreadGeneralChannels} />
          <TabButton to="/today" icon={FiSun} label="Today" badge={todayAttention} />
          <TabButton icon={FiMenu} label="More" isMenu onClick={() => setShowDrawer(true)} />
        </div>
      </div>

      {/* ─── Side Drawer ────────────────────────────────────────────── */}
      {showDrawer && (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-black/50 backdrop-blur-sm md:hidden"
          onClick={(e) => e.target === e.currentTarget && setShowDrawer(false)}
        >
          <div className="h-full w-full max-w-[300px] bg-[#14141a]/95 backdrop-blur-2xl border-l border-white/[0.06] shadow-2xl shadow-cyan-500/10 flex flex-col animate-[slideInRight_0.25s_ease-out]">
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-5 border-b border-white/[0.06] flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                Menu
                {hasUpdate && !updateLoading && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isRequired
                        ? "bg-red-500/20 text-red-400"
                        : "bg-orange-400/20 text-orange-400"
                    } flex items-center gap-1`}
                  >
                    <FaExclamationTriangle className="text-[8px]" />
                    {isRequired ? "Required" : "New"}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowDrawer(false)}
                aria-label="Close menu"
                className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-full transition active:scale-95"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            {/* Items */}
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
                    live,
                  }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setShowDrawer(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition active:scale-[0.98] ${
                          isActive
                            ? "bg-cyan-500/15 text-cyan-400"
                            : "text-gray-300 hover:text-white hover:bg-white/[0.05]"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`relative flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-transform group-hover:scale-105 ${
                              isActive ? "bg-cyan-500/20" : "bg-white/[0.05]"
                            }`}
                          >
                            <Icon
                              className={`w-[18px] h-[18px] ${
                                isActive ? "text-cyan-400" : "text-gray-300"
                              }`}
                              strokeWidth={2}
                            />
                            {updateBadge && to === "/app-versions" && (
                              <span
                                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                                  req ? "bg-red-500" : "bg-orange-400"
                                } shadow-[0_0_8px_currentColor] animate-pulse`}
                                style={{ color: req ? "#ef4444" : "#fb923c" }}
                              />
                            )}
                            {/* Live dot for Calls */}
                            {live && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[#14141a] animate-pulse" />
                            )}
                          </span>
                          <span className="flex-1">{label}</span>
                          {live && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              Live
                            </span>
                          )}
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
                                <span className="text-[9px] text-gray-400">v{latestVer}</span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-1">
                <NavLink
                  to="/settings"
                  onClick={() => setShowDrawer(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition active:scale-[0.98] ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-400"
                        : "text-gray-300 hover:text-white hover:bg-white/[0.05]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? "bg-cyan-500/20" : "bg-white/[0.05]"
                        }`}
                      >
                        <FiSettings
                          className={`w-[18px] h-[18px] ${
                            isActive ? "text-cyan-400" : "text-gray-300"
                          }`}
                          strokeWidth={2}
                        />
                      </span>
                      <span>Settings</span>
                    </>
                  )}
                </NavLink>
                <NavLink
                  to="/profile"
                  onClick={() => setShowDrawer(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition active:scale-[0.98] ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-400"
                        : "text-gray-300 hover:text-white hover:bg-white/[0.05]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? "bg-cyan-500/20" : "bg-white/[0.05]"
                        }`}
                      >
                        <FiUser
                          className={`w-[18px] h-[18px] ${
                            isActive ? "text-cyan-400" : "text-gray-300"
                          }`}
                          strokeWidth={2}
                        />
                      </span>
                      <span>Profile</span>
                    </>
                  )}
                </NavLink>
              </div>

              {/* Update banner */}
              {hasUpdate && !updateLoading && (
                <div
                  className={`mt-4 p-3 rounded-2xl ${
                    isRequired
                      ? "bg-red-500/10 border border-red-500/25"
                      : "bg-orange-400/10 border border-orange-400/25"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <FaExclamationTriangle
                      className={`text-sm mt-0.5 ${
                        isRequired ? "text-red-400" : "text-orange-400"
                      }`}
                    />
                    <div>
                      <p
                        className={`text-xs font-medium ${
                          isRequired ? "text-red-400" : "text-orange-400"
                        }`}
                      >
                        {isRequired ? "Required update available" : "New update available"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Version {latestVersion || ""} is ready to download
                      </p>
                      <NavLink
                        to="/app-versions"
                        onClick={() => setShowDrawer(false)}
                        className={`text-xs font-medium mt-1 inline-block underline ${
                          isRequired
                            ? "text-red-400 hover:text-red-300"
                            : "text-orange-400 hover:text-orange-300"
                        }`}
                      >
                        View & download →
                      </NavLink>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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