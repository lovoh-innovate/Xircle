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
  FiArrowLeft,
  FiSave,
  FiX,
  FiImage,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiLoader,
  FiAlertTriangle,
  FiHome,
  FiUsers,
  FiCalendar,
  FiSettings,
  FiDroplet,
  FiInfo,
  FiRefreshCw,
} from 'react-icons/fi';
import { FaRocket } from 'react-icons/fa';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full max-h-[90vh]">
        <img src={imageUrl} alt="Preview" className="w-full h-auto max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition"
        >
          <FiX className="text-xl" />
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

  // ── State ──
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // ── Queries ──
  const { data: workspaceData, isLoading, error, refetch } = useGetWorkspaceQuery(workspaceId);
  const [updateWorkspace] = useUpdateWorkspaceMutation();
  const [deleteWorkspace] = useDeleteWorkspaceMutation();
  const [regenerateInviteCode] = useRegenerateInviteCodeMutation();

  // ── Populate form when data loads ──
  useEffect(() => {
    if (workspaceData?.workspace) {
      const w = workspaceData.workspace;
      setName(w.name || '');
      setIndustry(w.industry || '');
      setDescription(w.description || '');
      setColor(w.color || '#4F46E5');
      if (w.logo) setLogoPreview(w.logo);
    }
  }, [workspaceData]);

  // ── Redirect if not owner ──
  const workspace = workspaceData?.workspace;
  const isOwner = workspace?.owner?._id === userInfo?._id || workspace?.owner === userInfo?._id;

  if (error || (workspace && !isOwner)) {
    navigate(`/my-workspace/${workspaceId}`);
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  const brandColor = workspace.color || '#4F46E5';
  const memberCount = workspace.members?.length || 0;
  const channelCount = workspaceData?.chats?.length || 0;
  const createdDate = new Date(workspace.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ─── Handle logo change ──────────────────────────────────────────────
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

  // ─── Save settings ──────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('industry', industry.trim());
      formData.append('description', description.trim());
      formData.append('color', color);
      if (logoFile) {
        formData.append('logo', logoFile);
      } else if (logoPreview === '' && workspace.logo) {
        formData.append('logo', '');
      }

      await updateWorkspace({ id: workspaceId, data: formData }).unwrap();
      toast.success('Workspace settings updated!');
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Regenerate invite code ──────────────────────────────────────────
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

  // ─── Copy invite code ──────────────────────────────────────────────
  const copyInviteCode = () => {
    if (workspace.inviteCode) {
      navigator.clipboard.writeText(workspace.inviteCode);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // ─── Delete workspace ──────────────────────────────────────────────
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Desktop Sidebar (fixed) ── */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 fixed top-0 left-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 md:ml-64 overflow-y-auto pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
          
          {/* ── Header with subtle gradient ── */}
          <div className="relative mb-8 overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-white to-gray-50 border border-gray-200/60 shadow-sm">
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(`/my-workspace/${workspaceId}`)}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-gray-600 hover:text-gray-800"
                >
                  <FiArrowLeft className="text-lg" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FiSettings className="text-2xl" style={{ color: brandColor }} />
                    Settings
                  </h1>
                  <p className="text-gray-500 text-sm">Manage your workspace preferences</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-4 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600 border border-gray-200/60">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                  {memberCount} members
                </span>
                <span className="px-4 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600 border border-gray-200/60">
                  <FiCalendar className="inline mr-2" /> {createdDate}
                </span>
              </div>
            </div>

            {/* Brand accent glow */}
            <div
              className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-10"
              style={{ backgroundColor: brandColor }}
            ></div>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Members', value: memberCount, icon: FiUsers },
              { label: 'Channels', value: channelCount || 0, icon: FiHome },
              { label: 'Invite Code', value: workspace.inviteCode, icon: FaRocket, isCode: true },
              { label: 'Created', value: createdDate, icon: FiCalendar },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200/60 rounded-xl p-4 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition">
                    <stat.icon className="text-lg" style={{ color: brandColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{stat.label}</p>
                    {stat.isCode ? (
                      <p className="text-sm font-mono font-bold text-gray-900 truncate">{stat.value}</p>
                    ) : (
                      <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Settings Form ── */}
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* ── Two columns: General & Branding ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* General Information */}
              <div className="bg-white border border-gray-200/60 rounded-xl p-6 hover:shadow-sm transition">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <FiInfo className="text-lg" style={{ color: brandColor }} />
                  General Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Workspace Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm transition"
                      style={{ '--tw-ring-color': brandColor }}
                      onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Industry</label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Technology"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm transition"
                      style={{ '--tw-ring-color': brandColor }}
                      onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What's this workspace about?"
                      rows="2"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm transition resize-none"
                      style={{ '--tw-ring-color': brandColor }}
                      onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
                    />
                  </div>
                </div>
              </div>

              {/* Branding */}
              <div className="bg-white border border-gray-200/60 rounded-xl p-6 hover:shadow-sm transition">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <FiDroplet className="text-lg" style={{ color: brandColor }} />
                  Branding
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Brand Color</label>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-xl border-2 border-gray-200 overflow-hidden transition hover:scale-105"
                        style={{ backgroundColor: color }}
                      >
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="w-full h-full cursor-pointer opacity-0"
                        />
                      </div>
                      <span className="text-sm font-mono text-gray-500">{color}</span>
                      <div
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 16px ${color}44` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Workspace Logo</label>
                    <div className="flex items-center gap-4">
                      {logoPreview ? (
                        <div className="relative group/logo">
                          <img
                            src={logoPreview}
                            alt="Logo"
                            className="w-16 h-16 rounded-xl object-cover border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition"
                            onClick={() => setPreviewImage(logoPreview)}
                          />
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-3 px-5 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 transition bg-gray-50">
                          <FiImage className="text-gray-400" />
                          <span className="text-sm text-gray-500">Upload Logo</span>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleLogoChange}
                            className="hidden"
                            accept="image/*"
                          />
                        </label>
                      )}
                      <p className="text-xs text-gray-400">PNG, JPG, WebP (max 5MB)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Invite Code ── */}
            <div className="bg-white border border-gray-200/60 rounded-xl p-6 hover:shadow-sm transition">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                    <FaRocket className="text-2xl" style={{ color: brandColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">Invite Code</h3>
                    <p className="text-xs text-gray-500">Share this code with new members</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                    <span className="text-lg font-mono font-bold text-gray-900 tracking-wider">{workspace.inviteCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition border border-gray-200 group/copy"
                  >
                    {copied ? <FiCheck className="text-green-500" /> : <FiCopy className="text-gray-500 group-hover/copy:text-gray-700" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateInvite}
                    disabled={isRegenerating}
                    className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl transition hover:opacity-90 disabled:opacity-50 text-sm font-medium"
                    style={{ backgroundColor: brandColor }}
                  >
                    {isRegenerating ? <FiLoader className="animate-spin" /> : <FiRefreshCw className="text-sm" />}
                    {isRegenerating ? 'Generating...' : 'Regenerate'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Danger Zone ── */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 hover:bg-red-100/50 transition">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                    <FiAlertTriangle className="text-2xl text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
                    <p className="text-xs text-red-600/70">Deleting this workspace is irreversible</p>
                  </div>
                </div>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition"
                  >
                    Delete Workspace
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-red-700 font-medium">Are you sure?</span>
                    <button
                      type="button"
                      onClick={handleDeleteWorkspace}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-700 text-white rounded-xl text-sm font-medium hover:bg-red-800 transition disabled:opacity-50"
                    >
                      {isDeleting ? <FiLoader className="animate-spin" /> : 'Yes, Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Save Button ── */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-3 px-8 py-3.5 text-white rounded-xl transition hover:opacity-90 disabled:opacity-50 text-sm font-medium shadow-md"
                style={{ backgroundColor: brandColor, boxShadow: `0 4px 12px ${brandColor}44` }}
              >
                {isSaving ? <FiLoader className="animate-spin" /> : <FiSave className="text-lg" />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Bottom Navigation (mobile & tablet) ── */}
      <MyWorkspaceBottombar workspace={workspace} />

      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
};

export default MyWorkspaceSettings;