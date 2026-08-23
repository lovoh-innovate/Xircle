// src/components/MyWorkspaceBottombar.jsx
import React, { useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiUsers,
  FiSettings,
  FiMenu,
  FiX,
  FiFolder,
  FiUserPlus,
  FiBell,
  FiLogOut,
  FiUser,
  FiCopy,
  FiCheck,
  FiClock,
} from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { useLogoutMutation } from '../slices/userApiSlice';
import { logout } from '../slices/authSlice';
import { toast } from 'react-toastify';

// ─── Custom WhatsApp‑style Chat Icon (matches sidebar & bottom bar) ──
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

// ─── Invite Modal ──────────────────────────────────────────────────────
const InviteModal = ({ isOpen, onClose, inviteCode, brandColor, workspaceName }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] border border-gray-200/60 dark:border-gray-800/60 rounded-t-3xl w-full max-w-md p-6 pb-8 animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Invite Members</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Share this invite code with your team. They can join using the code.
        </p>

        <div className="bg-gray-50 dark:bg-[#0b0b10] rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider">Invite Code</p>
              <p className="text-xl font-mono font-bold text-gray-800 dark:text-gray-200 mt-1">{inviteCode}</p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-lg transition hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              {copied ? <FiCheck className="text-xs" /> : <FiCopy className="text-xs" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <FiCopy className="text-xs" />
          Copy invite link
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-4">
          Anyone with this link can join {workspaceName}
        </p>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
const MyWorkspaceBottombar = ({ workspace }) => {
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const brandColor = workspace?.color || '#0d9488';

  const [logoutUser] = useLogoutMutation();

  const isActive = (path) => {
    if (path === 'home' && location.pathname === `/my-workspace/${workspaceId}`) return true;
    if (path !== 'home' && location.pathname.includes(path)) return true;
    return false;
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

  // ─── Bottom navigation items (with custom ChatIcon) ────────────────
  const navItems = [
    { id: 'home', label: 'Home', icon: FiHome, path: `/my-workspace/${workspaceId}` },
    { id: 'channels', label: 'Chats', icon: ChatIcon, path: `/my-workspace/${workspaceId}/channels` },
    { id: 'members', label: 'Members', icon: FiUsers, path: `/my-workspace/${workspaceId}/members` },
  ];

  // ─── Menu items (slide‑out) ─────────────────────────────────────────
  const menuItems = [
    { id: 'projects', label: 'Projects', icon: FiFolder, path: `/my-workspace/${workspaceId}/projects` },
    { id: 'clockin', label: 'Clock‑in', icon: FiClock, path: `/my-workspace/${workspaceId}/clockin` },
    { id: 'invite', label: 'Invite Members', icon: FiUserPlus, action: () => setInviteModalOpen(true) },
    // { id: 'notifications', label: 'Notifications', icon: FiBell, path: `/my-workspace/${workspaceId}/notifications` },
    { id: 'settings', label: 'Settings', icon: FiSettings, path: `/my-workspace/${workspaceId}/settings` },
    { id: 'profile', label: 'Profile', icon: FiUser, path: '/profile' },
  ];

  return (
    <>
      {/* ── Bottom Bar (mobile only) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0f0f12]/90 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60 md:hidden">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.id);
            return (
              <Link
                key={item.id}
                to={item.path}
                className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full transition-all group"
              >
                <Icon
                  strokeWidth={active ? 2.5 : 1.8}
                  className={`text-xl transition-all duration-200 ${
                    active
                      ? `text-[#0d9488] scale-110`
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    active
                      ? 'text-gray-800 dark:text-gray-200'
                      : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                  }`}
                >
                  {item.label}
                </span>
                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#0d9488]" />
                )}
              </Link>
            );
          })}

          {/* Menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full transition-all group"
          >
            <FiMenu className="text-xl text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" strokeWidth={1.8} />
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300">Menu</span>
          </button>
        </div>
      </div>

      {/* ─── Slide-out Menu (mobile) ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-[#0b0b10]/70 backdrop-blur-sm md:hidden" onClick={() => setMenuOpen(false)} />
      )}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[300px] bg-white dark:bg-[#14141a] border-r border-gray-200/60 dark:border-gray-800/60 shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderRadius: '0 24px 24px 0' }}
      >
        {/* Menu Header */}
        <div className="px-5 py-5 flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="flex items-center gap-3">
            {workspace?.logo ? (
              <img src={workspace.logo} alt={workspace.name} className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brandColor }}>
                {workspace?.initials || workspace?.name?.charAt(0).toUpperCase() || 'W'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{workspace?.name || 'Workspace'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Owner</p>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
            <FiX className="text-lg" strokeWidth={2} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="py-2 px-3 overflow-y-auto" style={{ maxHeight: 'calc(100% - 180px)' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            if (item.action) {
              return (
                <button
                  key={item.id}
                  onClick={() => { setMenuOpen(false); item.action(); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition w-full"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}20`, color: brandColor }}>
                    <Icon className="text-sm" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}20`, color: brandColor }}>
                  <Icon className="text-sm" strokeWidth={2} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">{item.label}</span>
              </Link>
            );
          })}

          <div className="h-px bg-gray-200 dark:bg-gray-800/60 my-2 mx-4" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition w-full"
          >
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
              <FiLogOut className="text-sm text-red-600 dark:text-red-400" strokeWidth={2} />
            </div>
            <span className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition">Logout</span>
          </button>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-[#14141a]/80 backdrop-blur-sm">
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center">Xircle v1.0 · {workspace?.name}</p>
        </div>
      </div>

      {/* ─── Invite Modal ── */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        inviteCode={workspace?.inviteCode || 'N/A'}
        brandColor={brandColor}
        workspaceName={workspace?.name}
      />

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
};

export default MyWorkspaceBottombar;