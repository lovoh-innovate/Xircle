// src/components/MyWorkspaceBottombar.jsx
import React, { useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiMessageCircle,
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
} from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { useLogoutMutation } from '../slices/userApiSlice';
import { logout } from '../slices/authSlice';
import { toast } from 'react-toastify';

// ─── Invite Modal ────────────────────────────────────────────────
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:hidden"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Invite Members</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400 hover:text-gray-600"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Share this invite code with your team members. They can join the workspace using the code.
        </p>

        {/* Invite code card */}
        <div
          className="bg-gray-50 rounded-xl border border-gray-200/80 p-4 mb-4"
          style={{ borderColor: `${brandColor}30` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Invite Code</p>
              <p className="text-xl font-mono font-bold text-gray-900 mt-1">{inviteCode}</p>
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

        {/* Optional invite link */}
        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
        >
          <FiCopy className="text-xs" />
          Copy invite link
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          Share this link with anyone you want to join {workspaceName}
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

  const brandColor = workspace?.color || '#4F46E5';

  const [logoutUser] = useLogoutMutation();

  const isActive = (path) => {
    if (path === 'home' && location.pathname === `/my-workspace/${workspaceId}`) {
      return true;
    }
    if (path !== 'home' && location.pathname.includes(path)) {
      return true;
    }
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

  const navItems = [
    { id: 'home', label: 'Home', icon: FiHome, path: `/my-workspace/${workspaceId}` },
    { id: 'channels', label: 'Chats', icon: FiMessageCircle, path: `/my-workspace/${workspaceId}/channels` },
    { id: 'members', label: 'Members', icon: FiUsers, path: `/my-workspace/${workspaceId}/members` },
  ];

  const menuItems = [
    { id: 'projects', label: 'Projects', icon: FiFolder, path: `/my-workspace/${workspaceId}/projects` },
    { id: 'invite', label: 'Invite Members', icon: FiUserPlus, action: () => setInviteModalOpen(true) },
    { id: 'notifications', label: 'Notifications', icon: FiBell, path: `/my-workspace/${workspaceId}/notifications` },
    { id: 'settings', label: 'Settings', icon: FiSettings, path: `/my-workspace/${workspaceId}/settings` },
    { id: 'profile', label: 'Profile', icon: FiUser, path: '/profile' },
  ];

  return (
    <>
      {/* ── Bottom Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 md:hidden shadow-sm">
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
                      ? 'text-[#1877F2] scale-110'
                      : 'text-gray-400 group-hover:text-gray-600 group-hover:scale-105'
                  }`}
                  style={active ? { color: brandColor } : {}}
                />
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    active ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
                {active && (
                  <span
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: brandColor }}
                  />
                )}
              </Link>
            );
          })}

          <button
            onClick={() => setMenuOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full transition-all group"
          >
            <FiMenu className="text-xl text-gray-400 group-hover:text-gray-600 transition-colors" strokeWidth={1.8} />
            <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
              Menu
            </span>
          </button>
        </div>
      </div>

      {/* ── Slide-out Menu Overlay ── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── Slide-out Menu Panel ── */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[300px] bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderRadius: '0 24px 24px 0' }}
      >
        {/* ── Menu Header ── */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200/80">
          <div className="flex items-center gap-3">
            {workspace?.logo ? (
              <img
                src={workspace.logo}
                alt={workspace.name}
                className="w-10 h-10 rounded-xl object-cover border border-gray-200/50"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: brandColor }}
              >
                {workspace?.initials || workspace?.name?.charAt(0).toUpperCase() || 'W'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{workspace?.name || 'Workspace'}</p>
              <p className="text-xs text-gray-400">Owner</p>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400 hover:text-gray-600"
          >
            <FiX className="text-lg" strokeWidth={2} />
          </button>
        </div>

        {/* ── Menu Items ── */}
        <div className="py-3 px-4 overflow-y-auto" style={{ maxHeight: 'calc(100% - 180px)' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            // If the item has an action, use a button; otherwise a Link
            if (item.action) {
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setMenuOpen(false);
                    item.action();
                  }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all group w-full"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors group-hover:bg-opacity-20"
                    style={{ backgroundColor: `${brandColor}10` }}
                  >
                    <Icon className="text-sm" style={{ color: brandColor }} strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">
                    {item.label}
                  </span>
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors group-hover:bg-opacity-20"
                  style={{ backgroundColor: `${brandColor}10` }}
                >
                  <Icon className="text-sm" style={{ color: brandColor }} strokeWidth={2} />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">
                  {item.label}
                </span>
              </Link>
            );
          })}

          <div className="h-px bg-gray-200/80 my-3 mx-4" />

          {/* ── Logout ── */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-red-50 transition-all group w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition">
              <FiLogOut className="text-sm text-red-500" strokeWidth={2} />
            </div>
            <span className="text-sm font-medium text-red-600">Logout</span>
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-gray-200/80 bg-white/50 backdrop-blur-sm">
          <p className="text-xs text-gray-400 text-center">
            Xircle v1.0 · {workspace?.name}
          </p>
        </div>
      </div>

      {/* ── Invite Modal ── */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        inviteCode={workspace?.inviteCode || 'N/A'}
        brandColor={brandColor}
        workspaceName={workspace?.name}
      />

      {/* ── Slide-up animation style ── */}
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