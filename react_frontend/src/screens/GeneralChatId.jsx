// pages/GeneralChatId.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  useGetChatMessagesQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
  useArchiveMessageMutation,
  useUnarchiveMessageMutation,
  useStarMessageMutation,
  useUnstarMessageMutation,
} from "../slices/messagingApiSlice";
import { useGetUserChatsQuery } from "../slices/messagingApiSlice";
import { useSocket } from "../components/SocketContext.jsx";
import { toast } from "react-hot-toast";
import {
  FaArrowLeft,
  FaPaperPlane,
  FaPaperclip,
  FaImage,
  FaMicrophone,
  FaStop,
  FaTimes,
  FaPlay,
  FaPause,
  FaEllipsisV,
  FaTrashAlt,
  FaArchive,
  FaUndo,
  FaStar,
  FaRegStar,
  FaReply,
  FaCheck,
  FaRegClock,
  FaSpinner,
  FaComment,
  FaChevronDown,
  FaDownload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaUser,
  FaInfoCircle,
  FaCamera,
  FaSmile,
  FaCopy,
  FaLink,
} from "react-icons/fa";
import GeneralSidebar from "../components/GeneralSidebar";

import { VoiceRecorder } from "capacitor-voice-recorder";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { FilePicker } from "@capawesome/capacitor-file-picker";

// ─── Helpers ──────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const SEEN_TICK_COLOR = "#34B7F1";

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

const formatDateDivider = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const safeFormatTime = (dateString) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

// ─── Emoji picker data & helpers ───────────────────────────────────
const EMOJI_LIST = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜", "🤔", "😎",
  "😢", "😭", "😡", "🥳", "👍", "👎", "🙏", "👏", "💪", "🔥",
  "❤️", "💔", "💯", "✨", "🎉", "😴", "🤗", "😇", "🙄", "😅",
  "🤝", "👋", "🤞", "🫶", "😏", "🥺", "😱", "😳", "🤩", "🫡",
  "💀", "👀", "😤", "🤦", "🤷", "🙈", "🙉", "🙊", "💃", "🕺",
  "🍕", "☕", "🎂", "🌹", "⚽", "🏆", "💰", "📌", "✅", "❌",
];

// ─── Link detection / preview helpers ──────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const extractFirstUrl = (text) => {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
};

const isUrlPart = (part) => /^https?:\/\//.test(part);

