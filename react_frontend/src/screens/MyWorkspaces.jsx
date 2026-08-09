// pages/MyWorkspaces.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetMyWorkspacesQuery,
  useCreateWorkspaceMutation,
} from '../slices/workspaceApiSlice';
import { useRequestToJoinMutation } from '../slices/teamApiSlice';
import { toast } from 'react-hot-toast';
import {
  FaPlus,
  FaUsers,
  FaUserCheck,
  FaSignInAlt,
  FaTimes,
  FaImage,
  FaTrashAlt,
  FaClock,
  FaRocket,
  FaUserFriends,
  FaSpinner,
  FaUserCircle,
  FaChevronRight,
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import JoinedWorkspaces from '../components/JoinedWorkspaces';
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

// ─── Create Workspace Form ─────────────────────────────────────────
const CreateWorkspaceContent = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#0d9488');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createWorkspace] = useCreateWorkspaceMutation();

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !industry.trim()) {
      toast.error('Name and industry are required.');
      return;
    }
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('industry', industry.trim());
      formData.append('description', description.trim());
      formData.append('color', color);
      if (logoFile) formData.append('logo', logoFile);

      await createWorkspace(formData).unwrap();
      toast.success('Workspace created!');
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setIndustry('');
    setDescription('');
    setColor('#0d9488');
    setLogoFile(null);
    setLogoPreview('');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          <FaRocket className="inline mr-2 text-teal-500" /> Create Workspace
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
          <FaTimes />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400"
            placeholder="Acme Corp"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industry *</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400"
            placeholder="Technology"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand Color</label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-12 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer p-1 bg-white dark:bg-[#2a2a2a]"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{color}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo</label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <div className="relative">
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="w-16 h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                >
                  <FaTrashAlt className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-teal-500 transition bg-gray-50 dark:bg-[#2a2a2a]">
                <FaImage className="text-gray-400 dark:text-gray-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Upload Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG, or SVG (max 5MB)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400"
            rows="3"
            placeholder="What's this workspace about?"
          />
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
            {isLoading ? <FaSpinner className="animate-spin mx-auto" /> : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Join Workspace Form ──────────────────────────────────────────
const JoinWorkspaceContent = ({ onClose, onSuccess }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestToJoin] = useRequestToJoinMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code.');
      return;
    }
    try {
      setIsLoading(true);
      await requestToJoin({ inviteCode: inviteCode.trim().toUpperCase() }).unwrap();
      toast.success('Request sent! Waiting for approval.');
      setInviteCode('');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to join workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FaSignInAlt className="text-purple-500" /> Join Workspace
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
          <FaTimes />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invite Code *</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400 uppercase"
            placeholder="e.g. ABCD1234"
            required
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Ask the workspace owner for the invite code.</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-xl hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 transition"
          >
            {isLoading ? <FaSpinner className="animate-spin mx-auto" /> : 'Request Join'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── FAB Options Sheet ──────────────────────────────────────────────
const FabOptionsSheet = ({ isOpen, onClose, onCreateWorkspace, onJoinWorkspace }) => (
  <BottomSheet isOpen={isOpen} onClose={onClose}>
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What would you like to do?</h3>
      <button
        onClick={() => {
          onClose();
          onCreateWorkspace();
        }}
        className="flex items-center gap-4 w-full px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition"
      >
        <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
          <FaPlus className="text-xl" />
        </div>
        <span className="font-medium text-gray-700 dark:text-gray-200">Create Workspace</span>
      </button>
      <button
        onClick={() => {
          onClose();
          onJoinWorkspace();
        }}
        className="flex items-center gap-4 w-full px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition"
      >
        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
          <FaSignInAlt className="text-xl" />
        </div>
        <span className="font-medium text-gray-700 dark:text-gray-200">Join Workspace</span>
      </button>
    </div>
  </BottomSheet>
);

// ─── Workspace Card — redesigned ───────────────────────────────────
const WorkspaceCard = ({ workspace, isOwner, userInfo }) => {
  const memberCount = workspace.members?.length || 0;
  const initials =
    workspace.initials ||
    workspace.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const currentUserMembership = workspace.members?.find(
    (m) => m.user?._id === userInfo?._id || m.user === userInfo?._id
  );
  const membershipStatus = currentUserMembership?.status || 'active';
  const isPending = membershipStatus === 'pending';
  const routePath = isOwner
    ? `/my-workspace/${workspace._id}`
    : `/workspace/${workspace._id}`;
  const isClickable = !isPending;

  const CardWrapper = isClickable ? Link : 'div';
  const cardProps = isClickable ? { to: routePath } : {};

  const subtitle = [workspace.industry, `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <CardWrapper
      {...cardProps}
      className={`group flex items-center gap-3.5 px-4 py-4 transition-colors ${
        isClickable
          ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04]'
          : 'opacity-60 cursor-default'
      }`}
    >
      {/* Avatar */}
      {workspace.logo ? (
        <img
          src={workspace.logo}
          alt={workspace.name}
          className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-700"
        />
      ) : (
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-[15px] flex-shrink-0 shadow-sm"
          style={{ backgroundColor: workspace.color || '#0d9488' }}
        >
          {initials}
        </div>
      )}

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[15px] text-gray-900 dark:text-white truncate">
            {workspace.name}
          </p>
          {isOwner && (
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 px-1.5 py-0.5 rounded">
              Owner
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {subtitle}
        </p>
      </div>

      {/* Right side: pending badge or chevron */}
      {isPending ? (
        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
          <FaClock className="text-[10px]" /> Pending
        </span>
      ) : (
        isClickable && (
          <FaChevronRight className="flex-shrink-0 text-gray-300 dark:text-gray-600 text-xs group-hover:text-gray-400 dark:group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
        )
      )}
    </CardWrapper>
  );
};

// ─── Quick Stats ──────────────────────────────────────────────────
const QuickStats = ({ ownedCount, joinedCount, pendingCount }) => (
  <div className="grid grid-cols-3 gap-3 mb-6">
    <div className="bg-white dark:bg-[#161619] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{ownedCount}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Owned</p>
    </div>
    <div className="bg-white dark:bg-[#161619] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{joinedCount}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Joined</p>
    </div>
    <div className="bg-white dark:bg-[#161619] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingCount}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pending</p>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaces = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const { data, isLoading, refetch } = useGetMyWorkspacesQuery(undefined, {
    pollingInterval: 30000,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showFabOptions, setShowFabOptions] = useState(false);

  const myWorkspaces = data?.myBusinesses || [];
  const joinedWorkspaces = data?.joinedBusinesses || [];
  const pendingCount = data?.pendingInvites || 0;

  const handleCreateSuccess = () => refetch();
  const handleJoinSuccess = () => refetch();

  const [activeTab, setActiveTab] = useState('owned');

  const renderWorkspaceList = (list, isOwner) => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
          <FaUsers className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">No workspaces here yet.</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
        {list.map((ws) => (
          <WorkspaceCard key={ws._id} workspace={ws} isOwner={isOwner} userInfo={userInfo} />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0b0b10]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
        {/* Sidebar – hidden on mobile */}
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          {/* Header – with profile button */}
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 px-4 sm:px-6 h-14 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Workspaces</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowJoinModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition text-sm font-medium"
              >
                <FaSignInAlt className="text-sm" />
                <span className="hidden sm:inline">Join</span>
              </button>
              {/* Profile button */}
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition text-sm font-medium"
              >
                <FaUserCircle className="text-lg" />
                <span className="hidden sm:inline">Profile</span>
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-6">
            <QuickStats
              ownedCount={myWorkspaces.length}
              joinedCount={joinedWorkspaces.length}
              pendingCount={pendingCount}
            />

            {/* Desktop */}
            <div className="hidden md:grid md:grid-cols-2 gap-6">
              <section>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <FaUserCheck className="text-teal-500" /> Owned
                  <span className="ml-auto text-sm font-normal text-gray-400 dark:text-gray-500">{myWorkspaces.length}</span>
                </h2>
                <div className="bg-white dark:bg-[#161619] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {renderWorkspaceList(myWorkspaces, true)}
                </div>
              </section>

              <section>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <FaUsers className="text-purple-500" /> Joined
                  <span className="ml-auto text-sm font-normal text-gray-400 dark:text-gray-500">{joinedWorkspaces.length}</span>
                </h2>
                <div className="bg-white dark:bg-[#161619] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {joinedWorkspaces.length > 0 ? (
                    <JoinedWorkspaces />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                      <FaUserFriends className="text-3xl mb-2 opacity-30" />
                      <p className="text-sm">No joined workspaces</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Mobile */}
            <div className="md:hidden">
              <div className="flex bg-gray-100 dark:bg-[#1c1c20] rounded-xl p-1 mb-4">
                <button
                  onClick={() => setActiveTab('owned')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                    activeTab === 'owned'
                      ? 'bg-white dark:bg-[#0f0f12] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Owned ({myWorkspaces.length})
                </button>
                <button
                  onClick={() => setActiveTab('joined')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                    activeTab === 'joined'
                      ? 'bg-white dark:bg-[#0f0f12] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Joined ({joinedWorkspaces.length})
                </button>
              </div>

              <div className="bg-white dark:bg-[#161619] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                {activeTab === 'owned'
                  ? renderWorkspaceList(myWorkspaces, true)
                  : joinedWorkspaces.length > 0
                  ? <JoinedWorkspaces />
                  : (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                        <FaUserFriends className="text-3xl mb-2 opacity-30" />
                        <p className="text-sm">No joined workspaces</p>
                      </div>
                    )
                }
              </div>
            </div>
          </main>

          <GeneralBottombar />

          {/* ─── FLOATING ACTION BUTTON ────────────────────────────────── */}
          <button
            onClick={() => setShowFabOptions(true)}
            className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-14 h-14 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg shadow-teal-600/25 flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
            aria-label="Create or join workspace"
          >
            <FaRocket className="text-2xl" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <FabOptionsSheet
        isOpen={showFabOptions}
        onClose={() => setShowFabOptions(false)}
        onCreateWorkspace={() => setShowCreateModal(true)}
        onJoinWorkspace={() => setShowJoinModal(true)}
      />

      <BottomSheet isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <CreateWorkspaceContent
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      </BottomSheet>

      <BottomSheet isOpen={showJoinModal} onClose={() => setShowJoinModal(false)}>
        <JoinWorkspaceContent
          onClose={() => setShowJoinModal(false)}
          onSuccess={handleJoinSuccess}
        />
      </BottomSheet>
    </>
  );
};

export default MyWorkspaces;