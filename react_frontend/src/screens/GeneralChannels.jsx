// pages/GeneralChannels.jsx
import React, { useState, useEffect } from 'react';
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
} from '../slices/messagingApiSlice';
import { toast } from 'react-toastify';
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
} from 'react-icons/fa';
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

// ─── Channel Card (clickable + three-dot menu) ──────────────────
const ChannelCard = ({ channel, status = 'discover', onJoin, onEdit, onDelete, isCreator = false }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const memberCount = channel.participants?.length || 0;
  const name = channel.name || 'Unnamed Channel';
  const description = channel.description || '';

  let actionButton = null;
  if (status === 'joined') {
    actionButton = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
        <FaCheckCircle className="text-xs" /> Joined
      </span>
    );
  } else if (status === 'pending') {
    actionButton = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
        <FaClock className="text-xs" /> Awaiting approval
      </span>
    );
  } else if (status === 'my') {
    actionButton = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400">
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
        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition"
      >
        <FaUserPlus className="text-xs" /> Join
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors relative">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
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

      {/* Text block – clickable to open chat */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-800 dark:text-white truncate">
            {name}
          </p>
          {channel.isPublic && (
            <span className="flex-shrink-0 text-xs text-gray-400">🌐</span>
          )}
        </div>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {description}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
          <span className="flex items-center gap-1">
            <FaUsers className="text-teal-500 dark:text-teal-400 text-xs" />
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>
      </div>

      {/* Action button + three-dot */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {actionButton}
        {isCreator && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <FaEllipsisV className="text-sm" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[120px] z-20">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(channel); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 w-full transition"
                >
                  <FaEdit className="text-xs" /> Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(channel); }}
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

// ─── Main Component ──────────────────────────────────────────────
const GeneralChannels = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('my');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editChannel, setEditChannel] = useState(null);

  // ─── Pending join requests from backend ──────────────────────
  const {
    data: pendingData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useGetPendingJoinRequestsQuery(undefined, {
    pollingInterval: 15000, // refresh every 15s to catch admin actions
  });

  const pendingChannels = pendingData?.groups || [];

  // ─── All user chats ──────────────────────────────────────────
  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useGetUserChatsQuery({ archived: false });

  // ─── Filtered lists ──────────────────────────────────────────
  const myChannels = React.useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats.filter(
      (chat) => chat.scope === 'public' && chat.type === 'group' && chat.createdBy?._id === userInfo?._id
    );
  }, [chatsData, userInfo]);

  const joinedChannels = React.useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats.filter(
      (chat) => chat.scope === 'public' && chat.type === 'group' && chat.createdBy?._id !== userInfo?._id
    );
  }, [chatsData, userInfo]);

  // ─── Build a Set of pending channel IDs for quick lookup ────
  const pendingIds = React.useMemo(() => {
    return new Set(pendingChannels.map(c => c._id));
  }, [pendingChannels]);

  // ─── Discover public groups ──────────────────────────────────
  const {
    data: discoverData,
    isLoading: discoverLoading,
    refetch: refetchDiscover,
  } = useSearchPublicGroupsQuery(
    { query: searchQuery || '' },
    { skip: activeTab !== 'discover' }
  );

  const discoverChannels = discoverData?.groups || [];

  // ─── Mutations ──────────────────────────────────────────────
  const [requestJoin] = useRequestJoinGroupMutation();
  const [deletePublicGroup] = useDeletePublicGroupMutation();

  const handleJoin = async (chatId) => {
    try {
      await requestJoin(chatId).unwrap();
      toast.success('Join request sent! Waiting for approval.');
      // Refetch all relevant queries to update pending list
      refetchPending();
      refetchDiscover();
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
      refetchDiscover();
      refetchPending();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete channel.');
    }
  };

  const handleEdit = (channel) => {
    setEditChannel(channel);
    setShowCreateModal(true);
  };

  const handleCreateSuccess = (action = 'created') => {
    toast.success(`Channel ${action === 'updated' ? 'updated' : 'created'}!`);
    refetchChats();
    refetchDiscover();
    refetchPending();
    setActiveTab('my');
  };

  const handleChannelClick = (channelId) => {
    navigate(`/channels/${channelId}`);
  };

  const renderList = (channels, status, isCreator = false) => {
    if (channels.length === 0) {
      let message = 'No channels here.';
      if (status === 'my') message = "You haven't created any public channels yet.";
      else if (status === 'joined') message = "You haven't joined any public channels yet.";
      else if (status === 'pending') message = "You don't have any pending join requests.";
      else message = searchQuery ? 'No public channels match your search.' : 'No public channels available right now.';
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
          <FaHashtag className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">{message}</p>
          {status === 'my' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-3 text-sm text-teal-500 hover:underline"
            >
              Create one now →
            </button>
          )}
          {status === 'joined' && (
            <button
              onClick={() => setActiveTab('discover')}
              className="mt-3 text-sm text-teal-500 hover:underline"
            >
              Discover channels →
            </button>
          )}
        </div>
      );
    }
    return channels.map((channel) => {
      // Determine actual status for discover tab: if channel is in pending set, show pending
      let actualStatus = status;
      if (status === 'discover' && pendingIds.has(channel._id)) {
        actualStatus = 'pending';
      }
      return (
        <div
          key={channel._id}
          onClick={() => {
            // Only navigate if not pending (can't click into pending channel)
            if (actualStatus !== 'pending') {
              handleChannelClick(channel._id);
            }
          }}
          className={`cursor-pointer ${actualStatus === 'pending' ? 'opacity-70 cursor-default' : ''}`}
        >
          <ChannelCard
            channel={channel}
            status={actualStatus}
            onJoin={handleJoin}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isCreator={isCreator}
          />
        </div>
      );
    });
  };

  const isLoading = chatsLoading || discoverLoading || pendingLoading;

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
                Channels
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition"
                >
                  <FaPlus className="text-sm" />
                  <span className="text-sm font-medium">Create</span>
                </button>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition"
                >
                  <FaSearch className="text-sm" />
                  <span className="hidden sm:inline text-sm font-medium">Discover</span>
                </button>
              </div>
            </div>
            <div className="md:hidden px-4 pb-2">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-full px-4 py-2">
                <FaSearch className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent flex-1 outline-none text-sm text-gray-800 dark:text-white placeholder-gray-400"
                />
              </div>
            </div>
          </header>

          {/* Tabs – 4 tabs */}
          <div className="flex bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('my')}
              className={`flex-1 py-3 text-sm font-medium transition whitespace-nowrap px-3 ${
                activeTab === 'my'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              My ({myChannels.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-3 text-sm font-medium transition whitespace-nowrap px-3 ${
                activeTab === 'pending'
                  ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Pending ({pendingChannels.length})
            </button>
            <button
              onClick={() => setActiveTab('joined')}
              className={`flex-1 py-3 text-sm font-medium transition whitespace-nowrap px-3 ${
                activeTab === 'joined'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Joined ({joinedChannels.length})
            </button>
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex-1 py-3 text-sm font-medium transition whitespace-nowrap px-3 ${
                activeTab === 'discover'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Discover ({discoverChannels.length})
            </button>
          </div>

          {/* List */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12]">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="animate-spin text-teal-500 text-2xl" />
                </div>
              ) : activeTab === 'my' ? (
                renderList(myChannels, 'my', true)
              ) : activeTab === 'pending' ? (
                renderList(pendingChannels, 'pending', false)
              ) : activeTab === 'joined' ? (
                renderList(joinedChannels, 'joined')
              ) : (
                renderList(discoverChannels, 'discover')
              )}
            </div>
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
    </>
  );
};

export default GeneralChannels;