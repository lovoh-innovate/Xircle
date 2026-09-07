// pages/Sticker.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useGetStickersQuery,
  useGetSavedStickersQuery,
  useCreateStickerMutation,
  useDeleteStickerMutation,
  useSaveStickerMutation,
  useUnsaveStickerMutation,
} from '../slices/stickerApiSlice';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { ConfirmModal } from '../components/ProjectHelpers'; // 👈 custom modal
import { toast } from 'react-hot-toast';
import {
  FaArrowLeft,
  FaPlus,
  FaSpinner,
  FaTrash,
  FaSave,
  FaTimes,
  FaTags,
  FaImage,
  FaVideo,
  FaSearch,
  FaRegSave,
  FaUser,
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Bottom Sheet (reused from GeneralChats) ──────────────────────
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

// ─── Create Sticker Modal (Capacitor‑ready) ────────────────────────
const CreateStickerModal = ({ isOpen, onClose, onSuccess }) => {
  const [createSticker, { isLoading }] = useCreateStickerMutation();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [type, setType] = useState('image');
  const [duration, setDuration] = useState('');
  const [tags, setTags] = useState('');

  const { files, pickMedia, setFiles } = useMediaPicker();

  useEffect(() => {
    if (files.length > 0) {
      const selected = files[0];
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreview(url);
      setFiles([]);
    }
  }, [files, setFiles]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFilePick = () => {
    pickMedia({ 
      multiple: false, 
      mediaType: 'image'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a sticker file.');
      return;
    }

    const formData = new FormData();
    formData.append('stickerFile', file);
    formData.append('type', type);
    if (type === 'animated' && duration) {
      formData.append('duration', duration);
    }
    if (tags.trim()) {
      formData.append('tags', tags.trim());
    }

    try {
      const result = await createSticker(formData).unwrap();
      toast.success('Sticker created!');
      onSuccess(result.sticker);
      onClose();
      setFile(null);
      setPreview(null);
      setType('image');
      setDuration('');
      setTags('');
      setFiles([]);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create sticker.');
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            <FaPlus className="inline mr-2 text-teal-500" /> Create Sticker
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sticker File
            </label>
            <button
              type="button"
              onClick={handleFilePick}
              className="flex items-center justify-center w-full px-4 py-3 bg-gray-100 dark:bg-[#2a2a2a] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-teal-500 dark:hover:border-teal-500 transition text-gray-700 dark:text-gray-300"
            >
              {file ? (
                <span className="flex items-center gap-2">
                  <FaImage /> {file.name}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FaImage /> Tap to select image or video
                </span>
              )}
            </button>
            {preview && (
              <div className="mt-2 relative w-24 h-24">
                {type === 'image' ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <video src={preview} className="w-full h-full object-cover rounded-lg" muted />
                )}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Supports PNG, JPG, GIF, MP4, WebP</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setType('image')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  type === 'image'
                    ? 'bg-teal-600 text-white dark:bg-teal-500'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <FaImage className="inline mr-2" /> Image
              </button>
              <button
                type="button"
                onClick={() => setType('animated')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  type === 'animated'
                    ? 'bg-teal-600 text-white dark:bg-teal-500'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <FaVideo className="inline mr-2" /> Animated
              </button>
            </div>
          </div>

          {type === 'animated' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (seconds, max 6)
              </label>
              <input
                type="number"
                min="0"
                max="6"
                step="0.1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
                placeholder="e.g. 3.5"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
              placeholder="funny, hello, reaction"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !file}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? <FaSpinner className="animate-spin" /> : 'Create Sticker'}
          </button>
        </form>
      </div>
    </BottomSheet>
  );
};

// ─── Sticker Card ──────────────────────────────────────────────────
const StickerCard = ({
  sticker,
  userId,
  onDeleteRequest,  // 👈 renamed from onDelete
  onSave,
  onUnsave,
  isSaved = false,
  isOwner = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleDeleteClick = () => {
    // Open confirm modal instead of window.confirm
    onDeleteRequest(sticker._id);
  };

  const handleToggleSave = async () => {
    setIsSaving(true);
    try {
      if (isSaved) {
        await onUnsave(sticker._id);
      } else {
        await onSave(sticker._id);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm hover:shadow-md transition border border-gray-200 dark:border-gray-700 overflow-hidden group">
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
        {sticker.type === 'image' ? (
          <img
            src={sticker.fileUrl}
            alt="sticker"
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            src={sticker.fileUrl}
            className="w-full h-full object-contain"
            muted
            loop
            autoPlay
          />
        )}
        {sticker.duration > 0 && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            {sticker.duration}s
          </span>
        )}
      </div>

      {sticker.tags && sticker.tags.length > 0 && (
        <div className="px-3 py-1.5 flex flex-wrap gap-1 border-t border-gray-100 dark:border-gray-800">
          {sticker.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full"
            >
              #{tag}
            </span>
          ))}
          {sticker.tags.length > 3 && (
            <span className="text-[10px] text-gray-400">+{sticker.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 md:opacity-0 md:group-hover:opacity-100">
        {isOwner ? (
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition disabled:opacity-50"
            title="Delete"
          >
            {isDeleting ? <FaSpinner className="animate-spin" /> : <FaTrash />}
          </button>
        ) : (
          <button
            onClick={handleToggleSave}
            disabled={isSaving}
            className={`p-2 rounded-full transition ${
              isSaved
                ? 'bg-teal-500 hover:bg-teal-600 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            }`}
            title={isSaved ? 'Unsave' : 'Save'}
          >
            {isSaving ? <FaSpinner className="animate-spin" /> : isSaved ? <FaSave /> : <FaRegSave />}
          </button>
        )}
      </div>

      <div className="absolute bottom-2 right-2 md:hidden flex gap-1">
        {isOwner ? (
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="p-1.5 bg-red-500 text-white rounded-full text-xs"
          >
            {isDeleting ? <FaSpinner className="animate-spin" /> : <FaTrash />}
          </button>
        ) : (
          <button
            onClick={handleToggleSave}
            disabled={isSaving}
            className={`p-1.5 rounded-full text-xs ${
              isSaved ? 'bg-teal-500 text-white' : 'bg-white/80 text-gray-700'
            }`}
          >
            {isSaving ? <FaSpinner className="animate-spin" /> : isSaved ? <FaSave /> : <FaRegSave />}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
const Sticker = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const userId = userInfo?._id;

  const [activeTab, setActiveTab] = useState('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ─── Confirm Modal state ──────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: false,
  });

  // ─── Queries ──────────────────────────────────────────────────────
  const {
    data: savedData,
    isLoading: savedLoading,
    refetch: refetchSaved,
  } = useGetSavedStickersQuery(undefined, {
    refetchOnFocus: true,
  });

  const {
    data: allData,
    isLoading: allLoading,
    refetch: refetchAll,
  } = useGetStickersQuery({ limit: 100 }, { refetchOnFocus: true });

  // ─── Mutations ──────────────────────────────────────────────────
  const [deleteSticker] = useDeleteStickerMutation();
  const [saveSticker] = useSaveStickerMutation();
  const [unsaveSticker] = useUnsaveStickerMutation();

  const savedStickers = savedData?.stickers || [];
  const allStickers = allData?.stickers || [];

  const filterBySearch = (stickers) => {
    if (!searchQuery.trim()) return stickers;
    const q = searchQuery.toLowerCase().trim();
    return stickers.filter((s) =>
      s.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  };

  const filteredSaved = useMemo(
    () => filterBySearch(savedStickers),
    [savedStickers, searchQuery]
  );
  const filteredAll = useMemo(
    () => filterBySearch(allStickers),
    [allStickers, searchQuery]
  );

  // ─── Delete handler with custom modal ──────────────────────────
  const handleDeleteRequest = (stickerId) => {
    const sticker = allStickers.find(s => s._id === stickerId) || savedStickers.find(s => s._id === stickerId);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Sticker',
      message: `Are you sure you want to delete "${sticker?.tags?.[0] || 'this'}" sticker? This cannot be undone.`,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteSticker(stickerId).unwrap();
          toast.success('Sticker deleted.');
          refetchSaved();
          refetchAll();
        } catch (err) {
          toast.error(err?.data?.message || 'Delete failed.');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  const handleSave = async (stickerId) => {
    try {
      await saveSticker(stickerId).unwrap();
      toast.success('Saved to collection.');
      refetchSaved();
      refetchAll();
    } catch (err) {
      toast.error(err?.data?.message || 'Save failed.');
    }
  };

  const handleUnsave = async (stickerId) => {
    try {
      await unsaveSticker(stickerId).unwrap();
      toast.success('Removed from collection.');
      refetchSaved();
      refetchAll();
    } catch (err) {
      toast.error(err?.data?.message || 'Unsave failed.');
    }
  };

  const handleCreateSuccess = (newSticker) => {
    refetchSaved();
    refetchAll();
  };

  const isLoading = (activeTab === 'saved' ? savedLoading : allLoading);

  const renderStickers = (stickers, isSavedView = false) => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      );
    }

    if (stickers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
          <FaImage className="text-5xl mb-4 opacity-30" />
          <p className="text-lg font-medium">No stickers found</p>
          <p className="text-sm">
            {activeTab === 'saved'
              ? 'Save some stickers to see them here.'
              : 'Be the first to create a sticker!'}
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {stickers.map((sticker) => {
          const isSaved = savedStickers.some((s) => s._id === sticker._id);
          const isOwner = sticker.createdBy === userId;
          return (
            <StickerCard
              key={sticker._id}
              sticker={sticker}
              userId={userId}
              onDeleteRequest={handleDeleteRequest}
              onSave={handleSave}
              onUnsave={handleUnsave}
              isSaved={isSaved}
              isOwner={isOwner}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col h-screen md:h-auto md:min-h-screen relative overflow-hidden">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 flex-shrink-0 z-10">
            <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-full transition"
                  aria-label="Go back"
                >
                  <FaArrowLeft className="text-gray-600 dark:text-gray-300" />
                </button>
                <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Stickers
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-2 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-full transition active:scale-95"
                  aria-label="Create sticker"
                >
                  <FaPlus />
                </button>
              </div>
            </div>
          </header>

          <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 flex-shrink-0 gap-3 flex-wrap">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab('saved')}
                className={`text-sm font-medium transition ${
                  activeTab === 'saved'
                    ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400 pb-1'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <FaSave className="inline mr-1.5" /> My Stickers
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`text-sm font-medium transition ${
                  activeTab === 'all'
                    ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400 pb-1'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <FaTags className="inline mr-1.5" /> All Stickers
              </button>
            </div>

            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-40 sm:w-56 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-[#0f0f12]">
            {activeTab === 'saved'
              ? renderStickers(filteredSaved, true)
              : renderStickers(filteredAll, false)}
          </main>

          <GeneralBottombar />
        </div>
      </div>

      {/* ─── Custom Confirm Modal ────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />

      {/* ─── Create Sticker Modal ────────────────────────────────── */}
      <CreateStickerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
};

export default Sticker;