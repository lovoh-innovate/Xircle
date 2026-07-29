// src/workspaceScreens/MyWorkspaceChannelId.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
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
  useAddParticipantMutation,
  useRemoveParticipantMutation,
  useMakeGroupAdminMutation,
  useRemoveGroupAdminMutation,
  useArchiveChatMutation,
  useUnarchiveChatMutation,
  useExitGroupChatMutation,
  useDeleteGroupChatMutation,
} from "../slices/messagingApiSlice";
import { useGetMembersQuery } from "../slices/teamApiSlice";
import MyWorkspaceSidebar from "../workspaceComponents/MyWorkspaceSidebar";
import { useInitiateCallMutation } from "../slices/callApiSlice";
import {
  FaHashtag,
  FaArrowLeft,
  FaComment,
  FaPaperPlane,
  FaSmile,
  FaPaperclip,
  FaImage,
  FaCheck,
  FaRegClock,
  FaPhone,
  FaVideo,
  FaInfoCircle,
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
  FaSearch,
  FaUserPlus,
  FaUserMinus,
  FaCrown,
  FaArchive,
  FaUndo,
  FaStar,
  FaRegStar,
  FaSignOutAlt,
  FaPen,
  FaExclamationTriangle
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useSocket } from "../components/SocketContext.jsx";

// ─── Helpers ────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const LOCK_THRESHOLD = 80;
const SEEN_TICK_COLOR = "#34B7F1";

