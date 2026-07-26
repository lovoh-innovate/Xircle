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

// ─── Search Members Modal (dark themed) ──────────────────────────────
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
    <div className="fixed inset-0 z-50 bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800/60 bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition">
          <FaArrowLeft />
        </button>
        <div className="flex-1 bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-800/40 focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-500 text-xs" />
          <input
            type="text"
            placeholder="Search members..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-200 placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search members by name or email</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-sm">No members found for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="space-y-1">
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
                  className="flex items-center gap-4 w-full px-4 py-3 bg-[#14141a] rounded-xl border border-gray-800/40 hover:border-[#0d9488]/40 hover:bg-[#1a1a24] transition cursor-pointer group"
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
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0b0b10]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-200 group-hover:text-white transition truncate">{user.name}</p>
                    <p className="text-sm text-gray-500">{isOnline ? 'Online' : 'Offline'}</p>
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

// ─── Main Component ──────────────────────────────────────────────────────
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
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500 text-sm">Loading...</p>
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
    <div className="h-dvh bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chatsData?.chats || []} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header – dark glass */}
        <header className="sticky top-0 z-10 bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/workspace/${workspaceId}`)}
                className="p-1 lg:hidden text-gray-400 hover:text-white transition"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold text-gray-100">Messages</h1>
              <span className="text-xs font-normal text-gray-500 bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-800/40">
                {filteredMembers.length}
              </span>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-xl transition"
            >
              <FaSearch className="text-sm" />
            </button>
          </div>
        </header>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto bg-[#0f0f12] divide-y divide-gray-800/30">
          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <FaComment className="text-4xl mb-2 opacity-30" />
              <p className="text-sm">No members available to message</p>
            </div>
          ) : (
            filteredMembers.map(member => {
              const user = member.user || member;
              const isOnline = member.status === 'active';
              return (
                <button
                  key={user._id}
                  onClick={() => handleStartDM(user._id)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#1a1a24] transition group text-left"
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
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0f0f12] group-hover:border-[#1a1a24]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-200 group-hover:text-white transition truncate">{user.name}</p>
                    <p className="text-sm text-gray-500">{isOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </button>
              );
            })
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