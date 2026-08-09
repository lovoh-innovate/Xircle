// src/workspaceScreens/MyWorkspaceChannels.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetUserChatsQuery,
  useLazyGetUserChatsQuery,
  useCreateGroupChatMutation,
  useAddParticipantMutation,
  useArchiveChatMutation,
  useUnarchiveChatMutation,
  useExitGroupChatMutation,
  useDeleteGroupChatMutation,
} from '../slices/messagingApiSlice';
import { useGetMembersQuery } from '../slices/teamApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaUsers,
  FaPlus,
  FaSearch,
  FaArrowLeft,
  FaTimes,
  FaUserPlus,
  FaCheck,
  FaSpinner,
  FaCopy,
  FaEllipsisV,
  FaArchive,
  FaUndo,
  FaSignOutAlt,
  FaTrashAlt,
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
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
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

// ─── Action Sheet (Bottom Sheet) ────────────────────────────────────────
const ActionSheet = ({ isOpen, onClose, actions, title }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] w-full max-w-md rounded-t-3xl p-4 pb-8 shadow-xl transform transition-transform duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 pb-3 border-b border-gray-200 dark:border-gray-800/60 mb-2">
            {title}
          </div>
        )}
        <div className="space-y-2">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => { action.onPress(); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                action.danger
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Search Modal ─────────────────────────────────────────────────────
const SearchModal = ({ isOpen, onClose, channels, dms, brandColor, workspaceId, userInfo }) => {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;

  const filteredChannels = channels.filter((c) =>
    c.name?.toLowerCase().includes(query.toLowerCase())
  );
  const filteredDMs = dms.filter((dm) => {
    const participant = dm.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    );
    const name = participant?.user?.name || participant?.name || 'Unknown';
    return name.toLowerCase().includes(query.toLowerCase());
  });

  const showChannels = filteredChannels.length > 0;
  const showDMs = filteredDMs.length > 0;

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
            placeholder="Search..."
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
            <p className="text-sm">Search channels and people</p>
          </div>
        )}

        {query && !showChannels && !showDMs && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">No results for "{query}"</p>
          </div>
        )}

        {showChannels && (
          <div>
            <h3 className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Channels
            </h3>
            <div className="space-y-1">
              {filteredChannels.map((ch) => (
                <Link
                  key={ch._id}
                  to={`/my-workspace/${workspaceId}/channels/${ch._id}`}
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
          </div>
        )}

        {showDMs && (
          <div className="mt-4">
            <h3 className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              People
            </h3>
            <div className="space-y-1">
              {filteredDMs.map((dm) => {
                const participant = dm.participants.find(
                  (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
                );
                const user = participant?.user || participant || {};
                return (
                  <Link
                    key={dm._id}
                    to={`/my-workspace/${workspaceId}/chat/${dm._id}`}
                    onClick={onClose}
                    className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
                  >
                    {user?.profile ? (
                      <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: brandColor }}
                      >
                        {user?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition">
                        {user?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">Direct message</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Add Participant Modal ──────────────────────────────────────────────
const AddParticipantModal = ({
  isOpen,
  onClose,
  workspaceId,
  chatId,
  brandColor,
  existingParticipantIds,
  onSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addParticipant] = useAddParticipantMutation();
  const { data: membersData, isLoading: membersLoading } = useGetMembersQuery(workspaceId);

  const availableMembers = membersData?.members
    ?.filter((m) => {
      const userId = m.user?._id || m._id;
      return !existingParticipantIds.includes(userId);
    })
    .filter((m) => {
      const user = m.user || m;
      const name = user?.name?.toLowerCase() || '';
      const email = user?.email?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return name.includes(query) || email.includes(query);
    }) || [];

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.info('Select at least one member to add.');
      return;
    }
    try {
      setIsLoading(true);
      await addParticipant({ chatId, userIds: selectedUsers }).unwrap();
      toast.success(`${selectedUsers.length} member(s) added!`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to add participants');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Add Members</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5">{availableMembers.length} available</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {membersLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-500">
              <FaSpinner className="animate-spin mx-auto text-lg" />
              <p className="text-xs mt-1">Loading...</p>
            </div>
          ) : availableMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-500 text-sm">
              {searchQuery ? 'No members found' : 'All members are already in this channel'}
            </div>
          ) : (
            availableMembers.map((member) => {
              const user = member.user || member;
              const isSelected = selectedUsers.includes(user._id);
              return (
                <button
                  key={user._id}
                  onClick={() => toggleUser(user._id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition ${
                    isSelected ? 'bg-teal-50 dark:bg-[#0d9488]/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {user?.profile ? (
                      <img src={user.profile} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: brandColor }}
                      >
                        {user?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{user?.email}</p>
                  </div>
                  {isSelected && <FaCheck className="text-sm text-teal-600 dark:text-[#0d9488]" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button
            disabled={isLoading || selectedUsers.length === 0}
            onClick={handleSubmit}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {isLoading ? <FaSpinner className="animate-spin mx-auto" /> : `Add ${selectedUsers.length}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Channel Modal ──────────────────────────────────────────────
const CreateChannelModal = ({ isOpen, onClose, workspaceId, brandColor, onSuccess }) => {
  const [channelName, setChannelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createGroupChat] = useCreateGroupChatMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = channelName.trim();
    if (!trimmed) return toast.error('Channel name required');
    const cleanName = trimmed.toLowerCase().replace(/\s+/g, '-');
    if (cleanName.length > 20) return toast.error('Max 20 characters');
    try {
      setIsLoading(true);
      await createGroupChat({ workspaceId, name: cleanName }).unwrap();
      toast.success(`#${cleanName} created`);
      setChannelName('');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Create Channel</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Channel Name</label>
            <div className="relative">
              <FaUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm" />
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="general"
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
                required
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Lowercase, no spaces</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium transition hover:opacity-80"
              style={{ backgroundColor: brandColor }}
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Channel Dropdown Menu (Desktop only) ──────────────────────────────
const ChannelMenu = ({
  chat,
  userInfo,
  userRole,
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

  const isAdmin = chat.participants?.some(
    (p) => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === 'admin'
  );
  const isCreator = chat.createdBy?._id === userInfo?._id;
  const isWorkspaceOwner = userRole === 'Owner';
  const canManage = isAdmin || isWorkspaceOwner;
  const canDelete = isCreator || isWorkspaceOwner;

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
              {canManage && (
                <button
                  onClick={() => { setIsOpen(false); onArchive(chat._id); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 w-full transition"
                >
                  <FaArchive className="text-xs" /> Archive
                </button>
              )}
              {!isAdmin && !isCreator && (
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

// ─── Channel Row (handles click + long‑press) ──────────────────────────
const ChannelRow = ({
  chat,
  isArchived,
  brandColor,
  workspaceId,
  userInfo,
  userRole,
  lastMsgTime,
  lastMsgPreview,
  onArchive,
  onUnarchive,
  onExit,
  onDelete,
  onAddMember,
  openActionSheet,
}) => {
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);

  // Determine the correct route based on chat type
  const getChatLink = () => {
    if (chat.type === 'direct') {
      return `/my-workspace/${workspaceId}/chat/${chat._id}`;
    } else {
      return `/my-workspace/${workspaceId}/channels/${chat._id}`;
    }
  };

  const handleTouchStart = (e) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      const actions = getActions();
      if (actions.length > 0) {
        openActionSheet(chat, actions);
      }
    }, 500);
  };

  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current);
    if (!isLongPress.current) {
      // It was a tap, navigate to chat
      window.__navigate(getChatLink());
    }
  };

  const handleTouchMove = () => {
    clearTimeout(longPressTimer.current);
  };

  const getActions = () => {
    const actions = [];
    const isAdmin = chat.participants?.some(
      (p) => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === 'admin'
    );
    const isCreator = chat.createdBy?._id === userInfo?._id;
    const isWorkspaceOwner = userRole === 'Owner';
    const canManage = isAdmin || isWorkspaceOwner;
    const canDelete = isCreator || isWorkspaceOwner;

    if (isArchived) {
      actions.push({
        label: 'Unarchive',
        icon: <FaUndo className="text-sm" />,
        onPress: () => onUnarchive(chat._id),
        danger: false,
      });
    } else {
      if (canManage) {
        actions.push({
          label: 'Add Members',
          icon: <FaUserPlus className="text-sm" />,
          onPress: () => onAddMember(chat._id),
          danger: false,
        });
        actions.push({
          label: 'Archive',
          icon: <FaArchive className="text-sm" />,
          onPress: () => onArchive(chat._id),
          danger: false,
        });
      }
      if (!isAdmin && !isCreator) {
        actions.push({
          label: 'Exit Group',
          icon: <FaSignOutAlt className="text-sm" />,
          onPress: () => onExit(chat._id),
          danger: true,
        });
      }
      if (canDelete) {
        actions.push({
          label: 'Delete Group',
          icon: <FaTrashAlt className="text-sm" />,
          onPress: () => onDelete(chat._id),
          danger: true,
        });
      }
    }
    return actions;
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition group"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={(e) => {
        if (isLongPress.current) {
          e.preventDefault();
          return;
        }
      }}
    >
      <Link
        to={getChatLink()}
        className="flex items-center gap-3 flex-1 min-w-0"
        onClick={(e) => {
          if (isLongPress.current) {
            e.preventDefault();
            return;
          }
        }}
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
              {chat.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0 ml-2">{lastMsgTime}</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{lastMsgPreview}</p>
            {!isArchived && chat.unreadCount > 0 && (
              <span
                className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-2"
                style={{ backgroundColor: brandColor }}
              >
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Desktop controls */}
      <div className="hidden lg:flex items-center gap-1">
        {!isArchived && (chat.participants?.some(p => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === 'admin') || userRole === 'Owner') && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddMember(chat._id);
            }}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-teal-600 dark:hover:text-[#0d9488] rounded-lg hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 transition"
            title="Add members"
          >
            <FaUserPlus className="text-sm" />
          </button>
        )}
        <ChannelMenu
          chat={chat}
          userInfo={userInfo}
          userRole={userRole}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onExit={onExit}
          onDelete={onDelete}
          isArchived={isArchived}
        />
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const MyWorkspaceChannels = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [activeTab, setActiveTab] = useState('channels');

  const [actionSheet, setActionSheet] = useState({
    isOpen: false,
    chat: null,
    actions: [],
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: false,
  });

  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);

  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useGetUserChatsQuery({ workspaceId, archived: false });

  const [getArchivedChats, { data: archivedData, isLoading: archivedLoading }] = useLazyGetUserChatsQuery();

  useEffect(() => {
    if (activeTab === 'archived') {
      getArchivedChats({ workspaceId, archived: true });
    }
  }, [activeTab, workspaceId, getArchivedChats]);

  const [archiveChat] = useArchiveChatMutation();
  const [unarchiveChat] = useUnarchiveChatMutation();
  const [exitGroupChat] = useExitGroupChatMutation();
  const [deleteGroupChat] = useDeleteGroupChatMutation();

  const userMembership = workspaceData?.workspace?.members?.find(
    (m) => m.user?._id === userInfo?._id || m.user === userInfo?._id
  );
  const userRole = userMembership?.role || 'Member';

  const refreshActive = () => refetchChats();
  const refreshArchived = () => {
    if (activeTab === 'archived') {
      getArchivedChats({ workspaceId, archived: true });
    }
  };
  const refreshAll = () => {
    refreshActive();
    refreshArchived();
  };

  const handleChannelCreated = () => {
    refreshAll();
  };
  const handleParticipantsAdded = () => {
    refreshAll();
    setSelectedChatId(null);
  };

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

  const openActionSheet = (chat, actions) => {
    setActionSheet({ isOpen: true, chat, actions });
  };

  const closeActionSheet = () => {
    setActionSheet({ isOpen: false, chat: null, actions: [] });
  };

  const handleAddMemberFromAction = (chatId) => {
    setSelectedChatId(chatId);
    setShowAddParticipantModal(true);
  };

  if (error) navigate('/my-workspaces');
  if (workspaceLoading || chatsLoading || (activeTab === 'archived' && archivedLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-teal-500 dark:border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const chats = chatsData?.chats || [];
  const archivedChats = archivedData?.chats || [];
  if (!workspace) return null;

  const brandColor = workspace.color || '#0d9488';
  const groupChats = chats.filter((c) => c.type === 'group');
  const directMessages = chats.filter((c) => c.type === 'direct');
  const archivedGroups = archivedChats.filter((c) => c.type === 'group');
  const archivedDMs = archivedChats.filter((c) => c.type === 'direct');

  const getDMParticipant = (dm) => {
    return dm.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    )?.user || {};
  };

  const renderChannelList = (channels, dms, isArchived = false) => {
    const hasChannels = channels.length > 0;
    const hasDMs = dms.length > 0;

    if (!hasChannels && !hasDMs) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
          <FaUsers className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">{isArchived ? 'No archived chats' : 'No channels or messages yet'}</p>
        </div>
      );
    }

    return (
      <>
        {hasChannels && (
          <div>
            <div className="px-4 py-2 text-xs font-semibold text-teal-600 dark:text-[#0d9488] uppercase tracking-wider bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800/30">
              {isArchived ? 'Archived Channels' : 'Channels'} · {channels.length}
            </div>
            {channels.map((ch) => {
              const lastMsg = ch.lastMessage;
              const lastMsgSender = lastMsg?.sender;
              const isOwnLastMsg = lastMsgSender?._id === userInfo?._id || lastMsgSender === userInfo?._id;
              const lastMsgText = lastMsg?.content || '';
              const lastMsgSenderName = isOwnLastMsg ? 'You' : (lastMsgSender?.name || '');
              const lastMsgPreview = lastMsgText
                ? (lastMsgSenderName ? `${lastMsgSenderName}: ${lastMsgText}` : lastMsgText)
                : 'No messages yet';
              const lastMsgTime = formatTime(lastMsg?.createdAt || ch.updatedAt);

              return (
                <ChannelRow
                  key={ch._id}
                  chat={ch}
                  isArchived={isArchived}
                  brandColor={brandColor}
                  workspaceId={workspaceId}
                  userInfo={userInfo}
                  userRole={userRole}
                  lastMsgTime={lastMsgTime}
                  lastMsgPreview={lastMsgPreview}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                  onExit={handleExit}
                  onDelete={handleDelete}
                  onAddMember={handleAddMemberFromAction}
                  openActionSheet={openActionSheet}
                />
              );
            })}
          </div>
        )}

        {hasDMs && (
          <div>
            <div className="px-4 py-2 text-xs font-semibold text-teal-600 dark:text-[#0d9488] uppercase tracking-wider bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800/30">
              {isArchived ? 'Archived Direct Messages' : 'Direct Messages'} · {dms.length}
            </div>
            {dms.map((dm) => {
              const participant = getDMParticipant(dm);
              const lastMsg = dm.lastMessage;
              const lastMsgTime = formatTime(lastMsg?.createdAt || dm.updatedAt);
              const lastMsgText = lastMsg?.content || 'No messages yet';
              return (
                <Link
                  key={dm._id}
                  to={`/my-workspace/${workspaceId}/chat/${dm._id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition group"
                >
                  {participant?.profile ? (
                    <img src={participant.profile} alt={participant.name} className="w-12 h-12 rounded-2xl object-cover" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: brandColor }}
                    >
                      {participant?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition">
                        {participant?.name || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">{lastMsgTime}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{lastMsgText}</p>
                      {!isArchived && dm.unreadCount > 0 && (
                        <span
                          className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                          style={{ backgroundColor: brandColor }}
                        >
                          {dm.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:min-h-screen fixed top-0 left-0 z-20">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 lg:mr-64 flex flex-col h-screen">
        {/* ── Fixed Header ── */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/my-workspace/${workspaceId}`)}
                className="lg:hidden p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Channels</h1>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40">
                {groupChats.length + directMessages.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
              >
                <FaSearch className="text-sm" />
              </button>
              {activeTab === 'channels' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
                >
                  <FaPlus className="text-sm" />
                </button>
              )}
            </div>
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

        {/* ── Channel List ── */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12] divide-y divide-gray-100 dark:divide-gray-800/30">
          {activeTab === 'channels'
            ? renderChannelList(groupChats, directMessages, false)
            : renderChannelList(archivedGroups, archivedDMs, true)}
        </div>

        {/* Bottom Navigation (mobile) */}
        <MyWorkspaceBottombar workspace={workspace} />
      </div>

      {/* Right Sidebar (desktop only) */}
      <div className="hidden lg:block fixed right-0 top-0 bottom-0 w-64 bg-white dark:bg-[#14141a] border-l border-gray-200/60 dark:border-gray-800/60 p-4 overflow-y-auto z-20">
        <div className="flex items-center gap-3 mb-4">
          {workspace.logo ? (
            <img src={workspace.logo} alt={workspace.name} className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60" />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: brandColor }}
            >
              {workspace.initials || workspace.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{workspace.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500">{workspace.members?.length} members</p>
          </div>
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(workspace.inviteCode);
            toast.success('Invite code copied!');
          }}
          className="w-full py-2 rounded-xl text-sm font-medium text-white transition hover:opacity-80 flex items-center justify-center gap-2"
          style={{ backgroundColor: brandColor }}
        >
          <FaCopy className="text-xs" /> Invite People
        </button>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-2">
          <p className="font-semibold text-gray-700 dark:text-gray-300">About</p>
          {workspace.description && <p className="text-gray-600 dark:text-gray-400">{workspace.description}</p>}
          {workspace.industry && <p>🏢 {workspace.industry}</p>}
          {workspace.website && (
            <a href={workspace.website} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-[#0d9488] hover:underline block">
              🌐 {workspace.website}
            </a>
          )}
        </div>
      </div>

      {/* Modals */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        channels={groupChats}
        dms={directMessages}
        brandColor={brandColor}
        workspaceId={workspaceId}
        userInfo={userInfo}
      />
      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        workspaceId={workspaceId}
        brandColor={brandColor}
        onSuccess={handleChannelCreated}
      />
      <AddParticipantModal
        isOpen={showAddParticipantModal}
        onClose={() => {
          setShowAddParticipantModal(false);
          setSelectedChatId(null);
        }}
        workspaceId={workspaceId}
        chatId={selectedChatId}
        brandColor={brandColor}
        existingParticipantIds={
          selectedChatId
            ? groupChats.find((c) => c._id === selectedChatId)?.participants.map(p => p.user?._id || p.user) || []
            : []
        }
        onSuccess={handleParticipantsAdded}
      />

      <ActionSheet
        isOpen={actionSheet.isOpen}
        onClose={closeActionSheet}
        actions={actionSheet.actions}
        title={actionSheet.chat ? `#${actionSheet.chat.name}` : ''}
      />

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

export default MyWorkspaceChannels;