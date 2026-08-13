// src/workspaceScreens/MyWorkspaceChatId.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetWorkspaceQuery } from "../slices/workspaceApiSlice";
import {
  useGetUserChatsQuery,
  useGetChatMessagesQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
  useArchiveMessageMutation,
  useUnarchiveMessageMutation,
  useStarMessageMutation,
  useUnstarMessageMutation,
} from "../slices/messagingApiSlice";
import { useInitiateCallMutation } from "../slices/callApiSlice";
import MyWorkspaceSidebar from "../workspaceComponents/MyWorkspaceSidebar";
import { useSocket } from "../components/SocketContext.jsx";
import {
  FaArrowLeft,
  FaPhone,
  FaVideo,
  FaInfoCircle,
  FaComment,
  FaPaperPlane,
  FaPaperclip,
  FaImage,
  FaMicrophone,
  FaStop,
  FaTimes,
  FaPlay,
  FaPause,
  FaCheckCircle,
  FaEllipsisV,
  FaTrashAlt,
  FaLock,
  FaChevronUp,
  FaChevronDown,
  FaReply,
  FaCheck,
  FaRegClock,
  FaDownload,
  FaExclamationTriangle,
  FaSpinner,
  FaStar,
  FaRegStar,
  FaArchive,
  FaUndo,
  FaFile,
  FaCamera,
  FaUser,
} from "react-icons/fa";
import { toast } from "react-hot-toast";

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

// ─── Helpers ──────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const SEEN_TICK_COLOR = "#34B7F1";
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

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);
  return matches;
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

// ─── Attachment Preview Modal ──────────────────────────────────────────
const AttachmentPreviewModal = ({
  isOpen,
  onClose,
  previewData,
  onSend,
  onRemove,
  brandColor,
}) => {
  if (!isOpen || !previewData) return null;

  const { file, preview, type, name } = previewData;
  const isImage = type === "image";
  const isVideo = type === "video";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800/60">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {isImage ? "Image Preview" : isVideo ? "Video Preview" : "File Preview"}
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
              <p className="text-sm text-gray-600 dark:text-gray-300">{name || "File"}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : ""}
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

