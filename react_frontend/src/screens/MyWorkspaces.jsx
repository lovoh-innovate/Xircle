// pages/MyWorkspaces.jsx
import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetMyWorkspacesQuery,
  useCreateWorkspaceMutation,
} from '../slices/workspaceApiSlice';
import { useRequestToJoinMutation } from '../slices/teamApiSlice';
import { toast } from 'react-toastify';
import {
  FaPlus,
  FaUserCircle,
  FaUsers,
  FaIndustry,
  FaUserCheck,
  FaSignInAlt,
  FaTimes,
  FaImage,
  FaTrashAlt,
  FaClock,
} from 'react-icons/fa';
import JoinedWorkspaces from '../components/JoinedWorkspaces';

// ─── Bottom Sheet (mobile) / Modal (desktop) ────────────────────────────
const BottomSheet = ({ isOpen, onClose, children }) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      if (visible) {
        setAnimating(false);
        const timer = setTimeout(() => setVisible(false), 300);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full md:max-w-md md:rounded-xl rounded-t-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ease-out ${
          animating ? 'translate-y-0' : 'translate-y-full'
        } md:translate-y-0 md:scale-100`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Create Workspace Form ──────────────────────────────────────────────
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

      setName('');
      setIndustry('');
      setDescription('');
      setColor('#0d9488');
      setLogoFile(null);
      setLogoPreview('');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Create Workspace</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <FaTimes />
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="Acme Corp"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Industry *</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="Technology"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer p-1"
            />
            <span className="text-sm text-gray-500">{color}</span>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <div className="relative">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                >
                  <FaTrashAlt className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <FaImage className="text-gray-400" />
                <span className="text-sm text-gray-500">Upload Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG, or SVG (max 5MB)</p>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            rows="3"
            placeholder="What's this about?"
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-70"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Join Workspace Form ─────────────────────────────────────────────────
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
      toast.success('Join request sent! Waiting for owner approval.');
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FaSignInAlt className="text-teal-500" /> Join Workspace
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <FaTimes />
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code *</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 uppercase"
            placeholder="e.g. ABCD1234"
            required
          />
          <p className="text-xs text-gray-400 mt-1">Ask the workspace owner for the invite code.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-70"
          >
            {isLoading ? 'Requesting...' : 'Request Join'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── FAB Options Sheet ──────────────────────────────────────────────────
const FabOptionsSheet = ({ isOpen, onClose, onCreateWorkspace, onJoinWorkspace }) => (
  <BottomSheet isOpen={isOpen} onClose={onClose}>
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">What would you like to do?</h3>
      <button
        onClick={() => {
          onClose();
          onCreateWorkspace();
        }}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-gray-50 transition"
      >
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
          <FaPlus />
        </div>
        <span className="font-medium text-gray-700">Create Workspace</span>
      </button>
      <button
        onClick={() => {
          onClose();
          onJoinWorkspace();
        }}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-gray-50 transition"
      >
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
          <FaSignInAlt />
        </div>
        <span className="font-medium text-gray-700">Join Workspace</span>
      </button>
    </div>
  </BottomSheet>
);

// ─── Workspace Item (arrow removed, full‑width) ─────────────────────────
const WorkspaceItem = ({ workspace, isOwner, userInfo }) => {
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

  return (
    <CardWrapper
      {...cardProps}
      className={`flex items-center gap-3.5 px-4 py-3.5 hover:bg-gray-50 transition-colors ${
        isClickable ? 'cursor-pointer active:bg-gray-100' : 'opacity-60'
      }`}
    >
      {workspace.logo ? (
        <img
          src={workspace.logo}
          alt={workspace.name}
          className="w-12 h-12 rounded-2xl object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ backgroundColor: workspace.color || '#0d9488' }}
        >
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-800 truncate leading-tight">
            {workspace.name}
          </span>
          {isOwner && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
              Owner
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 whitespace-nowrap">
              <FaClock className="text-[10px]" />
              Pending
            </span>
          )}
        </div>

        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <FaUsers className="text-teal-500 text-xs shrink-0" />
            <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </span>
          {workspace.industry && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <FaIndustry className="text-teal-500 text-xs shrink-0" />
              <span className="truncate">{workspace.industry}</span>
            </span>
          )}
        </div>
      </div>
    </CardWrapper>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const MyWorkspaces = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { data, isLoading, refetch } = useGetMyWorkspacesQuery(undefined, {
    pollingInterval: 30000,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showFabOptions, setShowFabOptions] = useState(false);

  const myWorkspaces = data?.myBusinesses || [];

  const handleCreateSuccess = () => refetch();
  const handleJoinSuccess = () => refetch();

  // Mobile swipe
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollTo = useCallback((index) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        left: index * containerRef.current.clientWidth,
        behavior: 'smooth',
      });
      setActiveIndex(index);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const newIndex = Math.round(
        containerRef.current.scrollLeft / containerRef.current.clientWidth
      );
      if (newIndex !== activeIndex) setActiveIndex(newIndex);
    }
  }, [activeIndex]);

  const renderOwnedList = () => {
    if (myWorkspaces.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <FaUsers className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">No workspaces here yet.</p>
        </div>
      );
    }
    return myWorkspaces.map((ws) => (
      <WorkspaceItem key={ws._id} workspace={ws} isOwner={true} userInfo={userInfo} />
    ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500">Loading workspaces...</p>
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

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* ── WhatsApp‑style Header ── */}
        <header className="bg-teal-600 text-white sticky top-0 z-10 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/xircle-logo.png" alt="Xircle" className="h-8 w-auto" />
              <span className="text-lg font-semibold tracking-wide hidden sm:inline">
                Workspaces
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowJoinModal(true)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-teal-500/30 transition"
                aria-label="Join workspace"
              >
                <FaSignInAlt className="text-lg" />
                <span className="hidden sm:inline text-sm font-medium">Join</span>
              </button>
              <Link to="/profile" className="flex items-center gap-2">
                {userInfo?.profile ? (
                  <img
                    src={userInfo.profile}
                    alt={userInfo.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/30"
                  />
                ) : (
                  <FaUserCircle className="w-8 h-8 text-white/80" />
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
          {/* Desktop: two columns */}
          <div className="hidden md:grid md:grid-cols-2 gap-6">
            {/* Owned */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                  <FaUserCheck className="text-teal-500" /> Owned
                </h2>
                <span className="text-sm text-gray-400">{myWorkspaces.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {renderOwnedList()}
              </div>
            </div>
            {/* Joined (imported component) */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                  <FaUsers className="text-teal-500" /> Joined
                </h2>
                <span className="text-sm text-gray-400">
                  {/* Optionally show count: */}
                  {data?.joinedBusinesses?.length || 0}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                <JoinedWorkspaces />
              </div>
            </div>
          </div>

          {/* Mobile: swipeable container with two panels */}
          <div className="md:hidden -mx-4">
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            >
              {/* Panel 1: Owned */}
              <div className="w-full flex-shrink-0 snap-start bg-white divide-y divide-gray-100 px-4">
                {renderOwnedList()}
              </div>
              {/* Panel 2: Joined */}
              <div className="w-full flex-shrink-0 snap-start bg-white divide-y divide-gray-100 px-4">
                <JoinedWorkspaces />
              </div>
            </div>
          </div>
        </main>

        {/* ── Bottom Navigation (mobile) ── */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 h-16 flex items-stretch z-20">
          <button
            onClick={() => scrollTo(0)}
            className={`flex-1 flex flex-col items-center justify-center transition-colors ${
              activeIndex === 0 ? 'text-teal-600' : 'text-gray-400'
            }`}
          >
            <FaUserCheck className="text-xl" />
            <span className="text-xs mt-0.5 font-medium">Owned</span>
          </button>
          <button
            onClick={() => scrollTo(1)}
            className={`flex-1 flex flex-col items-center justify-center transition-colors ${
              activeIndex === 1 ? 'text-teal-600' : 'text-gray-400'
            }`}
          >
            <FaUsers className="text-xl" />
            <span className="text-xs mt-0.5 font-medium">Joined</span>
          </button>
        </nav>

        {/* ── Floating Action Button ── */}
        <button
          onClick={() => setShowFabOptions(true)}
          className="fixed right-5 bottom-20 md:bottom-6 z-20 w-14 h-14 bg-teal-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-teal-700 active:scale-95 transition-transform"
          aria-label="Add workspace"
        >
          <FaPlus className="text-2xl" />
        </button>

        {/* ── Modals / Bottom Sheets ── */}
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
      </div>
    </>
  );
};

export default MyWorkspaces;