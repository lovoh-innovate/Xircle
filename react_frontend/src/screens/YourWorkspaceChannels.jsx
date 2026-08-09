// src/workspaceScreens/YourWorkspaceChannels.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetUserChatsQuery,
  useLazyGetUserChatsQuery,
  useArchiveChatMutation,
  useUnarchiveChatMutation,
  useExitGroupChatMutation,
  useDeleteGroupChatMutation,
} from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaUsers,
  FaSearch,
  FaArrowLeft,
  FaTimes,
  FaEllipsisV,
  FaArchive,
  FaUndo,
  FaSignOutAlt,
  FaTrashAlt,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';

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

// ─── Confirm Modal ──────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          {danger && <FaExclamationTriangle className="text-red-500 text-xl" />}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 dark:bg-[#0d9488] hover:bg-teal-700 dark:hover:bg-[#0f9e96]'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Channel Menu Dropdown ──────────────────────────────────────────────
const ChannelMenu = ({
  chat,
  userInfo,
  isWorkspaceOwner,
  onArchive,
  onUnarchive,
  onExit,
  onDelete,
  isArchived = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = React.useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Determine roles
  const isAdmin = chat.participants?.some(
    (p) => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === 'admin'
  );
  const isCreator = chat.createdBy?._id === userInfo?._id;

  // Permissions
  const canDelete = isWorkspaceOwner || isAdmin;
  const canExit = !isCreator && !isWorkspaceOwner;

  return (
    <div className="relative flex-shrink-0" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition"
      >
        <FaEllipsisV className="text-sm" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-800/60 rounded-xl min-w-[180px] z-30 py-1 shadow-lg">
          {isArchived ? (
            <button
              onClick={() => { setIsOpen(false); onUnarchive(chat._id); }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 w-full transition"
            >
              <FaUndo className="text-xs" /> Unarchive
            </button>
          ) : (
            <>
              <button
                onClick={() => { setIsOpen(false); onArchive(chat._id); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 w-full transition"
              >
                <FaArchive className="text-xs" /> Archive
              </button>
              {canExit && (
                <button
                  onClick={() => { setIsOpen(false); onExit(chat._id); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 w-full transition"
                >
                  <FaSignOutAlt className="text-xs" /> Exit Group
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => { setIsOpen(false); onDelete(chat._id); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 w-full transition"
                >
                  <FaTrashAlt className="text-xs" /> Delete Group
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Search Channels Modal ──────────────────────────────────────────────
const SearchChannelsModal = ({ isOpen, onClose, channels, brandColor, workspaceId }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;

  const filtered = channels.filter(c =>
    c.name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0b0b10]/90 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50 dark:bg-[#14141a]/80">
        <button onClick={onClose} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft />
        </button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-4 py-2 flex items-center gap-3 border border-gray-200 dark:border-gray-800/40 focus-within:border-teal-500 dark:focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
          <input
            type="text"
            placeholder="Search channels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search channels</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">No channels found for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="space-y-1">
            {filtered.map(ch => (
              <Link
                key={ch._id}
                to={`/workspace/${workspaceId}/chat/${ch._id}`}
                onClick={onClose}
                className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                >
                  <FaUsers className="text-sm" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition">
                    {ch.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{ch.participants?.length} members</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const YourWorkspaceChannels = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('channels'); // 'channels' or 'archived'
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: false,
  });

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);

  // Active chats (not archived)
  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useGetUserChatsQuery({ workspaceId, archived: false });

  // Archived chats (lazy)
  const [getArchivedChats, { data: archivedData, isLoading: archivedLoading }] = useLazyGetUserChatsQuery();

  // Fetch archived when tab changes
  useEffect(() => {
    if (activeTab === 'archived') {
      getArchivedChats({ workspaceId, archived: true });
    }
  }, [activeTab, workspaceId, getArchivedChats]);

  // ── Mutations ────────────────────────────────────────────────────────
  const [archiveChat] = useArchiveChatMutation();
  const [unarchiveChat] = useUnarchiveChatMutation();
  const [exitGroupChat] = useExitGroupChatMutation();
  const [deleteGroupChat] = useDeleteGroupChatMutation();

  const refreshAll = () => {
    refetchChats();
    if (activeTab === 'archived') {
      getArchivedChats({ workspaceId, archived: true });
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleArchive = (chatId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Archive Channel',
      message: 'This will hide the channel from your main list. You can find it in Archived.',
      onConfirm: async () => {
        try {
          await archiveChat(chatId).unwrap();
          toast.success('Channel archived');
          refreshAll();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to archive');
        }
      },
      danger: false,
    });
  };

  const handleUnarchive = (chatId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Unarchive Channel',
      message: 'This will move the channel back to your main list.',
      onConfirm: async () => {
        try {
          await unarchiveChat(chatId).unwrap();
          toast.success('Channel unarchived');
          refreshAll();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to unarchive');
        }
      },
      danger: false,
    });
  };

  const handleExit = (chatId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Exit Group',
      message: 'You will leave this group and no longer receive messages.',
      onConfirm: async () => {
        try {
          await exitGroupChat(chatId).unwrap();
          toast.success('You left the group');
          refreshAll();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to exit');
        }
      },
      danger: true,
    });
  };

  const handleDelete = (chatId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Group',
      message: 'This will permanently delete the group and all its messages. This cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteGroupChat(chatId).unwrap();
          toast.success('Group deleted');
          refreshAll();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to delete');
        }
      },
      danger: true,
    });
  };

  // ── Error / Loading ──────────────────────────────────────────────────
  if (error) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (workspaceLoading || chatsLoading || (activeTab === 'archived' && archivedLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading channels...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const chats = chatsData?.chats || [];
  const archivedChats = archivedData?.chats || [];
  if (!workspace) return null;

  const brandColor = workspace.color || '#0d9488';
  const allChannels = chats.filter(c => c.type === 'group');
  const archivedChannels = archivedChats.filter(c => c.type === 'group');
  const displayChannels = activeTab === 'channels' ? allChannels : archivedChannels;
  const isArchivedView = activeTab === 'archived';

  const isWorkspaceOwner = workspace?.owner?._id === userInfo?._id;

  const activeMembers = workspace.members?.filter(m => m.status === 'active') || [];
  const onlineCount = activeMembers.filter(m => m.status === 'active').length || 0;

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header – glass */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/workspace/${workspaceId}`)}
                className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Channels</h1>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40">
                {allChannels.length}
              </span>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
            >
              <FaSearch className="text-sm" />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-200/60 dark:border-gray-800/30 px-4">
            <button
              onClick={() => setActiveTab('channels')}
              className={`py-2 px-3 text-sm font-medium transition ${
                activeTab === 'channels'
                  ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Channels
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`py-2 px-3 text-sm font-medium transition ${
                activeTab === 'archived'
                  ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Archived
            </button>
          </div>
        </header>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12] divide-y divide-gray-100 dark:divide-gray-800/30">
          {displayChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <FaUsers className="text-4xl mb-2 opacity-30" />
              <p className="text-sm">{isArchivedView ? 'No archived channels' : 'No channels yet'}</p>
            </div>
          ) : (
            displayChannels.map(channel => {
              const lastMsg = channel.lastMessage?.content || 'No messages yet';
              const lastMsgTime = formatTime(channel.updatedAt);
              return (
                <div
                  key={channel._id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition group"
                >
                  <Link
                    to={`/workspace/${workspaceId}/chat/${channel._id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                    >
                      <FaUsers className="text-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
                          {channel.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">{lastMsgTime}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{lastMsg}</span>
                        {!isArchivedView && channel.unreadCount > 0 && (
                          <span
                            className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex-shrink-0"
                            style={{ backgroundColor: brandColor }}
                          >
                            {channel.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <ChannelMenu
                    chat={channel}
                    userInfo={userInfo}
                    isWorkspaceOwner={isWorkspaceOwner}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    onExit={handleExit}
                    onDelete={handleDelete}
                    isArchived={isArchivedView}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Stats row */}
        <div className="border-t border-gray-200/60 dark:border-gray-800/40 px-4 py-3 bg-white dark:bg-[#0f0f12] flex-shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{allChannels.length}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-500">Channels</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{activeMembers.length}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-500">Members</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{onlineCount}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-500">Online</p>
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
        channels={allChannels}
        brandColor={brandColor}
        workspaceId={workspaceId}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />
    </div>
  );
};

export default YourWorkspaceChannels;