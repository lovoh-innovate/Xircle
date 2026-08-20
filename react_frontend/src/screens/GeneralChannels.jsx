// pages/GeneralChannels.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useGetUserChatsQuery,
  useSearchPublicGroupsQuery,
  useRequestJoinGroupMutation,
  useCreatePublicGroupChatMutation,
  useUpdatePublicGroupMutation,
  useDeletePublicGroupMutation,
  useGetPendingJoinRequestsQuery,
  useExitGroupChatMutation,
} from '../slices/messagingApiSlice';
import { useGetMyWorkspacesQuery } from '../slices/workspaceApiSlice';
import { toast } from 'react-hot-toast';
import {
  FaUsers,
  FaSearch,
  FaSpinner,
  FaClock,
  FaCheckCircle,
  FaPlus,
  FaHashtag,
  FaUserPlus,
  FaTimes,
  FaImage,
  FaTrashAlt,
  FaRocket,
  FaEllipsisV,
  FaEdit,
  FaTrash,
  FaUser,
  FaBuilding,
  FaGlobe,
  FaCompass,
  FaSignOutAlt,
} from 'react-icons/fa';
import { FiRadio } from 'react-icons/fi';
import { motion } from 'framer-motion';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Bottom Sheet ──────────────────────────────────────────────────
const BottomSheet = ({ isOpen, onClose, children }) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: animating ? 0 : '100%', opacity: animating ? 1 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full md:max-w-md md:rounded-2xl rounded-t-2xl bg-white dark:bg-[#1a1a1a] shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── Create/Edit Channel Form ────────────────────────────────────
const CreateChannelContent = ({ onClose, onSuccess, editData = null }) => {
  const navigate = useNavigate();
  const [name, setName] = useState(editData?.name || '');
  const [description, setDescription] = useState(editData?.description || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(editData?.avatar || '');
  const [isPublic, setIsPublic] = useState(editData?.isPublic !== undefined ? editData.isPublic : true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [createPublicGroup] = useCreatePublicGroupChatMutation();
  const [updatePublicGroup] = useUpdatePublicGroupMutation();

  const isEditing = !!editData;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(editData?.avatar || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Channel name is required.');
      return;
    }
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('isPublic', isPublic);
      if (avatarFile) formData.append('avatar', avatarFile);

      if (isEditing) {
        await updatePublicGroup({ chatId: editData._id, data: formData }).unwrap();
      } else {
        await createPublicGroup(formData).unwrap();
      }
      
      resetForm();
      onSuccess(isEditing ? 'updated' : 'created');
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || (isEditing ? 'Failed to update channel.' : 'Failed to create channel.'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setAvatarFile(null);
    setAvatarPreview('');
    setIsPublic(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          <FaRocket className="inline mr-2 text-teal-500" /> {isEditing ? 'Edit Channel' : 'Create Channel'}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
          <FaTimes />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
            rows="2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Avatar</label>
          <div className="flex items-center gap-4">
            {avatarPreview ? (
              <div className="relative">
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                >
                  <FaTrashAlt className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-teal-500 transition bg-gray-50 dark:bg-[#2a2a2a]">
                <FaImage className="text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Upload Avatar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG, or SVG (max 5MB)</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-teal-500 focus:ring-teal-500"
          />
          <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-300">
            Public channel (anyone can join)
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
          >
            {isLoading ? <FaSpinner className="animate-spin mx-auto" /> : (isEditing ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Helper ──────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
};

// ─── Discover Modal ──────────────────────────────────────────────
const DiscoverModal = ({ isOpen, onClose, onJoin, joinedIds, pendingIds }) => {
  const [query, setQuery] = useState('');
  const { data, isLoading, refetch } = useSearchPublicGroupsQuery(
    { query: query || '' },
    { skip: !isOpen }
  );

  const groups = data?.groups || [];

  const handleJoin = (chatId) => {
    onJoin(chatId);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            <FaCompass className="inline mr-2 text-teal-500" /> Discover Channels
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes />
          </button>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-full px-4 py-2 mb-4">
          <FaSearch className="text-gray-400" />
          <input
            type="text"
            placeholder="Search public channels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent flex-1 outline-none text-sm text-gray-800 dark:text-white placeholder-gray-400"
            autoFocus
          />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <FaSpinner className="animate-spin text-teal-500 text-2xl" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <FaHashtag className="text-4xl mb-2 opacity-30" />
                <p className="text-sm">No public channels found</p>
              </div>
            ) : (
              groups.map((channel) => {
                const isJoined = joinedIds.has(channel._id);
                const isPending = pendingIds.has(channel._id);
                let action = null;
                if (isJoined) {
                  action = (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      <FaCheckCircle className="inline mr-1" /> Joined
                    </span>
                  );
                } else if (isPending) {
                  action = (
                    <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                      <FaClock className="inline mr-1" /> Pending
                    </span>
                  );
                } else {
                  action = (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleJoin(channel._id); }}
                      className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition"
                    >
                      <FaUserPlus className="inline mr-1" /> Join
                    </button>
                  );
                }
                return (
                  <div key={channel._id} className="flex items-center gap-3 px-2 py-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {channel.avatar ? (
                        <img src={channel.avatar} alt={channel.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getInitials(channel.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-white truncate">{channel.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{channel.participants?.length || 0} members</p>
                    </div>
                    {action}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

// ─── Channel Action Modal (mobile long-press) ──────────────────
const ChannelActionModal = ({
  isOpen,
  onClose,
  channel,
  isCreator,
  onEdit,
  onDelete,
  onExit,
  status,
}) => {
  if (!isOpen || !channel) return null;
  if (status === 'pending') {
    onClose(); // no actions for pending
    return null;
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">
            {channel.name}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes />
          </button>
        </div>
        <div className="space-y-2">
          {isCreator ? (
            <>
              <button
                onClick={() => { onClose(); onEdit(channel); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
              >
                <FaEdit className="text-sm" /> <span className="text-sm font-medium">Edit Channel</span>
              </button>
              <button
                onClick={() => { onClose(); onDelete(channel); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
              >
                <FaTrash className="text-sm" /> <span className="text-sm font-medium">Delete Channel</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => { onClose(); onExit(channel._id); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <FaSignOutAlt className="text-sm" /> <span className="text-sm font-medium">Exit Channel</span>
            </button>
          )}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
};

// ─── Channel Card ────────────────────────────────────────────────
const ChannelCard = ({
  channel,
  status = 'discover',
  onJoin,
  onEdit,
  onDelete,
  onExit,
  isCreator = false,
  linkTo,
  workspaceName,
  navigate,
  onLongPress, // for mobile
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const memberCount = channel.participants?.length || 0;
  const name = channel.name || 'Unnamed Channel';
  const description = channel.description || '';

  let actionButton = null;
  if (status === 'joined') {
    actionButton = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 flex-shrink-0">
        <FaCheckCircle className="text-xs" /> Joined
      </span>
    );
  } else if (status === 'pending') {
    actionButton = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400 flex-shrink-0">
        <FaClock className="text-xs" /> Awaiting approval
      </span>
    );
  } else if (status === 'my') {
    actionButton = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 flex-shrink-0">
        <FaCheckCircle className="text-xs" /> Created
      </span>
    );
  } else {
    actionButton = (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onJoin(channel._id);
        }}
        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition flex-shrink-0"
      >
        <FaUserPlus className="text-xs" /> Join
      </button>
    );
  }

  const handleCardClick = () => {
    if (status === 'pending') return;
    if (linkTo && navigate) {
      navigate(linkTo);
    }
  };

  // Desktop menu
  const handleMenuToggle = (e) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleMenuItemClick = (e, callback) => {
    e.stopPropagation();
    callback();
    setMenuOpen(false);
  };

  // Mobile long press – we'll use touch events
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e) => {
    if (status === 'pending') return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      e.preventDefault();
      onLongPress(channel);
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!longPressTimer.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isLongPress.current) {
      e.preventDefault();
      isLongPress.current = false;
    }
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 md:gap-4 md:px-4 md:py-3 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors relative ${status === 'pending' ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center text-white font-bold text-sm md:text-lg flex-shrink-0">
        {channel.avatar ? (
          <img
            src={channel.avatar}
            alt={name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          getInitials(name)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-semibold text-sm md:text-base text-gray-800 dark:text-white truncate max-w-[120px] sm:max-w-[200px]">
            {name}
          </p>
          {channel.isPublic && (
            <span className="flex-shrink-0 text-xs text-gray-400">🌐</span>
          )}
          {workspaceName && (
            <span className="flex-shrink-0 text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
              {workspaceName}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 max-w-[180px] sm:max-w-full">
            {description}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
          <span className="flex items-center gap-1">
            <FaUsers className="text-teal-500 dark:text-teal-400 text-xs flex-shrink-0" />
            <span className="truncate">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1 md:gap-2">
        {actionButton}
        {isCreator && (
          // Three-dot menu – only visible on desktop (md and up)
          <div className="relative hidden md:block">
            <button
              onClick={handleMenuToggle}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <FaEllipsisV className="text-sm" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[120px] z-20">
                <button
                  onClick={(e) => handleMenuItemClick(e, () => onEdit(channel))}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 w-full transition"
                >
                  <FaEdit className="text-xs" /> Edit
                </button>
                <button
                  onClick={(e) => handleMenuItemClick(e, () => onDelete(channel))}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition"
                >
                  <FaTrash className="text-xs" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Workspace Group Section ─────────────────────────────────────
const WorkspaceGroupSection = ({ workspaceId, workspaceName, channels, userInfo, navigate, searchTerm, onLongPress }) => {
  const isOwnWorkspace = userInfo?.ownedWorkspaces?.includes(workspaceId);
  const baseRoute = isOwnWorkspace
    ? `/my-workspace/${workspaceId}/channels`
    : `/workspace/${workspaceId}/chat`;

  const filtered = channels.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="px-3 md:px-4 py-2 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 sticky top-0 z-10">
        <FaBuilding className="text-teal-500 flex-shrink-0" />
        <span className="font-semibold text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">
          {workspaceName || 'Workspace'}
        </span>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">
          {filtered.length} channel{filtered.length > 1 ? 's' : ''}
        </span>
      </div>
      {filtered.map((channel) => (
        <ChannelCard
          key={channel._id}
          channel={channel}
          status="joined"
          linkTo={`${baseRoute}/${channel._id}`}
          workspaceName={workspaceName}
          navigate={navigate}
          onLongPress={onLongPress}
          isCreator={false} // workspace channels are always joined, not created in this context
          onEdit={null}
          onDelete={null}
          onExit={null}
        />
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
const GeneralChannels = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [editChannel, setEditChannel] = useState(null);
  const [actionModal, setActionModal] = useState({ isOpen: false, channel: null });

  // ─── Fetch all workspaces (owned + joined) ────────────────────
  const { data: workspacesData, isLoading: workspacesLoading } = useGetMyWorkspacesQuery();

  // ─── Build a map: workspaceId → workspaceName ──────────────────
  const workspaceNameMap = useMemo(() => {
    const map = {};
    if (workspacesData) {
      const allWorkspaces = [...(workspacesData.myBusinesses || []), ...(workspacesData.joinedBusinesses || [])];
      for (const ws of allWorkspaces) {
        map[ws._id] = ws.name;
      }
    }
    return map;
  }, [workspacesData]);

  // ─── Queries for chats ──────────────────────────────────────────
  const {
    data: pendingData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useGetPendingJoinRequestsQuery(undefined, {
    pollingInterval: 15000,
  });
  const pendingChannels = pendingData?.groups || [];

  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useGetUserChatsQuery({ archived: false });

  // ─── Mutations ─────────────────────────────────────────────────
  const [requestJoin] = useRequestJoinGroupMutation();
  const [deletePublicGroup] = useDeletePublicGroupMutation();
  const [exitGroupChat] = useExitGroupChatMutation();

  // ─── Derived Lists ─────────────────────────────────────────────
  const myChannels = useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats.filter(
      (chat) => chat.scope === 'public' && chat.type === 'group' && chat.createdBy?._id === userInfo?._id
    );
  }, [chatsData, userInfo]);

  const joinedChannels = useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats.filter(
      (chat) => chat.scope === 'public' && chat.type === 'group' && chat.createdBy?._id !== userInfo?._id
    );
  }, [chatsData, userInfo]);

  const pendingIds = useMemo(() => new Set(pendingChannels.map(c => c._id)), [pendingChannels]);

  // ─── Merged Joined – pending first, then joined ───────────────
  const mergedJoined = useMemo(() => {
    const joinedIds = new Set(joinedChannels.map(c => c._id));
    const pendingNotJoined = pendingChannels.filter(c => !joinedIds.has(c._id));
    return [...pendingNotJoined, ...joinedChannels];
  }, [pendingChannels, joinedChannels]);

  // ─── All channels = myChannels + joinedChannels ───────────────
  const allChannels = useMemo(() => {
    const combined = [...myChannels, ...joinedChannels];
    const seen = new Set();
    return combined.filter(c => {
      if (seen.has(c._id)) return false;
      seen.add(c._id);
      return true;
    });
  }, [myChannels, joinedChannels]);

  // ─── Workspace channels ────────────────────────────────────────
  const workspaceChats = useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats.filter(
      (chat) => chat.scope === 'workspace' && chat.type === 'group'
    );
  }, [chatsData]);

  const workspaceGroups = useMemo(() => {
    const groups = {};
    for (const chat of workspaceChats) {
      const wsId = chat.workspace?.toString();
      if (!wsId) continue;
      if (!groups[wsId]) groups[wsId] = [];
      groups[wsId].push(chat);
    }
    return Object.entries(groups).map(([wsId, chats]) => ({
      workspaceId: wsId,
      workspaceName: workspaceNameMap[wsId] || `Workspace ${wsId.slice(-4)}`,
      channels: chats,
    }));
  }, [workspaceChats, workspaceNameMap]);

  // ─── Handlers ──────────────────────────────────────────────────
  const handleJoin = async (chatId) => {
    try {
      await requestJoin(chatId).unwrap();
      toast.success('Join request sent! Waiting for approval.');
      refetchPending();
      refetchChats();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to request join.');
    }
  };

  const handleDelete = async (channel) => {
    if (!window.confirm(`Delete "${channel.name}" permanently?`)) return;
    try {
      await deletePublicGroup(channel._id).unwrap();
      toast.success('Channel deleted.');
      refetchChats();
      refetchPending();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete channel.');
    }
  };

  const handleEdit = (channel) => {
    setEditChannel(channel);
    setShowCreateModal(true);
  };

  const handleExit = async (chatId) => {
    if (!window.confirm('Are you sure you want to leave this channel?')) return;
    try {
      await exitGroupChat(chatId).unwrap();
      toast.success('You have left the channel.');
      refetchChats();
      refetchPending();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to leave channel.');
    }
  };

  const handleCreateSuccess = (action = 'created') => {
    toast.success(`Channel ${action === 'updated' ? 'updated' : 'created'}!`);
    refetchChats();
    refetchPending();
    setActiveTab('my');
  };

  // Long press handler for mobile
  const handleLongPress = (channel) => {
    // Determine if the user is the creator
    const isCreator = channel.createdBy?._id === userInfo?._id;
    // For workspace channels, we don't show actions
    if (channel.scope === 'workspace') return;
    setActionModal({ isOpen: true, channel, isCreator });
  };

  const isLoading = chatsLoading || pendingLoading || workspacesLoading;

  // ─── Tab configuration ─────────────────────────────────────────
  const tabs = [
    { id: 'all', label: 'All', icon: FiRadio },
    { id: 'my', label: 'My', icon: FaUser },
    { id: 'joined', label: 'Joined', icon: FaCheckCircle },
    { id: 'workspace', label: 'Workspace', icon: FaBuilding },
  ];

  // ─── Filter by search term ─────────────────────────────────────
  const filterByName = (channel) =>
    channel.name?.toLowerCase().includes(searchTerm.toLowerCase());

  // ─── Render ────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col h-screen md:h-auto md:min-h-screen relative overflow-hidden">
          {/* ─── Fixed Header ──────────────────────────────────────── */}
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 flex-shrink-0 z-10">
            <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                  Channels
                </h1>
                <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-full px-4 py-1.5 flex-1 max-w-xs">
                  <FaSearch className="text-gray-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Search channels..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent flex-1 outline-none text-sm text-gray-800 dark:text-white placeholder-gray-400"
                  />
                </div>
              </div>
              <button
                onClick={() => setShowDiscoverModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition flex-shrink-0"
              >
                <FaCompass className="text-sm" />
                <span className="hidden sm:inline text-sm font-medium">Discover</span>
              </button>
            </div>
            <div className="md:hidden px-4 pb-2">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-full px-4 py-2 w-full">
                <FaSearch className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent flex-1 outline-none text-sm text-gray-800 dark:text-white placeholder-gray-400"
                />
              </div>
            </div>
          </header>

          {/* ─── Fixed Tab Bar ────────────────────────────────────── */}
          <div className="flex bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 flex-shrink-0 overflow-hidden">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`
                  flex-1 min-w-0 py-2 px-1 text-[10px] font-medium
                  transition flex flex-col items-center justify-center gap-0.5
                  whitespace-nowrap
                  md:py-3 md:px-3 md:text-sm md:flex-row md:gap-2
                  ${
                    activeTab === id
                      ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon className="text-base md:text-lg" />
                <span className="leading-none">{label}</span>
              </button>
            ))}
          </div>

          {/* ─── Scrollable Content ──────────────────────────────── */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12]">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <FaSpinner className="animate-spin text-teal-500 text-2xl" />
              </div>
            ) : (
              <>
                {activeTab === 'all' && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {allChannels.filter(filterByName).map((channel) => {
                      const isCreator = channel.createdBy?._id === userInfo?._id;
                      const status = isCreator ? 'my' : 'joined';
                      return (
                        <ChannelCard
                          key={channel._id}
                          channel={channel}
                          status={status}
                          linkTo={`/channels/${channel._id}`}
                          onJoin={handleJoin}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onExit={handleExit}
                          isCreator={isCreator}
                          navigate={navigate}
                          onLongPress={handleLongPress}
                        />
                      );
                    })}
                    {allChannels.filter(filterByName).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                        <FaHashtag className="text-4xl mb-2 opacity-30" />
                        <p className="text-sm">No channels found.</p>
                        <button
                          onClick={() => setShowDiscoverModal(true)}
                          className="mt-3 text-sm text-teal-500 hover:underline"
                        >
                          Discover public channels →
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'my' && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {myChannels.filter(filterByName).map((channel) => (
                      <ChannelCard
                        key={channel._id}
                        channel={channel}
                        status="my"
                        linkTo={`/channels/${channel._id}`}
                        onJoin={handleJoin}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onExit={handleExit}
                        isCreator={true}
                        navigate={navigate}
                        onLongPress={handleLongPress}
                      />
                    ))}
                    {myChannels.filter(filterByName).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                        <FaHashtag className="text-4xl mb-2 opacity-30" />
                        <p className="text-sm">You haven't created any public channels yet.</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="mt-3 text-sm text-teal-500 hover:underline"
                        >
                          Create one now →
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'joined' && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {mergedJoined.filter(filterByName).map((channel) => {
                      const isJoined = joinedChannels.some(c => c._id === channel._id);
                      const isPending = !isJoined && pendingIds.has(channel._id);
                      const status = isPending ? 'pending' : 'joined';
                      return (
                        <ChannelCard
                          key={channel._id}
                          channel={channel}
                          status={status}
                          linkTo={isPending ? undefined : `/channels/${channel._id}`}
                          onJoin={handleJoin}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onExit={handleExit}
                          isCreator={false}
                          navigate={navigate}
                          onLongPress={handleLongPress}
                        />
                      );
                    })}
                    {mergedJoined.filter(filterByName).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                        <FaHashtag className="text-4xl mb-2 opacity-30" />
                        <p className="text-sm">You haven't joined any public channels yet.</p>
                        <button
                          onClick={() => setShowDiscoverModal(true)}
                          className="mt-3 text-sm text-teal-500 hover:underline"
                        >
                          Discover channels →
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'workspace' && (
                  <div>
                    {workspaceGroups.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                        <FaBuilding className="text-4xl mb-2 opacity-30" />
                        <p className="text-sm">No workspace channels found.</p>
                      </div>
                    ) : (
                      workspaceGroups.map((group) => (
                        <WorkspaceGroupSection
                          key={group.workspaceId}
                          workspaceId={group.workspaceId}
                          workspaceName={group.workspaceName}
                          channels={group.channels}
                          userInfo={userInfo}
                          navigate={navigate}
                          searchTerm={searchTerm}
                          onLongPress={handleLongPress}
                        />
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </main>

          <GeneralBottombar />

          <button
            onClick={() => setShowCreateModal(true)}
            className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-14 h-14 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
            aria-label="Create channel"
          >
            <FaPlus className="text-2xl" />
          </button>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <BottomSheet isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setEditChannel(null); }}>
        <CreateChannelContent
          onClose={() => { setShowCreateModal(false); setEditChannel(null); }}
          onSuccess={handleCreateSuccess}
          editData={editChannel}
        />
      </BottomSheet>

      {/* Discover Modal */}
      <DiscoverModal
        isOpen={showDiscoverModal}
        onClose={() => setShowDiscoverModal(false)}
        onJoin={handleJoin}
        joinedIds={new Set(joinedChannels.map(c => c._id))}
        pendingIds={pendingIds}
      />

      {/* Mobile Action Modal */}
      <ChannelActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, channel: null })}
        channel={actionModal.channel}
        isCreator={actionModal.isCreator}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExit={handleExit}
        status={actionModal.channel ? (pendingIds.has(actionModal.channel._id) ? 'pending' : 'joined') : ''}
      />
    </>
  );
};

export default GeneralChannels;