// screens/UploadApp.jsx
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useGetAppVersionsQuery,
  useUploadAppMutation,
  useDeleteAppVersionMutation,
  useUpdateAppVersionMutation,
} from '../slices/appApiSlice';
import { toast } from 'react-hot-toast';
import {
  FaUpload,
  FaTrash,
  FaEdit,
  FaSpinner,
  FaCheck,
  FaTimes,
  FaPlus,
  FaDownload,
  FaFolderOpen,
  FaExclamationTriangle,
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

// ─── Upload Form ──────────────────────────────────────────────────
const UploadFormContent = ({ onClose, onSuccess }) => {
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadApp, { isLoading }] = useUploadAppMutation();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (ext !== 'apk' && ext !== 'aab') {
        toast.error('Only APK and AAB files are allowed.');
        e.target.value = '';
        setFile(null);
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!version.trim()) {
      toast.error('Version number is required.');
      return;
    }
    if (!file) {
      toast.error('Please select an APK or AAB file.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('version', version.trim());
      formData.append('releaseNotes', releaseNotes.trim());
      formData.append('isRequired', isRequired ? 'true' : 'false');
      formData.append('platform', 'android');
      formData.append('file', file);

      await uploadApp(formData).unwrap();
      toast.success(`Version ${version} uploaded successfully!`);
      onSuccess();
      onClose();
      // Reset form
      setVersion('');
      setReleaseNotes('');
      setIsRequired(false);
      setFile(null);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to upload app version.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          <FaUpload className="inline mr-2 text-teal-500" /> Upload New Version
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
          <FaTimes />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Version * (e.g. 1.2.3)
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.2.3"
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Release Notes
          </label>
          <textarea
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            rows="3"
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
            placeholder="What's new in this version..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            APK / AAB File *
          </label>
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-teal-500 transition">
              <FaFolderOpen className="text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {file ? file.name : 'Choose file...'}
              </span>
              <input
                type="file"
                accept=".apk,.aab"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => { setFile(null); }}
                className="text-red-500 hover:text-red-700 transition"
              >
                <FaTimes />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Supported: .apk, .aab (max 200MB)</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isRequired"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500"
          />
          <label htmlFor="isRequired" className="text-sm text-gray-700 dark:text-gray-300">
            <span className="text-red-500 font-medium">Required</span> – users must update to continue
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {isLoading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
            {isLoading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Edit Form ────────────────────────────────────────────────────
const EditFormContent = ({ version, onClose, onSuccess }) => {
  const [editVersion, setEditVersion] = useState(version?.version || '');
  const [releaseNotes, setReleaseNotes] = useState(version?.releaseNotes || '');
  const [isRequired, setIsRequired] = useState(version?.isRequired || false);
  const [isActive, setIsActive] = useState(version?.isActive !== undefined ? version.isActive : true);
  const [updateAppVersion, { isLoading }] = useUpdateAppVersionMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editVersion.trim()) {
      toast.error('Version number is required.');
      return;
    }
    try {
      await updateAppVersion({
        versionId: version._id,
        data: {
          version: editVersion.trim(),
          releaseNotes: releaseNotes.trim(),
          isRequired,
          isActive,
        },
      }).unwrap();
      toast.success('Version updated successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update version.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          <FaEdit className="inline mr-2 text-teal-500" /> Edit Version
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
          <FaTimes />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Version *
          </label>
          <input
            type="text"
            value={editVersion}
            onChange={(e) => setEditVersion(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Release Notes
          </label>
          <textarea
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            rows="3"
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="editIsRequired"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500"
          />
          <label htmlFor="editIsRequired" className="text-sm text-gray-700 dark:text-gray-300">
            <span className="text-red-500 font-medium">Required</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="editIsActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-teal-500 focus:ring-teal-500"
          />
          <label htmlFor="editIsActive" className="text-sm text-gray-700 dark:text-gray-300">
            Active (visible to users)
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {isLoading ? <FaSpinner className="animate-spin" /> : <FaCheck />}
            {isLoading ? 'Saving...' : 'Update'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Confirmation Modal ──────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, danger = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          {danger && <FaExclamationTriangle className="text-red-500 text-xl" />}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Version Card ─────────────────────────────────────────────────
const VersionCard = ({ version, onEdit, onDelete }) => {
  const isActive = version.isActive !== false;
  const isRequired = version.isRequired || false;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors border-b border-gray-100 dark:border-gray-800">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-800 dark:text-white">
            v{version.version}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
          {isRequired && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Required
            </span>
          )}
        </div>
        {version.releaseNotes && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {version.releaseNotes}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
          <span>{new Date(version.createdAt).toLocaleDateString()}</span>
          <span>•</span>
          <span>{Math.round(version.fileSize / 1024 / 1024)} MB</span>
          <span>•</span>
          <span className="truncate max-w-[120px]">{version.fileName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onEdit(version)}
          className="p-2 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <FaEdit className="text-sm" />
        </button>
        <button
          onClick={() => onDelete(version)}
          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <FaTrash className="text-sm" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
const UploadApp = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const isAdmin = userInfo?.role === 'admin' || userInfo?.role === 'super_admin';

  // ─── Redirect if not admin ──────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) {
      toast.error('Access denied. Admin privileges required.');
      navigate('/my-workspaces');
    }
  }, [isAdmin, navigate]);

  // ─── State ──────────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editVersion, setEditVersion] = useState(null);
  const [deleteVersion, setDeleteVersion] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ─── API hooks ─────────────────────────────────────────────────
  const { data: versionsData, isLoading, refetch } = useGetAppVersionsQuery({ platform: 'android' });
  const [deleteAppVersion, { isLoading: deleting }] = useDeleteAppVersionMutation();

  const versions = versionsData?.data || [];

  const handleDeleteConfirm = async () => {
    if (!deleteVersion) return;
    try {
      await deleteAppVersion(deleteVersion._id).unwrap();
      toast.success(`Version ${deleteVersion.version} deleted.`);
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete version.');
    } finally {
      setDeleteVersion(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleUploadSuccess = () => {
    refetch();
  };

  const handleEditSuccess = () => {
    refetch();
  };

  if (!isAdmin) {
    return null; // Will redirect via useEffect
  }

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
                App Version Manager
              </h1>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 dark:bg-teal-500 text-white hover:bg-teal-700 dark:hover:bg-teal-600 transition"
              >
                <FaPlus className="text-sm" />
                <span className="text-sm font-medium">Upload New</span>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12]">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <FaSpinner className="animate-spin text-teal-500 text-3xl" />
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                <FaUpload className="text-5xl mb-4 opacity-20" />
                <p className="text-sm">No app versions uploaded yet.</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-3 text-sm text-teal-500 hover:underline"
                >
                  Upload your first version →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {versions.map((v) => (
                  <VersionCard
                    key={v._id}
                    version={v}
                    onEdit={(ver) => setEditVersion(ver)}
                    onDelete={(ver) => {
                      setDeleteVersion(ver);
                      setShowDeleteConfirm(true);
                    }}
                  />
                ))}
              </div>
            )}
          </main>

          <GeneralBottombar />
        </div>
      </div>

      {/* Upload Modal */}
      <BottomSheet isOpen={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <UploadFormContent
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />
      </BottomSheet>

      {/* Edit Modal */}
      <BottomSheet isOpen={!!editVersion} onClose={() => setEditVersion(null)}>
        <EditFormContent
          version={editVersion}
          onClose={() => setEditVersion(null)}
          onSuccess={handleEditSuccess}
        />
      </BottomSheet>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteVersion(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Version"
        message={`Are you sure you want to delete version ${deleteVersion?.version}? This action cannot be undone.`}
        danger={true}
      />
    </>
  );
};

export default UploadApp;