// ─── Confirm Modal ────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", danger = false }) => {
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
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 dark:bg-[#0d9488] hover:bg-teal-700 dark:hover:bg-[#0f9e96]"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Prompt Modal ──────────────────────────────────────────────────
const PromptModal = ({ isOpen, onClose, onConfirm, title, label, placeholder = "", initialValue = "", confirmText = "Save" }) => {
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

// ─── Add Participant Modal (reused from Channels) ──────────────────
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

// ─── Message status ticks ────────────────────────────────────────
const MessageTicks = ({ message, isOwn, isDM }) => {
  if (!isOwn) return null;

  if (message._pending) {
    return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
  }

  if (message._failed) {
    return <FaTimes className="text-[10px] text-red-500" />;
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

// ─── Audio waveform ──────────────────────────────────────────────────
const WAVEFORM_BARS = [
  6, 11, 15, 9, 17, 12, 7, 14, 18, 10, 6, 13, 16, 11, 8, 15, 12, 7, 13, 9, 6,
  10,
];

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

// ─── Fullscreen image viewer ────────────────────────────────────────
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
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/70 text-white flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1">
            <FaArrowLeft />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {senderName || "Photo"}
            </p>
            {time && <p className="text-[11px] text-white/60">{time}</p>}
          </div>
        </div>
        <button onClick={handleDownload} className="p-2">
          <FaDownload />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <img
          src={imageUrl}
          alt="Preview"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
};

// ─── Media Message Component (with archive/star) ────────────────────
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
  userId,
}) => {
  const time = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef(null);

  const isArchived = message.archivedBy?.some(id => id === userId) || false;
  const isStarred = message.starredBy?.some(id => id === userId) || false;

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
          <div className="relative group">
            <video
              src={message.mediaUrl}
              controls
              className="max-w-full rounded-lg max-h-80"
            />
          </div>
        );
      case "audio":
        return (
          <div className="flex items-center gap-2.5 min-w-[220px] py-0.5">
            <button
              onClick={() => {
                if (audioRef.current) {
                  isPlaying
                    ? audioRef.current.pause()
                    : audioRef.current.play();
                  setIsPlaying(!isPlaying);
                }
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : brandColor,
              }}
            >
              {isPlaying ? (
                <FaPause className="text-xs text-white" />
              ) : (
                <FaPlay className="text-xs text-white ml-0.5" />
              )}
            </button>
            <AudioWaveform
              isOwn={isOwn}
              isPlaying={isPlaying}
              brandColor={brandColor}
            />
            <span
              className={`text-[10px] flex-shrink-0 ${isOwn ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}
            >
              {message.mediaDuration
                ? formatTime(message.mediaDuration)
                : "0:00"}
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
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(e);
              }}
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

  // Image messages without bubble
  if (message.messageType === "image") {
    return (
      <div
        className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
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
                style={{ backgroundColor: brandColor }}
              >
                {senderName?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
        )}
        <div
          className={`max-w-[85%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}
        >
          {!isOwn && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1 mb-0.5">
              {senderName}
            </span>
          )}
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer group"
            onClick={() =>
              onImageClick &&
              onImageClick({
                url: message.mediaUrl,
                senderName: isOwn ? "You" : senderName,
                time,
              })
            }
          >
            <img
              src={message.mediaUrl}
              alt={message.mediaName || "Image"}
              className="max-w-full max-h-80 object-cover w-full"
            />
            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">
              <span>{time}</span>
              <MessageTicks message={message} isOwn={isOwn} isDM={isDM} />
            </div>
            {isOwn && (
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition">
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
                  <div className="absolute right-0 top-8 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[150px] z-10">
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDelete && onDelete(message._id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full"
                    >
                      <FaTrashAlt className="text-xs" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular messages with bubble
  return (
    <div
      className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
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
              style={{ backgroundColor: brandColor }}
            >
              {senderName?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
      )}
      <div
        className={`max-w-[85%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}
      >
        {!isOwn && (
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1">
            {senderName}
          </span>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
            isOwn
              ? "text-white"
              : "bg-gray-100 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200"
          }`}
          style={isOwn ? { backgroundColor: brandColor } : {}}
        >
          {message.content && <p className="mb-2">{message.content}</p>}
          {renderMediaContent()}
        </div>
        <div
          className={`flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 ${isOwn ? "flex-row-reverse" : ""}`}
        >
          <span>{time}</span>
          <MessageTicks message={message} isOwn={isOwn} isDM={isDM} />
          {isOwn && (
            <div className="relative ml-2">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5"
              >
                <FaEllipsisV className="text-xs" />
              </button>
              {showMenu && (
                <div className="absolute right-0 bottom-6 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[150px] z-10">
                  {isStarred ? (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onUnstar(message._id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full"
                    >
                      <FaStar className="text-xs" /> Unstar
                    </button>
                  ) : (
                    <button
                      onClick={() => {
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
                      onClick={() => {
                        setShowMenu(false);
                        onUnarchive(message._id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full"
                    >
                      <FaUndo className="text-xs" /> Unarchive
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onArchive(message._id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full"
                    >
                      <FaArchive className="text-xs" /> Archive
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete && onDelete(message._id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full"
                  >
                    <FaTrashAlt className="text-xs" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Chat Details Bottom Sheet (with admin controls) ───────────────
const ChatDetailsSheet = ({
  isOpen,
  onClose,
  chat,
  workspace,
  isDM,
  otherParticipant,
  isDMOnline,
  userInfo,
  userRole,
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
    (p) => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === "admin"
  ) || userRole === "Owner";
  const isCreator = chat.createdBy?._id === userInfo?._id;
  const isWorkspaceOwner = userRole === "Owner";
  const canManage = isGroupAdmin || isWorkspaceOwner;
  const canDelete = isCreator || isWorkspaceOwner;

  const displayName = isDM
    ? otherParticipant?.name || "Unknown"
    : chat?.name || "Unnamed Channel";
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
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ boxShadow: "0 -4px 30px rgba(0,0,0,0.15)" }}
      >
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            {isDM ? (
              displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-gray-700/60"
                />
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
                <FaHashtag size={24} />
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
                  ? isDMOnline
                    ? "Online"
                    : "Offline"
                  : `${memberCount} member${memberCount !== 1 ? "s" : ""}`}
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
            {!isDM && !isCreator && !isWorkspaceOwner && (
              <button
                onClick={() => onExitGroup(chat._id)}
                className="p-2 text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition"
              >
                <FaSignOutAlt className="text-sm" />
              </button>
            )}
          </div>

          {!isDM && (
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
              {isDM ? "Participant" : `Members (${memberCount})`}
            </h4>
            <ul className="space-y-2">
              {participants.map((p) => {
                const user = p.user || {};
                const profile = user.profile || null;
                const name = user.name || "Unknown Member";
                const userId = user._id || p._id;
                const isAdmin = p.role === "admin";
                const isCurrentUser = userId === userInfo?._id;
                const canPromote = canManage && !isCurrentUser && !isAdmin && !isWorkspaceOwner;
                const canDemote = canManage && !isCurrentUser && isAdmin && !isWorkspaceOwner;

                return (
                  <li
                    key={userId}
                    className="flex items-center gap-3 py-1"
                  >
                    {profile ? (
                      <img
                        src={profile}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700/60"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-medium">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {name}
                      </span>
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
                          {isDMOnline ? "🟢 online" : "⚫ offline"}
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
                            className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition"
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

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaceChannelId = () => {
  const { workspaceId, chatId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userInfo } = useSelector((state) => state.auth);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);

  // ── Modal states ────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    danger: false,
  });
  const [promptModal, setPromptModal] = useState({
    isOpen: false,
    title: "",
    label: "",
    initialValue: "",
    onConfirm: null,
    placeholder: "",
  });
  const [addMemberModal, setAddMemberModal] = useState({
    isOpen: false,
    chatId: null,
  });

  // ── Focus input if queried (quick reply) ─────────────────────────
  const inputRef = useRef(null);
  useEffect(() => {
    if (searchParams.get("focusInput") === "true") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [searchParams]);

  // ── Call mutation ────────────────────────────────────────────────
  const [initiateCall, { isLoading: isCallInitiating }] = useInitiateCallMutation();

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [showRecordedPreview, setShowRecordedPreview] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);

  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const touchStartYRef = useRef(0);
  const isRecordingRef = useRef(false);

  // ── Socket & local messages ─────────────────────────────────────────
  const { socket, isConnected } = useSocket();
  const [localMessages, setLocalMessages] = useState([]);

  // API hooks
  const {
    data: workspaceData,
    isLoading: workspaceLoading,
    error,
  } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } =
    useGetUserChatsQuery(workspaceId);
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

  // Message archive/star mutations
  const [archiveMessage] = useArchiveMessageMutation();
  const [unarchiveMessage] = useUnarchiveMessageMutation();
  const [starMessage] = useStarMessageMutation();
  const [unstarMessage] = useUnstarMessageMutation();

  // Group management mutations
  const [addParticipant] = useAddParticipantMutation();
  const [removeParticipant] = useRemoveParticipantMutation();
  const [makeAdmin] = useMakeGroupAdminMutation();
  const [removeAdmin] = useRemoveGroupAdminMutation();
  const [exitGroup] = useExitGroupChatMutation();
  const [deleteGroup] = useDeleteGroupChatMutation();
  const [archiveChat] = useArchiveChatMutation();
  const [unarchiveChat] = useUnarchiveChatMutation();

  const { data: membersData } = useGetMembersQuery(workspaceId);

  const chat = chatsData?.chats?.find((c) => c._id === chatId);
  const isDM = chat?.type === "direct";
  const otherParticipant = isDM
    ? chat?.participants?.find(
        (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id,
      )?.user || null
    : null;
  const displayName = isDM
    ? otherParticipant?.name || "Unknown"
    : chat?.name || "Unnamed Channel";
  const displayAvatar = isDM ? otherParticipant?.profile : null;
  const isDMOnline = isDM ? otherParticipant?.online || false : false;

  // ── User role in workspace ─────────────────────────────────────────
  const userMembership = workspaceData?.workspace?.members?.find(
    (m) => m.user?._id === userInfo?._id || m.user === userInfo?._id
  );
  const userRole = userMembership?.role || "Member";

  // ── Lock body scroll while this chat is mounted ─────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // ── Silent polling every 3 seconds ──────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      refetchMessages();
    }, 3000);
    return () => clearInterval(interval);
  }, [refetchMessages, chatId]);

  // ── Scroll state & new‑message button ──────────────────────────────
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

  // ── Join chat room + socket events ─────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;

    socket.emit("join-chat", chatId);

    const handleNewMessage = (incoming) => {
      setLocalMessages((prev) => {
        if (
          (incoming.sender?._id === userInfo?._id ||
            incoming.sender === userInfo?._id) &&
          incoming.content
        ) {
          const tempIdx = prev.findIndex(
            (m) => m._temp && m.content === incoming.content,
          );
          if (tempIdx > -1) {
            const updated = [...prev];
            updated[tempIdx] = {
              ...incoming,
              _temp: false,
              _pending: false,
              _failed: false,
              _sent: true,
            };
            return updated;
          }
        }
        if (!prev.some((m) => m._id === incoming._id)) {
          return [...prev, { ...incoming, _sent: true }];
        }
        return prev;
      });
    };

    const handleMessageDeleted = ({ messageId }) => {
      setLocalMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    socket.on("new-message", handleNewMessage);
    socket.on("message-deleted", handleMessageDeleted);

    return () => {
      socket.emit("leave-chat", chatId);
      socket.off("new-message", handleNewMessage);
      socket.off("message-deleted", handleMessageDeleted);
    };
  }, [socket, isConnected, chatId, userInfo?._id]);

  // ── Merge polled messages ──────────────────────────────────────────
  useEffect(() => {
    if (messagesData?.messages) {
      setLocalMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m._id));
        const newMessages = messagesData.messages.filter(
          (m) => !existingIds.has(m._id),
        );
        return [...prev, ...newMessages.map((m) => ({ ...m, _sent: true }))];
      });
    }
  }, [messagesData]);

  // Voice recording cleanup
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecordingRef.current)
        mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

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

  // ── Error / Loading ──────────────────────────────────────────────
  if (error) navigate("/my-workspaces");
  if (workspaceLoading || chatsLoading || messagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="w-8 h-8 border-4 border-teal-500 dark:border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const chats = chatsData?.chats || [];
  if (!workspace) return null;

  const brandColor = workspace.color || "#0d9488";
  const memberCount = chat?.participants?.length || 0;

  // ── Channel / DM lists ──────────────────────────────────────────
  const groupChats = chats.filter((c) => c.type === "group");
  const directMessages = chats.filter((c) => c.type === "direct");
  const filteredChannels = groupChats.filter((ch) =>
    ch.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredDMs = directMessages.filter((dm) => {
    const participant = dm.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id,
    );
    const name = participant?.user?.name || participant?.name || "Unknown";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getDMParticipant = (dmChat) => {
    const other = dmChat.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id,
    );
    return other?.user || other;
  };

  const getSender = (senderId) => {
    const member = workspace.members?.find(
      (m) => m.user?._id === senderId || m.user === senderId,
    );
    return member?.user || null;
  };

  // ── Send text message via socket (optimistic) ────────────────────
  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !socket) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      _id: tempId,
      _temp: true,
      _pending: true,
      _sent: false,
      _failed: false,
      _read: false,
      content: trimmed,
      sender: userInfo,
      createdAt: new Date().toISOString(),
      messageType: "text",
      chat: chatId,
    };

    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setMessage("");

    socket.emit(
      "send-message",
      {
        chatId,
        content: trimmed,
        messageType: "text",
        mentions: [],
        replyToId: null,
        mediaUrl: null,
        mediaName: null,
        mediaSize: null,
        mediaDuration: null,
      },
      (response) => {
        if (response?.error) {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...m, _pending: false, _failed: true } : m,
            ),
          );
          toast.error(response.error);
        } else {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...m, _pending: false, _sent: true } : m,
            ),
          );
        }
      },
    );
  };

  // ── File / image / voice via REST ───────────────────────────────
  const handleFileUpload = (type) => {
    if (type === "file") fileInputRef.current?.click();
    else if (type === "image") imageInputRef.current?.click();
  };

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("media", file);
    formData.append("messageType", type === "image" ? "image" : "file");
    try {
      await sendMessageApi({ chatId, data: formData }).unwrap();
      toast.success(`${type === "image" ? "Image" : "File"} sent!`);
    } catch (err) {
      toast.error(err?.data?.message || `Failed to send ${type}`);
    } finally {
      e.target.value = "";
    }
  };

  const sendAudioMessage = async (audioBlob) => {
    const formData = new FormData();
    const audioFile = new File([audioBlob], "voice-note.webm", {
      type: "audio/webm",
    });
    formData.append("media", audioFile);
    formData.append("messageType", "audio");
    formData.append("mediaDuration", recordingTime.toString());
    try {
      await sendMessageApi({ chatId, data: formData }).unwrap();
      setRecordingBlob(null);
      setShowRecordedPreview(false);
      setRecordingTime(0);
    } catch (err) {
      toast.error(err?.data?.message || "Failed to send voice note");
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording)
      mediaRecorderRef.current.stop();
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    setIsLocked(false);
    setSwipeProgress(0);
    stopTimer();
  };

  // ── Message actions ──────────────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Message",
      message: "Are you sure you want to delete this message?",
      onConfirm: async () => {
        try {
          await deleteMessageApi(messageId).unwrap();
        } catch (err) {
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

  // ── Group management actions ─────────────────────────────────────
  const handleAddMember = (chatId) => {
    setAddMemberModal({ isOpen: true, chatId });
  };

  const handleRemoveMember = (chatId, userId) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Member",
      message: "Are you sure you want to remove this member from the group?",
      onConfirm: async () => {
        try {
          await removeParticipant({ chatId, userId }).unwrap();
          toast.success("Member removed");
          refetchChats();
          refetchMessages();
        } catch (err) {
          toast.error(err?.data?.message || "Failed to remove member");
        }
      },
      danger: true,
    });
  };

  const handleMakeAdmin = (chatId, userId) => {
    setConfirmModal({
      isOpen: true,
      title: "Make Admin",
      message: "Are you sure you want to promote this user to admin?",
      onConfirm: async () => {
        try {
          await makeAdmin({ chatId, userId }).unwrap();
          toast.success("User promoted to admin");
          refetchChats();
        } catch (err) {
          toast.error(err?.data?.message || "Failed to promote user");
        }
      },
      danger: false,
    });
  };

  const handleRemoveAdmin = (chatId, userId) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Admin",
      message: "Are you sure you want to remove admin rights from this user?",
      onConfirm: async () => {
        try {
          await removeAdmin({ chatId, userId }).unwrap();
          toast.success("Admin rights removed");
          refetchChats();
        } catch (err) {
          toast.error(err?.data?.message || "Failed to demote user");
        }
      },
      danger: false,
    });
  };

  const handleExitGroup = (chatId) => {
    setConfirmModal({
      isOpen: true,
      title: "Exit Group",
      message: "Are you sure you want to leave this group? You will no longer receive messages.",
      onConfirm: async () => {
        try {
          await exitGroup(chatId).unwrap();
          toast.success("You left the group");
          navigate(`/my-workspace/${workspaceId}/channels`);
        } catch (err) {
          toast.error(err?.data?.message || "Failed to leave group");
        }
      },
      danger: true,
    });
  };

  const handleDeleteGroup = (chatId) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Group",
      message: "Are you sure you want to permanently delete this group and all its messages? This cannot be undone.",
      onConfirm: async () => {
        try {
          await deleteGroup(chatId).unwrap();
          toast.success("Group deleted");
          navigate(`/my-workspace/${workspaceId}/channels`);
        } catch (err) {
          toast.error(err?.data?.message || "Failed to delete group");
        }
      },
      danger: true,
    });
  };

  const handleRenameGroup = (chatId, currentName) => {
    setPromptModal({
      isOpen: true,
      title: "Rename Group",
      label: "New group name",
      initialValue: currentName,
      placeholder: "Enter new name...",
      onConfirm: async (newName) => {
        if (!newName.trim()) {
          toast.error("Name cannot be empty");
          return;
        }
        // We don't have a dedicated rename endpoint; we'll show a toast and refetch.
        // In a real implementation, you'd call an update endpoint.
        toast.info("Rename feature coming soon");
        // If we had an update endpoint: await updateChat({ chatId, name: newName.trim() });
        refetchChats();
      },
    });
  };

  // ── Add Participant Modal success ─────────────────────────────────
  const handleAddMemberSuccess = () => {
    refetchChats();
    refetchMessages();
    setAddMemberModal({ isOpen: false, chatId: null });
  };

  // ── Call handler ──────────────────────────────────────────────────
  const handleCall = async (type) => {
    if (!workspace || !chat) {
      toast.error("Missing workspace or chat data");
      return;
    }

    let participantIds = [];
    if (isDM) {
      const otherId = otherParticipant?._id;
      if (!otherId) {
        toast.error("No other participant in this DM");
        return;
      }
      participantIds = [otherId];
    } else {
      participantIds = chat.participants
        .filter((p) => {
          const uid = p.user?._id || p.user;
          return uid !== userInfo._id && uid !== userInfo?._id;
        })
        .map((p) => p.user?._id || p.user);
    }

    if (participantIds.length === 0) {
      toast.info("No one else to call in this chat.");
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

  // Mic pointer events (unchanged)
  const startRecording = async () => {
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
        setIsLocked(false);
        setSwipeProgress(0);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingTime(0);
      setShowRecordedPreview(false);
      setIsLocked(false);
      setSwipeProgress(0);
      startTimer();
    } catch (err) {
      toast.error("Microphone access denied");
    }
  };

  const pauseRecording = () => {
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording)
      mediaRecorderRef.current.stop();
  };

  const handleMicPointerDown = (e) => {
    if (message.trim()) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    touchStartYRef.current = e.clientY;
    setSwipeProgress(0);
    startRecording();
  };

  const handleMicPointerMove = (e) => {
    if (!isRecordingRef.current || isLocked) return;
    const deltaY = touchStartYRef.current - e.clientY;
    const progress = Math.min(Math.max(deltaY / LOCK_THRESHOLD, 0), 1);
    setSwipeProgress(progress);
    if (deltaY >= LOCK_THRESHOLD) {
      setIsLocked(true);
      setSwipeProgress(1);
    }
  };

  const handleMicPointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (isLocked) return;
    if (isRecordingRef.current) stopRecording();
  };

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

      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Channel list (desktop) – dark/light themed */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col bg-white dark:bg-[#0f0f12] border-r border-gray-200/60 dark:border-gray-800/60 h-full overflow-hidden">
        <div className="p-4 border-b border-gray-200/60 dark:border-gray-800/60 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-300 flex items-center gap-2">
            <FaHashtag className="text-sm" style={{ color: brandColor }} />
            Channels
          </h2>
        </div>
        <div className="px-3 py-2 border-b border-gray-200/60 dark:border-gray-800/60 flex-shrink-0">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-[#0d9488]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filteredChannels.map((channel) => (
            <Link
              key={channel._id}
              to={`/my-workspace/${workspaceId}/chat/${channel._id}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${
                channel._id === chatId ? "bg-gray-100 dark:bg-gray-800/60" : "hover:bg-gray-50 dark:hover:bg-gray-800/30"
              }`}
            >
              <FaHashtag className="text-xs text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{channel.name}</span>
              {channel.unreadCount > 0 && (
                <span className="ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center" style={{ backgroundColor: brandColor }}>
                  {channel.unreadCount}
                </span>
              )}
            </Link>
          ))}
          {filteredDMs.map((dm) => {
            const participant = getDMParticipant(dm);
            return (
              <Link
                key={dm._id}
                to={`/my-workspace/${workspaceId}/chat/${dm._id}`}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${
                  dm._id === chatId ? "bg-gray-100 dark:bg-gray-800/60" : "hover:bg-gray-50 dark:hover:bg-gray-800/30"
                }`}
              >
                <div className="w-6 h-6 rounded-full overflow-hidden">
                  {participant?.profile ? (
                    <img
                      src={participant.profile}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: brandColor }}
                    >
                      {participant?.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {participant?.name || "Unknown"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0f0f12] h-full overflow-hidden">
        {/* Header – dark/light glass */}
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
                navigate(`/my-workspace/${workspaceId}/channels`);
              }}
              className="p-1 lg:hidden flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
            >
              <FaArrowLeft />
            </button>
            {isDM ? (
              displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-700/60"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <FaHashtag className="text-sm" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-base text-gray-800 dark:text-gray-100 truncate">
                {displayName}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {isDM
                  ? isDMOnline
                    ? "Online"
                    : "Offline"
                  : `${memberCount} members`}
              </p>
            </div>
          </div>
          <div
            className="flex gap-2 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
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

        {/* Messages area */}
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
              </div>
            ) : (
              localMessages.map((msg) => {
                const sender = getSender(msg.sender?._id || msg.sender);
                const isOwn =
                  msg.sender?._id === userInfo?._id ||
                  msg.sender === userInfo?._id;
                return (
                  <MediaMessage
                    key={msg._id}
                    message={msg}
                    isOwn={isOwn}
                    isDM={isDM}
                    senderName={sender?.name || "Unknown"}
                    senderProfile={sender?.profile}
                    brandColor={brandColor}
                    onImageClick={(payload) => setPreviewImage(payload)}
                    onDelete={handleDeleteMessage}
                    onArchive={handleArchiveMessage}
                    onUnarchive={handleUnarchiveMessage}
                    onStar={handleStarMessage}
                    onUnstar={handleUnstarMessage}
                    userId={userInfo?._id}
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

        {/* Input area – dark/light themed */}
        <div
          className="fixed lg:sticky bottom-0 left-0 right-0 lg:left-auto lg:right-auto z-20 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/90 dark:bg-[#0f0f12]/90 backdrop-blur-xl flex-shrink-0"
          style={{
            paddingTop: '0.5rem',
            paddingLeft: 'calc(0.75rem + var(--safe-left))',
            paddingRight: 'calc(0.75rem + var(--safe-right))',
            paddingBottom: 'calc(0.5rem + var(--safe-bottom))',
          }}
        >
          {showRecordedPreview && recordingBlob && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700/40">
              <div className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500 dark:text-green-400" />
                <span className="text-sm text-gray-700 dark:text-gray-200">Voice note ready</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(recordingTime)}
                </span>
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
                <button onClick={cancelRecording} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white">
                  <FaTimes className="text-xs" />
                </button>
              </div>
            </div>
          )}

          {isRecording && !isLocked && (
            <div className="relative flex items-center justify-between px-3 py-2 mb-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/40">
              <span className="text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />{" "}
                Recording... {formatTime(recordingTime)}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Slide up to lock
              </span>
              <div className="absolute right-4 bottom-20 flex flex-col items-center">
                <FaLock
                  className="text-xs"
                  style={{
                    color: swipeProgress > 0.6 ? brandColor : "#9CA3AF",
                  }}
                />
                <FaChevronUp className="text-gray-300 dark:text-gray-500 text-xs" />
              </div>
            </div>
          )}

          {isRecording && isLocked && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-600 dark:text-red-300">
                  {recordingPaused ? "Paused" : "Recording..."}{" "}
                  {formatTime(recordingTime)}
                </span>
                <FaLock className="text-[10px]" style={{ color: brandColor }} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={pauseRecording}
                  className="text-xs text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
                >
                  {recordingPaused ? "Resume" : "Pause"}
                </button>
                <button onClick={cancelRecording} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white">
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
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => handleFileUpload("file")}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0"
            >
              <FaPaperclip className="text-sm" />
            </button>
            <button
              type="button"
              onClick={() => handleFileUpload("image")}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0"
            >
              <FaImage className="text-sm" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e, "file")}
              className="hidden"
            />
            <input
              type="file"
              ref={imageInputRef}
              onChange={(e) => handleFileChange(e, "image")}
              className="hidden"
              accept="image/*,video/*"
            />

            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 min-w-0 px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-full bg-white dark:bg-[#0b0b10] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-[#0d9488]"
            />

            {message.trim() ? (
              <button
                type="submit"
                disabled={!isConnected}
                className="p-2 rounded-full text-white disabled:opacity-50 flex-shrink-0 transition hover:opacity-80"
                style={{ backgroundColor: brandColor }}
              >
                <FaPaperPlane className="text-sm" />
              </button>
            ) : (
              <button
                type="button"
                onPointerDown={handleMicPointerDown}
                onPointerMove={handleMicPointerMove}
                onPointerUp={handleMicPointerUp}
                onPointerCancel={handleMicPointerUp}
                className="p-2 rounded-full text-white flex-shrink-0 transition hover:opacity-80"
                style={{ backgroundColor: brandColor }}
              >
                <FaMicrophone className="text-sm" />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Chat / Group Details Bottom Sheet */}
      <ChatDetailsSheet
        isOpen={showDetailsSheet}
        onClose={() => setShowDetailsSheet(false)}
        chat={chat}
        workspace={workspace}
        isDM={isDM}
        otherParticipant={otherParticipant}
        isDMOnline={isDMOnline}
        userInfo={userInfo}
        userRole={userRole}
        brandColor={brandColor}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onMakeAdmin={handleMakeAdmin}
        onRemoveAdmin={handleRemoveAdmin}
        onExitGroup={handleExitGroup}
        onDeleteGroup={handleDeleteGroup}
        onRenameGroup={handleRenameGroup}
      />

      {/* Modals */}
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
    </div>
  );
};

export default MyWorkspaceChannelId;