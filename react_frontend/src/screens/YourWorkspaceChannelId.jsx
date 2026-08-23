// src/workspaceScreens/YourWorkspaceChannelId.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetUserChatsQuery,
  useGetChatMessagesQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
  useArchiveMessageMutation,
  useUnarchiveMessageMutation,
  useStarMessageMutation,
  useUnstarMessageMutation,
  useAddParticipantMutation,
  useRemoveParticipantMutation,
  useMakeGroupAdminMutation,
  useRemoveGroupAdminMutation,
  useArchiveChatMutation,
  useUnarchiveChatMutation,
  useExitGroupChatMutation,
  useDeleteGroupChatMutation,
} from '../slices/messagingApiSlice';
import { useGetMembersQuery } from '../slices/teamApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import { useInitiateCallMutation } from '../slices/callApiSlice';
import {
  FaHashtag,
  FaArrowLeft,
  FaComment,
  FaPaperPlane,
  FaPaperclip,
  FaImage,
  FaCheck,
  FaRegClock,
  FaPhone,
  FaVideo,
  FaMicrophone,
  FaStop,
  FaTimes,
  FaDownload,
  FaPlay,
  FaPause,
  FaCheckCircle,
  FaEllipsisV,
  FaTrashAlt,
  FaLock,
  FaChevronUp,
  FaChevronDown,
  FaUserPlus,
  FaUserMinus,
  FaCrown,
  FaArchive,
  FaUndo,
  FaStar,
  FaRegStar,
  FaSignOutAlt,
  FaPen,
  FaSearch,
  FaSpinner,
  FaExclamationTriangle,
  FaReply,
  FaFile,
  FaUsers,
  FaCamera,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { useSocket } from '../components/SocketContext.jsx';

// ─── Capacitor Imports ──────────────────────────────────────────────
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { VoiceRecorder } from 'capacitor-voice-recorder';

// ─── Helper: base64 to File ─────────────────────────────────────────
const base64ToFile = (base64Data, fileName, mimeType) => {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
};

// ─── Helper: Format time ──────────────────────────────────────────────
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const SEEN_TICK_COLOR = '#34B7F1';
const SWIPE_REPLY_THRESHOLD = 60;
const SWIPE_REPLY_MAX = 72;

// ─── Safe date formatter ────────────────────────────────────────────
const safeFormatTime = (dateString) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// ─── Media Query hook ──────────────────────────────────────────────────
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

// ─── Skeleton Message Component (copied from GeneralChatId) ────────────
const SkeletonMessage = ({ isOwn }) => {
  const randomWidth = useCallback(() => {
    const widths = ["w-32", "w-40", "w-48", "w-52", "w-56", "w-36", "w-44", "w-60"];
    return widths[Math.floor(Math.random() * widths.length)];
  }, []);
  const randomHeight = useCallback(() => {
    const heights = ["h-8", "h-10", "h-12", "h-9", "h-11"];
    return heights[Math.floor(Math.random() * heights.length)];
  }, []);

  return (
    <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""} animate-pulse`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-700" />
      )}
      <div className={`max-w-[75%] sm:max-w-[85%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {!isOwn && (
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded-full mb-0.5" />
        )}
        <div className={`px-4 py-2.5 rounded-2xl ${isOwn ? "bg-teal-200/60 dark:bg-teal-700/40" : "bg-gray-200 dark:bg-gray-700/60"}`}>
          <div className={`${randomWidth()} ${randomHeight()} rounded-lg`} />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="w-8 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="w-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    </div>
  );
};

const SkeletonMessages = ({ count = 6 }) => {
  return (
    <div className="space-y-4 pt-4">
      {/* Date divider skeleton */}
      <div className="flex justify-center my-3">
        <div className="w-24 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      </div>
      {Array.from({ length: count }).map((_, i) => {
        const isOwn = i % 2 === 0;
        if (i === 3) {
          return (
            <React.Fragment key={i}>
              <div className="flex justify-center my-3">
                <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              </div>
              <SkeletonMessage isOwn={isOwn} />
            </React.Fragment>
          );
        }
        return <SkeletonMessage key={i} isOwn={isOwn} />;
      })}
    </div>
  );
};

// ─── Media Picker Modal (custom bottom sheet) ──────────────────────
const MediaPickerModal = ({ isOpen, onClose, onTakePhoto, onChooseFromGallery, brandColor }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] rounded-t-2xl w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Choose Media
        </h3>
        <div className="space-y-2">
          <button
            onClick={onTakePhoto}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaCamera className="text-sm" />
            <span className="text-sm font-medium">Take Photo</span>
          </button>
          <button
            onClick={onChooseFromGallery}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaImage className="text-sm" />
            <span className="text-sm font-medium">Choose from Gallery</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Image Preview Modal for attachments ──────────────────────────────
const AttachmentPreviewModal = ({ 
  isOpen, 
  onClose, 
  previewData, 
  onSend, 
  onRemove,
  brandColor 
}) => {
  if (!isOpen || !previewData) return null;

  const { file, preview, type, name } = previewData;
  const isImage = type === 'image';
  const isVideo = type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800/60">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {isImage ? 'Image Preview' : isVideo ? 'Video Preview' : 'File Preview'}
          </h3>
          <button 
            onClick={onRemove}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="p-4 flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10] max-h-[60vh] overflow-auto">
          {isImage && (
            <img 
              src={preview} 
              alt="Preview" 
              className="max-w-full max-h-[50vh] object-contain rounded-lg"
            />
          )}
          {isVideo && (
            <video 
              src={preview} 
              controls 
              className="max-w-full max-h-[50vh] rounded-lg"
            />
          )}
          {!isImage && !isVideo && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                <FaFile className="text-3xl text-gray-500 dark:text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{name || 'File'}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : ''}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-800/60">
          <button 
            onClick={onRemove}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSend(previewData)}
            className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80"
            style={{ backgroundColor: brandColor }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Confirm Modal ──────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          {danger && <FaExclamationTriangle className="text-red-500 text-xl" />}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 dark:bg-[#0d9488] hover:bg-teal-700 dark:hover:bg-[#0f9e96]'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Prompt Modal ──────────────────────────────────────────────────
const PromptModal = ({ isOpen, onClose, onConfirm, title, label, placeholder = "", initialValue = "", confirmText = "Save", brandColor }) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(value); onClose(); }}
            className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80"
            style={{ backgroundColor: brandColor || "#0d9488" }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Add Participant Modal ──────────────────────────────────────────────
const AddParticipantModal = ({
  isOpen,
  onClose,
  workspaceId,
  chatId,
  brandColor,
  existingParticipantIds,
  onSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addParticipant] = useAddParticipantMutation();
  const { data: membersData, isLoading: membersLoading } = useGetMembersQuery(workspaceId);

  const availableMembers = membersData?.members
    ?.filter((m) => {
      const userId = m.user?._id || m._id;
      return !existingParticipantIds.includes(userId);
    })
    .filter((m) => {
      const user = m.user || m;
      const name = user?.name?.toLowerCase() || "";
      const email = user?.email?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      return name.includes(query) || email.includes(query);
    }) || [];

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.info("Select at least one member to add.");
      return;
    }
    try {
      setIsLoading(true);
      await addParticipant({ chatId, userIds: selectedUsers }).unwrap();
      toast.success(`${selectedUsers.length} member(s) added!`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to add participants");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Add Members</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:border-teal-500 dark:focus:border-[#0d9488] outline-none"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5">{availableMembers.length} available</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {membersLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-500">
              <FaSpinner className="animate-spin mx-auto text-lg" />
              <p className="text-xs mt-1">Loading...</p>
            </div>
          ) : availableMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-500 text-sm">
              {searchQuery ? "No members found" : "All members are already in this channel"}
            </div>
          ) : (
            availableMembers.map((member) => {
              const user = member.user || member;
              const isSelected = selectedUsers.includes(user._id);
              return (
                <button
                  key={user._id}
                  onClick={() => toggleUser(user._id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition ${
                    isSelected ? "bg-teal-50 dark:bg-[#0d9488]/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/30"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {user?.profile ? (
                      <img src={user.profile} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: brandColor }}
                      >
                        {user?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user?.name || "Unknown"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{user?.email}</p>
                  </div>
                  {isSelected && <FaCheck className="text-sm text-teal-600 dark:text-[#0d9488]" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-200/60 dark:border-gray-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button
            disabled={isLoading || selectedUsers.length === 0}
            onClick={handleSubmit}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {isLoading ? <FaSpinner className="animate-spin mx-auto" /> : `Add ${selectedUsers.length}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Message Action Modal (mobile long-press) ──────────────────────────
const MessageActionModal = ({
  isOpen,
  onClose,
  message,
  isOwn,
  isStarred,
  isArchived,
  onDelete,
  onArchive,
  onUnarchive,
  onStar,
  onUnstar,
  onReply,
  brandColor,
}) => {
  if (!isOpen || !message) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#14141a] rounded-t-2xl w-full max-w-lg p-5 transform transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700/60">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {message.messageType === 'image' ? <FaImage className="text-sm" /> : <FaComment className="text-sm" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {message.content ? message.content.substring(0, 60) : (message.mediaName || 'Media')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(message.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <button
            onClick={() => { onReply(message); onClose(); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaReply className="text-sm" />
            <span className="text-sm font-medium">Reply</span>
          </button>
          {isOwn && (
            <button
              onClick={() => { onDelete(message); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <FaTrashAlt className="text-sm" />
              <span className="text-sm font-medium">Delete for everyone</span>
            </button>
          )}
          {isStarred ? (
            <button
              onClick={() => { onUnstar(message); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 transition"
            >
              <FaStar className="text-sm" />
              <span className="text-sm font-medium">Unstar</span>
            </button>
          ) : (
            <button
              onClick={() => { onStar(message); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaRegStar className="text-sm" />
              <span className="text-sm font-medium">Star</span>
            </button>
          )}
          {isArchived ? (
            <button
              onClick={() => { onUnarchive(message); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
            >
              <FaUndo className="text-sm" />
              <span className="text-sm font-medium">Unarchive</span>
            </button>
          ) : (
            <button
              onClick={() => { onArchive(message); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaArchive className="text-sm" />
              <span className="text-sm font-medium">Archive</span>
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Message status ticks (UPDATED: text messages show clock until sent) ──
const MessageTicks = ({ message, isOwn }) => {
  if (!isOwn) return null;

  // ── TEXT MESSAGES: always show clock until sent, no failed icon ──
  if (message.messageType === 'text') {
    if (!message._sent) {
      return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
    }
    // if sent, fall through to normal ticks
  }

  // ── MEDIA MESSAGES: keep existing pending/failed logic ──────────
  if (message._pending) {
    return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
  }
  if (message._failed) {
    return <FaTimes className="text-[10px] text-red-500" />;
  }
  if (!message._sent) {
    return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
  }

  // ── Sent → delivered / read ──────────────────────────────────────
  if (!message._delivered && !message._read) {
    return <FaCheck className="text-[10px] text-gray-400 dark:text-gray-500" />;
  }
  if (message._delivered && !message._read) {
    return (
      <span className="inline-flex items-center -space-x-[5px] text-gray-400 dark:text-gray-500">
        <FaCheck className="text-[10px]" />
        <FaCheck className="text-[10px]" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center -space-x-[5px]">
      <FaCheck className="text-[10px]" style={{ color: SEEN_TICK_COLOR }} />
      <FaCheck className="text-[10px]" style={{ color: SEEN_TICK_COLOR }} />
    </span>
  );
};

// ─── Audio waveform ────────────────────────────────────────────────────
const WAVEFORM_BARS = [6, 11, 15, 9, 17, 12, 7, 14, 18, 10, 6, 13, 16, 11, 8, 15, 12, 7, 13, 9, 6, 10];

const AudioWaveform = ({ isOwn, isPlaying, brandColor }) => (
  <div className="flex items-center gap-[2px] h-6 flex-1">
    {WAVEFORM_BARS.map((h, i) => (
      <span
        key={i}
        className="w-[2.5px] rounded-full transition-opacity"
        style={{
          height: `${h * 2}px`,
          backgroundColor: isOwn ? 'rgba(255,255,255,0.85)' : brandColor,
          opacity: isPlaying ? 1 : 0.55,
        }}
      />
    ))}
  </div>
);

// ─── Fullscreen image viewer ──────────────────────────────────────────
const ImagePreviewModal = ({ imageUrl, onClose, senderName, time }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/70 text-white flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1">
            <FaArrowLeft />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{senderName || 'Photo'}</p>
            {time && <p className="text-[11px] text-white/60">{time}</p>}
          </div>
        </div>
        <button onClick={handleDownload} className="p-2">
          <FaDownload />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <img src={imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
      </div>
    </div>
  );
};

// ─── Quoted reply preview ──────────────────────────────────────────────
const QuotedReplyBlock = ({ replyData, isOwn, brandColor, onJump }) => {
  if (!replyData) return null;
  const name = replyData.senderName || 'Unknown';
  const text = replyData.content
    ? replyData.content
    : replyData.mediaName
    ? `📎 ${replyData.mediaName}`
    : replyData.messageType === 'image'
    ? '📷 Photo'
    : replyData.messageType === 'audio'
    ? '🎤 Voice note'
    : replyData.messageType === 'video'
    ? '🎥 Video'
    : 'Media';

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onJump && onJump(replyData.id); }}
      className={`block w-full text-left mb-1.5 px-2.5 py-1.5 rounded-lg border-l-2 text-xs cursor-pointer transition ${
        isOwn
          ? 'bg-black/10 border-white/60 hover:bg-black/20'
          : 'bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1]'
      }`}
      style={!isOwn ? { borderLeftColor: brandColor } : {}}
    >
      <p
        className={`font-semibold truncate ${isOwn ? 'text-white/90' : ''}`}
        style={isOwn ? {} : { color: brandColor }}
      >
        {name}
      </p>
      <p className={`truncate ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>{text}</p>
    </button>
  );
};

// ─── Resolve reply preview ─────────────────────────────────────────────
const resolveReplyPreview = (msg, allMessages, resolveSender) => {
  const replyTo = msg?.replyTo;
  if (!replyTo) return null;

  if (typeof replyTo === 'object') {
    const sender = resolveSender ? resolveSender(replyTo.sender) : replyTo.sender;
    return {
      id: replyTo._id,
      senderName: sender?.name || replyTo.senderName || 'Unknown',
      content: replyTo.content,
      mediaName: replyTo.mediaName,
      messageType: replyTo.messageType,
    };
  }

  const original = allMessages?.find((m) => m._id === replyTo);
  if (!original) return null;
  const sender = resolveSender ? resolveSender(original.sender) : original.sender;

  return {
    id: original._id,
    senderName: sender?.name || 'Unknown',
    content: original.content,
    mediaName: original.mediaName,
    messageType: original.messageType,
  };
};

// ─── Media Message Component (UPDATED: skip pending/failed for text) ──
const MediaMessage = ({
  message,
  isOwn,
  senderName,
  senderProfile,
  brandColor,
  onImageClick,
  onDelete,
  onArchive,
  onUnarchive,
  onStar,
  onUnstar,
  onReply,
  userId,
  isMobile,
  onLongPress,
  allMessages,
  onJumpToMessage,
  resolveSender,
}) => {
  // ── For text messages: skip pending/failed blocks ────────────────
  if (message.messageType !== 'text') {
    // ── Pending state (only for media) ──
    if (message._pending) {
      return (
        <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
          {!isOwn && (
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <FaUser className="text-gray-400 dark:text-gray-500" />
            </div>
          )}
          <div className="bg-gray-200 dark:bg-gray-700/50 px-4 py-2 rounded-2xl flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <FaSpinner className="animate-spin text-sm" />
            <span>Sending...</span>
          </div>
        </div>
      );
    }

    // ── Failed state (only for media) ──
    if (message._failed) {
      return (
        <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
          {!isOwn && (
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <FaUser className="text-gray-400 dark:text-gray-500" />
            </div>
          )}
          <div className="bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-2xl flex items-center gap-2 text-red-600 dark:text-red-400">
            <FaExclamationTriangle className="text-sm" />
            <span>Failed to send</span>
          </div>
        </div>
      );
    }
  }

  // ── Deleted state ──
  if (message.isDeleted) {
    return (
      <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
        {!isOwn && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <FaUser className="text-gray-400 dark:text-gray-500" />
          </div>
        )}
        <div className="bg-gray-100 dark:bg-gray-800/40 px-4 py-2 rounded-2xl text-gray-400 dark:text-gray-500 italic text-sm flex items-center gap-1">
          <span>Message deleted</span>
          <span className="text-[10px] ml-1 opacity-60">
            {safeFormatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  const time = safeFormatTime(message.createdAt);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef(null);
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);

  const touchStartRef = useRef({ x: 0, y: 0 });
  const [swipeX, setSwipeX] = useState(0);
  const swipeTriggered = useRef(false);
  const swipeActive = useRef(false);

  const isArchived = message.archivedBy?.some(id => id === userId) || false;
  const isStarred = message.starredBy?.some(id => id === userId) || false;
  const replyPreview = resolveReplyPreview(message, allMessages, resolveSender);

  const handleTouchStart = (e) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPress.current = false;
    swipeTriggered.current = false;
    swipeActive.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(message);
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (deltaX > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      swipeActive.current = true;
      const capped = Math.min(deltaX, SWIPE_REPLY_MAX);
      setSwipeX(capped);
      if (capped >= SWIPE_REPLY_THRESHOLD && !swipeTriggered.current) {
        swipeTriggered.current = true;
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!isMobile) return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (swipeTriggered.current) {
      onReply(message);
    }
    setSwipeX(0);
    swipeTriggered.current = false;

    if (isLongPress.current || swipeActive.current) {
      e.preventDefault();
      isLongPress.current = false;
      swipeActive.current = false;
    }
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const closeMenu = () => setShowMenu(false);

  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDownload = (e) => {
    e.stopPropagation();
    if (message.mediaUrl) {
      const link = document.createElement('a');
      link.href = message.mediaUrl;
      link.download = message.mediaName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderMediaContent = () => {
    if (!message.mediaUrl) return null;

    switch (message.messageType) {
      case 'image':
        return null;

      case 'video':
        return (
          <div className="relative group">
            <video src={message.mediaUrl} controls className="max-w-full rounded-lg max-h-80" />
          </div>
        );

      case 'audio':
        return (
          <div className="flex items-center gap-2.5 min-w-[220px] py-0.5">
            <button
              onClick={() => {
                if (audioRef.current) {
                  isPlaying ? audioRef.current.pause() : audioRef.current.play();
                  setIsPlaying(!isPlaying);
                }
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : brandColor }}
            >
              {isPlaying ? <FaPause className="text-xs text-white" /> : <FaPlay className="text-xs text-white ml-0.5" />}
            </button>
            <AudioWaveform isOwn={isOwn} isPlaying={isPlaying} brandColor={brandColor} />
            <span className={`text-[10px] flex-shrink-0 ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
              {message.mediaDuration ? formatTime(message.mediaDuration) : '0:00'}
            </span>
            <audio
              ref={audioRef}
              src={message.mediaUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              className="hidden"
            />
          </div>
        );

      case 'file':
        return (
          <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
              📄
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {message.mediaName || 'File'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {message.mediaSize ? `${(message.mediaSize / 1024).toFixed(1)} KB` : 'File'}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(e); }}
              className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <FaDownload className="text-sm" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const swipeStyle = {
    transform: `translateX(${swipeX}px)`,
    transition: swipeX === 0 ? 'transform 0.2s ease' : 'none',
  };
  const swipeIconOpacity = Math.min(swipeX / SWIPE_REPLY_THRESHOLD, 1);

  // Message width – mobile 75%, desktop 85%
  const maxWidthClass = isMobile ? 'max-w-[75%]' : 'max-w-[85%]';

  // ── Image messages without bubble ──
  if (message.messageType === 'image') {
    return (
      <div
        data-message-id={message._id}
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {isMobile && swipeX > 0 && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            style={{ opacity: swipeIconOpacity }}
          >
            <FaReply className="text-sm" />
          </div>
        )}
        <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`} style={isMobile ? swipeStyle : undefined}>
          {!isOwn && (
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
              {senderProfile ? (
                <img src={senderProfile} alt={senderName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: brandColor }}>
                  {senderName?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
          )}
          <div className={`${maxWidthClass} ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
            {!isOwn && <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1 mb-0.5">{senderName}</span>}
            {replyPreview && (
              <div className="w-full mb-1">
                <QuotedReplyBlock replyData={replyPreview} isOwn={isOwn} brandColor={brandColor} onJump={onJumpToMessage} />
              </div>
            )}
            <div
              className="relative rounded-2xl overflow-hidden cursor-pointer group"
              onClick={() =>
                onImageClick &&
                onImageClick({
                  url: message.mediaUrl,
                  senderName: isOwn ? 'You' : senderName,
                  time,
                })
              }
            >
              <img src={message.mediaUrl} alt={message.mediaName || 'Image'} className="max-w-full max-h-80 object-cover w-full" />
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">
                <span>{time}</span>
                <MessageTicks message={message} isOwn={isOwn} />
              </div>
              {!isMobile && (
                <div
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition"
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={toggleMenu}
                    className="text-white bg-black/40 p-1 rounded-full hover:bg-black/60"
                  >
                    <FaEllipsisV className="text-xs" />
                  </button>
                  {showMenu && (
                    <div
                      className="absolute right-0 top-8 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[160px] z-10 py-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); closeMenu(); onReply(message); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaReply className="text-xs" /> Reply
                      </button>
                      {isOwn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeMenu(); onDelete(message); }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full"
                        >
                          <FaTrashAlt className="text-xs" /> Delete
                        </button>
                      )}
                      {isStarred ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeMenu(); onUnstar(message); }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full"
                        >
                          <FaStar className="text-xs" /> Unstar
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeMenu(); onStar(message); }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                        >
                          <FaRegStar className="text-xs" /> Star
                        </button>
                      )}
                      {isArchived ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeMenu(); onUnarchive(message); }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full"
                        >
                          <FaUndo className="text-xs" /> Unarchive
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeMenu(); onArchive(message); }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                        >
                          <FaArchive className="text-xs" /> Archive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Regular messages with bubble ──
  return (
    <div
      data-message-id={message._id}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {isMobile && swipeX > 0 && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          style={{ opacity: swipeIconOpacity }}
        >
          <FaReply className="text-sm" />
        </div>
      )}
      <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`} style={isMobile ? swipeStyle : undefined}>
        {!isOwn && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
            {senderProfile ? (
              <img src={senderProfile} alt={senderName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: brandColor }}>
                {senderName?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
        )}
        <div className={`${maxWidthClass} ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
          {!isOwn && <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1">{senderName}</span>}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm break-words w-full ${
              isOwn
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200'
            }`}
            style={isOwn ? { backgroundColor: brandColor } : {}}
          >
            {replyPreview && (
              <QuotedReplyBlock replyData={replyPreview} isOwn={isOwn} brandColor={brandColor} onJump={onJumpToMessage} />
            )}
            {message.content && (
              <p className="mb-2 whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
            {renderMediaContent()}
          </div>
          <div className={`flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 ${isOwn ? 'flex-row-reverse' : ''}`}>
            <span>{time}</span>
            <MessageTicks message={message} isOwn={isOwn} />
            {!isMobile && (
              <div className="relative ml-2" ref={menuRef}>
                <button
                  onClick={toggleMenu}
                  className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5"
                >
                  <FaEllipsisV className="text-xs" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 bottom-6 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[160px] z-10 py-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); closeMenu(); onReply(message); }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                    >
                      <FaReply className="text-xs" /> Reply
                    </button>
                    {isOwn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); closeMenu(); onDelete(message); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full"
                      >
                        <FaTrashAlt className="text-xs" /> Delete
                      </button>
                    )}
                    {isStarred ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); closeMenu(); onUnstar(message); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full"
                      >
                        <FaStar className="text-xs" /> Unstar
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); closeMenu(); onStar(message); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaRegStar className="text-xs" /> Star
                      </button>
                    )}
                    {isArchived ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); closeMenu(); onUnarchive(message); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full"
                      >
                        <FaUndo className="text-xs" /> Unarchive
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); closeMenu(); onArchive(message); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaArchive className="text-xs" /> Archive
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Chat Details Bottom Sheet ────────────────────────────────────────
const ChatDetailsSheet = ({
  isOpen,
  onClose,
  chat,
  workspace,
  isDM,
  otherParticipant,
  isDMOnline,
  userInfo,
  canManageWorkspace,
  brandColor,
  onAddMember,
  onRemoveMember,
  onMakeAdmin,
  onRemoveAdmin,
  onExitGroup,
  onDeleteGroup,
  onRenameGroup,
}) => {
  if (!isOpen || !chat) return null;

  const participants = chat?.participants || [];
  const isGroupAdmin = chat.participants?.some(
    (p) => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === 'admin'
  ) || canManageWorkspace;
  const isCreator = chat.createdBy?._id === userInfo?._id;
  const canManage = isGroupAdmin || canManageWorkspace;
  const canDelete = isCreator || canManageWorkspace;

  const displayName = isDM ? otherParticipant?.name || 'Unknown' : chat?.name || 'Unnamed Channel';
  const displayAvatar = isDM ? otherParticipant?.profile : null;
  const memberCount = participants.length;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl max-h-[80vh] overflow-y-auto transform transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}
      >
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            {isDM ? (
              displayAvatar ? (
                <img src={displayAvatar} alt="" className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-gray-700/60" />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: brandColor }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: brandColor }}
              >
                <FaUsers size={24} />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{displayName}</h3>
                {!isDM && canManage && (
                  <button
                    onClick={() => onRenameGroup(chat._id, chat.name)}
                    className="p-1 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
                  >
                    <FaPen className="text-xs" />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDM
                  ? isDMOnline ? 'Online' : 'Offline'
                  : `${memberCount} member${memberCount !== 1 ? 's' : ''}`
                }
              </p>
            </div>
            {!isDM && canDelete && (
              <button
                onClick={() => onDeleteGroup(chat._id)}
                className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
              >
                <FaTrashAlt className="text-sm" />
              </button>
            )}
            {!isDM && !isCreator && !canManageWorkspace && (
              <button
                onClick={() => onExitGroup(chat._id)}
                className="p-2 text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition"
              >
                <FaSignOutAlt className="text-sm" />
              </button>
            )}
          </div>

          {!isDM && canManage && (
            <div className="mb-4">
              <button
                onClick={() => onAddMember(chat._id)}
                className="flex items-center gap-2 text-sm text-teal-600 dark:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 px-3 py-1.5 rounded-lg transition"
              >
                <FaUserPlus className="text-sm" /> Add Members
              </button>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {isDM ? 'Participant' : `Members (${memberCount})`}
            </h4>
            <ul className="space-y-2">
              {participants.map((p) => {
                const user = p.user || {};
                const profile = user.profile || null;
                const name = user.name || 'Unknown Member';
                const userId = user._id || p._id;
                const isAdmin = p.role === 'admin';
                const isCurrentUser = userId === userInfo?._id;
                const canPromote = canManage && !isCurrentUser && !isAdmin && !canManageWorkspace;
                const canDemote = canManage && !isCurrentUser && isAdmin && !canManageWorkspace;

                return (
                  <li key={userId} className="flex items-center gap-3 py-1">
                    {profile ? (
                      <img src={profile} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700/60" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-medium">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{name}</span>
                      {isAdmin && (
                        <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-700/40">
                          <FaCrown className="inline text-[10px] mr-0.5" /> Admin
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>
                      )}
                      {isDM && otherParticipant?._id === userId && (
                        <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">
                          {isDMOnline ? '🟢 online' : '⚫ offline'}
                        </span>
                      )}
                    </div>
                    {!isDM && canManage && !isCurrentUser && (
                      <div className="flex gap-1">
                        {canPromote && (
                          <button
                            onClick={() => onMakeAdmin(chat._id, userId)}
                            className="p-1 text-yellow-500 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition"
                            title="Make admin"
                          >
                            <FaCrown className="text-xs" />
                          </button>
                        )}
                        {canDemote && (
                          <button
                            onClick={() => onRemoveAdmin(chat._id, userId)}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
                            title="Remove admin"
                          >
                            <FaUserMinus className="text-xs" />
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => onRemoveMember(chat._id, userId)}
                            className="p-1 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                            title="Remove member"
                          >
                            <FaUserMinus className="text-xs" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Reply Preview Bar ──────────────────────────────────────────────
const ReplyPreview = ({ replyTo, onCancel, brandColor, resolveSender }) => {
  if (!replyTo) return null;
  const sender = resolveSender ? resolveSender(replyTo.sender) : replyTo.sender;
  const senderName = sender?.name || 'Unknown';
  const content = replyTo.content || (replyTo.mediaName ? `📎 ${replyTo.mediaName}` : 'Media');

  return (
    <div className="flex items-center justify-between px-3 py-2 mb-2 bg-gray-100 dark:bg-gray-800/60 rounded-lg border-l-4 border-teal-500 dark:border-[#0d9488]">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">Replying to {senderName}</span>
        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{content}</p>
      </div>
      <button onClick={onCancel} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition">
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────
const YourWorkspaceChannelId = () => {
  const { workspaceId, chatId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userInfo } = useSelector((state) => state.auth);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const inputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);

  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: false,
  });
  const [promptModal, setPromptModal] = useState({
    isOpen: false,
    title: '',
    label: '',
    initialValue: '',
    onConfirm: null,
    placeholder: '',
  });
  const [addMemberModal, setAddMemberModal] = useState({
    isOpen: false,
    chatId: null,
  });
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    message: null,
  });

  const [replyToMessage, setReplyToMessage] = useState(null);

  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [pendingMentions, setPendingMentions] = useState([]);

  const [initiateCall, { isLoading: isCallInitiating }] = useInitiateCallMutation();

  // ─── Voice recording state ──────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [showRecordedPreview, setShowRecordedPreview] = useState(false);

  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  const { socket, isConnected } = useSocket();
  const [localMessages, setLocalMessages] = useState([]);

  // ─── Online status for DM participants ──────────────────────────────
  const [otherUserOnline, setOtherUserOnline] = useState(null);

  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } = useGetUserChatsQuery(workspaceId);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useGetChatMessagesQuery(
    { chatId, page: 1, limit: 50 },
    { skip: !chatId, refetchOnMountOrArgChange: true }
  );
  const [sendMessageApi] = useSendMessageMutation();
  const [deleteMessageApi] = useDeleteMessageMutation();

  const [archiveMessage] = useArchiveMessageMutation();
  const [unarchiveMessage] = useUnarchiveMessageMutation();
  const [starMessage] = useStarMessageMutation();
  const [unstarMessage] = useUnstarMessageMutation();

  const [addParticipant] = useAddParticipantMutation();
  const [removeParticipant] = useRemoveParticipantMutation();
  const [makeAdmin] = useMakeGroupAdminMutation();
  const [removeAdmin] = useRemoveGroupAdminMutation();
  const [exitGroup] = useExitGroupChatMutation();
  const [deleteGroup] = useDeleteGroupChatMutation();
  const [archiveChat] = useArchiveChatMutation();
  const [unarchiveChat] = useUnarchiveChatMutation();

  const { data: membersData } = useGetMembersQuery(workspaceId);

  const chat = chatsData?.chats?.find(c => c._id === chatId);
  const isDM = chat?.type === 'direct';
  const otherParticipant = isDM
    ? chat?.participants?.find(p => p.user?._id !== userInfo?._id && p.user !== userInfo?._id)?.user || null
    : null;
  const displayName = isDM ? otherParticipant?.name || 'Unknown' : chat?.name || 'Unnamed Channel';
  const displayAvatar = isDM ? otherParticipant?.profile : null;
  const isDMOnline = isDM ? otherParticipant?.online || false : false;

  const isWorkspaceOwner = workspaceData?.workspace?.owner?._id === userInfo?._id;
  const isWorkspaceAdmin = workspaceData?.workspace?.members?.some(
    (m) => (m.user?._id || m.user) === userInfo?._id && m.role === 'Admin' && m.status === 'active'
  );
  const canManageWorkspace = isWorkspaceOwner || isWorkspaceAdmin;

  const participants = chat?.participants || [];
  const usernameMap = React.useMemo(() => {
    const map = new Map();
    participants.forEach(p => {
      const user = p.user || {};
      if (user._id && user.name) {
        const key = user.username || user.name;
        map.set(key.toLowerCase(), user._id);
      }
    });
    return map;
  }, [participants]);

  const userMapRef = useRef(new Map());

  const resolveSender = useCallback((senderField) => {
    if (!senderField) return { name: 'Unknown', profile: null };
    if (typeof senderField === 'string') {
      const found = userMapRef.current.get(senderField);
      if (found) {
        const name = found.name || found.username || found.email || 'Unknown';
        return { ...found, name };
      }
      return { _id: senderField, name: 'Unknown', profile: null };
    }
    if (senderField.name) return senderField;
    const found = senderField._id ? userMapRef.current.get(senderField._id) : null;
    if (found) {
      const name = found.name || found.username || found.email || 'Unknown';
      return {
        ...senderField,
        name: found.name || found.username || found.email || 'Unknown',
        profile: found.profile ?? senderField.profile,
      };
    }
    const name = senderField.username || senderField.email || 'Unknown';
    return { ...senderField, name };
  }, []);

  useEffect(() => {
    if (workspaceData?.workspace?.members) {
      const map = new Map();
      workspaceData.workspace.members.forEach((m) => {
        const user = m.user || m;
        if (user._id) map.set(user._id, user);
      });
      participants.forEach((p) => {
        const user = p.user || {};
        if (user._id && !map.has(user._id)) map.set(user._id, user);
      });
      if (userInfo?._id) map.set(userInfo._id, userInfo);
      userMapRef.current = map;
    }
  }, [workspaceData, participants, userInfo]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // ─── Polling for messages ──────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(() => {
      if (!isConnected) {
        // socket is down — poll as a fallback until it reconnects
        refetchMessages();
        refetchChats();
      }
    }, 15000); // 15s, not 3s
    return () => clearInterval(interval);
  }, [chatId, isConnected, refetchMessages, refetchChats]);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
    if (atBottom) setShowScrollDown(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
  };

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setShowScrollDown(true);
    }
  }, [localMessages.length]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [message]);

  const handleJumpToMessage = useCallback((messageId) => {
    if (!messageId) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-message-id="${messageId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('ring-2', 'ring-teal-400', 'rounded-2xl');
    setTimeout(() => {
      target.classList.remove('ring-2', 'ring-teal-400', 'rounded-2xl');
    }, 1200);
  }, []);

  // ─── Socket handlers ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;

    socket.emit('join-chat', chatId);

    const mergeMessages = (incomingList) => {
      if (!incomingList || incomingList.length === 0) return;
      setLocalMessages((prev) => {
        let next = prev;
        let mutated = false;

        incomingList.forEach((incoming) => {
          const isOwn = incoming.sender?._id === userInfo?._id || incoming.sender === userInfo?._id;

          // 1. If message already exists by real _id, update it
          const existingIdx = next.findIndex(m => m._id === incoming._id);
          if (existingIdx > -1) {
            if (!mutated) next = [...next];
            mutated = true;
            const existing = next[existingIdx];
            const updated = {
              ...incoming,
              _sent: existing._sent || false,
              _pending: existing._pending || false,
              _failed: existing._failed || false,
              _delivered: true,
              _read: false,
            };
            // Determine read status
            if (isOwn) {
              const otherIds = participants.map(p => p.user?._id || p.user).filter(id => id !== userInfo?._id);
              if (otherIds.some(id => incoming.readBy?.some(r => r.user === id || r.user?._id === id))) {
                updated._read = true;
              }
            } else {
              if (incoming.readBy?.some(r => r.user === userInfo?._id || r.user?._id === userInfo?._id)) {
                updated._read = true;
              }
            }
            next[existingIdx] = updated;
            return;
          }

          // 2. If this is our own message, try to replace a temporary
          if (isOwn) {
            // First, try by _tempId (most reliable)
            let tempIdx = next.findIndex(m => m._tempId === incoming._id);
            if (tempIdx === -1) {
              // Fallback: content + timestamp
              tempIdx = next.findIndex(
                m => m._temp && m.content === incoming.content && Math.abs(new Date(m.createdAt) - new Date(incoming.createdAt)) < 10000
              );
            }
            if (tempIdx > -1) {
              if (!mutated) next = [...next];
              mutated = true;
              const realMsg = {
                ...incoming,
                _temp: false,
                _tempId: undefined,
                _pending: false,
                _failed: false,
                _sent: true,
                _delivered: true,
                _read: false,
              };
              const otherIds = participants.map(p => p.user?._id || p.user).filter(id => id !== userInfo?._id);
              if (otherIds.some(id => incoming.readBy?.some(r => r.user === id || r.user?._id === id))) {
                realMsg._read = true;
              }
              next[tempIdx] = realMsg;
              return;
            }
          }

          // 3. New message from someone else (or ours that wasn't temp)
          const msg = {
            ...incoming,
            _sent: true,
            _pending: false,
            _failed: false,
            _delivered: true,
            _read: false,
          };
          if (isOwn) {
            const otherIds = participants.map(p => p.user?._id || p.user).filter(id => id !== userInfo?._id);
            if (otherIds.some(id => incoming.readBy?.some(r => r.user === id || r.user?._id === id))) {
              msg._read = true;
            }
          } else {
            if (incoming.readBy?.some(r => r.user === userInfo?._id || r.user?._id === userInfo?._id)) {
              msg._read = true;
            }
          }
          if (!mutated) next = [...next];
          mutated = true;
          next.push(msg);
        });

        return mutated ? next : prev;
      });
    };

    const handleNewMessage = (incoming) => {
      const incomingChatId = typeof incoming.chat === 'string' ? incoming.chat : incoming.chat?._id;
      if (incomingChatId && incomingChatId !== chatId) return;
      mergeMessages([incoming]);
    };

    const handleMessageDeleted = ({ messageId }) => {
      setLocalMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true } : m))
      );
    };

    const handleMessageRead = ({ chatId: readChatId, messageId, readBy }) => {
      if (readChatId !== chatId) return;
      setLocalMessages((prev) =>
        prev.map((m) => m._id === messageId ? { ...m, _read: true } : m)
      );
    };

    const handleUserStatusChange = ({ userId, online, chatId: statusChatId }) => {
      if (statusChatId !== chatId) return;
      if (userId === otherParticipant?._id) {
        setOtherUserOnline(online);
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('message-read', handleMessageRead);
    socket.on('user-status-changed', handleUserStatusChange);

    return () => {
      socket.emit('leave-chat', chatId);
      socket.off('new-message', handleNewMessage);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('message-read', handleMessageRead);
      socket.off('user-status-changed', handleUserStatusChange);
    };
  }, [socket, isConnected, chatId, userInfo?._id, participants, otherParticipant?._id]);

  // ─── Request presence when socket connects and we have a participant ──
  useEffect(() => {
    if (!socket || !isConnected || !otherParticipant?._id) return;
    socket.emit('request-presence', { userId: otherParticipant._id }, (response) => {
      if (response && typeof response.online === 'boolean') {
        setOtherUserOnline(response.online);
      }
    });
  }, [socket, isConnected, otherParticipant?._id]);

  // ─── Merge initial messages ──────────────────────────────────────
  useEffect(() => {
    if (messagesData?.messages) {
      setLocalMessages((prev) => {
        const existingIds = new Set(prev.map(m => m._id));
        const newMessages = messagesData.messages.filter(m => !existingIds.has(m._id));
        if (newMessages.length === 0) return prev;
        const merged = newMessages.map(msg => {
          const isOwn = msg.sender?._id === userInfo?._id || msg.sender === userInfo?._id;
          const obj = {
            ...msg,
            _sent: true,
            _pending: false,
            _failed: false,
            _delivered: true,
            _read: false,
          };
          if (isOwn) {
            const otherIds = participants.map(p => p.user?._id || p.user).filter(id => id !== userInfo?._id);
            if (otherIds.some(id => msg.readBy?.some(r => r.user === id || r.user?._id === id))) {
              obj._read = true;
            }
          } else {
            if (msg.readBy?.some(r => r.user === userInfo?._id || r.user?._id === userInfo?._id)) {
              obj._read = true;
            }
          }
          return obj;
        });
        return [...prev, ...merged];
      });
    }
  }, [messagesData, userInfo?._id, participants]);

  // ─── Native / Web voice recording ──────────────────────────────────
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecordingRef.current) {
        if (isNative) {
          VoiceRecorder.stopRecording().catch(() => {});
        } else {
          mediaRecorderRef.current.stop();
        }
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isNative]);

  const startTimer = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Native recording using VoiceRecorder
  const startNativeRecording = async () => {
    try {
      const { value: hasPermission } = await VoiceRecorder.hasAudioRecordingPermission();
      if (!hasPermission) {
        const { value: granted } = await VoiceRecorder.requestAudioRecordingPermission();
        if (!granted) {
          toast.error('Microphone permission is required.');
          return;
        }
      }
      await VoiceRecorder.startRecording();
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingTime(0);
      setShowRecordedPreview(false);
      startTimer();
    } catch (err) {
      console.error('Native recording error:', err);
      toast.error('Failed to start recording: ' + (err.message || ''));
      setIsRecording(false);
    }
  };

  const pauseNativeRecording = async () => {
    try {
      if (recordingPaused) {
        await VoiceRecorder.resumeRecording();
        setRecordingPaused(false);
        startTimer();
      } else {
        await VoiceRecorder.pauseRecording();
        setRecordingPaused(true);
        stopTimer();
      }
    } catch (err) {
      toast.error('Failed to pause/resume recording');
    }
  };

  const stopNativeRecording = async () => {
    try {
      const result = await VoiceRecorder.stopRecording();
      const base64 = result.value.recordDataBase64;
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const audioBlob = new Blob([byteArray], { type: 'audio/m4a' });
      setRecordingBlob(audioBlob);
      setShowRecordedPreview(true);
      stopTimer();
      setIsRecording(false);
    } catch (err) {
      console.error('Stop recording error:', err);
      toast.error('Failed to stop recording');
      setIsRecording(false);
    }
  };

  const cancelNativeRecording = async () => {
    try {
      await VoiceRecorder.stopRecording();
    } catch (_) {}
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    stopTimer();
  };

  // Web recording using MediaRecorder
  const startWebRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(audioBlob);
        setShowRecordedPreview(true);
        stopTimer();
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingTime(0);
      setShowRecordedPreview(false);
      startTimer();
    } catch (err) {
      console.error('Web recording error:', err);
      let msg = 'Microphone access denied';
      if (err.name === 'NotAllowedError') msg = 'Microphone permission denied. Please grant it in system settings.';
      else if (err.name === 'NotFoundError') msg = 'No microphone found.';
      else if (err.name === 'NotReadableError') msg = 'Microphone busy — please try again.';
      else if (err.name === 'AbortError') msg = 'User canceled the permission prompt.';
      toast.error(msg);
      mediaRecorderRef.current = null;
    }
  };

  const pauseWebRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordingPaused) {
        mediaRecorderRef.current.resume();
        setRecordingPaused(false);
        startTimer();
      } else {
        mediaRecorderRef.current.pause();
        setRecordingPaused(true);
        stopTimer();
      }
    }
  };

  const stopWebRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelWebRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    stopTimer();
  };

  // Unified recording handlers
  const startRecording = () => {
    if (isRecording) return;
    if (isNative) {
      startNativeRecording();
    } else {
      startWebRecording();
    }
  };

  const pauseRecording = () => {
    if (isNative) {
      pauseNativeRecording();
    } else {
      pauseWebRecording();
    }
  };

  const stopRecording = () => {
    if (isNative) {
      stopNativeRecording();
    } else {
      stopWebRecording();
    }
  };

  const cancelRecording = () => {
    if (isNative) {
      cancelNativeRecording();
    } else {
      cancelWebRecording();
    }
  };

  // ─── Optimistic sendAudioMessage ──────────────────────────────────
  const sendAudioMessage = async (audioBlob) => {
    const formData = new FormData();
    const mimeType = isNative ? 'audio/m4a' : 'audio/webm';
    const extension = isNative ? 'm4a' : 'webm';
    const audioFile = new File([audioBlob], `voice-note.${extension}`, {
      type: mimeType,
    });
    formData.append('media', audioFile);
    formData.append('messageType', 'audio');
    formData.append('mediaDuration', recordingTime.toString());
    if (pendingMentions.length > 0) {
      formData.append('mentions', JSON.stringify(pendingMentions));
    }
    if (replyToMessage) {
      formData.append('replyToId', replyToMessage._id);
    }

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || 'Unknown',
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: true,
      _sent: false,
      _failed: false,
      _delivered: false,
      _read: false,
      content: '',
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: 'audio',
      chat: chatId,
      replyTo: replyToMessage ? { _id: replyToMessage._id, sender: replyToMessage.sender, content: replyToMessage.content, mediaName: replyToMessage.mediaName, messageType: replyToMessage.messageType } : null,
      mediaUrl: URL.createObjectURL(audioBlob),
      mediaName: 'Voice note',
      mediaSize: audioBlob.size,
      mediaDuration: recordingTime,
    };
    setLocalMessages(prev => [...prev, optimisticMsg]);
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setReplyToMessage(null);

    try {
      const result = await sendMessageApi({ chatId, data: formData }).unwrap();
      toast.success('Voice note sent!');
    } catch (err) {
      setLocalMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _pending: false, _failed: true } : m));
      toast.error(err?.data?.message || 'Failed to send voice note');
    }
  };

  // ─── Mention logic ──────────────────────────────────────────────────
  const extractMentionsFromText = (text) => {
    const matches = text.match(/@(\w+)/g);
    if (!matches) return [];
    const ids = [];
    const seen = new Set();
    matches.forEach(m => {
      const username = m.slice(1).toLowerCase();
      const userId = usernameMap.get(username);
      if (userId && !seen.has(userId)) {
        seen.add(userId);
        ids.push(userId);
      }
    });
    return ids;
  };

  const handleMessageChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    const mentions = extractMentionsFromText(value);
    setPendingMentions(mentions);

    const cursorPos = e.target.selectionStart || 0;
    const beforeCursor = value.slice(0, cursorPos);
    const lastAt = beforeCursor.lastIndexOf('@');
    if (lastAt !== -1) {
      const afterAt = value.slice(lastAt + 1, cursorPos);
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt);
        setShowMentions(true);
        const queryLower = afterAt.toLowerCase();
        const filtered = participants
          .map(p => p.user)
          .filter(u => u && u._id !== userInfo?._id)
          .filter(u => {
            const name = (u.name || '').toLowerCase();
            const username = (u.username || '').toLowerCase();
            return name.includes(queryLower) || username.includes(queryLower);
          });
        setMentionSuggestions(filtered);
        return;
      }
    }
    setShowMentions(false);
    setMentionQuery('');
    setMentionSuggestions([]);
  };

  const handleSelectMention = (user) => {
    const value = message;
    const cursorPos = inputRef.current?.selectionStart || 0;
    const beforeCursor = value.slice(0, cursorPos);
    const lastAt = beforeCursor.lastIndexOf('@');
    if (lastAt === -1) return;
    const beforeMention = value.slice(0, lastAt);
    const afterCursor = value.slice(cursorPos);
    const mentionText = `@${user.username || user.name} `;
    const newValue = beforeMention + mentionText + afterCursor;
    setMessage(newValue);
    setShowMentions(false);
    setMentionQuery('');
    setMentionSuggestions([]);
    setTimeout(() => {
      if (inputRef.current) {
        const newCursor = beforeMention.length + mentionText.length;
        inputRef.current.selectionStart = newCursor;
        inputRef.current.selectionEnd = newCursor;
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleReply = (msg) => {
    setReplyToMessage(msg);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const cancelReply = () => {
    setReplyToMessage(null);
  };

  // ─── Native / Web file & image pickers ────────────────────────────

  // Native image picker (Camera / Gallery) - called from custom modal
  const handleTakePhoto = useCallback(async () => {
    setShowMediaPicker(false);
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      if (photo?.base64String) {
        const mimeType = `image/${photo.format || 'jpeg'}`;
        const fileName = `photo-${Date.now()}.${photo.format || 'jpg'}`;
        const file = base64ToFile(photo.base64String, fileName, mimeType);
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachmentPreview({
            file: file,
            preview: event.target.result,
            type: 'image',
            name: fileName,
          });
          setIsPreviewOpen(true);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('Camera error:', err);
        toast.error('Failed to take photo');
      }
    }
  }, []);

  const handleChooseFromGallery = useCallback(async () => {
    setShowMediaPicker(false);
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      if (photo?.base64String) {
        const mimeType = `image/${photo.format || 'jpeg'}`;
        const fileName = `photo-${Date.now()}.${photo.format || 'jpg'}`;
        const file = base64ToFile(photo.base64String, fileName, mimeType);
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachmentPreview({
            file: file,
            preview: event.target.result,
            type: 'image',
            name: fileName,
          });
          setIsPreviewOpen(true);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('Gallery error:', err);
        toast.error('Failed to pick from gallery');
      }
    }
  }, []);

  // Native file picker (documents, PDF, etc.)
  const handlePickFile = useCallback(async () => {
    try {
      const result = await FilePicker.pickFiles({ readData: true });
      const picked = result?.files?.[0];
      if (!picked) return;
      const mimeType = picked.mimeType || 'application/octet-stream';
      const fileName = picked.name || `file-${Date.now()}`;

      let file;
      if (picked.data) {
        file = base64ToFile(picked.data, fileName, mimeType);
      } else if (picked.path) {
        const readResult = await Filesystem.readFile({ path: picked.path });
        file = base64ToFile(readResult.data, fileName, mimeType);
      } else {
        toast.error('Could not read selected file');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachmentPreview({
          file: file,
          preview: event.target.result,
          type: 'file',
          name: fileName,
        });
        setIsPreviewOpen(true);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel')) {
        console.error('File picker error:', err);
        toast.error('Failed to pick file');
      }
    }
  }, []);

  // Entry point for file/image upload
  const handleFileUpload = useCallback(
    (type) => {
      if (isNative) {
        if (type === 'image') {
          setShowMediaPicker(true);
        } else {
          handlePickFile();
        }
        return;
      }
      if (type === 'file') {
        fileInputRef.current?.click();
      } else {
        imageInputRef.current?.click();
      }
    },
    [handlePickFile],
  );

  // Web-only file change handler (hidden inputs)
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error('No file selected');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      setAttachmentPreview({
        file: file,
        preview: event.target.result,
        type: type,
        name: file.name,
      });
      setIsPreviewOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // ─── Handle paste ──────────────────────────────────────────────────
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setAttachmentPreview({
              file: file,
              preview: event.target.result,
              type: 'image',
              name: file.name || 'image.png',
            });
            setIsPreviewOpen(true);
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }

    const text = e.clipboardData?.getData('text');
    if (text) {
      const urlPattern = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
      if (urlPattern.test(text.trim())) {
        e.preventDefault();
      }
    }
  }, []);

  // ─── Optimistic sendAttachment ────────────────────────────────────
  const handleSendAttachment = async (previewData) => {
    const { file, type } = previewData;
    if (!file) return;

    const formData = new FormData();
    formData.append('media', file);
    formData.append('messageType', type === 'image' ? 'image' : 'file');
    if (pendingMentions.length > 0) {
      formData.append('mentions', JSON.stringify(pendingMentions));
    }
    if (replyToMessage) {
      formData.append('replyToId', replyToMessage._id);
    }

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || 'Unknown',
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageType = type === 'image' ? 'image' : 'file';
    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: true,
      _sent: false,
      _failed: false,
      _delivered: false,
      _read: false,
      content: '',
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: messageType,
      chat: chatId,
      replyTo: replyToMessage ? { _id: replyToMessage._id, sender: replyToMessage.sender, content: replyToMessage.content, mediaName: replyToMessage.mediaName, messageType: replyToMessage.messageType } : null,
      mediaUrl: URL.createObjectURL(file),
      mediaName: file.name,
      mediaSize: file.size,
      mediaDuration: null,
    };
    setLocalMessages(prev => [...prev, optimisticMsg]);
    setReplyToMessage(null);
    setIsPreviewOpen(false);
    setAttachmentPreview(null);

    try {
      const result = await sendMessageApi({ chatId, data: formData }).unwrap();
      toast.success(`${type === 'image' ? 'Image' : 'File'} sent!`);
    } catch (err) {
      setLocalMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _pending: false, _failed: true } : m));
      toast.error(err?.data?.message || 'Failed to send media');
    }
  };

  const handleRemoveAttachment = () => {
    setIsPreviewOpen(false);
    setAttachmentPreview(null);
  };

  // ─── Message action handlers (optimistic delete) ────────────────
  const handleDeleteMessage = useCallback((msg) => {
    const msgId = msg._id;
    setLocalMessages(prev => prev.map(m => m._id === msgId ? { ...m, isDeleted: true } : m));

    deleteMessageApi(msgId)
      .unwrap()
      .catch(err => {
        setLocalMessages(prev => prev.map(m => m._id === msgId ? { ...m, isDeleted: false } : m));
        toast.error(err?.data?.message || 'Failed to delete message');
      });
  }, [deleteMessageApi]);

  const handleStarMessage = useCallback((msg) => {
    const msgId = msg._id;
    setLocalMessages(prev => prev.map(m => {
      if (m._id === msgId) {
        return { ...m, starredBy: [...(m.starredBy || []), userInfo._id] };
      }
      return m;
    }));

    starMessage(msgId)
      .unwrap()
      .catch(err => {
        setLocalMessages(prev => prev.map(m => {
          if (m._id === msgId) {
            return { ...m, starredBy: (m.starredBy || []).filter(id => id !== userInfo._id) };
          }
          return m;
        }));
        toast.error(err?.data?.message || 'Failed to star message');
      });
  }, [starMessage, userInfo?._id]);

  const handleUnstarMessage = useCallback((msg) => {
    const msgId = msg._id;
    setLocalMessages(prev => prev.map(m => {
      if (m._id === msgId) {
        return { ...m, starredBy: (m.starredBy || []).filter(id => id !== userInfo._id) };
      }
      return m;
    }));

    unstarMessage(msgId)
      .unwrap()
      .catch(err => {
        setLocalMessages(prev => prev.map(m => {
          if (m._id === msgId) {
            return { ...m, starredBy: [...(m.starredBy || []), userInfo._id] };
          }
          return m;
        }));
        toast.error(err?.data?.message || 'Failed to unstar message');
      });
  }, [unstarMessage, userInfo?._id]);

  const handleArchiveMessage = useCallback((msg) => {
    const msgId = msg._id;
    setLocalMessages(prev => prev.map(m => {
      if (m._id === msgId) {
        return { ...m, archivedBy: [...(m.archivedBy || []), userInfo._id] };
      }
      return m;
    }));

    archiveMessage(msgId)
      .unwrap()
      .catch(err => {
        setLocalMessages(prev => prev.map(m => {
          if (m._id === msgId) {
            return { ...m, archivedBy: (m.archivedBy || []).filter(id => id !== userInfo._id) };
          }
          return m;
        }));
        toast.error(err?.data?.message || 'Failed to archive message');
      });
  }, [archiveMessage, userInfo?._id]);

  const handleUnarchiveMessage = useCallback((msg) => {
    const msgId = msg._id;
    setLocalMessages(prev => prev.map(m => {
      if (m._id === msgId) {
        return { ...m, archivedBy: (m.archivedBy || []).filter(id => id !== userInfo._id) };
      }
      return m;
    }));

    unarchiveMessage(msgId)
      .unwrap()
      .catch(err => {
        setLocalMessages(prev => prev.map(m => {
          if (m._id === msgId) {
            return { ...m, archivedBy: [...(m.archivedBy || []), userInfo._id] };
          }
          return m;
        }));
        toast.error(err?.data?.message || 'Failed to unarchive message');
      });
  }, [unarchiveMessage, userInfo?._id]);

  // ─── Mark message as read ─────────────────────────────────────────
  const markMessageAsRead = useCallback((messageId) => {
    if (!socket || !isConnected) return;
    const msg = localMessages.find(m => m._id === messageId);
    if (!msg || msg._read || msg.sender?._id === userInfo?._id) return;
    socket.emit('mark-read', { chatId, messageIds: [messageId] });
  }, [socket, isConnected, chatId, localMessages, userInfo]);

  // ─── Intersection Observer for auto-read ─────────────────────────
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            if (messageId) {
              const msg = localMessages.find(m => m._id === messageId);
              if (msg && !msg._read && msg.sender?._id !== userInfo?._id) {
                markMessageAsRead(messageId);
              }
            }
          }
        });
      },
      { threshold: 0.5 }
    );
    const elements = messagesContainerRef.current.querySelectorAll('[data-message-id]');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [localMessages, markMessageAsRead, userInfo]);

  // ─── Error / loading states ─────────────────────────────────────────
  // Only show full-page spinner if workspace or chat list is loading
  if (workspaceLoading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }} />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading chat...</p>
        </div>
      </div>
    );
  }

  // If workspace or chat not found, redirect
  if (error || !workspaceData?.workspace || !chat) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  const workspace = workspaceData?.workspace;
  const brandColor = workspace.color || '#0d9488';
  const memberCount = chat.participants?.length || 0;

  // ─── Group management handlers ──────────────────────────────────────
  const handleAddMember = (chatId) => {
    setAddMemberModal({ isOpen: true, chatId });
  };

  const handleRemoveMember = (chatId, userId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the group?',
      onConfirm: async () => {
        try {
          await removeParticipant({ chatId, userId }).unwrap();
          toast.success('Member removed');
          refetchChats();
          refetchMessages();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to remove member');
        }
      },
      danger: true,
    });
  };

  const handleMakeAdmin = (chatId, userId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Make Admin',
      message: 'Are you sure you want to promote this user to admin?',
      onConfirm: async () => {
        try {
          await makeAdmin({ chatId, userId }).unwrap();
          toast.success('User promoted to admin');
          refetchChats();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to promote user');
        }
      },
      danger: false,
    });
  };

  const handleRemoveAdmin = (chatId, userId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Admin',
      message: 'Are you sure you want to remove admin rights from this user?',
      onConfirm: async () => {
        try {
          await removeAdmin({ chatId, userId }).unwrap();
          toast.success('Admin rights removed');
          refetchChats();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to demote user');
        }
      },
      danger: false,
    });
  };

  const handleExitGroup = (chatId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Exit Group',
      message: 'Are you sure you want to leave this group? You will no longer receive messages.',
      onConfirm: async () => {
        try {
          await exitGroup(chatId).unwrap();
          toast.success('You left the group');
          navigate(`/workspace/${workspaceId}/channels`);
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to leave group');
        }
      },
      danger: true,
    });
  };

  const handleDeleteGroup = (chatId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Group',
      message: 'Are you sure you want to permanently delete this group and all its messages? This cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteGroup(chatId).unwrap();
          toast.success('Group deleted');
          navigate(`/workspace/${workspaceId}/channels`);
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to delete group');
        }
      },
      danger: true,
    });
  };

  const handleRenameGroup = (chatId, currentName) => {
    setPromptModal({
      isOpen: true,
      title: 'Rename Group',
      label: 'New group name',
      initialValue: currentName,
      placeholder: 'Enter new name...',
      onConfirm: async (newName) => {
        if (!newName.trim()) {
          toast.error('Name cannot be empty');
          return;
        }
        toast.info('Rename feature coming soon');
        refetchChats();
      },
    });
  };

  const handleAddMemberSuccess = () => {
    refetchChats();
    refetchMessages();
    setAddMemberModal({ isOpen: false, chatId: null });
  };

  const handleLongPress = (message) => {
    setActionModal({ isOpen: true, message });
  };

  // ─── Call initiation ────────────────────────────────────────────────
  const handleCall = async (type) => {
    if (!workspace || !chat) return;

    let participantIds = [];
    if (isDM) {
      const otherId = otherParticipant?._id;
      if (otherId) participantIds = [otherId];
    } else {
      participantIds = chat.participants
        .filter((p) => {
          const uid = p.user?._id || p.user;
          return uid !== userInfo._id && uid !== userInfo?._id;
        })
        .map((p) => p.user?._id || p.user);
    }

    if (participantIds.length === 0) {
      toast.info('No one else to call in this chat.');
      return;
    }

    try {
      const response = await initiateCall({
        workspaceId,
        type,
        participantIds,
      }).unwrap();

      navigate(`/call/${response.call.roomId}`, {
        state: {
          callData: {
            ...response.call,
            status: 'ringing',
            isInitiator: true,
            workspaceColor: brandColor,
          },
        },
      });
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to initiate call');
    }
  };

  // ─── Optimistic send text message (UPDATED: no spinner, clock only) ──
  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !socket) return;

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || 'Unknown',
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: false, // no spinner
      _sent: false,    // clock will show
      _failed: false,
      _delivered: false,
      _read: false,
      content: trimmed,
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: 'text',
      chat: chatId,
      mentions: pendingMentions,
      replyTo: replyToMessage
        ? {
            _id: replyToMessage._id,
            sender: replyToMessage.sender,
            content: replyToMessage.content,
            mediaName: replyToMessage.mediaName,
            messageType: replyToMessage.messageType,
          }
        : null,
    };

    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setMessage('');
    const replyToId = replyToMessage?._id || null;
    const mentions = pendingMentions;

    setReplyToMessage(null);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    socket.emit('send-message', {
      chatId,
      content: trimmed,
      messageType: 'text',
      mentions,
      replyToId,
      mediaUrl: null,
      mediaName: null,
      mediaSize: null,
      mediaDuration: null,
    }, (response) => {
      if (response?.error) {
        // On error: remove the temporary message (do not show failed)
        setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
        toast.error(response.error);
      } else {
        // ✅ FIX: Mark as sent and delivered immediately
        setLocalMessages((prev) =>
          prev.map((m) =>
            m._id === tempId ? { ...m, _sent: true, _delivered: true } : m
          )
        );
      }
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          senderName={previewImage.senderName}
          time={previewImage.time}
          onClose={() => setPreviewImage(null)}
        />
      )}

      <AttachmentPreviewModal
        isOpen={isPreviewOpen}
        onClose={handleRemoveAttachment}
        previewData={attachmentPreview}
        onSend={handleSendAttachment}
        onRemove={handleRemoveAttachment}
        brandColor={brandColor}
      />

      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chatsData?.chats || []} />
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-[#0f0f12] h-full overflow-hidden">
        <header
          className="fixed lg:sticky top-0 left-0 right-0 lg:left-auto lg:right-auto z-20 flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl text-gray-800 dark:text-white flex-shrink-0 cursor-pointer"
          style={{
            paddingTop: 'calc(0.75rem + var(--safe-top))',
            paddingLeft: 'calc(1rem + var(--safe-left))',
            paddingRight: 'calc(1rem + var(--safe-right))',
          }}
          onClick={() => setShowDetailsSheet(true)}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/workspace/${workspaceId}/channels`);
              }}
              className="p-1 lg:hidden flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
            >
              <FaArrowLeft />
            </button>
            {isDM ? (
              displayAvatar ? (
                <img src={displayAvatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-700/60" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <FaUsers className="text-sm" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-base text-gray-800 dark:text-gray-100 truncate">{displayName}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {isDM ? (otherUserOnline === true ? 'Online' : otherUserOnline === false ? 'Offline' : '') : `${memberCount} members`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleCall('voice')}
              disabled={isCallInitiating}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition disabled:opacity-50"
              aria-label="Start voice call"
            >
              <FaPhone />
            </button>
            <button
              onClick={() => handleCall('video')}
              disabled={isCallInitiating}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition disabled:opacity-50"
              aria-label="Start video call"
            >
              <FaVideo />
            </button>
          </div>
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="h-full overflow-y-auto px-4 py-3 space-y-4 pt-20 lg:pt-3 pb-24 lg:pb-3"
          >
            {/* ─── Skeleton or messages ──────────────────────────────── */}
            {messagesLoading ? (
              <SkeletonMessages count={6} />
            ) : localMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <FaComment className="text-4xl mb-2 opacity-30" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1 opacity-60">Paste images or screenshots here</p>
              </div>
            ) : (
              localMessages.map((msg) => {
                const sender = msg.sender?._id ? resolveSender(msg.sender._id) : resolveSender(msg.sender);
                const isOwn = (msg.sender?._id === userInfo?._id || msg.sender === userInfo?._id);
                return (
                  <MediaMessage
                    key={msg._id}
                    message={msg}
                    isOwn={isOwn}
                    senderName={sender?.name || 'Unknown'}
                    senderProfile={sender?.profile}
                    brandColor={brandColor}
                    onImageClick={(payload) => setPreviewImage(payload)}
                    onDelete={handleDeleteMessage}
                    onArchive={handleArchiveMessage}
                    onUnarchive={handleUnarchiveMessage}
                    onStar={handleStarMessage}
                    onUnstar={handleUnstarMessage}
                    onReply={handleReply}
                    userId={userInfo?._id}
                    isMobile={isMobile}
                    onLongPress={handleLongPress}
                    allMessages={localMessages}
                    onJumpToMessage={handleJumpToMessage}
                    resolveSender={resolveSender}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {showScrollDown && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 z-30 w-10 h-10 rounded-full bg-white dark:bg-[#14141a] shadow-lg border border-gray-200 dark:border-gray-700/60 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all"
            >
              <FaChevronDown className="text-sm" />
            </button>
          )}
        </div>

        <div
          className="fixed lg:sticky bottom-0 left-0 right-0 lg:left-auto lg:right-auto z-20 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/90 dark:bg-[#0f0f12]/90 backdrop-blur-xl flex-shrink-0 px-3 sm:px-4"
          style={{
            paddingTop: '0.5rem',
            paddingBottom: 'calc(0.5rem + var(--safe-bottom))',
          }}
        >
          <ReplyPreview
            replyTo={replyToMessage}
            onCancel={cancelReply}
            brandColor={brandColor}
            resolveSender={resolveSender}
          />

          {showRecordedPreview && recordingBlob && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700/40">
              <div className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500 dark:text-green-400" />
                <span className="text-sm text-gray-700 dark:text-gray-200">Voice note ready</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(recordingTime)}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const audio = new Audio(URL.createObjectURL(recordingBlob));
                    audio.play();
                  }}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                >
                  <FaPlay className="text-xs" />
                </button>
                <button
                  onClick={() => sendAudioMessage(recordingBlob)}
                  className="px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded text-xs hover:bg-green-700 dark:hover:bg-green-800 transition"
                >
                  Send
                </button>
                <button
                  onClick={cancelRecording}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
            </div>
          )}

          {isRecording && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-600 dark:text-red-300">
                  {recordingPaused ? 'Paused' : 'Recording...'} {formatTime(recordingTime)}
                </span>
                <button
                  onClick={pauseRecording}
                  className="text-xs text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
                >
                  {recordingPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelRecording}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"
                >
                  <FaTrashAlt className="text-xs" />
                </button>
                <button
                  onClick={stopRecording}
                  className="bg-red-500 text-white px-2 py-1 rounded-full hover:bg-red-600 transition text-xs"
                >
                  Stop
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-end gap-2 py-2 relative">
            {showMentions && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-xl shadow-lg max-h-48 overflow-y-auto z-40">
                {mentionSuggestions.length > 0 ? (
                  mentionSuggestions.map((user) => (
                    <button
                      key={user._id}
                      onClick={() => handleSelectMention(user)}
                      className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
                    >
                      {user.profile ? (
                        <img src={user.profile} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: brandColor }}
                        >
                          {user.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username || user.name}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No users found</div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleFileUpload('file')}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0 mb-1"
            >
              <FaPaperclip className="text-sm" />
            </button>
            <button
              type="button"
              onClick={() => handleFileUpload('image')}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0 mb-1"
            >
              <FaImage className="text-sm" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <input type="file" ref={imageInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />

            <textarea
              ref={inputRef}
              value={message}
              onChange={handleMessageChange}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (isMobile) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Message"
              rows={1}
              className="flex-1 min-w-0 px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-2xl bg-white dark:bg-[#0b0b10] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-[#0d9488] resize-none max-h-32 overflow-y-auto"
              style={{ 
                minHeight: '42px',
                lineHeight: '1.5'
              }}
            />

            {message.trim() ? (
              <button
                type="submit"
                disabled={!isConnected}
                className="p-2 rounded-full text-white disabled:opacity-50 flex-shrink-0 transition hover:opacity-80 mb-1"
                style={{ backgroundColor: brandColor }}
              >
                <FaPaperPlane className="text-sm" />
              </button>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => {
                  if (message.trim()) return;
                  if (isRecording || mediaRecorderRef.current) return;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  startRecording();
                }}
                onPointerUp={(e) => {
                  e.currentTarget.releasePointerCapture?.(e.pointerId);
                  if (isRecording && !recordingPaused) {
                    stopRecording();
                  }
                }}
                onPointerCancel={(e) => {
                  if (isRecording && !recordingPaused) stopRecording();
                }}
                className="p-2 rounded-full text-white flex-shrink-0 transition hover:opacity-80 mb-1"
                style={{ backgroundColor: brandColor }}
              >
                <FaMicrophone className="text-sm" />
              </button>
            )}
          </form>
        </div>
      </div>

      <ChatDetailsSheet
        isOpen={showDetailsSheet}
        onClose={() => setShowDetailsSheet(false)}
        chat={chat}
        workspace={workspace}
        isDM={isDM}
        otherParticipant={otherParticipant}
        isDMOnline={otherUserOnline === true}
        userInfo={userInfo}
        canManageWorkspace={canManageWorkspace}
        brandColor={brandColor}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onMakeAdmin={handleMakeAdmin}
        onRemoveAdmin={handleRemoveAdmin}
        onExitGroup={handleExitGroup}
        onDeleteGroup={handleDeleteGroup}
        onRenameGroup={handleRenameGroup}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />

      <PromptModal
        isOpen={promptModal.isOpen}
        onClose={() => setPromptModal({ ...promptModal, isOpen: false })}
        onConfirm={(value) => promptModal.onConfirm && promptModal.onConfirm(value)}
        title={promptModal.title}
        label={promptModal.label}
        initialValue={promptModal.initialValue}
        placeholder={promptModal.placeholder}
        brandColor={brandColor}
      />

      <AddParticipantModal
        isOpen={addMemberModal.isOpen}
        onClose={() => setAddMemberModal({ isOpen: false, chatId: null })}
        workspaceId={workspaceId}
        chatId={addMemberModal.chatId}
        brandColor={brandColor}
        existingParticipantIds={
          addMemberModal.chatId
            ? chat?.participants.map(p => p.user?._id || p.user) || []
            : []
        }
        onSuccess={handleAddMemberSuccess}
      />

      <MessageActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, message: null })}
        message={actionModal.message}
        isOwn={actionModal.message?.sender?._id === userInfo?._id || actionModal.message?.sender === userInfo?._id}
        isStarred={actionModal.message?.starredBy?.some(id => id === userInfo?._id) || false}
        isArchived={actionModal.message?.archivedBy?.some(id => id === userInfo?._id) || false}
        onDelete={handleDeleteMessage}
        onArchive={handleArchiveMessage}
        onUnarchive={handleUnarchiveMessage}
        onStar={handleStarMessage}
        onUnstar={handleUnstarMessage}
        onReply={handleReply}
        brandColor={brandColor}
      />

      {/* Custom Media Picker Modal */}
      <MediaPickerModal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromGallery={handleChooseFromGallery}
        brandColor={brandColor}
      />
    </div>
  );
};

export default YourWorkspaceChannelId;