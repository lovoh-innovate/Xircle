// src/workspaceScreens/YourWorkspaceChannels.jsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaUsers,
  FaSearch,
  FaArrowLeft,
  FaTimes,
  FaCircle,
} from 'react-icons/fa';

// ─── Helper: format time ──────────────────────────────────────────────
const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return 'Yesterday';
  if (diff < 604800000) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Search Channels Modal ────────────────────────────────────────────
const SearchChannelsModal = ({ isOpen, onClose, channels, brandColor, workspaceId }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;

  const filtered = channels.filter(c =>
    c.name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100">
        <button onClick={onClose} className="p-1">
          <FaArrowLeft className="text-gray-600" />
        </button>
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center gap-2">
          <FaSearch className="text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search channels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <FaTimes className="text-gray-400 text-xs" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FaSearch className="text-4xl mb-2 opacity-30" />
            <p className="text-sm">Search channels</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">No channels found for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map(ch => (
              <Link
                key={ch._id}
                to={`/workspace/${workspaceId}/chat/${ch._id}`}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                >
                  <FaUsers className="text-sm" />
                </div>
                <div>
                  <p className="text-sm font-medium">{ch.name}</p>
                  <p className="text-xs text-gray-500">{ch.participants?.length} members</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const YourWorkspaceChannels = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId);

  if (error) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }}
          />
          <p className="mt-4 text-gray-500">Loading channels...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const chats = chatsData?.chats || [];
  if (!workspace) return null;

  const brandColor = workspace.color || '#0d9488';
  const channels = chats.filter(c => c.type === 'group');
  const activeMembers = workspace.members?.filter(m => m.status === 'active') || [];
  const onlineCount = activeMembers.filter(m => m.status === 'active').length || 0;

  return (
    <div className="h-dvh bg-gray-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header */}
        <header className="sticky top-0 z-10 bg-teal-600 text-white flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(`/workspace/${workspaceId}`)} className="p-1 lg:hidden">
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold">Channels</h1>
              <span className="text-xs text-white/70 ml-1">{channels.length}</span>
            </div>
            <button onClick={() => setSearchOpen(true)} className="p-1">
              <FaSearch className="text-white" />
            </button>
          </div>
        </header>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FaUsers className="text-4xl mb-2 opacity-30" />
              <p className="text-sm">No channels yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {channels.map(channel => {
                const lastMsg = channel.lastMessage?.content || 'No messages yet';
                const lastMsgTime = formatTime(channel.updatedAt);
                return (
                  <Link
                    key={channel._id}
                    to={`/workspace/${workspaceId}/chat/${channel._id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                    >
                      <FaUsers className="text-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800 truncate">{channel.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{lastMsgTime}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 truncate flex-1">{lastMsg}</span>
                        {channel.unreadCount > 0 && (
                          <span
                            className="bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                          >
                            {channel.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="border-t border-gray-200 px-4 py-3 bg-white flex-shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{channels.length}</p>
              <p className="text-[10px] text-gray-500">Channels</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{activeMembers.length}</p>
              <p className="text-[10px] text-gray-500">Members</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{onlineCount}</p>
              <p className="text-[10px] text-gray-500">Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      <YourWorkspaceBottombar workspace={workspace} />

      {/* Search Modal */}
      <SearchChannelsModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        channels={channels}
        brandColor={brandColor}
        workspaceId={workspaceId}
      />
    </div>
  );
};

export default YourWorkspaceChannels;