const LinkifiedText = ({ text, isOwn }) => {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        isUrlPart(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`underline break-all ${
              isOwn ? "text-white" : "text-teal-600 dark:text-teal-400"
            }`}
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

const linkPreviewCache = new Map();

const LinkPreviewCard = ({ url, isOwn }) => {
  const [data, setData] = useState(() => linkPreviewCache.get(url) || null);
  const [loading, setLoading] = useState(!linkPreviewCache.has(url));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (linkPreviewCache.has(url)) {
      setData(linkPreviewCache.get(url));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.status === "success" && json?.data) {
          linkPreviewCache.set(url, json.data);
          setData(json.data);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) return null;

  let domain = "";
  try {
    domain = new URL(url).hostname.replace("www.", "");
  } catch {
    domain = url;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`block mt-1.5 rounded-xl overflow-hidden border ${
        isOwn
          ? "border-white/20 bg-black/10 hover:bg-black/20"
          : "border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/60"
      } transition`}
    >
      {loading ? (
        <div className="p-3 animate-pulse">
          <div
            className={`h-3 w-2/3 rounded-full mb-2 ${
              isOwn ? "bg-white/20" : "bg-gray-300 dark:bg-gray-700"
            }`}
          />
          <div
            className={`h-2 w-1/3 rounded-full ${
              isOwn ? "bg-white/20" : "bg-gray-300 dark:bg-gray-700"
            }`}
          />
        </div>
      ) : data ? (
        <>
          {data.image?.url && (
            <img
              src={data.image.url}
              alt={data.title || "Link preview"}
              className="w-full max-h-40 object-cover"
            />
          )}
          <div className="p-2.5">
            {data.title && (
              <p
                className={`text-xs font-semibold line-clamp-1 ${
                  isOwn ? "text-white" : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {data.title}
              </p>
            )}
            {data.description && (
              <p
                className={`text-[11px] line-clamp-2 mt-0.5 ${
                  isOwn ? "text-white/70" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {data.description}
              </p>
            )}
            <p
              className={`text-[10px] mt-1 flex items-center gap-1 ${
                isOwn ? "text-white/50" : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <FaLink className="text-[9px]" /> {domain}
            </p>
          </div>
        </>
      ) : null}
    </a>
  );
};

// ─── Skeleton Message Component ────────────────────────────────────────
const SkeletonMessage = ({ isOwn }) => {
  const randomWidth = useCallback(() => {
    const widths = [
      "w-32",
      "w-40",
      "w-48",
      "w-52",
      "w-56",
      "w-36",
      "w-44",
      "w-60",
    ];
    return widths[Math.floor(Math.random() * widths.length)];
  }, []);

  const randomHeight = useCallback(() => {
    const heights = ["h-8", "h-10", "h-12", "h-9", "h-11"];
    return heights[Math.floor(Math.random() * heights.length)];
  }, []);

  return (
    <div
      className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""} animate-pulse`}
    >
      {!isOwn && (
        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-700" />
      )}
      <div
        className={`max-w-[75%] sm:max-w-[85%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}
      >
        {!isOwn && (
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded-full mb-0.5" />
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl ${isOwn ? "bg-teal-200/60 dark:bg-teal-700/40" : "bg-gray-200 dark:bg-gray-700/60"}`}
        >
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

// ─── Confirm Modal ──────────────────────────────────────────────────
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  danger = false,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>
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
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Media Picker Modal ────────────────────────────────────────────
const MediaPickerModal = ({
  isOpen,
  onClose,
  onTakePhoto,
  onChooseFromGallery,
}) => {
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

// ─── Audio Player with waveform (seekable) ────────────────────────
const AudioPlayer = ({
  src,
  isOwn,
  duration: initialDuration,
  onDurationReady,
}) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);

  // Waveform bars – same as original
  const WAVEFORM_BARS = [
    6, 11, 15, 9, 17, 12, 7, 14, 18, 10, 6, 13, 16, 11, 8, 15, 12, 7, 13, 9, 6,
    10,
  ];

  // Refs for drag/seek
  const waveformContainerRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };
    const handleLoadedMetadata = () => {
      const dur = audio.duration;
      if (dur && !isNaN(dur)) {
        setDuration(dur);
        onDurationReady?.(dur);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onDurationReady]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  // Seek helpers
  const getSeekPosition = (clientX) => {
    const container = waveformContainerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.min(Math.max(x / rect.width, 0), 1);
    return percent * duration;
  };

  const handleSeekStart = (e) => {
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX == null) return;
    isDraggingRef.current = true;
    const newTime = getSeekPosition(clientX);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekMove = (e) => {
    if (!isDraggingRef.current) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX == null) return;
    const newTime = getSeekPosition(clientX);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekEnd = () => {
    isDraggingRef.current = false;
  };

  // Click on waveform to seek
  const handleWaveformClick = (e) => {
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX == null) return;
    const newTime = getSeekPosition(clientX);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[220px] py-0.5">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : "#0d9488",
        }}
      >
        {isPlaying ? (
          <FaPause className="text-xs text-white" />
        ) : (
          <FaPlay className="text-xs text-white ml-0.5" />
        )}
      </button>

      {/* Waveform container – click/drag to seek */}
      <div
        ref={waveformContainerRef}
        className="flex-1 flex items-center h-6 relative cursor-pointer"
        onClick={handleWaveformClick}
        onMouseDown={handleSeekStart}
        onMouseMove={handleSeekMove}
        onMouseUp={handleSeekEnd}
        onMouseLeave={handleSeekEnd}
        onTouchStart={handleSeekStart}
        onTouchMove={handleSeekMove}
        onTouchEnd={handleSeekEnd}
      >
        <div className="flex items-center gap-[2px] h-full w-full">
          {WAVEFORM_BARS.map((h, i) => {
            // Determine if this bar is within the progress portion
            const barIndex = i / WAVEFORM_BARS.length;
            const isFilled = barIndex <= progressPercent / 100;
            return (
              <span
                key={i}
                className="w-[2.5px] rounded-full transition-all"
                style={{
                  height: `${h * 2}px`,
                  backgroundColor: isOwn
                    ? isFilled
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.3)"
                    : isFilled
                      ? "#0d9488"
                      : "#d1d5db",
                  opacity: isFilled ? 1 : 0.4,
                }}
              />
            );
          })}
        </div>
        {/* Optional small progress handle – not necessary but can be added */}
      </div>

      <span
        className={`text-[10px] flex-shrink-0 ${isOwn ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}
      >
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <audio ref={audioRef} src={src} className="hidden" />
    </div>
  );
};

// ─── Message Ticks ──────────────────────────────────────────────────
const MessageTicks = ({ message, isOwn }) => {
  if (!isOwn) return null;

  if (message._pending) {
    return (
      <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />
    );
  }
  if (message._failed) {
    return <FaTimes className="text-[10px] text-red-500" />;
  }
  if (!message._sent) {
    return (
      <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />
    );
  }

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

// ─── Quoted Reply Block ────────────────────────────────────────────
const QuotedReplyBlock = ({ replyData, isOwn, onJump }) => {
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
      style={!isOwn ? { borderLeftColor: "#0d9488" } : {}}
    >
      <p
        className={`font-semibold truncate ${isOwn ? "text-white/90" : ""}`}
        style={isOwn ? {} : { color: "#0d9488" }}
      >
        {name}
      </p>
      <p
        className={`truncate ${isOwn ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}
      >
        {text}
      </p>
    </button>
  );
};

// ─── Media Preview Component ──────────────────────────────────────
const MediaPreview = ({ mediaFile, onRemove, onSend, brandColor, isSending }) => {
  const [preview, setPreview] = useState(null);
  const [type, setType] = useState(null);

  useEffect(() => {
    if (mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setPreview(url);
      setType(mediaFile.type.startsWith("image/") ? "image" : "file");
      return () => URL.revokeObjectURL(url);
    }
  }, [mediaFile]);

  if (!mediaFile || !preview) return null;

  return (
    <div className="flex items-center gap-3 p-3 mb-2 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700/60">
      <div className="relative flex-shrink-0">
        {type === "image" ? (
          <img
            src={preview}
            alt="Preview"
            className="w-16 h-16 rounded-lg object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl">
            📄
          </div>
        )}
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition text-xs"
        >
          <FaTimes />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {mediaFile.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {(mediaFile.size / 1024).toFixed(1)} KB
        </p>
      </div>
      <button
        onClick={() => onSend(mediaFile)}
        disabled={isSending}
        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium flex-shrink-0 disabled:opacity-50"
        style={{ backgroundColor: brandColor || "#0d9488" }}
      >
        <FaPaperPlane className="inline mr-1 text-xs" /> Send
      </button>
    </div>
  );
};

// ─── Media Message Component ──────────────────────────────────────────
const MediaMessage = ({
  message,
  isOwn,
  senderName,
  senderProfile,
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
  // ── Deleted state (same for all) ──
  if (message.isDeleted) {
    return (
      <div
        className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
      >
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
  const [showMenu, setShowMenu] = useState(false);
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
      const rSender = resolveSender
        ? resolveSender(replyTo.sender)
        : replyTo.sender || {};
      return {
        id: replyTo._id,
        senderName: rSender?.name || replyTo.senderName || "Unknown",
        content: replyTo.content,
        mediaName: replyTo.mediaName,
        messageType: replyTo.messageType,
      };
    }
    const original = allMessages?.find((m) => m._id === replyTo);
    if (!original) return null;
    const rSender = resolveSender
      ? resolveSender(original.sender)
      : original.sender || {};
    return {
      id: original._id,
      senderName: rSender?.name || "Unknown",
      content: original.content,
      mediaName: original.mediaName,
      messageType: original.messageType,
    };
  })();

  // Link preview target (only relevant for text messages)
  const firstUrl = extractFirstUrl(message.content);

  // Touch handlers for swipe reply
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
      const capped = Math.min(deltaX, 72);
      setSwipeX(capped);
      if (capped >= 60 && !swipeTriggered.current) {
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
      if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        return (
          <video
            src={message.mediaUrl}
            controls
            className="max-w-full rounded-lg max-h-80"
          />
        );
      case "audio":
        return (
          <AudioPlayer
            src={message.mediaUrl}
            isOwn={isOwn}
            duration={message.mediaDuration}
            onDurationReady={(dur) => {
              // Optionally update message.mediaDuration if needed
            }}
          />
        );
      case "file":
        return (
          <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
              📄
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {message.mediaName || "File"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {message.mediaSize
                  ? `${(message.mediaSize / 1024).toFixed(1)} KB`
                  : "File"}
              </div>
            </div>
            <button
              onClick={handleDownload}
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
    transition: swipeX === 0 ? "transform 0.2s ease" : "none",
  };
  const swipeIconOpacity = Math.min(swipeX / 60, 1);
  const maxWidthClass = isMobile ? "max-w-[75%]" : "max-w-[85%]";

  // ─── Image messages ──────────────────────────────────────────────────
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
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            style={{ opacity: swipeIconOpacity }}
          >
            <FaReply className="text-sm" />
          </div>
        )}
        <div
          className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
          style={isMobile ? swipeStyle : undefined}
        >
          {!isOwn && (
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
              {senderProfile ? (
                <img
                  src={senderProfile}
                  alt={senderName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: "#0d9488" }}
                >
                  {senderName?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </div>
          )}
          <div
            className={`${maxWidthClass} ${isOwn ? "items-end" : "items-start"} flex flex-col`}
          >
            {!isOwn && (
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1 mb-0.5">
                {senderName}
              </span>
            )}
            {replyPreview && (
              <div className="w-full mb-1">
                <QuotedReplyBlock
                  replyData={replyPreview}
                  isOwn={isOwn}
                  onJump={onJumpToMessage}
                />
              </div>
            )}
            <div
              className="relative rounded-2xl overflow-hidden cursor-pointer group"
              onClick={(e) => {
                if (message.mediaUrl) {
                  onImageClick &&
                    onImageClick({
                      url: message.mediaUrl,
                      senderName: isOwn ? "You" : senderName,
                      time,
                    });
                } else {
                  toast.error("Image URL not available");
                }
              }}
            >
              {message.mediaUrl ? (
                <img
                  src={message.mediaUrl}
                  alt={message.mediaName || "Image"}
                  className="max-w-full max-h-80 object-cover w-full"
                />
              ) : (
                <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <FaExclamationTriangle className="text-2xl mr-2" /> Image
                  unavailable
                </div>
              )}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          closeMenu();
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
                            closeMenu();
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
                            closeMenu();
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
                            closeMenu();
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
                            closeMenu();
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
                            closeMenu();
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

  // ─── Text and other messages ──────────────────────────────────────
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
      <div
        className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
        style={isMobile ? swipeStyle : undefined}
      >
        {!isOwn && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
            {senderProfile ? (
              <img
                src={senderProfile}
                alt={senderName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: "#0d9488" }}
              >
                {senderName?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
        )}
        <div
          className={`${maxWidthClass} ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}
        >
          {!isOwn && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1">
              {senderName}
            </span>
          )}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm break-words w-full ${
              isOwn
                ? "text-white"
                : "bg-gray-100 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200"
            }`}
            style={isOwn ? { backgroundColor: "#0d9488" } : {}}
          >
            {replyPreview && (
              <QuotedReplyBlock
                replyData={replyPreview}
                isOwn={isOwn}
                onJump={onJumpToMessage}
              />
            )}
            {message.content && (
              <p className="mb-2 whitespace-pre-wrap break-words">
                <LinkifiedText text={message.content} isOwn={isOwn} />
              </p>
            )}
            {firstUrl && <LinkPreviewCard url={firstUrl} isOwn={isOwn} />}
            {renderMediaContent()}
          </div>
          <div
            className={`flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 ${isOwn ? "flex-row-reverse" : ""}`}
          >
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
                      onClick={(e) => {
                        e.stopPropagation();
                        closeMenu();
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
                          closeMenu();
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
                          closeMenu();
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
                          closeMenu();
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
                          closeMenu();
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
                          closeMenu();
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

// ─── Reply Preview Bar ────────────────────────────────────────────
const ReplyPreview = ({ replyTo, onCancel, resolveSender }) => {
  if (!replyTo) return null;
  const resolved = resolveSender
    ? resolveSender(replyTo.sender)
    : replyTo.sender;
  const senderName = resolved?.name || "Unknown";
  const content =
    replyTo.content ||
    (replyTo.mediaName ? `📎 ${replyTo.mediaName}` : "Media");
  return (
    <div className="flex items-center justify-between px-3 py-2 mb-2 bg-gray-100 dark:bg-gray-800/60 rounded-lg border-l-4 border-teal-500">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
          Replying to {senderName}
        </span>
        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {content}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition"
      >
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

// ─── Fullscreen image preview ──────────────────────────────────────
const ImagePreviewModal = ({ imageUrl, onClose, senderName, time }) => {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = "image";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    setImageError(false);
    setLoading(true);
  }, [imageUrl]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/70 text-white flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition"
          >
            <FaArrowLeft />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {senderName || "Photo"}
            </p>
            {time && <p className="text-[11px] text-white/60">{time}</p>}
          </div>
        </div>
        {imageUrl && (
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <FaDownload />
          </button>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {loading && (
          <div className="flex flex-col items-center text-white/60">
            <FaSpinner className="animate-spin text-4xl mb-2" />
            <span className="text-sm">Loading...</span>
          </div>
        )}
        {imageError || !imageUrl ? (
          <div className="flex flex-col items-center text-white/60">
            <FaExclamationTriangle className="text-4xl mb-2" />
            <span className="text-sm">Image not available</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setImageError(true);
            }}
          />
        )}
      </div>
    </div>
  );
};

// ─── Message Action Modal (mobile) ──────────────────────────────
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
  onCopy,
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
            {message.messageType === "image" ? (
              <FaImage className="text-sm" />
            ) : (
              <FaComment className="text-sm" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {message.content
                ? message.content.substring(0, 60)
                : message.mediaName || "Media"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(message.createdAt).toLocaleString()}
            </p>
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
            <FaReply className="text-sm" />{" "}
            <span className="text-sm font-medium">Reply</span>
          </button>
          <button
            onClick={() => {
              onCopy(message);
              onClose();
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaCopy className="text-sm" />{" "}
            <span className="text-sm font-medium">Copy</span>
          </button>
          {isOwn && (
            <button
              onClick={() => {
                onDelete(message._id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <FaTrashAlt className="text-sm" />{" "}
              <span className="text-sm font-medium">Delete for everyone</span>
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
              <FaStar className="text-sm" />{" "}
              <span className="text-sm font-medium">Unstar</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onStar(message._id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaRegStar className="text-sm" />{" "}
              <span className="text-sm font-medium">Star</span>
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
              <FaUndo className="text-sm" />{" "}
              <span className="text-sm font-medium">Unarchive</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onArchive(message._id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaArchive className="text-sm" />{" "}
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

// ─── Contact Info Panel (DM only) ──────────────────────────────────
const ContactInfoPanel = ({ user, onlineStatus, onClose }) => {
  return (
    <div className="h-full bg-white dark:bg-[#14141a] border-l border-gray-200 dark:border-gray-800/60 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800/60">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">
          Contact Info
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition"
        >
          <FaTimes className="text-sm" />
        </button>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-center gap-4">
          {user?.profile ? (
            <img
              src={user.profile}
              alt=""
              className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-gray-700/60"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-2xl font-bold text-gray-600 dark:text-gray-300">
              {user?.name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div>
            <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
              {user?.name || "Unknown"}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {onlineStatus ? "🟢 Online" : "⚫ Offline"}
            </p>
          </div>
        </div>
        {user?.email && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Email
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              {user.email}
            </p>
          </div>
        )}
        {user?.username && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Username
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              @{user.username}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

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

// ─── Main Component ──────────────────────────────────────────────────
const GeneralChatId = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const inputAreaRef = useRef(null);
  const isSendingRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isDesktop = !isMobile;

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  const [inputHeight, setInputHeight] = useState(0);

  useEffect(() => {
    if (!inputAreaRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setInputHeight(entry.contentRect.height);
      }
    });
    observer.observe(inputAreaRef.current);
    return () => observer.disconnect();
  }, []);

  const { socket, isConnected } = useSocket();

  const {
    data: chatListData,
    isLoading: chatsListLoading,
    refetch: refetchChats,
  } = useGetUserChatsQuery({
    archived: false,
  });
  const chat = chatListData?.chats?.find((c) => c._id === chatId);

  useEffect(() => {
    if (chat && (chat.type !== "direct" || chat.scope !== "public")) {
      navigate("/chat");
    }
  }, [chat, navigate]);

  const otherParticipant =
    chat?.participants?.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id,
    )?.user || null;
  const displayName = otherParticipant?.name || "Unknown";
  const displayAvatar = otherParticipant?.profile || null;

  const [otherUserOnline, setOtherUserOnline] = useState(null);

  useEffect(() => {
    if (otherParticipant) {
      // We'll request presence below
    }
  }, [otherParticipant]);

  useEffect(() => {
    if (!socket || !isConnected || !otherParticipant?._id) return;
    socket.emit(
      "request-presence",
      { userId: otherParticipant._id },
      (response) => {
        if (response && typeof response.online === "boolean") {
          setOtherUserOnline(response.online);
        }
      },
    );
  }, [socket, isConnected, otherParticipant?._id]);

  const userMapRef = useRef(new Map());
  useEffect(() => {
    const map = new Map();
    if (otherParticipant) map.set(otherParticipant._id, otherParticipant);
    if (userInfo?._id) map.set(userInfo._id, userInfo);
    userMapRef.current = map;
  }, [otherParticipant, userInfo]);

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
    const found = senderField._id
      ? userMapRef.current.get(senderField._id)
      : null;
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

  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useGetChatMessagesQuery(
    { chatId, page: 1, limit: 50 },
    { skip: !chatId },
  );
  const [sendMessageApi] = useSendMessageMutation();
  const [deleteMessageApi] = useDeleteMessageMutation();
  const [archiveMessage] = useArchiveMessageMutation();
  const [unarchiveMessage] = useUnarchiveMessageMutation();
  const [starMessage] = useStarMessageMutation();
  const [unstarMessage] = useUnstarMessageMutation();

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

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
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
  }, [localMessages.length]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
  }, [message]);

  // ─── Close emoji picker on outside click (desktop popup only) ────
  useEffect(() => {
    if (!showEmojiPicker || isMobile) return;
    const handler = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker, isMobile]);

  // ─── Insert emoji ──────────────────────────────────────────────────
  const handleEmojiSelect = (emoji) => {
    setMessage((prev) => prev + emoji);
    // Keep emoji panel open and keyboard hidden – do NOT focus input
  };

  // ─── Toggle emoji picker ──────────────────────────────────────────
  const toggleEmoji = useCallback(() => {
    setShowEmojiPicker((prev) => {
      if (!prev) {
        // opening: blur input to dismiss keyboard
        inputRef.current?.blur();
      } else {
        // closing: focus input to show keyboard
        inputRef.current?.focus();
      }
      return !prev;
    });
  }, []);

  // ─── Copy message content to clipboard ───────────────────────────
  const handleCopyMessage = async (msg) => {
    try {
      const textToCopy = msg?.content || msg?.mediaName || "";
      if (!textToCopy) {
        toast.error("Nothing to copy");
        return;
      }
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  // ─── Duplicate detection helper ──────────────────────────────────
  const isRecentDuplicateMedia = useCallback(
    (signature) => {
      const now = Date.now();
      return localMessages.some((m) => {
        // Only check own messages
        const isOwnMsg =
          m.sender?._id === userInfo?._id || m.sender === userInfo?._id;
        if (!isOwnMsg) return false;
        // Must be a media message with the same signature
        if (!m.mediaSignature) return false;
        if (m.mediaSignature !== signature) return false;
        const msgTime = new Date(m.createdAt).getTime();
        return now - msgTime < 4000;
      });
    },
    [localMessages, userInfo],
  );

  // ─── Message handling ──────────────────────────────────────────
  const mergeMessagesIntoState = useCallback(
    (incomingList) => {
      if (!incomingList || incomingList.length === 0) return;
      setLocalMessages((prev) => {
        let next = prev;
        let mutated = false;
        incomingList.forEach((incoming) => {
          // 1. Check if this message already exists by real _id
          const existingIdx = next.findIndex((m) => m._id === incoming._id);
          if (existingIdx > -1) {
            if (!mutated) next = [...next];
            mutated = true;
            const existing = next[existingIdx];
            const updated = {
              ...incoming,
              createdAt: existing.createdAt, // keep client order
              _sent: existing._sent || false,
              _pending: existing._pending || false,
              _failed: existing._failed || false,
              _delivered: true,
              _read: false,
            };
            const isOwn =
              incoming.sender?._id === userInfo?._id ||
              incoming.sender === userInfo?._id;
            if (isOwn) {
              const otherId = otherParticipant?._id;
              if (
                otherId &&
                incoming.readBy?.some(
                  (r) => r.user === otherId || r.user?._id === otherId,
                )
              ) {
                updated._read = true;
              }
            } else {
              if (
                incoming.readBy?.some(
                  (r) =>
                    r.user === userInfo?._id || r.user?._id === userInfo?._id,
                )
              ) {
                updated._read = true;
              }
            }
            next[existingIdx] = updated;
            return;
          }

          const isOwn =
            incoming.sender?._id === userInfo?._id ||
            incoming.sender === userInfo?._id;

          // 2. Find a temporary message to replace
          let tempIdx = -1;
          if (isOwn) {
            // PRIMARY: match by clientMsgId
            if (incoming.clientMsgId) {
              tempIdx = next.findIndex(
                (m) => m._tempId === incoming.clientMsgId,
              );
            }
            // Fallback for older in-flight messages
            if (tempIdx === -1) {
              tempIdx = next.findIndex((m) => m._tempId === incoming._id);
            }
            // Last-resort fallback (content + time) – kept for safety
            if (tempIdx === -1) {
              const incomingContent = incoming.content || "";
              const incomingTime = new Date(incoming.createdAt).getTime();
              tempIdx = next.findIndex((m) => {
                if (!m._temp) return false;
                if (m.content !== undefined && m.content === incomingContent) {
                  const mTime = new Date(m.createdAt).getTime();
                  return Math.abs(mTime - incomingTime) < 10000;
                }
                if (m.mediaName && m.mediaName === incoming.mediaName) {
                  const mTime = new Date(m.createdAt).getTime();
                  return Math.abs(mTime - incomingTime) < 20000;
                }
                return false;
              });
            }
          }

          if (tempIdx > -1) {
            if (!mutated) next = [...next];
            mutated = true;
            const tempMsg = next[tempIdx];
            const realMsg = {
              ...incoming,
              createdAt: tempMsg.createdAt, // preserve client order
              _sent: true,
              _pending: false,
              _failed: false,
              _delivered: true,
              _read: false,
              _temp: false,
              _tempId: undefined,
            };
            if (isOwn) {
              const otherId = otherParticipant?._id;
              if (
                otherId &&
                incoming.readBy?.some(
                  (r) => r.user === otherId || r.user?._id === otherId,
                )
              ) {
                realMsg._read = true;
              }
            } else {
              if (
                incoming.readBy?.some(
                  (r) =>
                    r.user === userInfo?._id || r.user?._id === userInfo?._id,
                )
              ) {
                realMsg._read = true;
              }
            }
            next[tempIdx] = realMsg;
            return;
          }

          // 3. It's a new message from someone else or our own that wasn't optimistically added
          const msg = {
            ...incoming,
            _sent: true,
            _pending: false,
            _failed: false,
            _delivered: true,
            _read: false,
          };
          if (isOwn) {
            const otherId = otherParticipant?._id;
            if (
              otherId &&
              incoming.readBy?.some(
                (r) => r.user === otherId || r.user?._id === otherId,
              )
            ) {
              msg._read = true;
            }
          } else {
            if (
              incoming.readBy?.some(
                (r) =>
                  r.user === userInfo?._id || r.user?._id === userInfo?._id,
              )
            ) {
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
    [userInfo?._id, otherParticipant?._id],
  );

  useEffect(() => {
    if (messagesData?.messages && messagesData.messages.length > 0) {
      const firstMsg = messagesData.messages[0];
      const msgChatId =
        typeof firstMsg.chat === "string" ? firstMsg.chat : firstMsg.chat?._id;
      if (msgChatId && msgChatId !== chatId) return;
      mergeMessagesIntoState(messagesData.messages);
    }
  }, [messagesData, mergeMessagesIntoState, chatId]);

  // ─── Socket handlers ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;
    socket.emit("join-chat", chatId);

    const handleNewMessage = (incoming) => {
      const incomingChatId =
        typeof incoming.chat === "string" ? incoming.chat : incoming.chat?._id;
      if (incomingChatId && incomingChatId !== chatId) return;
      mergeMessagesIntoState([incoming]);
    };

    const handleMessageDeleted = ({ messageId }) => {
      setLocalMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true } : m)),
      );
    };

    const handleMessageRead = ({ chatId: readChatId, messageId, readBy }) => {
      if (readChatId !== chatId) return;
      setLocalMessages((prev) =>
        prev.map((msg) => {
          if (msg._id === messageId) {
            return { ...msg, _read: true };
          }
          return msg;
        }),
      );
    };

    const handleUserStatusChange = ({
      userId,
      online,
      chatId: statusChatId,
    }) => {
      if (statusChatId !== chatId) return;
      if (userId === otherParticipant?._id) {
        setOtherUserOnline(online);
      }
    };

    socket.on("new-message", handleNewMessage);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("message-read", handleMessageRead);
    socket.on("user-status-changed", handleUserStatusChange);

    return () => {
      socket.emit("leave-chat", chatId);
      socket.off("new-message", handleNewMessage);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("message-read", handleMessageRead);
      socket.off("user-status-changed", handleUserStatusChange);
    };
  }, [
    socket,
    isConnected,
    chatId,
    mergeMessagesIntoState,
    otherParticipant?._id,
  ]);

  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(() => {
      if (!isConnected) {
        refetchMessages();
        refetchChats();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [chatId, isConnected, refetchMessages, refetchChats]);

  const markMessageAsRead = useCallback(
    (messageId) => {
      if (!socket || !isConnected) return;
      const msg = localMessages.find((m) => m._id === messageId);
      if (!msg || msg._read || msg.sender?._id === userInfo?._id) return;
      socket.emit("mark-read", { chatId, messageIds: [messageId] });
    },
    [socket, isConnected, chatId, localMessages, userInfo],
  );

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
      { threshold: 0.5 },
    );
    const elements =
      messagesContainerRef.current.querySelectorAll("[data-message-id]");
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [localMessages, markMessageAsRead, userInfo]);

  // ─── Handle media send (with duplicate prevention) ──────────────
  const handleSendMedia = async (file) => {
    if (!file) return;
    if (isSendingRef.current) return;

    // Prevent duplicate sends of the same file within 4 seconds
    const signature = `${file.name}-${file.size}-${file.lastModified}`;
    if (isRecentDuplicateMedia(signature)) {
      console.warn("Blocked duplicate media send:", file.name);
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const formData = new FormData();
    formData.append("media", file);
    const messageType = file.type.startsWith("image/") ? "image" : "file";
    formData.append("messageType", messageType);
    if (replyToMessage) formData.append("replyToId", replyToMessage._id);

    const senderWithName = {
      ...userInfo,
      name:
        userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Add clientMsgId to formData so backend can echo it back
    formData.append("clientMsgId", tempId);

    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: false,
      _sent: false,
      _failed: false,
      _delivered: false,
      _read: false,
      content: "",
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: messageType,
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
      mediaUrl: URL.createObjectURL(file),
      mediaName: file.name,
      mediaSize: file.size,
      mediaDuration: null,
      mediaSignature: signature, // for duplicate detection
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setReplyToMessage(null);
    setPendingMedia(null);

    try {
      await sendMessageApi({ chatId, data: formData }).unwrap();
    } catch (err) {
      setLocalMessages((prev) => prev.filter((m) => m._tempId !== tempId));
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  // ─── Send message (text) ──────────────────────────────────────
  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !socket) return;
    if (isSendingRef.current) return;

    const now = Date.now();
    const isDuplicate = localMessages.some((m) => {
      if (m.messageType !== "text") return false;
      if (m.content !== trimmed) return false;
      const isOwnMsg =
        m.sender?._id === userInfo?._id || m.sender === userInfo?._id;
      if (!isOwnMsg) return false;
      const msgTime = new Date(m.createdAt).getTime();
      return now - msgTime < 4000;
    });
    if (isDuplicate) {
      console.warn("Blocked duplicate send:", trimmed);
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const senderWithName = {
      ...userInfo,
      name:
        userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: false,
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
      // keep focus after sending so keyboard stays open
      inputRef.current.focus();
    }

    socket.emit(
      "send-message",
      {
        chatId,
        content: trimmed,
        messageType: "text",
        mentions: [],
        replyToId,
        clientMsgId: tempId,
      },
      (response) => {
        isSendingRef.current = false;
        setIsSending(false);
        if (response?.error) {
          setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
          toast.error(response.error);
        } else {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...m, _sent: true, _delivered: true } : m,
            ),
          );
        }
      },
    );
  };

  // ─── File / image: Native plugins with custom modal for images ──
  const handleTakePhoto = useCallback(async () => {
    setShowMediaPicker(false);
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      if (photo?.base64String) {
        const mimeType = `image/${photo.format || "jpeg"}`;
        const fileName = `photo-${Date.now()}.${photo.format || "jpg"}`;
        setPendingMedia(base64ToFile(photo.base64String, fileName, mimeType));
      }
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (!msg.includes("cancel")) {
        console.error("Camera error:", err);
        toast.error("Failed to take photo");
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
        const mimeType = `image/${photo.format || "jpeg"}`;
        const fileName = `photo-${Date.now()}.${photo.format || "jpg"}`;
        setPendingMedia(base64ToFile(photo.base64String, fileName, mimeType));
      }
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (!msg.includes("cancel")) {
        console.error("Gallery error:", err);
        toast.error("Failed to pick from gallery");
      }
    }
  }, []);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await FilePicker.pickFiles({ readData: true });
      const picked = result?.files?.[0];
      if (!picked) return;
      const mimeType = picked.mimeType || "application/octet-stream";
      const fileName = picked.name || `file-${Date.now()}`;

      let file;
      if (picked.data) {
        file = base64ToFile(picked.data, fileName, mimeType);
      } else if (picked.path) {
        const readResult = await Filesystem.readFile({ path: picked.path });
        file = base64ToFile(readResult.data, fileName, mimeType);
      } else {
        toast.error("Could not read selected file");
        return;
      }
      setPendingMedia(file);
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (!msg.includes("cancel")) {
        console.error("File picker error:", err);
        toast.error("Failed to pick file");
      }
    }
  }, []);

  const handleFileUpload = useCallback(
    (type) => {
      if (Capacitor.isNativePlatform()) {
        if (type === "image") {
          setShowMediaPicker(true);
        } else {
          handlePickFile();
        }
        return;
      }
      if (type === "file") {
        fileInputRef.current?.click();
      } else {
        imageInputRef.current?.click();
      }
    },
    [handlePickFile],
  );

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error("No file selected");
      return;
    }
    setPendingMedia(file);
    toast.success(`${file.name} loaded`);
    e.target.value = "";
  }, []);

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setPendingMedia(file);
          toast("Image pasted! Click send to upload.", { icon: "🖼️" });
          e.preventDefault();
          break;
        }
      }
    }
  };

  // ─── Voice recording ──────────────────────────────────────────
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
    recordingTimerRef.current = setInterval(
      () => setRecordingTime((prev) => prev + 1),
      1000,
    );
  };

  const stopTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const startNativeRecording = async () => {
    try {
      const { value: hasPermission } =
        await VoiceRecorder.hasAudioRecordingPermission();
      if (!hasPermission) {
        const { value: granted } =
          await VoiceRecorder.requestAudioRecordingPermission();
        if (!granted) {
          toast.error("Microphone permission is required.");
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
      console.error("Native recording error:", err);
      toast.error("Failed to start recording: " + (err.message || ""));
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
      toast.error("Failed to pause/resume recording");
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
      const audioBlob = new Blob([byteArray], { type: "audio/m4a" });
      setRecordingBlob(audioBlob);
      setShowRecordedPreview(true);
      stopTimer();
      setIsRecording(false);
    } catch (err) {
      console.error("Stop recording error:", err);
      toast.error("Failed to stop recording");
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
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
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
      if (err.name === "NotAllowedError")
        msg =
          "Microphone permission denied. Please grant it in system settings.";
      else if (err.name === "NotFoundError") msg = "No microphone found.";
      else if (err.name === "NotReadableError")
        msg = "Microphone busy — please try again.";
      else if (err.name === "AbortError")
        msg = "User canceled the permission prompt.";
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

  // ─── Send audio message (with duplicate prevention) ──────────────
  const sendAudioMessage = async (audioBlob) => {
    if (!audioBlob) return;
    if (isSendingRef.current) return;

    const signature = `${audioBlob.size}-${recordingTime}`;
    if (isRecentDuplicateMedia(signature)) {
      console.warn("Blocked duplicate voice note send");
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const formData = new FormData();
    const mimeType = isNative ? "audio/m4a" : "audio/webm";
    const extension = isNative ? "m4a" : "webm";
    const audioFile = new File([audioBlob], `voice-note.${extension}`, {
      type: mimeType,
    });
    formData.append("media", audioFile);
    formData.append("messageType", "audio");
    formData.append("mediaDuration", recordingTime.toString());
    if (replyToMessage) {
      formData.append("replyToId", replyToMessage._id);
    }

    const senderWithName = {
      ...userInfo,
      name:
        userInfo?.name || userInfo?.username || userInfo?.email || "Unknown",
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    formData.append("clientMsgId", tempId);

    const optimisticMsg = {
      _id: tempId,
      _tempId: tempId,
      _temp: true,
      _pending: false,
      _sent: false,
      _failed: false,
      _delivered: false,
      _read: false,
      content: "",
      sender: senderWithName,
      createdAt: new Date().toISOString(),
      messageType: "audio",
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
      mediaUrl: URL.createObjectURL(audioBlob),
      mediaName: "Voice note",
      mediaSize: audioBlob.size,
      mediaDuration: recordingTime,
      mediaSignature: signature,
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setReplyToMessage(null);

    try {
      const res = await sendMessageApi({ chatId, data: formData }).unwrap();
      const realMsg = res.message;

      setLocalMessages((prev) => {
        if (prev.some((m) => m._id === realMsg._id)) {
          return prev.filter((m) => m._tempId !== tempId);
        }
        return prev.map((m) =>
          m._tempId === tempId
            ? {
                ...realMsg,
                createdAt: m.createdAt,
                _sent: true,
                _pending: false,
                _failed: false,
                _delivered: true,
                _read: false,
                _temp: false,
                _tempId: undefined,
              }
            : m
        );
      });
    } catch (err) {
      setLocalMessages((prev) => prev.filter((m) => m._tempId !== tempId));
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  // ─── Mic button handlers ────────────────────────────────────────
  const handleMicPointerDown = (e) => {
    if (message.trim()) return;
    if (isRecording || mediaRecorderRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startRecording();
  };

  const handleMicPointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (isRecording && !recordingPaused) {
      stopRecording();
    }
  };

  // ─── Message action handlers ──────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Message",
      message: "Are you sure?",
      onConfirm: async () => {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m._id === messageId ? { ...m, isDeleted: true } : m,
          ),
        );
        try {
          await deleteMessageApi(messageId).unwrap();
          toast.success("Message deleted");
        } catch (err) {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m._id === messageId ? { ...m, isDeleted: false } : m,
            ),
          );
          toast.error(err?.data?.message);
        }
      },
      danger: true,
    });
  };

  const handleArchiveMessage = async (messageId) => {
    try {
      await archiveMessage(messageId).unwrap();
      toast.success("Archived");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message);
    }
  };
  const handleUnarchiveMessage = async (messageId) => {
    try {
      await unarchiveMessage(messageId).unwrap();
      toast.success("Unarchived");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message);
    }
  };
  const handleStarMessage = async (messageId) => {
    try {
      await starMessage(messageId).unwrap();
      toast.success("Starred");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message);
    }
  };
  const handleUnstarMessage = async (messageId) => {
    try {
      await unstarMessage(messageId).unwrap();
      toast.success("Unstarred");
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message);
    }
  };
  const handleReply = (msg) => {
    setReplyToMessage(msg);
    setTimeout(() => inputRef.current?.focus(), 100);
  };
  const cancelReply = () => setReplyToMessage(null);
  const handleLongPress = (message) =>
    setActionModal({ isOpen: true, message });
  const handleJumpToMessage = useCallback((messageId) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-message-id="${messageId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-teal-400", "rounded-2xl");
    setTimeout(
      () => target.classList.remove("ring-2", "ring-teal-400", "rounded-2xl"),
      1200,
    );
  }, []);
  const clearPendingMedia = () => setPendingMedia(null);

  // ─── Render messages with dividers ────────────────────────────────
  const renderMessagesWithDividers = () => {
    if (messagesLoading) {
      return <SkeletonMessages count={6} />;
    }

    if (localMessages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
          <FaComment className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">No messages yet</p>
          <p className="text-xs mt-1 opacity-60">
            Say hello to start the conversation!
          </p>
        </div>
      );
    }

    const sorted = [...localMessages].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );
    let lastDate = null;
    const elements = [];
    sorted.forEach((msg) => {
      const msgDate = new Date(msg.createdAt);
      const dateKey = msgDate.toDateString();
      if (dateKey !== lastDate) {
        const dividerText = formatDateDivider(msg.createdAt);
        elements.push(
          <div key={`divider-${dateKey}`} className="flex justify-center my-3">
            <div className="bg-gray-200/70 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full">
              {dividerText}
            </div>
          </div>,
        );
        lastDate = dateKey;
      }
      const resolvedSender = resolveSender(msg.sender);
      const isOwn =
        resolvedSender._id === userInfo?._id ||
        msg.sender === userInfo?._id ||
        msg.sender?._id === userInfo?._id;
      const senderName = resolvedSender.name || "Unknown";
      const senderProfile = resolvedSender.profile || null;
      elements.push(
        <MediaMessage
          key={msg._id}
          message={msg}
          isOwn={isOwn}
          senderName={senderName}
          senderProfile={senderProfile}
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
          allMessages={sorted}
          onJumpToMessage={handleJumpToMessage}
          resolveSender={resolveSender}
        />,
      );
    });
    return elements;
  };

  // ─── Render ────────────────────────────────────────────────────
  if (!chat) {
    if (chatsListLoading) {
      return (
        <div className="h-dvh flex items-center justify-center bg-white dark:bg-[#0f0f12]">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-white dark:bg-[#0f0f12] gap-2">
        <FaUser className="text-4xl mb-2 opacity-30 text-gray-400" />
        <p className="text-sm text-gray-500">Chat not found</p>
      </div>
    );
  }

  return (
    <>
      <div className="h-dvh bg-white dark:bg-[#0f0f12] flex flex-col lg:flex-row overflow-hidden">
        <div className="hidden lg:block lg:w-72 lg:h-full flex-shrink-0">
          <GeneralSidebar />
        </div>
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div
            className={`flex-1 flex flex-col h-full overflow-hidden ${
              isDesktop && showDetails ? "lg:w-2/3" : "lg:w-full"
            }`}
          >
            {/* Header */}
            <header
              className="fixed lg:sticky top-0 left-0 right-0 lg:left-auto lg:right-auto z-20 flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl text-gray-800 dark:text-white flex-shrink-0 cursor-pointer"
              onClick={() => setShowDetails(!showDetails)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={() => navigate("/chat")}
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
                  <h2 className="font-semibold text-base text-gray-800 dark:text-gray-100 truncate">
                    {displayName}
                  </h2>
                  <p
                    className={`text-xs truncate ${
                      otherUserOnline === true
                        ? "text-green-500 dark:text-green-400"
                        : otherUserOnline === false
                          ? "text-gray-500 dark:text-gray-400"
                          : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {otherUserOnline === true
                      ? "Online"
                      : otherUserOnline === false
                        ? "Offline"
                        : ""}
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 flex-shrink-0 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition relative"
                  aria-label="Contact info"
                >
                  <FaInfoCircle className="text-lg" />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="relative flex-1 overflow-hidden">
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="h-full overflow-y-auto px-4 py-3 space-y-1 pt-20 lg:pt-3 pb-24 lg:pb-3 transition-all duration-200 ease-in-out"
                style={{
                  paddingBottom: isMobile ? `${inputHeight}px` : undefined,
                }}
              >
                {renderMessagesWithDividers()}
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
            <div
              ref={inputAreaRef}
              className="fixed lg:sticky bottom-0 left-0 right-0 lg:left-auto lg:right-auto z-20 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/90 dark:bg-[#0f0f12]/90 backdrop-blur-xl flex-shrink-0 px-3 sm:px-4"
            >
              <div className="py-2">
                <ReplyPreview
                  replyTo={replyToMessage}
                  onCancel={cancelReply}
                  resolveSender={resolveSender}
                />

                {/* Media Preview */}
                {pendingMedia && (
                  <MediaPreview
                    mediaFile={pendingMedia}
                    onRemove={clearPendingMedia}
                    onSend={handleSendMedia}
                    brandColor="#0d9488"
                    isSending={isSending}
                  />
                )}

                {showRecordedPreview && recordingBlob && (
                  <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700/40">
                    <div className="flex items-center gap-2">
                      <FaCheckCircle className="text-green-500 dark:text-green-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-200">
                        Voice note ready
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(recordingTime)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const audio = new Audio(
                            URL.createObjectURL(recordingBlob),
                          );
                          audio.play();
                        }}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                      >
                        <FaPlay className="text-xs" />
                      </button>
                      <button
                        onClick={() => sendAudioMessage(recordingBlob)}
                        disabled={isSending}
                        className="px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded text-xs hover:bg-green-700 dark:hover:bg-green-800 transition disabled:opacity-50"
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
                        {recordingPaused ? "Paused" : "Recording..."}{" "}
                        {formatTime(recordingTime)}
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

                <form
                  onSubmit={handleSendMessage}
                  className="flex items-end gap-2"
                >
                  {/* Emoji – outside the pill, extreme left, exactly like WhatsApp */}
                  <div className="relative flex-shrink-0 mb-1" ref={emojiPickerRef}>
                    <button
                      type="button"
                      onClick={toggleEmoji}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition"
                    >
                      <FaSmile className="text-xl" />
                    </button>
                    {/* Desktop: floating popup above the bar */}
                    {showEmojiPicker && !isMobile && (
                      <div className="absolute bottom-12 left-0 z-30 w-72 max-h-56 overflow-y-auto bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-xl p-3 grid grid-cols-8 gap-1">
                        {EMOJI_LIST.map((emoji, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="text-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg p-1 transition"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input pill – paperclip + camera live INSIDE it, like WhatsApp */}
                  <div className="flex-1 min-w-0 relative flex items-end">
                    <textarea
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onPaste={handlePaste}
                      onFocus={() => setShowEmojiPicker(false)}
                      onKeyDown={(e) => {
                        if (isMobile) return;
                        if (isSendingRef.current) return;
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Message"
                      rows={1}
                      className="w-full min-w-0 pl-4 pr-20 py-2 border border-gray-300 dark:border-gray-700/60 rounded-full bg-white dark:bg-[#0b0b10] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none max-h-32 overflow-y-auto"
                      style={{ minHeight: "42px", lineHeight: "1.5" }}
                    />
                    <div className="absolute right-3 bottom-0 h-[42px] flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleFileUpload("file")}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition"
                      >
                        <FaPaperclip className="text-base" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFileUpload("image")}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition"
                      >
                        <FaCamera className="text-base" />
                      </button>
                    </div>
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
                  </div>

                  {/* Mic / send – outside the pill, extreme right, exactly like WhatsApp */}
                  {message.trim() ? (
                    <button
                      type="submit"
                      disabled={!isConnected || isSending}
                      className="p-3 rounded-full text-white disabled:opacity-50 flex-shrink-0 transition hover:opacity-80 mb-1"
                      style={{ backgroundColor: "#0d9488" }}
                    >
                      <FaPaperPlane className="text-sm" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onPointerDown={handleMicPointerDown}
                      onPointerUp={handleMicPointerUp}
                      onPointerCancel={handleMicPointerUp}
                      className="p-3 rounded-full text-white flex-shrink-0 transition hover:opacity-80 mb-1"
                      style={{ backgroundColor: "#0d9488" }}
                    >
                      <FaMicrophone className="text-sm" />
                    </button>
                  )}
                </form>

                {/* Mobile: emoji panel docks under the input, same footprint as the keyboard it replaces */}
                {showEmojiPicker && isMobile && (
                  <div
                    className="w-full mt-2 overflow-y-auto bg-white dark:bg-[#14141a] border-t border-gray-200 dark:border-gray-800/60 rounded-t-xl grid grid-cols-8 gap-1 p-3"
                    style={{ height: "260px" }}
                  >
                    {EMOJI_LIST.map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleEmojiSelect(emoji)}
                        className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg p-1 transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isDesktop && showDetails && (
            <div className="lg:w-80 lg:flex-shrink-0 border-l border-gray-200 dark:border-gray-800/60 h-full overflow-hidden">
              <ContactInfoPanel
                user={otherParticipant}
                onlineStatus={otherUserOnline}
                onClose={() => setShowDetails(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile details overlay */}
      {isMobile && showDetails && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowDetails(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-white dark:bg-[#14141a] shadow-xl border-l border-gray-200 dark:border-gray-800/60 overflow-y-auto transition-transform duration-300 ease-in-out">
            <ContactInfoPanel
              user={otherParticipant}
              onlineStatus={otherUserOnline}
              onClose={() => setShowDetails(false)}
            />
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
      />
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          senderName={previewImage.senderName}
          time={previewImage.time}
          onClose={() => setPreviewImage(null)}
        />
      )}
      <MessageActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, message: null })}
        message={actionModal.message}
        isOwn={actionModal.message?.sender?._id === userInfo?._id}
        isStarred={actionModal.message?.starredBy?.some(
          (id) => id === userInfo?._id,
        )}
        isArchived={actionModal.message?.archivedBy?.some(
          (id) => id === userInfo?._id,
        )}
        onDelete={handleDeleteMessage}
        onArchive={handleArchiveMessage}
        onUnarchive={handleUnarchiveMessage}
        onStar={handleStarMessage}
        onUnstar={handleUnstarMessage}
        onReply={handleReply}
        onCopy={handleCopyMessage}
      />

      <MediaPickerModal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromGallery={handleChooseFromGallery}
      />
    </>
  );
};

export default GeneralChatId;