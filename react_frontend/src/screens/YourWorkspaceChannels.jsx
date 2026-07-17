// src/workspaceScreens/YourWorkspaceChannels.jsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaHashtag,
  FaLock,
  FaUsers,
  FaSearch,
  FaComment,
  FaArrowLeft,
  FaChevronRight,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const YourWorkspaceChannels = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId);

  if (error) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-500">Loading channels...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const chats = chatsData?.chats || [];

  if (!workspace) return null;

  const brandColor = workspace.color || '#4F46E5';
  const activeMembers = workspace.members?.filter(m => m.status === 'active') || [];
  const onlineCount = activeMembers.filter(m => m.status === 'active').length || 0;

  // ── Only group chats (channels) ──
  const channels = chats.filter(c => c.type === 'group');

  // ── Filter channels by search ──
  const filteredChannels = channels.filter(channel =>
    channel.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* ── Sidebar ── */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 bg-white md:min-h-screen overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-6">
          
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/workspace/${workspaceId}`)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <FaArrowLeft className="text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Channels</h1>
                <p className="text-sm text-gray-500">
                  {channels.length} channels · {onlineCount} online
                </p>
              </div>
            </div>
            {/* No "Create Channel" button – members cannot create */}
          </div>

          {/* ── Search Bar ── */}
          <div className="relative mb-6">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>

          {/* ─── Channels List ─── */}
          <div className="space-y-6">
            {filteredChannels.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FaHashtag className="text-3xl mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No channels found</p>
                {searchQuery && <p className="text-xs mt-1">Try a different search term</p>}
              </div>
            ) : (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Channels ({filteredChannels.length})
                </h2>
                <div className="space-y-0.5">
                  {filteredChannels.map((channel) => (
                    <Link
                      key={channel._id}
                      to={`/workspace/${workspaceId}/chat/${channel._id}`}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                          <FaHashtag className="text-sm" style={{ color: brandColor }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {channel.name || 'Unnamed Channel'}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {channel.participants?.length || 0} members
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {channel.unreadCount > 0 && (
                          <span
                            className="text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center font-medium"
                            style={{ backgroundColor: brandColor }}
                          >
                            {channel.unreadCount}
                          </span>
                        )}
                        <FaChevronRight className="text-gray-300 text-xs" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Quick Stats (optional) ── */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{channels.length}</p>
              <p className="text-xs text-gray-500">Total Channels</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{activeMembers.length}</p>
              <p className="text-xs text-gray-500">Members</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{onlineCount}</p>
              <p className="text-xs text-gray-500">Online</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <p className="text-lg font-bold text-gray-900">{chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}</p>
              <p className="text-xs text-gray-500">Unread</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <YourWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default YourWorkspaceChannels;