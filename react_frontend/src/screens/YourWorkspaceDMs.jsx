// src/workspaceScreens/YourWorkspaceDMs.jsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery, useCreateDirectChatMutation } from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaArrowLeft,
  FaSearch,
  FaComment,
  FaTimes,
  FaCircle,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Helper: get initials ──────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

// ─── Search Members Modal ──────────────────────────────────────────────
const SearchMembersModal = ({ isOpen, onClose, members, brandColor, currentUserId, onStartDM }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;

  const filtered = members
    .filter(m => {
      const user = m.user || m;
      return user._id !== currentUserId;
    })
    .filter(m => {
      const user = m.user || m;
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const q = query.toLowerCase();
      return name.includes(q) || email.includes(q);
    });

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
            placeholder="Search members..."
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
            <p className="text-sm">Search members by name or email</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">No members found for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map(member => {
              const user = member.user || member;
              const isOnline = member.status === 'active';
              return (
                <button
                  key={user._id}
                  onClick={() => {
                    onStartDM(user._id);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition text-left"
                >
                  <div className="relative flex-shrink-0">
                    {user.profile ? (
                      <img src={user.profile} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{user.name}</p>
                    <p className="text-sm text-gray-500 truncate">{isOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const YourWorkspaceDMs = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: workspaceData, isLoading: workspaceLoading, error: workspaceError } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId);
  const [createDirectChat, { isLoading: creatingChat }] = useCreateDirectChatMutation();

  if (workspaceError) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const members = workspace?.members || [];
  const currentUserId = userInfo?._id;
  const brandColor = workspace?.color || '#0d9488';

  const filteredMembers = members.filter(m => {
    const user = m.user || m;
    return user._id !== currentUserId;
  });

  const handleStartDM = async (targetUserId) => {
    if (targetUserId === currentUserId) {
      toast.info("You can't message yourself");
      return;
    }
    try {
      const existingChat = chatsData?.chats?.find(
        (chat) =>
          chat.type === 'direct' &&
          chat.participants.some((p) => p.user?._id === targetUserId || p.user === targetUserId)
      );
      if (existingChat) {
        navigate(`/workspace/${workspaceId}/chat/${existingChat._id}`);
        return;
      }
      const result = await createDirectChat({ workspaceId, targetUserId }).unwrap();
      toast.success('Chat started!');
      navigate(`/workspace/${workspaceId}/chat/${result.chat._id}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start chat');
    }
  };

  if (!workspace) return null;

  return (
    <div className="h-dvh bg-gray-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chatsData?.chats || []} />
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
              <h1 className="text-lg font-semibold">Messages</h1>
              <span className="text-xs text-white/70 ml-1">{filteredMembers.length}</span>
            </div>
            <button onClick={() => setSearchOpen(true)} className="p-1">
              <FaSearch className="text-white" />
            </button>
          </div>
        </header>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FaComment className="text-4xl mb-2 opacity-30" />
              <p className="text-sm">No members available to message</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredMembers.map(member => {
                const user = member.user || member;
                const isOnline = member.status === 'active';
                return (
                  <button
                    key={user._id}
                    onClick={() => handleStartDM(user._id)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition text-left"
                  >
                    <div className="relative flex-shrink-0">
                      {user.profile ? (
                        <img src={user.profile} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: brandColor }}
                        >
                          {getInitials(user.name)}
                        </div>
                      )}
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{user.name}</p>
                      <p className="text-sm text-gray-500 truncate">{isOnline ? 'Online' : 'Offline'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      <YourWorkspaceBottombar workspace={workspace} />

      {/* Search Members Modal */}
      <SearchMembersModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        members={members}
        brandColor={brandColor}
        currentUserId={currentUserId}
        onStartDM={handleStartDM}
      />
    </div>
  );
};

export default YourWorkspaceDMs;