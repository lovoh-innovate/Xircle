// src/workspaceScreens/MyWorkspaceSettings.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetWorkspaceQuery,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useRegenerateInviteCodeMutation,
} from '../slices/workspaceApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaArrowLeft,
  FaSave,
  FaTimes,
  FaImage,
  FaTrashAlt,
  FaCopy,
  FaCheck,
  FaSpinner,
  FaExclamationTriangle,
  FaUsers,
  FaCalendarAlt,
  FaCog,
  FaPalette,
  FaInfoCircle,
  FaRedo,
  FaRocket,
  FaChevronRight,
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

// ─── Image Preview Modal ──────────────────────────────────────────────
const ImagePreviewModal = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full max-h-[90vh]">
        <img src={imageUrl} alt="Preview" className="w-full h-auto max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition"
        >
          <FaTimes className="text-xl" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const MyWorkspaceSettings = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#0d9488');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const { data: workspaceData, isLoading, error, refetch } = useGetWorkspaceQuery(workspaceId);
  const [updateWorkspace] = useUpdateWorkspaceMutation();
  const [deleteWorkspace] = useDeleteWorkspaceMutation();
  const [regenerateInviteCode] = useRegenerateInviteCodeMutation();

  useEffect(() => {
    if (workspaceData?.workspace) {
      const w = workspaceData.workspace;
      setName(w.name || '');
      setIndustry(w.industry || '');
      setDescription(w.description || '');
      setColor(w.color || '#0d9488');
      if (w.logo) setLogoPreview(w.logo);
    }
  }, [workspaceData]);

  const workspace = workspaceData?.workspace;
  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;

  if (error || (workspace && !isOwner)) {
    navigate(`/my-workspace/${workspaceId}`);
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  const brandColor = workspace.color || '#0d9488';
  const memberCount = workspace.members?.length || 0;
  const createdDate = new Date(workspace.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('industry', industry.trim());
      formData.append('description', description.trim());
      formData.append('color', color);
      if (logoFile) formData.append('logo', logoFile);
      else if (logoPreview === '' && workspace.logo) formData.append('logo', '');

      await updateWorkspace({ id: workspaceId, data: formData }).unwrap();
      toast.success('Workspace settings updated!');
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateInvite = async () => {
    if (!window.confirm('Regenerating the invite code will invalidate the previous code. Continue?')) return;
    setIsRegenerating(true);
    try {
      await regenerateInviteCode(workspaceId).unwrap();
      toast.success('Invite code regenerated!');
      refetch();
      setCopied(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to regenerate invite code');
    } finally {
      setIsRegenerating(false);
    }
  };

  const copyInviteCode = () => {
    if (workspace.inviteCode) {
      navigator.clipboard.writeText(workspace.inviteCode);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDeleteWorkspace = async () => {
    setIsDeleting(true);
    try {
      await deleteWorkspace(workspaceId).unwrap();
      toast.success('Workspace deleted!');
      navigate('/my-workspaces');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete workspace');
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Fixed Header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/40 flex-shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate(`/my-workspace/${workspaceId}`)}
                className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
              >
                <FaArrowLeft />
              </button>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Settings</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400">{memberCount} members</span>
              <FaUsers className="hidden sm:block text-sm text-gray-500 dark:text-gray-400" />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Workspace Info Card */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
                <FaInfoCircle className="text-[#0d9488]" /> General Information
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Workspace Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Industry</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Technology"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this workspace about?"
                    rows="2"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-white rounded-xl transition hover:opacity-80 disabled:opacity-50 text-sm font-medium"
                    style={{ backgroundColor: brandColor }}
                  >
                    {isSaving ? <FaSpinner className="animate-spin" /> : <FaSave className="text-sm" />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Branding Card */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
                <FaPalette className="text-[#0d9488]" /> Branding
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Brand Color</label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 rounded-xl border-2 border-gray-300 dark:border-gray-700/60 overflow-hidden">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="w-full h-full" style={{ backgroundColor: color }} />
                    </div>
                    <span className="text-sm font-mono text-gray-500 dark:text-gray-500">{color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Workspace Logo</label>
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="w-16 h-16 rounded-xl object-cover border-2 border-gray-300 dark:border-gray-700/60 cursor-pointer"
                          onClick={() => setPreviewImage(logoPreview)}
                        />
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition"
                        >
                          <FaTrashAlt className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700/60 rounded-xl cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-[#0b0b10]">
                        <FaImage className="text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Upload Logo</span>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoChange}
                          className="hidden"
                          accept="image/*"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">PNG, JPG, WebP (max 5MB)</p>
                </div>
              </div>
            </div>

            {/* Invite Code Card */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
                <FaRocket className="text-[#0d9488]" /> Invite Code
              </h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex-1 bg-gray-100 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl px-4 py-2.5">
                    <span className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200 tracking-wider">{workspace.inviteCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="p-2.5 bg-gray-100 dark:bg-[#0b0b10] hover:bg-gray-200 dark:hover:bg-gray-800/60 rounded-xl transition border border-gray-300 dark:border-gray-700/60 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    {copied ? <FaCheck className="text-green-500 dark:text-green-400" /> : <FaCopy className="text-sm" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateInvite}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl transition hover:opacity-80 disabled:opacity-50 text-sm font-medium"
                  style={{ backgroundColor: brandColor }}
                >
                  {isRegenerating ? <FaSpinner className="animate-spin" /> : <FaRedo className="text-sm" />}
                  {isRegenerating ? 'Generating...' : 'Regenerate'}
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-4">
                <FaExclamationTriangle className="text-red-500" /> Danger Zone
              </h2>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mb-3">Deleting this workspace is irreversible.</p>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition"
                >
                  Delete Workspace
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-red-800 dark:text-red-300 font-medium">Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleDeleteWorkspace}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-700 text-white rounded-xl text-sm font-medium hover:bg-red-800 transition disabled:opacity-50"
                  >
                    {isDeleting ? <FaSpinner className="animate-spin" /> : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation (mobile) */}
      <MyWorkspaceBottombar workspace={workspace} />

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  );
};

export default MyWorkspaceSettings;