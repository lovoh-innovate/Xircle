// pages/MyWorkspaces.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetMyWorkspacesQuery,
  useCreateWorkspaceMutation,
  useGetWorkspaceByInviteCodeQuery,
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
  FaSpinner,
  FaUserCircle,
  FaChevronRight,
  FaCheckCircle,
  FaUserShield,
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Helpers ────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return String(name)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

const getUserId = (u) => (u?._id ? u._id.toString() : u?.toString());

const formatExpiry = (date) => {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
};

// ─── Global Styles ───────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }

    .skeleton { position: relative; overflow: hidden; background-color: rgb(229 231 235); }
    .dark .skeleton { background-color: rgba(255, 255, 255, 0.07); }
    .skeleton::after {
      content: ''; position: absolute; inset: 0; transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
      animation: skeletonShimmer 1.5s ease-in-out infinite;
    }
    .dark .skeleton::after {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
    }
    @keyframes skeletonShimmer { 100% { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .skeleton::after { animation: none; } }
  `}</style>
);

// ─── Skeletons ──────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-md ${className}`} />
);

const WorkspaceRowSkeleton = () => (
  <div className="flex items-center gap-3 px-3 sm:px-4 min-h-[58px]">
    <Skeleton className="w-9 h-9 flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-3.5 w-28 sm:w-40" />
      <Skeleton className="h-2.5 w-20 sm:w-32" />
    </div>
    <Skeleton className="h-3 w-3 flex-shrink-0" />
  </div>
);

const WorkspaceListSkeleton = ({ rows = 3 }) => (
  <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
    {Array.from({ length: rows }).map((_, i) => (
      <WorkspaceRowSkeleton key={i} />
    ))}
  </div>
);

