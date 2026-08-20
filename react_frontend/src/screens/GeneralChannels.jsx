// pages/GeneralChannels.jsx
import React, { useState, useEffect, useMemo } from 'react';
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

// ─── Channel Card ────────────────────────────────────────────────
const ChannelCard = ({ channel, status = 'discover', onJoin, onEdit, onDelete, isCreator = false, linkTo, workspaceName, navigate }) => {
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

  const handleCardClick = () => {
    if (status === 'pending') return;
    if (linkTo && navigate) {
      navigate(linkTo);
    }
  };

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors relative ${status === 'pending' ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
      onClick={handleCardClick}
    >
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

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-800 dark:text-white truncate">
            {name}
          </p>
          {channel.isPublic && (
            <span className="flex-shrink-0 text-xs text-gray-400">🌐</span>
          )}
          {workspaceName && (
            <span className="flex-shrink-0 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {workspaceName}
            </span>
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

// ─── Workspace Group Section ─────────────────────────────────────
const WorkspaceGroupSection = ({ workspaceId, workspaceName, channels, userInfo, navigate }) => {
  const isOwnWorkspace = userInfo?.ownedWorkspaces?.includes(workspaceId);
  const baseRoute = isOwnWorkspace
    ? `/my-workspace/${workspaceId}/channels`
    : `/workspace/${workspaceId}/chat`;

  const sortedChannels = [...channels].sort((a, b) => a.name?.localeCompare(b.name) || 0);

  return (
    <div className="mb-4">
      <div className="px-4 py-2 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 sticky top-0 z-10">
        <FaBuilding className="text-teal-500" />
        <span className="font-semibold text-gray-700 dark:text-gray-300">{workspaceName || 'Workspace'}</span>
        <span className="text-xs text-gray-400 ml-auto">{channels.length} channel{channels.length > 1 ? 's' : ''}</span>
      </div>
      {sortedChannels.map((channel) => (
        <ChannelCard
          key={channel._id}
          channel={channel}
          status="joined"
          linkTo={`${baseRoute}/${channel._id}`}
          workspaceName={workspaceName}
          navigate={navigate}
        />
      ))}
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

  const {
    data: discoverData,
    isLoading: discoverLoading,
    refetch: refetchDiscover,
  } = useSearchPublicGroupsQuery(
    { query: searchQuery || '' },
    { skip: activeTab !== 'discover' }
  );
  const discoverChannels = discoverData?.groups || [];

  // ─── Mutations ─────────────────────────────────────────────────
  const [requestJoin] = useRequestJoinGroupMutation();
  const [deletePublicGroup] = useDeletePublicGroupMutation();

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

  // ─── Merged Joined – with fix: joined channels always take precedence ──
  const mergedJoined = useMemo(() => {
    const joinedIds = new Set(joinedChannels.map(c => c._id));
    // Filter out pending channels that are already joined
    const pendingNotJoined = pendingChannels.filter(c => !joinedIds.has(c._id));
    // Show pending first, then joined
    return [...pendingNotJoined, ...joinedChannels];
  }, [pendingChannels, joinedChannels]);

  // ─── Workspace channels (scope: workspace, type: group) ──────
  const workspaceChats = useMemo(() => {
    if (!chatsData?.chats) return [];
    return chatsData.chats.filter(
      (chat) => chat.scope === 'workspace' && chat.type === 'group'
    );
  }, [chatsData]);

  // Group by workspaceId, using the workspaceNameMap for names
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

  const isLoading = chatsLoading || discoverLoading || pendingLoading || workspacesLoading;

  // ─── Tab configuration ─────────────────────────────────────────
  const tabs = [
    { id: 'my', label: 'My', icon: FaUser },
    { id: 'joined', label: 'Joined', icon: FaCheckCircle },
    { id: 'workspace', label: 'Workspace', icon: FaBuilding },
    { id: 'discover', label: 'Discover', icon: FaGlobe },
  ];

  // ─── Render ────────────────────────────────────────────────────
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

          {/* ─── Mobile‑optimised Tab Bar ──────────────────────────── */}
          <div className="flex bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 overflow-hidden">
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

          {/* ─── Content ────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12]">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <FaSpinner className="animate-spin text-teal-500 text-2xl" />
              </div>
            ) : (
              <>
                {activeTab === 'my' && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {myChannels.map((channel) => (
                      <ChannelCard
                        key={channel._id}
                        channel={channel}
                        status="my"
                        linkTo={`/channels/${channel._id}`}
                        onJoin={handleJoin}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        isCreator={true}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'joined' && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {mergedJoined.map((channel) => {
                      // Determine if channel is actually joined (participant)
                      const isJoined = joinedChannels.some(c => c._id === channel._id);
                      // Only pending if it's NOT joined AND it's in pending list
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
                          isCreator={false}
                          navigate={navigate}
                        />
                      );
                    })}
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
                        />
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'discover' && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {discoverChannels.map((channel) => {
                      // For discover, if already joined, show as joined (clickable)
                      const isJoined = joinedChannels.some(c => c._id === channel._id);
                      const isPending = !isJoined && pendingIds.has(channel._id);
                      const status = isJoined ? 'joined' : (isPending ? 'pending' : 'discover');
                      return (
                        <ChannelCard
                          key={channel._id}
                          channel={channel}
                          status={status}
                          linkTo={(isJoined || status === 'discover') ? `/channels/${channel._id}` : undefined}
                          onJoin={handleJoin}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          isCreator={false}
                          navigate={navigate}
                        />
                      );
                    })}
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
    </>
  );
};

export default GeneralChannels;