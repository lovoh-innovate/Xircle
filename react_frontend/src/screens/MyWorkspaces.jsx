// pages/MyWorkspaces.jsx
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  FaChevronRight,
  FaUserCheck,
  FaSignInAlt,
  FaTimes,
  FaImage,
  FaTrashAlt,
  FaClock,
} from 'react-icons/fa';

// ─── Create Workspace Modal ──────────────────────────────────────────────
const CreateWorkspaceModal = ({ isOpen, onClose, onSuccess }) => {
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
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
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
      if (logoFile) {
        formData.append('logo', logoFile);
      }

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
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
    </div>
  );
};

// ─── Join Workspace Modal ────────────────────────────────────────────────
const JoinWorkspaceModal = ({ isOpen, onClose, onSuccess }) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invite Code *
            </label>
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
    </div>
  );
};

// ─── Workspace List Item ──────────────────────────────────────────────────
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

  // ── Find the current user's membership in this workspace ──
  const currentUserMembership = workspace.members?.find(
    (m) => m.user?._id === userInfo?._id || m.user === userInfo?._id
  );
  const membershipStatus = currentUserMembership?.status || 'active';

  // ── Determine if the user is pending ──
  const isPending = membershipStatus === 'pending';

  // ── Determine route ──
  const routePath = isOwner
    ? `/my-workspace/${workspace._id}`
    : `/workspace/${workspace._id}`;

  // ── If pending, don't make it clickable ──
  const isClickable = !isPending;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 ${
        isClickable ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-60 cursor-default'
      } transition-colors`}
    >
      {/* Avatar with logo or initials */}
      {workspace.logo ? (
        <img
          src={workspace.logo}
          alt={workspace.name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: workspace.color || '#0d9488' }}
        >
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 truncate">{workspace.name}</span>
          {isOwner && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Owner</span>
          )}
          {isPending && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <FaClock className="text-[10px]" /> Pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <FaUsers className="text-teal-500 text-xs" />
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
          {workspace.industry && (
            <span className="flex items-center gap-1">
              <FaIndustry className="text-teal-500 text-xs" />
              {workspace.industry}
            </span>
          )}
        </div>
      </div>
      {isClickable ? (
        <Link to={routePath} className="text-gray-300 hover:text-gray-500 transition">
          <FaChevronRight className="text-sm" />
        </Link>
      ) : (
        <span className="text-gray-300">
          <FaClock className="text-sm" />
        </span>
      )}
    </div>
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

  const myWorkspaces = data?.myBusinesses || [];
  const joinedWorkspaces = data?.joinedBusinesses || [];

  const handleCreateSuccess = () => refetch();
  const handleJoinSuccess = () => refetch();

  // Mobile swipe
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollTo = (index) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        left: index * containerRef.current.offsetWidth,
        behavior: 'smooth',
      });
      setActiveIndex(index);
    }
  };

  const handleScroll = () => {
    if (containerRef.current) {
      const newIndex = Math.round(
        containerRef.current.scrollLeft / containerRef.current.offsetWidth
      );
      if (newIndex !== activeIndex) setActiveIndex(newIndex);
    }
  };

  const renderList = (workspaces, isOwner) => {
    if (workspaces.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No workspaces here.</p>
        </div>
      );
    }
    return workspaces.map((ws) => (
      <WorkspaceItem key={ws._id} workspace={ws} isOwner={isOwner} userInfo={userInfo} />
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/xircle-logo.png" alt="Xircle" className="h-8 w-auto" />
            <span className="text-lg font-semibold text-gray-700 hidden sm:inline">Workspaces</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Join button */}
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-1 px-3 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition text-sm font-medium"
            >
              <FaSignInAlt className="text-sm" />
              <span className="hidden sm:inline">Join</span>
            </button>

            {/* New Workspace button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
            >
              <FaPlus className="text-sm" />
              <span className="hidden sm:inline">New</span>
            </button>

            {/* Profile */}
            <Link to="/profile" className="flex items-center gap-2 text-gray-600 hover:text-teal-600">
              {userInfo?.profile ? (
                <img
                  src={userInfo.profile}
                  alt={userInfo.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-teal-500/20"
                />
              ) : (
                <FaUserCircle className="w-8 h-8" />
              )}
              <span className="hidden md:inline text-sm font-medium text-gray-700">
                {userInfo?.name?.split(' ')[0] || 'Profile'}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop: two columns */}
        <div className="hidden md:grid md:grid-cols-2 gap-6 h-full">
          {/* Owned Workspaces */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <FaUserCheck className="text-teal-500" /> Owned
              </h2>
              <span className="text-sm text-gray-400">{myWorkspaces.length}</span>
            </div>
            <div className="divide-y divide-gray-100">{renderList(myWorkspaces, true)}</div>
          </div>

          {/* Joined Workspaces */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <FaUsers className="text-teal-500" /> Joined
              </h2>
              <span className="text-sm text-gray-400">{joinedWorkspaces.length}</span>
            </div>
            <div className="divide-y divide-gray-100">{renderList(joinedWorkspaces, false)}</div>
          </div>
        </div>

        {/* Mobile: swipeable tabs */}
        <div className="md:hidden">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-4 bg-white">
            <button
              onClick={() => scrollTo(0)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeIndex === 0
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FaUserCheck className="inline mr-1.5" /> Owned ({myWorkspaces.length})
            </button>
            <button
              onClick={() => scrollTo(1)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeIndex === 1
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FaUsers className="inline mr-1.5" /> Joined ({joinedWorkspaces.length})
            </button>
          </div>

          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-lg"
          >
            <div className="w-full flex-shrink-0 snap-start bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">{renderList(myWorkspaces, true)}</div>
            </div>
            <div className="w-full flex-shrink-0 snap-start bg-white rounded-lg border border-gray-200 overflow-hidden ml-4">
              <div className="divide-y divide-gray-100">{renderList(joinedWorkspaces, false)}</div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
      <JoinWorkspaceModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={handleJoinSuccess}
      />
    </div>
  );
};

export default MyWorkspaces;