const MyWorkspacesSkeleton = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
    <div className="hidden md:block md:w-72 md:flex-shrink-0 border-r border-gray-100 dark:border-gray-800/60 p-4 space-y-4">
      <Skeleton className="h-9 w-36" />
      <div className="space-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="h-8 w-8 flex-shrink-0" />
            <Skeleton className="h-3.5 flex-1 max-w-[110px]" />
          </div>
        ))}
      </div>
    </div>

    <div className="flex-1 flex flex-col min-h-screen">
      <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 px-4 sm:px-6 h-14 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#161619] rounded-lg p-4 text-center border border-gray-100 dark:border-gray-800"
            >
              <Skeleton className="h-7 w-10 mx-auto mb-2" />
              <Skeleton className="h-2.5 w-12 mx-auto" />
            </div>
          ))}
        </div>

        <div className="hidden md:flex md:flex-row md:items-stretch md:gap-4 flex-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex-1 bg-white dark:bg-[#161619] rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                <WorkspaceListSkeleton rows={4} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  </div>
);

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
        className="w-full md:max-w-md md:rounded-lg rounded-t-lg bg-white dark:bg-[#1a1a1a] shadow-xl max-h-[90vh] overflow-y-auto"
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
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400"
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
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400"
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
              className="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer p-1 bg-white dark:bg-[#2a2a2a]"
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
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
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
              <label className="flex items-center gap-3 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-teal-500 transition bg-gray-50 dark:bg-[#2a2a2a]">
                <FaImage className="text-gray-400 dark:text-gray-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Upload Logo</span>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
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
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400"
            rows="3"
            placeholder="What's this workspace about?"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
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
  const [previewWorkspace, setPreviewWorkspace] = useState(null);
  const [checkError, setCheckError] = useState('');
  const [debouncedCode, setDebouncedCode] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const code = inviteCode.trim().toUpperCase();
      if (code.length >= 4) {
        setDebouncedCode(code);
      } else {
        setDebouncedCode('');
        setPreviewWorkspace(null);
        setCheckError('');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [inviteCode]);

  const {
    data: workspaceData,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useGetWorkspaceByInviteCodeQuery(debouncedCode, {
    skip: !debouncedCode || debouncedCode.length < 4,
  });

  useEffect(() => {
    if (workspaceLoading) return;
    if (workspaceData?.workspace) {
      setPreviewWorkspace(workspaceData.workspace);
      setCheckError('');
    } else if (workspaceError) {
      setPreviewWorkspace(null);
      setCheckError('Invalid invite code');
    }
  }, [workspaceData, workspaceError, workspaceLoading, debouncedCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code.');
      return;
    }
    if (!previewWorkspace) {
      toast.error('Please enter a valid invite code.');
      return;
    }
    try {
      setIsLoading(true);
      await requestToJoin({ inviteCode: inviteCode.trim().toUpperCase() }).unwrap();
      toast.success(`Request sent to join "${previewWorkspace.name}"! Waiting for approval.`);
      setInviteCode('');
      setPreviewWorkspace(null);
      setDebouncedCode('');
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
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400 uppercase"
            placeholder="e.g. ABCD1234"
            required
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Enter the invite code to preview the workspace before joining.
          </p>
        </div>

        {debouncedCode && debouncedCode.length >= 4 && (
          <div className="min-h-[60px]">
            {workspaceLoading ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-gray-700">
                <FaSpinner className="animate-spin text-purple-500 text-lg" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Looking up workspace...</span>
              </div>
            ) : checkError ? (
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700/40">
                <FaTimes className="text-red-500 text-sm" />
                <span className="text-sm text-red-600 dark:text-red-400">{checkError}</span>
              </div>
            ) : previewWorkspace ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700/40">
                {previewWorkspace.logo ? (
                  <img
                    src={previewWorkspace.logo}
                    alt={previewWorkspace.name}
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: previewWorkspace.color || '#0d9488' }}
                  >
                    {previewWorkspace.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {previewWorkspace.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {previewWorkspace.industry || 'Workspace'} · {previewWorkspace.memberCount || 0} members
                  </p>
                </div>
                <FaCheckCircle className="text-green-500 text-lg flex-shrink-0" />
              </div>
            ) : null}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !previewWorkspace}
            className="flex-1 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 transition"
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
        onClick={() => { onClose(); onCreateWorkspace(); }}
        className="flex items-center gap-4 w-full px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition"
      >
        <div className="w-11 h-11 rounded-md bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
          <FaPlus className="text-lg" />
        </div>
        <span className="font-medium text-gray-700 dark:text-gray-200">Create Workspace</span>
      </button>
      <button
        onClick={() => { onClose(); onJoinWorkspace(); }}
        className="flex items-center gap-4 w-full px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition"
      >
        <div className="w-11 h-11 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
          <FaSignInAlt className="text-lg" />
        </div>
        <span className="font-medium text-gray-700 dark:text-gray-200">Join Workspace</span>
      </button>
    </div>
  </BottomSheet>
);

// ═════════════════════════════════════════════════════════════════════
//  Workspace Card — used for Owned and Joined lists
// ═════════════════════════════════════════════════════════════════════
const WorkspaceCard = ({ workspace, isOwner, userInfo }) => {
  const memberCount = workspace.members?.length || 0;
  const initials = workspace.initials || getInitials(workspace.name);

  const currentUserMembership = workspace.members?.find(
    (m) => getUserId(m.user) === String(userInfo?._id)
  );
  const membershipStatus = currentUserMembership?.status || 'active';
  const isPending = membershipStatus === 'pending';
  const isClickable = !isPending;
  const routePath = isOwner
    ? `/my-workspace/${workspace._id}`
    : `/workspace/${workspace._id}`;

  const CardWrapper = isClickable ? Link : 'div';
  const cardProps = isClickable ? { to: routePath } : {};

  const subtitle = [
    workspace.industry,
    `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <CardWrapper
      {...cardProps}
      className={`group flex items-center gap-3 px-3 sm:px-4 min-h-[58px] transition-colors ${
        isClickable
          ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04]'
          : 'opacity-60 cursor-default'
      }`}
    >
      {workspace.logo ? (
        <img
          src={workspace.logo}
          alt={workspace.name}
          className="w-9 h-9 rounded-md object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-700"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center text-white font-semibold text-[12px] flex-shrink-0"
          style={{ backgroundColor: workspace.color || '#0d9488' }}
        >
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {workspace.name}
          </p>
          {isOwner && (
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 px-1.5 py-0.5 rounded">
              Owner
            </span>
          )}
          {isPending && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
              <FaClock className="text-[9px]" /> Pending
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {subtitle}
        </p>
      </div>

      {isClickable && (
        <FaChevronRight className="flex-shrink-0 text-gray-300 dark:text-gray-600 text-[10px] group-hover:text-gray-400 dark:group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
      )}
    </CardWrapper>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Associate Card — workspaces where the user is an associate.
//
//  Associates enter the workspace shell just like permanent members.
//  Inside the workspace they only see:
//    - Projects they've been added to
//    - Chats they're part of
//    - Tasks assigned to them
//
//  The "Associate" badge + optional expiry come from their membership
//  record on this workspace.
// ═════════════════════════════════════════════════════════════════════
const AssociateCard = ({ workspace, userInfo }) => {
  const memberCount = workspace.members?.length || 0;
  const initials = workspace.initials || getInitials(workspace.name);

  const myMembership = workspace.members?.find(
    (m) => getUserId(m.user) === String(userInfo?._id)
  );

  const expiryLabel = myMembership?.accessExpiresAt
    ? `Expires ${formatExpiry(myMembership.accessExpiresAt)}`
    : null;

  const routePath = `/workspace/${workspace._id}`;

  const subtitle = [
    workspace.industry,
    `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`,
    expiryLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={routePath}
      className="group flex items-center gap-3 px-3 sm:px-4 min-h-[58px] transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04]"
    >
      {workspace.logo ? (
        <img
          src={workspace.logo}
          alt={workspace.name}
          className="w-9 h-9 rounded-md object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-700"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center text-white font-semibold text-[12px] flex-shrink-0"
          style={{ backgroundColor: workspace.color || '#0d9488' }}
        >
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {workspace.name}
          </p>
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            <FaUserShield className="text-[9px]" />
            Associate
          </span>
        </div>
        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {subtitle}
        </p>
      </div>

      <FaChevronRight className="flex-shrink-0 text-gray-300 dark:text-gray-600 text-[10px] group-hover:text-gray-400 dark:group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Quick Stats — Owned / Joined / Associates
// ═════════════════════════════════════════════════════════════════════
const QuickStats = ({ ownedCount, joinedCount, associatesCount }) => (
  <div className="grid grid-cols-3 gap-3 mb-6">
    <div className="bg-white dark:bg-[#161619] rounded-lg p-4 text-center border border-gray-100 dark:border-gray-800">
      <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{ownedCount}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Owned</p>
    </div>
    <div className="bg-white dark:bg-[#161619] rounded-lg p-4 text-center border border-gray-100 dark:border-gray-800">
      <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{joinedCount}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Joined</p>
    </div>
    <div className="bg-white dark:bg-[#161619] rounded-lg p-4 text-center border border-gray-100 dark:border-gray-800">
      <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{associatesCount}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Associates</p>
    </div>
  </div>
);

// ─── Empty state ────────────────────────────────────────────────────
const EmptyList = ({ icon: Icon = FaUsers, message = 'Nothing here yet.' }) => (
  <div className="flex flex-col items-center justify-center min-h-[120px] text-gray-400 dark:text-gray-500 px-4 py-8">
    <Icon className="text-3xl mb-2 opacity-30" />
    <p className="text-sm text-center">{message}</p>
  </div>
);

// ─── Column (desktop) ───────────────────────────────────────────────
const Column = ({ title, icon: Icon, iconColor = 'text-teal-500', count, children }) => (
  <div className="flex-1 flex flex-col min-h-0">
    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
      <Icon className={iconColor} />
      {title}
      <span className="ml-auto text-xs font-normal text-gray-400 dark:text-gray-500 tabular-nums">
        {count}
      </span>
    </h2>
    <div className="flex-1 bg-white dark:bg-[#161619] rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaces = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  // One query, three buckets:
  //   myBusinesses        → owned
  //   joinedBusinesses    → permanent member
  //   associateBusinesses → associate (already filtered for expiry server-side)
  const { data, isLoading, refetch } = useGetMyWorkspacesQuery(undefined, {
    pollingInterval: 30000,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showFabOptions, setShowFabOptions] = useState(false);
  const [activeTab, setActiveTab] = useState('owned');

  const myWorkspaces = data?.myBusinesses || [];
  const joinedWorkspaces = data?.joinedBusinesses || [];
  const associateWorkspaces = data?.associateBusinesses || [];

  const handleCreateSuccess = () => refetch();
  const handleJoinSuccess = () => refetch();

  // ─── Loading skeleton ────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <GlobalStyles />
        <MyWorkspacesSkeleton />
      </>
    );
  }

  const renderOwnedList = () => {
    if (myWorkspaces.length === 0) {
      return <EmptyList icon={FaUsers} message="No owned workspaces yet." />;
    }
    return (
      <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
        {myWorkspaces.map((ws) => (
          <WorkspaceCard key={ws._id} workspace={ws} isOwner userInfo={userInfo} />
        ))}
      </div>
    );
  };

  const renderJoinedList = () => {
    if (joinedWorkspaces.length === 0) {
      return <EmptyList icon={FaUsers} message="No joined workspaces yet." />;
    }
    return (
      <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
        {joinedWorkspaces.map((ws) => (
          <WorkspaceCard key={ws._id} workspace={ws} isOwner={false} userInfo={userInfo} />
        ))}
      </div>
    );
  };

  const renderAssociatesList = () => {
    if (associateWorkspaces.length === 0) {
      return (
        <EmptyList
          icon={FaUserShield}
          message="No associate workspaces yet. When someone adds you to a project, its workspace will show up here."
        />
      );
    }
    return (
      <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
        {associateWorkspaces.map((ws) => (
          <AssociateCard key={ws._id} workspace={ws} userInfo={userInfo} />
        ))}
      </div>
    );
  };

  return (
    <>
      <GlobalStyles />

      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 px-4 sm:px-6 h-14 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Workspaces</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowJoinModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition text-sm font-medium"
              >
                <FaSignInAlt className="text-sm" />
                <span className="hidden sm:inline">Join</span>
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition text-sm font-medium"
              >
                <FaUserCircle className="text-lg" />
                <span className="hidden sm:inline">Profile</span>
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-6 flex flex-col">
            <QuickStats
              ownedCount={myWorkspaces.length}
              joinedCount={joinedWorkspaces.length}
              associatesCount={associateWorkspaces.length}
            />

            {/* ─── Desktop: three equal columns ─────────────────── */}
            <div className="hidden md:flex md:flex-row md:items-stretch md:gap-4 flex-1 min-h-0">
              <Column title="Owned" icon={FaUserCheck} iconColor="text-teal-500" count={myWorkspaces.length}>
                {renderOwnedList()}
              </Column>
              <Column title="Joined" icon={FaUsers} iconColor="text-purple-500" count={joinedWorkspaces.length}>
                {renderJoinedList()}
              </Column>
              <Column title="Associates" icon={FaUserShield} iconColor="text-amber-500" count={associateWorkspaces.length}>
                {renderAssociatesList()}
              </Column>
            </div>

            {/* ─── Mobile: tabs ─────────────────────────────────── */}
            <div className="md:hidden">
              <div className="flex bg-gray-100 dark:bg-[#1c1c20] rounded-lg p-1 mb-4">
                <button
                  onClick={() => setActiveTab('owned')}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition ${
                    activeTab === 'owned'
                      ? 'bg-white dark:bg-[#0f0f12] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Owned ({myWorkspaces.length})
                </button>
                <button
                  onClick={() => setActiveTab('joined')}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition ${
                    activeTab === 'joined'
                      ? 'bg-white dark:bg-[#0f0f12] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Joined ({joinedWorkspaces.length})
                </button>
                <button
                  onClick={() => setActiveTab('associates')}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition ${
                    activeTab === 'associates'
                      ? 'bg-white dark:bg-[#0f0f12] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Associates ({associateWorkspaces.length})
                </button>
              </div>

              <div className="bg-white dark:bg-[#161619] rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                {activeTab === 'owned' && renderOwnedList()}
                {activeTab === 'joined' && renderJoinedList()}
                {activeTab === 'associates' && renderAssociatesList()}
              </div>
            </div>
          </main>

          <GeneralBottombar />

          <button
            onClick={() => setShowFabOptions(true)}
            className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-14 h-14 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg shadow-teal-600/25 flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
            aria-label="Create or join workspace"
          >
            <FaRocket className="text-2xl" />
          </button>
        </div>
      </div>

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