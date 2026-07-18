// src/components/YourWorkspaceBottombar.jsx
import React, { useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useLogoutMutation } from '../slices/userApiSlice';
import { logout } from '../slices/authSlice';
import { toast } from 'react-toastify';
import {
  FiHome,
  FiMessageCircle,
  FiUsers,
  FiMenu,
  FiX,
  FiFolder,
  FiHash,
  FiBell,
  FiUser,
  FiLogOut,
} from 'react-icons/fi';

const YourWorkspaceBottombar = ({ workspace }) => {
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [menuOpen, setMenuOpen] = useState(false);

  const [logoutUser] = useLogoutMutation();
  const brandColor = workspace?.color || '#0d9488';

  const isActive = (path) => {
    if (path === '' && location.pathname === `/workspace/${workspaceId}`) return true;
    if (path !== '' && location.pathname.includes(path)) return true;
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

  // Bottom navigation – "Chats" now leads to DMs
  const navItems = [
    { id: 'home', label: 'Home', icon: FiHome, path: `/workspace/${workspaceId}` },
    { id: 'dms', label: 'Messages', icon: FiMessageCircle, path: `/workspace/${workspaceId}/dms` },
    { id: 'members', label: 'Members', icon: FiUsers, path: `/workspace/${workspaceId}/members` },
  ];

  // Slide‑out menu – Channels added
  const menuItems = [
    { id: 'projects', label: 'Projects', icon: FiFolder, path: `/workspace/${workspaceId}/projects` },
    { id: 'channels', label: 'Channels', icon: FiHash, path: `/workspace/${workspaceId}/channels` },
    { id: 'notifications', label: 'Notifications', icon: FiBell, path: `/workspace/${workspaceId}/notifications` },
    { id: 'profile', label: 'Profile', icon: FiUser, path: '/profile' },
    { id: 'logout', label: 'Logout', icon: FiLogOut, action: handleLogout },
  ];

  return (
    <>
      {/* Bottom Bar (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 md:hidden shadow-sm">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.id === 'home' ? '' : item.id);
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
                      ? 'scale-110'
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

          {/* Menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full transition-all group"
          >
            <FiMenu className="text-xl text-gray-400 group-hover:text-gray-600 group-hover:scale-105 transition" strokeWidth={1.8} />
            <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-600 transition">Menu</span>
          </button>
        </div>
      </div>

      {/* Slide‑out overlay (mobile only) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide‑out panel */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[280px] bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderRadius: '0 24px 24px 0' }}
      >
        {/* Header */}
        <div className="px-5 py-5 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            {workspace?.logo ? (
              <img src={workspace.logo} alt={workspace.name} className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: brandColor }}
              >
                {workspace?.initials || workspace?.name?.charAt(0).toUpperCase() || 'W'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{workspace?.name || 'Workspace'}</p>
              <p className="text-xs text-gray-400">Member</p>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <FiX className="text-lg" strokeWidth={2} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="py-2 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            if (item.action) {
              return (
                <button
                  key={item.id}
                  onClick={() => { setMenuOpen(false); item.action(); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition w-full"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}10` }}>
                    <Icon className="text-sm" style={{ color: brandColor }} strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}10` }}>
                  <Icon className="text-sm" style={{ color: brandColor }} strokeWidth={2} />
                </div>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-gray-100 bg-white/50 backdrop-blur-sm">
          <p className="text-xs text-gray-400 text-center">
            Xircle · {workspace?.name}
          </p>
        </div>
      </div>
    </>
  );
};

export default YourWorkspaceBottombar;