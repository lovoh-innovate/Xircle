// src/screens/AppVersions.jsx
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Capacitor } from '@capacitor/core';
import {
  useGetAppVersionsQuery,
  useUploadAppMutation,
  useUpdateAppVersionMutation,
  useDeleteAppVersionMutation,
  useCheckAppUpdateQuery,
} from '../slices/appApiSlice';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';
import {
  FaSpinner,
  FaCheck,
  FaTimes,
  FaEdit,
  FaTrashAlt,
  FaUpload,
  FaArchive,
  FaRedo,
  FaExclamationTriangle,
  FaInfoCircle,
  FaDownload,
  FaMobileAlt,
  FaAndroid,
  FaApple,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { downloadAppFile, isAndroidNative, isIosNative } from '../components/AppDownloadHandler';

const AppVersions = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const isAdmin = userInfo?.role === 'admin' || userInfo?.role === 'super_admin';
  const [downloadingId, setDownloadingId] = useState(null);

  // ── Queries ──
  const { data: versionsData, isLoading, refetch } = useGetAppVersionsQuery({ platform: 'android' });
  const { data: updateData } = useCheckAppUpdateQuery(
    {
      platform: 'android',
      currentVersion: userInfo?.appVersion || undefined,
      token: userInfo?.token,
    },
    { refetchOnMountOrArgChange: true }
  );

  const versions = versionsData?.data || [];

  // ── Mutations (admin only) ──
  const [uploadApp, { isLoading: isUploading }] = useUploadAppMutation();
  const [updateVersion, { isLoading: isUpdating }] = useUpdateAppVersionMutation();
  const [deleteVersion, { isLoading: isDeleting }] = useDeleteAppVersionMutation();

  // ── State ──
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ version: '', releaseNotes: '', isRequired: false, isActive: true });
  const [uploadForm, setUploadForm] = useState({ version: '', releaseNotes: '', isRequired: false, file: null });
  const [showUpload, setShowUpload] = useState(false);

  // ── Platform detection ──
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = isAndroidNative();
  const isIos = isIosNative();

  // ── Download Handler ──
  const handleDownload = async (versionId, version) => {
    if (downloadingId) {
      toast.error('Download already in progress');
      return;
    }

    setDownloadingId(versionId);
    
    try {
      const result = await downloadAppFile(versionId, userInfo?.token, version);
      
      if (isNative) {
        toast.success('Download started in browser! Check your downloads folder.', {
          duration: 5000,
        });
      } else {
        toast.success('Download started in your browser');
      }
      
    } catch (error) {
      console.error('Download error:', error);
      toast.error(error.message || 'Failed to open download. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Handlers ──
  const handleUpload = async (e) => {
    e.preventDefault();
    const { version, releaseNotes, isRequired, file } = uploadForm;
    if (!version || !file) {
      toast.error('Version and APK file are required.');
      return;
    }
    const formData = new FormData();
    formData.append('version', version);
    formData.append('releaseNotes', releaseNotes || '');
    formData.append('isRequired', isRequired);
    formData.append('platform', 'android');
    formData.append('apk', file);
    try {
      await uploadApp(formData).unwrap();
      toast.success('App version uploaded successfully!');
      setUploadForm({ version: '', releaseNotes: '', isRequired: false, file: null });
      setShowUpload(false);
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || 'Upload failed.');
    }
  };

  const handleUpdate = async (id) => {
    try {
      await updateVersion({ versionId: id, data: editData }).unwrap();
      toast.success('Version updated.');
      setEditingId(null);
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || 'Update failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this version permanently?')) return;
    try {
      await deleteVersion(id).unwrap();
      toast.success('Version deleted.');
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || 'Delete failed.');
    }
  };

  const startEdit = (version) => {
    setEditingId(version._id);
    setEditData({
      version: version.version,
      releaseNotes: version.releaseNotes || '',
      isRequired: version.isRequired || false,
      isActive: version.isActive !== undefined ? version.isActive : true,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const isUpdateAvailable = updateData?.hasUpdate || false;
  const isRequiredUpdate = updateData?.isRequired || false;
  const latestVersion = updateData?.version || null;
  const releaseNotes = updateData?.releaseNotes || '';

  // Get platform icon
  const getPlatformIcon = () => {
    if (isAndroid) return FaAndroid;
    if (isIos) return FaApple;
    return FaMobileAlt;
  };

  const PlatformIcon = getPlatformIcon();

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          {/* ─── Header ────────────────────────────────────────────── */}
          <header className="bg-white/95 dark:bg-[#0f0f12]/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0 sticky top-0 z-10 px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FaArchive className="text-teal-500" />
                App Versions
                {isUpdateAvailable && (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isRequiredUpdate ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    } flex items-center gap-1`}
                  >
                    <FaExclamationTriangle className="text-[10px]" />
                    {isRequiredUpdate ? 'Required Update' : 'New Update Available'}
                  </span>
                )}
                {isNative && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <PlatformIcon className="text-[10px]" />
                    {isAndroid ? 'Android' : isIos ? 'iOS' : 'Mobile'}
                  </span>
                )}
              </h1>
              {isAdmin && (
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 transition flex items-center gap-2 text-sm"
                >
                  <FaUpload />
                  {showUpload ? 'Cancel' : 'Upload New Version'}
                </button>
              )}
            </div>
          </header>

          {/* ─── Upload Form (admin only) ────────────────────────── */}
          {isAdmin && showUpload && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-b border-gray-200 dark:border-gray-800/40 bg-gray-50 dark:bg-[#1a1a24]"
            >
              <form onSubmit={handleUpload} className="max-w-2xl mx-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version *</label>
                    <input
                      type="text"
                      value={uploadForm.version}
                      onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
                      placeholder="e.g. 1.2.3"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-[#0b0b10] text-gray-800 dark:text-gray-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">APK File *</label>
                    <input
                      type="file"
                      accept=".apk"
                      onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                      className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-teal-50 dark:file:bg-teal-900/30 file:text-teal-600 dark:file:text-teal-400"
                      required
                    />
                    {uploadForm.file && (
                      <p className="text-xs text-gray-400 mt-1">Selected: {uploadForm.file.name} ({(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB)</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Release Notes</label>
                  <textarea
                    value={uploadForm.releaseNotes}
                    onChange={(e) => setUploadForm({ ...uploadForm, releaseNotes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-[#0b0b10] text-gray-800 dark:text-gray-200"
                    placeholder="What's new in this version?"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadForm({ ...uploadForm, isRequired: !uploadForm.isRequired })}
                    className={`relative w-12 h-7 rounded-full transition-colors ${uploadForm.isRequired ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${uploadForm.isRequired ? 'translate-x-5' : ''}`}
                    />
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {uploadForm.isRequired ? 'Required update' : 'Optional update'}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {isUploading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpload(false)}
                    className="py-2 px-4 border border-gray-300 dark:border-gray-700/60 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition text-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ─── Versions List ────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <FaSpinner className="animate-spin text-teal-500 text-3xl" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <FaArchive className="text-5xl mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No versions uploaded yet</p>
                <p className="text-sm">Check back later for updates.</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-4xl mx-auto">
                {versions.map((version) => {
                  const isEditing = editingId === version._id;
                  const isCurrentVersion = version.version === userInfo?.appVersion;
                  const isNewerVersion = updateData && version.version === updateData.version;
                  const isDownloading = downloadingId === version._id;

                  return (
                    <div
                      key={version._id}
                      className={`bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition ${
                        isNewerVersion && !isCurrentVersion ? 'border-orange-400/50 dark:border-orange-400/30' : ''
                      }`}
                    >
                      {isEditing && isAdmin ? (
                        // ── Edit mode (admin only) ──
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex-1 min-w-[120px]">
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Version</label>
                              <input
                                type="text"
                                value={editData.version}
                                onChange={(e) => setEditData({ ...editData, version: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg bg-gray-50 dark:bg-[#0b0b10] text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={editData.isRequired}
                                  onChange={(e) => setEditData({ ...editData, isRequired: e.target.checked })}
                                  className="accent-red-500"
                                />
                                Required
                              </label>
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={editData.isActive}
                                  onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                                  className="accent-teal-500"
                                />
                                Active
                              </label>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Release Notes</label>
                            <textarea
                              value={editData.releaseNotes}
                              onChange={(e) => setEditData({ ...editData, releaseNotes: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg bg-gray-50 dark:bg-[#0b0b10] text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdate(version._id)}
                              disabled={isUpdating}
                              className="px-4 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition text-sm flex items-center gap-1"
                            >
                              {isUpdating ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-4 py-1.5 border border-gray-300 dark:border-gray-700/60 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30 transition text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // ── View mode ──
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg">
                                v{version.version}
                              </span>
                              {version.isRequired && (
                                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <FaExclamationTriangle className="text-[10px]" />
                                  Required
                                </span>
                              )}
                              {!version.isRequired && (
                                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <FaCheck className="text-[10px]" />
                                  Optional
                                </span>
                              )}
                              {!version.isActive && (
                                <span className="text-xs bg-gray-100 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <FaArchive className="text-[10px]" />
                                  Inactive
                                </span>
                              )}
                              {isCurrentVersion && (
                                <span className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <FaCheck className="text-[10px]" />
                                  Current
                                </span>
                              )}
                              {isNewerVersion && !isCurrentVersion && (
                                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <FaRedo className="text-[10px]" />
                                  Update Available
                                </span>
                              )}
                            </div>
                            {version.releaseNotes && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{version.releaseNotes}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
                              <span>Uploaded: {formatDate(version.createdAt)}</span>
                              {version.fileName && (
                                <>
                                  <span>•</span>
                                  <button
                                    onClick={() => handleDownload(version._id, version.version)}
                                    disabled={isDownloading}
                                    className={`text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline flex items-center gap-1 transition ${
                                      isDownloading ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    {isDownloading ? (
                                      <>
                                        <FaSpinner className="animate-spin text-[10px]" />
                                        Opening browser...
                                      </>
                                    ) : (
                                      <>
                                        <FaDownload className="text-[10px]" />
                                        {isNative ? 'Download & Install' : 'Download APK'}
                                      </>
                                    )}
                                  </button>
                                  {isNative && !isDownloading && (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                      (Opens in Chrome)
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => startEdit(version)}
                                className="p-2 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30"
                                title="Edit"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => handleDelete(version._id)}
                                disabled={isDeleting}
                                className="p-2 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/30"
                                title="Delete"
                              >
                                {isDeleting ? <FaSpinner className="animate-spin" /> : <FaTrashAlt />}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
      <GeneralBottombar />
    </>
  );
};

export default AppVersions;