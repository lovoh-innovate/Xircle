// src/components/YourWorkspaceBottombar.jsx
import React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiMessageCircle,
  FiUsers,
  FiSettings,
} from 'react-icons/fi';

const YourWorkspaceBottombar = ({ workspace }) => {
  const { workspaceId } = useParams();
  const location = useLocation();

  const brandColor = workspace?.color || '#0d9488'; // fallback teal

  const isActive = (path) => {
    // For home, check if path is exactly workspace base
    if (path === '' && location.pathname === `/workspace/${workspaceId}`) return true;
    if (path !== '' && location.pathname.includes(path)) return true;
    return false;
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: FiHome, path: `/workspace/${workspaceId}` },
    { id: 'channels', label: 'Chats', icon: FiMessageCircle, path: `/workspace/${workspaceId}/channels` },
    { id: 'members', label: 'Members', icon: FiUsers, path: `/workspace/${workspaceId}/members` },
    { id: 'settings', label: 'Settings', icon: FiSettings, path: `/workspace/${workspaceId}/settings` },
  ];

  return (
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
      </div>
    </div>
  );
};

export default YourWorkspaceBottombar;