// ─── Confirm Modal ──────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, danger = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 dark:bg-[#0d9488] hover:bg-teal-700 dark:hover:bg-[#0f9e96]"
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Message Action Modal (mobile) ─────────────────────────────────
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] rounded-t-2xl w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "70vh", overflowY: "auto" }}
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700/60">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {message.messageType === "image" ? <FaImage className="text-sm" /> : <FaComment className="text-sm" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {message.content ? message.content.substring(0, 60) : message.mediaName || "Media"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(message.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="space-y-1">
          <button
            onClick={() => {
              onReply(message);
              onClose();
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaReply className="text-sm" /> <span className="text-sm font-medium">Reply</span>
          </button>
          {isOwn && (
            <button
              onClick={() => {
                onDelete(message._id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <FaTrashAlt className="text-sm" /> <span className="text-sm font-medium">Delete for everyone</span>
            </button>
          )}
          {isStarred ? (
            <button
              onClick={() => {
                onUnstar(message._id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 transition"
            >
              <FaStar className="text-sm" /> <span className="text-sm font-medium">Unstar</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onStar(message._id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaRegStar className="text-sm" /> <span className="text-sm font-medium">Star</span>
            </button>
          )}
          {isArchived ? (
            <button
              onClick={() => {
                onUnarchive(message._id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
            >
              <FaUndo className="text-sm" /> <span className="text-sm font-medium">Unarchive</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onArchive(message._id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaArchive className="text-sm" /> <span className="text-sm font-medium">Archive</span>
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

// ─── Message Ticks ──────────────────────────────────────────────────
const MessageTicks = ({ message, isOwn }) => {
  if (!isOwn) return null;
  if (message._pending) return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
  if (message._failed) return <FaTimes className="text-[10px] text-red-500" />;
  if (!message._sent) return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
  if (!message._delivered && !message._read) return <FaCheck className="text-[10px] text-gray-400 dark:text-gray-500" />;
  if (message._delivered && !message._read)
    return (
      <span className="inline-flex items-center -space-x-[5px] text-gray-400 dark:text-gray-500">
        <FaCheck className="text-[10px]" />
        <FaCheck className="text-[10px]" />
      </span>
    );
  return (
    <span className="inline-flex items-center -space-x-[5px]">
      <FaCheck className="text-[10px]" style={{ color: SEEN_TICK_COLOR }} />
      <FaCheck className="text-[10px]" style={{ color: SEEN_TICK_COLOR }} />
    </span>
  );
};

// ─── Audio Waveform ──────────────────────────────────────────────────
const WAVEFORM_BARS = [6, 11, 15, 9, 17, 12, 7, 14, 18, 10, 6, 13, 16, 11, 8, 15, 12, 7, 13, 9, 6, 10];
const AudioWaveform = ({ isOwn, isPlaying, brandColor }) => (
  <div className="flex items-center gap-[2px] h-6 flex-1">
    {WAVEFORM_BARS.map((h, i) => (
      <span
        key={i}
        className="w-[2.5px] rounded-full transition-opacity"
        style={{
          height: `${h * 2}px`,
          backgroundColor: isOwn ? "rgba(255,255,255,0.85)" : brandColor,
          opacity: isPlaying ? 1 : 0.55,
        }}
      />
    ))}
  </div>
);

// ─── Image Preview Modal ────────────────────────────────────────────
const ImagePreviewModal = ({ imageUrl, onClose, senderName, time }) => {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 text-white flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1">
            <FaArrowLeft />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{senderName || "Photo"}</p>
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

// ─── Quoted Reply Block ─────────────────────────────────────────────
const QuotedReplyBlock = ({ replyData, isOwn, brandColor, onJump }) => {
  if (!replyData) return null;
  const name = replyData.senderName || "Unknown";
  const text = replyData.content
    ? replyData.content
    : replyData.mediaName
    ? `📎 ${replyData.mediaName}`
    : replyData.messageType === "image"
    ? "📷 Photo"
    : replyData.messageType === "audio"
    ? "🎤 Voice note"
    : "Media";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump && onJump(replyData.id);
      }}
      className={`block w-full text-left mb-1.5 px-2.5 py-1.5 rounded-lg border-l-2 text-xs cursor-pointer transition ${
        isOwn
          ? "bg-black/10 border-white/60 hover:bg-black/20"
          : "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1]"
      }`}
      style={!isOwn ? { borderLeftColor: brandColor } : {}}
    >
      <p className={`font-semibold truncate ${isOwn ? "text-white/90" : ""}`} style={isOwn ? {} : { color: brandColor }}>
        {name}
      </p>
      <p className={`truncate ${isOwn ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}>{text}</p>
    </button>
  );
};

// ─── Reply Preview Bar ──────────────────────────────────────────────
const ReplyPreview = ({ replyTo, onCancel, brandColor, resolveSender }) => {
  if (!replyTo) return null;
  const sender = resolveSender ? resolveSender(replyTo.sender) : replyTo.sender;
  const senderName = sender?.name || "Unknown";
  const content = replyTo.content || (replyTo.mediaName ? `📎 ${replyTo.mediaName}` : "Media");
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

// ─── Media Message Component ──────────────────────────────────────────
const MediaMessage = ({
  message,
  isOwn,
  isDM,
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
  // ── Pending state ──
  if (message._pending) {
    return (
      <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
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

  // ── Failed state ──
  if (message._failed) {
    return (
      <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
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

  // ── Deleted state ──
  if (message.isDeleted) {
    return (
      <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
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

  const isArchived = message.archivedBy?.some((id) => id === userId) || false;
  const isStarred = message.starredBy?.some((id) => id === userId) || false;

  const replyPreview = (() => {
    const replyTo = message?.replyTo;
    if (!replyTo) return null;
    if (typeof replyTo === "object") {
      const resolvedSender = resolveSender ? resolveSender(replyTo.sender) : replyTo.sender;
      return {
        id: replyTo._id,
        senderName: resolvedSender?.name || replyTo.senderName || "Unknown",
        content: replyTo.content,
        mediaName: replyTo.mediaName,
        messageType: replyTo.messageType,
      };
    }
    const original = allMessages?.find((m) => m._id === replyTo);
    if (!original) return null;
    const resolvedSender = resolveSender ? resolveSender(original.sender) : original.sender;
    return {
      id: original._id,
      senderName: resolvedSender?.name || "Unknown",
      content: original.content,
      mediaName: original.mediaName,
      messageType: original.messageType,
    };
  })();

  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const handleDownload = (e) => {
    e.stopPropagation();
    if (message.mediaUrl) {
      const link = document.createElement("a");
      link.href = message.mediaUrl;
      link.download = message.mediaName || "file";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderMediaContent = () => {
    if (!message.mediaUrl) return null;
    switch (message.messageType) {
      case "image":
        return null;
      case "video":
        return <video src={message.mediaUrl} controls className="max-w-full rounded-lg max-h-80" />;
      case "audio":
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
              style={{ backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : brandColor }}
            >
              {isPlaying ? <FaPause className="text-xs text-white" /> : <FaPlay className="text-xs text-white ml-0.5" />}
            </button>
            <AudioWaveform isOwn={isOwn} isPlaying={isPlaying} brandColor={brandColor} />
            <span className={`text-[10px] flex-shrink-0 ${isOwn ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}>
              {message.mediaDuration ? formatTime(message.mediaDuration) : "0:00"}
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
      case "file":
        return (
          <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
              📄
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{message.mediaName || "File"}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{message.mediaSize ? `${(message.mediaSize / 1024).toFixed(1)} KB` : "File"}</div>
            </div>
            <button onClick={handleDownload} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
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
    transition: swipeX === 0 ? "transform 0.2s ease" : "none",
  };
  const swipeIconOpacity = Math.min(swipeX / SWIPE_REPLY_THRESHOLD, 1);

  const maxWidthClass = isMobile ? "max-w-[75%]" : "max-w-[85%]";

  if (message.messageType === "image") {
    return (
      <div
        data-message-id={message._id}
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {isMobile && swipeX > 0 && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" style={{ opacity: swipeIconOpacity }}>
            <FaReply className="text-sm" />
          </div>
        )}
        <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`} style={isMobile ? swipeStyle : undefined}>
          {!isOwn && (
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
              {senderProfile ? (
                <img src={senderProfile} alt={senderName} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: brandColor }}
                >
                  {senderName?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </div>
          )}
          <div className={`${maxWidthClass} ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
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
                onImageClick({ url: message.mediaUrl, senderName: isOwn ? "You" : senderName, time })
              }
            >
              <img src={message.mediaUrl} alt={message.mediaName || "Image"} className="max-w-full max-h-80 object-cover w-full" />
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onReply(message);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaReply className="text-xs" /> Reply
                      </button>
                      {isOwn && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onDelete(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full"
                        >
                          <FaTrashAlt className="text-xs" /> Delete
                        </button>
                      )}
                      {isStarred ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onUnstar(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full"
                        >
                          <FaStar className="text-xs" /> Unstar
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onStar(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                        >
                          <FaRegStar className="text-xs" /> Star
                        </button>
                      )}
                      {isArchived ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onUnarchive(message._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full"
                        >
                          <FaUndo className="text-xs" /> Unarchive
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onArchive(message._id);
                          }}
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

  return (
    <div
      data-message-id={message._id}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {isMobile && swipeX > 0 && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" style={{ opacity: swipeIconOpacity }}>
          <FaReply className="text-sm" />
        </div>
      )}
      <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`} style={isMobile ? swipeStyle : undefined}>
        {!isOwn && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
            {senderProfile ? (
              <img src={senderProfile} alt={senderName} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: brandColor }}
              >
                {senderName?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
        )}
        <div className={`${maxWidthClass} ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
          {!isOwn && <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1">{senderName}</span>}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm break-words w-full ${
              isOwn ? "text-white" : "bg-gray-100 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200"
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
          <div className={`flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 ${isOwn ? "flex-row-reverse" : ""}`}>
            <span>{time}</span>
            <MessageTicks message={message} isOwn={isOwn} />
            {!isMobile && (
              <div className="relative ml-2" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5"
                >
                  <FaEllipsisV className="text-xs" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 bottom-6 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[160px] z-10 py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onReply(message);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                    >
                      <FaReply className="text-xs" /> Reply
                    </button>
                    {isOwn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onDelete(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full"
                      >
                        <FaTrashAlt className="text-xs" /> Delete
                      </button>
                    )}
                    {isStarred ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onUnstar(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full"
                      >
                        <FaStar className="text-xs" /> Unstar
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onStar(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                      >
                        <FaRegStar className="text-xs" /> Star
                      </button>
                    )}
                    {isArchived ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onUnarchive(message._id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full"
                      >
                        <FaUndo className="text-xs" /> Unarchive
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onArchive(message._id);
                        }}
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

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaceChatId = () => {
  const { workspaceId, chatId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userInfo } = useSelector((state) => state.auth);

  // ─── All hooks – unconditionally called ──────────────────────────
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // ─── Attachment preview state ─────────────────────────────────────
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    danger: false,
  });
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    message: null,
  });

  const { socket, isConnected } = useSocket();
  const [initiateCall] = useInitiateCallMutation();

  // API hooks
  const {
    data: workspaceData,
    error: workspaceError,
    isLoading: workspaceLoading,
  } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } = useGetUserChatsQuery(workspaceId);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useGetChatMessagesQuery(
    { chatId, page: 1, limit: 50 },
    { skip: !chatId }
  );
  const [sendMessageApi] = useSendMessageMutation();
  const [deleteMessageApi] = useDeleteMessageMutation();
  const [archiveMessage] = useArchiveMessageMutation();
  const [unarchiveMessage] = useUnarchiveMessageMutation();
  const [starMessage] = useStarMessageMutation();
  const [unstarMessage] = useUnstarMessageMutation();

  // ─── Voice recording states ──────────────────────────────────────
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

  // ─── Scroll state ──────────────────────────────────────────────────
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // ─── Memoized data ────────────────────────────────────────────────
  const workspace = useMemo(() => workspaceData?.workspace, [workspaceData]);
  const chats = useMemo(() => chatsData?.chats || [], [chatsData]);
  const chat = useMemo(() => {
    if (!chats.length || !chatId) return null;
    return chats.find((c) => c._id === chatId) || null;
  }, [chats, chatId]);

  const otherParticipant = useMemo(() => {
    if (!chat || chat.type !== "direct") return null;
    return chat.participants?.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    )?.user || null;
  }, [chat, userInfo]);

  // ─── Resolve sender ──────────────────────────────────────────────
  const userMapRef = useRef(new Map());

  const resolveSender = useCallback((senderField) => {
    if (!senderField) return { name: "Unknown", profile: null };
    if (typeof senderField === "string") {
      const found = userMapRef.current.get(senderField);
      if (found) {
        const name = found.name || found.username || found.email || "Unknown";
        return { ...found, name };
      }
      return { _id: senderField, name: "Unknown", profile: null };
    }
    if (senderField.name) return senderField;
    const found = senderField._id ? userMapRef.current.get(senderField._id) : null;
    if (found) {
      const name = found.name || found.username || found.email || "Unknown";
      return {
        ...senderField,
        name: found.name || found.username || found.email || "Unknown",
        profile: found.profile ?? senderField.profile,
      };
    }
    const name = senderField.username || senderField.email || "Unknown";
    return { ...senderField, name };
  }, []);

  // ─── Jump to message ──────────────────────────────────────────────
  const handleJumpToMessage = useCallback((messageId) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-message-id="${messageId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-teal-400", "rounded-2xl");
    setTimeout(() => target.classList.remove("ring-2", "ring-teal-400", "rounded-2xl"), 1200);
  }, []);

  // ─── Effects ──────────────────────────────────────────────────────────

  // Populate user map
  useEffect(() => {
    if (workspace?.members) {
      const map = new Map();
      workspace.members.forEach((m) => {
        const user = m.user || m;
        if (user._id) map.set(user._id, user);
      });
      if (otherParticipant?._id) map.set(otherParticipant._id, otherParticipant);
      if (userInfo?._id) map.set(userInfo._id, userInfo);
      userMapRef.current = map;
    }
  }, [workspace, otherParticipant, userInfo]);

  // ─── Improved merge function with delivered/read ────────────────
  const mergeMessagesIntoState = useCallback(
    (incomingList) => {
      if (!incomingList || incomingList.length === 0) return;
      setLocalMessages((prev) => {
        let next = prev;
        let mutated = false;

        incomingList.forEach((incoming) => {
          const isOwn = incoming.sender?._id === userInfo?._id || incoming.sender === userInfo?._id;

          const existingIdx = next.findIndex((m) => m._id === incoming._id);

          if (existingIdx > -1) {
            if (!mutated) next = [...next];
            mutated = true;
            const existing = next[existingIdx];

            const updated = {
              ...incoming,
              _temp: false,
              _pending: false,
              _failed: false,
              _sent: true,
              _delivered: true,
              _read: false,
            };

            if (isOwn) {
              const otherId = otherParticipant?._id;
              if (otherId && incoming.readBy?.some((r) => r.user === otherId || r.user?._id === otherId)) {
                updated._read = true;
              }
            } else {
              if (incoming.readBy?.some((r) => r.user === userInfo?._id || r.user?._id === userInfo?._id)) {
                updated._read = true;
              }
            }

            next[existingIdx] = updated;
            return;
          }

          if (isOwn) {
            const tempIdx = next.findIndex(
              (m) =>
                m._temp &&
                m.content === incoming.content &&
                Math.abs(new Date(m.createdAt) - new Date(incoming.createdAt)) < 5000
            );
            if (tempIdx > -1) {
              if (!mutated) next = [...next];
              mutated = true;
              const realMsg = {
                ...incoming,
                _temp: false,
                _pending: false,
                _failed: false,
                _sent: true,
                _delivered: true,
                _read: false,
              };
              const otherId = otherParticipant?._id;
              if (otherId && incoming.readBy?.some((r) => r.user === otherId || r.user?._id === otherId)) {
                realMsg._read = true;
              }
              next[tempIdx] = realMsg;
              return;
            }
          }

          const msg = {
            ...incoming,
            _temp: false,
            _pending: false,
            _failed: false,
            _sent: true,
            _delivered: true,
            _read: false,
          };
          if (isOwn) {
            const otherId = otherParticipant?._id;
            if (otherId && incoming.readBy?.some((r) => r.user === otherId || r.user?._id === otherId)) {
              msg._read = true;
            }
          } else {
            if (incoming.readBy?.some((r) => r.user === userInfo?._id || r.user?._id === userInfo?._id)) {
              msg._read = true;
            }
          }

          if (!mutated) next = [...next];
          mutated = true;
          next.push(msg);
        });

        return mutated ? next : prev;
      });
    },
    [userInfo?._id, otherParticipant?._id]
  );

  useEffect(() => {
    if (messagesData?.messages) {
      mergeMessagesIntoState(messagesData.messages);
    }
  }, [messagesData, mergeMessagesIntoState]);

  // ─── Socket events ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;
    socket.emit("join-chat", chatId);

    const handleNewMessage = (incoming) => {
      const incomingChatId = typeof incoming.chat === "string" ? incoming.chat : incoming.chat?._id;
      if (incomingChatId && incomingChatId !== chatId) return;
      mergeMessagesIntoState([incoming]);
    };

    // ── UPDATED: set isDeleted instead of filtering ──
    const handleMessageDeleted = ({ messageId }) => {
      setLocalMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true } : m))
      );
    };

    const handleMessageRead = ({ chatId: readChatId, messageId, readBy }) => {
      if (readChatId !== chatId) return;
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, _read: true } : msg
        )
      );
    };

    socket.on("new-message", handleNewMessage);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("message-read", handleMessageRead);

    return () => {
      socket.emit("leave-chat", chatId);
      socket.off("new-message", handleNewMessage);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("message-read", handleMessageRead);
    };
  }, [socket, isConnected, chatId, mergeMessagesIntoState]);

  // ─── Polling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(() => {
      refetchMessages();
      refetchChats();
    }, 3000);
    return () => clearInterval(interval);
  }, [chatId, refetchMessages, refetchChats]);

  // ─── Focus input on reply ─────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get("focusInput") === "true") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [searchParams]);

  // ─── Scroll behavior ──────────────────────────────────────────────
  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
    if (atBottom) setShowScrollDown(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
  };

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setShowScrollDown(true);
    }
  }, [localMessages.length, isAtBottom]);

  // ─── Auto-resize textarea ─────────────────────────────────────────
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
  }, [message]);

  // ─── Mark message as read (Observer + socket emit) ──────────────
  const markMessageAsRead = useCallback((messageId) => {
    if (!socket || !isConnected) return;
    const msg = localMessages.find((m) => m._id === messageId);
    if (!msg || msg._read || msg.sender?._id === userInfo?._id) return;
    socket.emit("mark-read", { chatId, messageIds: [messageId] });
  }, [socket, isConnected, chatId, localMessages, userInfo]);

  // ─── Intersection Observer for auto‑read ─────────────────────────
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            if (messageId) {
              const msg = localMessages.find((m) => m._id === messageId);
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
    recordingTimerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordingBlob(audioBlob);
        setShowRecordedPreview(true);
        stopTimer();
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingTime(0);
      setShowRecordedPreview(false);
      startTimer();
    } catch (err) {
      console.error("Web recording error:", err);
      let msg = "Microphone access denied";
      if (err.name === "NotAllowedError") msg = "Microphone permission denied. Please grant it in system settings.";
      else if (err.name === "NotFoundError") msg = "No microphone found.";
      else if (err.name === "NotReadableError") msg = "Microphone busy — please try again.";
      else if (err.name === "AbortError") msg = "User canceled the permission prompt.";
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
    formData.append("media", audioFile);
    formData.append("messageType", "audio");
    formData.append("mediaDuration", recordingTime.toString());
    if (replyToMessage) formData.append("replyToId", replyToMessage._id);

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
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
      replyTo: replyToMessage ? {
        _id: replyToMessage._id,
        sender: replyToMessage.sender,
        content: replyToMessage.content,
        mediaName: replyToMessage.mediaName,
        messageType: replyToMessage.messageType,
      } : null,
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
      setLocalMessages(prev => {
        const tempExists = prev.some(m => m._tempId === tempId);
        const realExists = prev.some(m => m._id === result._id);
        let newList = prev;
        if (tempExists) {
          newList = newList.filter(m => m._tempId !== tempId);
        }
        if (!realExists) {
          newList = [...newList, { ...result, _pending: false, _sent: true, _delivered: true, _read: false }];
        }
        return newList;
      });
      toast.success('Voice note sent!');
    } catch (err) {
      setLocalMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _pending: false, _failed: true } : m));
      toast.error(err?.data?.message || 'Failed to send voice note');
    }
  };

  // ─── Handle paste event ──────────────────────────────────────────
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setAttachmentPreview({
              file: file,
              preview: event.target.result,
              type: "image",
              name: file.name || "image.png",
            });
            setIsPreviewOpen(true);
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  }, []);

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
            type: "image",
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
            type: "image",
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
          type: "file",
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
        if (type === "image") {
          setShowMediaPicker(true); // show custom modal
        } else {
          handlePickFile(); // files use native picker directly
        }
        return;
      }
      // Web fallback: hidden <input type="file">
      if (type === "file") {
        fileInputRef.current?.click();
      } else {
        imageInputRef.current?.click();
      }
    },
    [handlePickFile]
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

  // ─── Optimistic sendAttachment ────────────────────────────────────
  const handleSendAttachment = async (previewData) => {
    const { file, type } = previewData;
    if (!file) return;

    const formData = new FormData();
    formData.append("media", file);
    const messageType = type === "image" ? "image" : "file";
    formData.append("messageType", messageType);
    if (replyToMessage) formData.append("replyToId", replyToMessage._id);

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
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
      messageType: messageType,
      chat: chatId,
      replyTo: replyToMessage ? {
        _id: replyToMessage._id,
        sender: replyToMessage.sender,
        content: replyToMessage.content,
        mediaName: replyToMessage.mediaName,
        messageType: replyToMessage.messageType,
      } : null,
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
      setLocalMessages(prev => {
        const tempExists = prev.some(m => m._tempId === tempId);
        const realExists = prev.some(m => m._id === result._id);
        let newList = prev;
        if (tempExists) {
          newList = newList.filter(m => m._tempId !== tempId);
        }
        if (!realExists) {
          newList = [...newList, { ...result, _pending: false, _sent: true, _delivered: true, _read: false }];
        }
        return newList;
      });
      toast.success(`${type === "image" ? "Image" : "File"} sent!`);
    } catch (err) {
      setLocalMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _pending: false, _failed: true } : m));
      toast.error(err?.data?.message || `Failed to send ${type}`);
    }
  };

  const handleRemoveAttachment = () => {
    setIsPreviewOpen(false);
    setAttachmentPreview(null);
  };

  // ─── Early returns ────────────────────────────────────────────────
  if (workspaceError) {
    navigate("/my-workspaces");
    return null;
  }
  if (workspaceLoading || chatsLoading || messagesLoading || !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-teal-500 dark:border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Derived data ──────────────────────────────────────────────────
  const displayName = otherParticipant?.name || "Unknown";
  const displayAvatar = otherParticipant?.profile || null;
  const isDMOnline = otherParticipant?.online || false;
  const brandColor = workspace.color || "#0d9488";

  // ─── Handlers ──────────────────────────────────────────────────────

  // ─── Optimistic text send ──────────────────────────────────────────
  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !socket) return;

    const senderWithName = {
      ...userInfo,
      name: userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      _id: tempId,
      _temp: true,
      _pending: true,
      _sent: false,
      _failed: false,
      _delivered: false,
      _read: false,
      content: trimmed,
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: "text",
      chat: chatId,
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
    setMessage("");
    const replyToId = replyToMessage?._id || null;
    setReplyToMessage(null);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    socket.emit(
      "send-message",
      {
        chatId,
        content: trimmed,
        messageType: "text",
        mentions: [],
        replyToId,
      },
      (response) => {
        if (response?.error) {
          setLocalMessages((prev) =>
            prev.map((m) => (m._id === tempId ? { ...m, _pending: false, _failed: true } : m))
          );
          toast.error(response.error);
        } else {
          setLocalMessages((prev) =>
            prev.map((m) => (m._id === tempId ? { ...m, _pending: false, _sent: true } : m))
          );
        }
      }
    );
  };

  // ─── Optimistic delete ──────────────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Message",
      message: "Are you sure you want to delete this message?",
      onConfirm: async () => {
        // Optimistically mark as deleted
        setLocalMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDeleted: true } : m));
        try {
          await deleteMessageApi(messageId).unwrap();
          toast.success("Message deleted");
        } catch (err) {
          // Revert on failure
          setLocalMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDeleted: false } : m));
          toast.error(err?.data?.message || "Failed to delete message");
        }
      },
      danger: true,
    });
  };

  const handleArchiveMessage = async (messageId) => {
    try {
      await archiveMessage(messageId).unwrap();
      toast.success("Message archived");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to archive message");
    }
  };

  const handleUnarchiveMessage = async (messageId) => {
    try {
      await unarchiveMessage(messageId).unwrap();
      toast.success("Message unarchived");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to unarchive message");
    }
  };

  const handleStarMessage = async (messageId) => {
    try {
      await starMessage(messageId).unwrap();
      toast.success("Message starred");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to star message");
    }
  };

  const handleUnstarMessage = async (messageId) => {
    try {
      await unstarMessage(messageId).unwrap();
      toast.success("Message unstarred");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to unstar message");
    }
  };

  const handleReply = (msg) => {
    setReplyToMessage(msg);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const cancelReply = () => setReplyToMessage(null);

  const handleLongPress = (msg) => {
    setActionModal({ isOpen: true, message: msg });
  };

  const handleCall = async (type) => {
    if (!workspace || !chat) {
      toast.error("Missing workspace or chat data");
      return;
    }
    const otherId = otherParticipant?._id;
    if (!otherId) {
      toast.error("No other participant in this DM");
      return;
    }
    try {
      const response = await initiateCall({
        workspaceId,
        type,
        participantIds: [otherId],
      }).unwrap();
      navigate(`/call/${response.call.roomId}`, {
        state: {
          callData: {
            ...response.call,
            status: "ringing",
            isInitiator: true,
            workspaceColor: brandColor,
          },
        },
      });
    } catch (err) {
      toast.error(err?.data?.message || "Failed to initiate call");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────
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

      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0f0f12] h-full overflow-hidden">
        {/* Header */}
        <header className="fixed lg:sticky top-0 left-0 right-0 lg:left-auto lg:right-auto z-20 flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl text-gray-800 dark:text-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate(`/my-workspace/${workspaceId}/channels`)}
              className="p-1 lg:hidden flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
            >
              <FaArrowLeft />
            </button>
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt=""
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-700/60"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-base text-gray-800 dark:text-gray-100 truncate">{displayName}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {isDMOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => handleCall("voice")} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
              <FaPhone />
            </button>
            <button onClick={() => handleCall("video")} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
              <FaVideo />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="h-full overflow-y-auto px-4 py-3 space-y-4 pt-20 lg:pt-3 pb-24 lg:pb-3"
          >
            {localMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <FaComment className="text-4xl mb-2 opacity-30" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1 opacity-60">Paste images or screenshots here</p>
              </div>
            ) : (
              localMessages.map((msg) => {
                const sender = resolveSender(msg.sender);
                const isOwn = msg.sender?._id === userInfo?._id || msg.sender === userInfo?._id || sender?._id === userInfo?._id;
                return (
                  <MediaMessage
                    key={msg._id}
                    message={msg}
                    isOwn={isOwn}
                    isDM={true}
                    senderName={sender?.name || "Unknown"}
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

        {/* Input area */}
        <div className="fixed lg:sticky bottom-0 left-0 right-0 lg:left-auto lg:right-auto z-20 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/90 dark:bg-[#0f0f12]/90 backdrop-blur-xl flex-shrink-0 px-3 sm:px-4">
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
                  {recordingPaused ? "Paused" : "Recording..."} {formatTime(recordingTime)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={pauseRecording}
                  className="text-xs text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
                >
                  {recordingPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={cancelRecording}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"
                >
                  <FaTrashAlt className="text-xs" />
                </button>
                <button
                  onClick={stopRecording}
                  className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition"
                >
                  <FaStop className="text-xs" />
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-end gap-2 py-2">
            <button
              type="button"
              onClick={() => handleFileUpload("file")}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0 mb-1"
            >
              <FaPaperclip className="text-sm" />
            </button>
            <button
              type="button"
              onClick={() => handleFileUpload("image")}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0 mb-1"
            >
              <FaImage className="text-sm" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,video/*"
            />
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (isMobile) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Message"
              rows={1}
              className="flex-1 min-w-0 px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-2xl bg-white dark:bg-[#0b0b10] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-[#0d9488] resize-none max-h-32 overflow-y-auto"
              style={{
                minHeight: "42px",
                lineHeight: "1.5",
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

      {/* Modals */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />
      <MessageActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, message: null })}
        message={actionModal.message}
        isOwn={
          actionModal.message?.sender?._id === userInfo?._id ||
          actionModal.message?.sender === userInfo?._id
        }
        isStarred={actionModal.message?.starredBy?.some((id) => id === userInfo?._id) || false}
        isArchived={actionModal.message?.archivedBy?.some((id) => id === userInfo?._id) || false}
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

export default MyWorkspaceChatId;