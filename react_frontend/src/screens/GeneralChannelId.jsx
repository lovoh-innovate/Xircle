// pages/GeneralChannelId.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetChatMessagesQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
  useArchiveMessageMutation,
  useUnarchiveMessageMutation,
  useStarMessageMutation,
  useUnstarMessageMutation,
  useGetGroupMembersQuery,
  useGetJoinRequestsQuery,
  useHandleJoinRequestMutation,
  useUpdatePublicGroupMutation,
  useCreatePublicDirectChatMutation,
} from '../slices/messagingApiSlice';
import { useGetUserChatsQuery } from '../slices/messagingApiSlice';
import { useSocket } from '../components/SocketContext.jsx';
import { toast } from 'react-toastify';
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
  FaLock,
  FaChevronUp,
  FaCheckCircle,
  FaExclamationTriangle,
  FaUsers,
  FaCrown,
  FaUserPlus,
  FaUserCheck,
  FaInfoCircle,
  FaEdit,
  FaImage as FaImageIcon,
  FaTrashAlt as FaTrashIcon,
  FaPlus,
} from 'react-icons/fa';
import GeneralSidebar from '../components/GeneralSidebar';

// ─── Helpers ──────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const LOCK_THRESHOLD = 80;
const SEEN_TICK_COLOR = '#34B7F1';

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

// ─── Format date divider ──────────────────────────────────────────────
const formatDateDivider = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Audio waveform ──────────────────────────────────────────────────
const WAVEFORM_BARS = [6, 11, 15, 9, 17, 12, 7, 14, 18, 10, 6, 13, 16, 11, 8, 15, 12, 7, 13, 9, 6, 10];
const AudioWaveform = ({ isOwn, isPlaying }) => (
  <div className="flex items-center gap-[2px] h-6 flex-1">
    {WAVEFORM_BARS.map((h, i) => (
      <span
        key={i}
        className="w-[2.5px] rounded-full transition-opacity"
        style={{
          height: `${h * 2}px`,
          backgroundColor: isOwn ? 'rgba(255,255,255,0.85)' : '#0d9488',
          opacity: isPlaying ? 1 : 0.55,
        }}
      />
    ))}
  </div>
);

// ─── Message Ticks ──────────────────────────────────────────────────
const MessageTicks = ({ message, isOwn }) => {
  if (!isOwn) return null;
  if (message._pending) return <FaRegClock className="text-[10px] text-gray-400 dark:text-gray-500" />;
  if (message._failed) return <FaTimes className="text-[10px] text-red-500" />;
  if (!message._delivered && !message._read) return <FaCheck className="text-[10px] text-gray-400 dark:text-gray-500" />;
  if (message._delivered && !message._read) return (
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

// ─── Quoted Reply Block ────────────────────────────────────────────
const QuotedReplyBlock = ({ replyData, isOwn, onJump }) => {
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
      style={!isOwn ? { borderLeftColor: '#0d9488' } : {}}
    >
      <p className={`font-semibold truncate ${isOwn ? 'text-white/90' : ''}`} style={isOwn ? {} : { color: '#0d9488' }}>
        {name}
      </p>
      <p className={`truncate ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>{text}</p>
    </button>
  );
};

// ─── Media Preview Component ──────────────────────────────────────
const MediaPreview = ({ mediaFile, onRemove, onSend, brandColor }) => {
  const [preview, setPreview] = useState(null);
  const [type, setType] = useState(null);

  useEffect(() => {
    if (mediaFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setType(mediaFile.type.startsWith('image/') ? 'image' : 'file');
      };
      reader.readAsDataURL(mediaFile);
    }
  }, [mediaFile]);

  if (!mediaFile || !preview) return null;

  return (
    <div className="flex items-center gap-3 p-3 mb-2 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700/60">
      <div className="relative flex-shrink-0">
        {type === 'image' ? (
          <img src={preview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
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
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{mediaFile.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {(mediaFile.size / 1024).toFixed(1)} KB
        </p>
      </div>
      <button
        onClick={() => onSend(mediaFile)}
        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium flex-shrink-0"
        style={{ backgroundColor: brandColor || '#0d9488' }}
      >
        <FaPaperPlane className="inline mr-1 text-xs" /> Send
      </button>
    </div>
  );
};

// ─── Media Message Component ──────────────────────────────────────
const MediaMessage = ({
  message,
  isOwn,
  senderName,
  senderId,
  senderProfile,
  onImageClick,
  onDelete,
  onArchive,
  onUnarchive,
  onStar,
  onUnstar,
  onReply,
  onOpenDM,
  userId,
  isMobile,
  onLongPress,
  allMessages,
  onJumpToMessage,
  resolveSender,
}) => {
  const time = new Date(message.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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

  const replyPreview = (() => {
    const replyTo = message?.replyTo;
    if (!replyTo) return null;
    if (typeof replyTo === 'object') {
      const rSender = resolveSender ? resolveSender(replyTo.sender) : (replyTo.sender || {});
      return {
        id: replyTo._id,
        senderName: rSender?.name || replyTo.senderName || 'Unknown',
        content: replyTo.content,
        mediaName: replyTo.mediaName,
        messageType: replyTo.messageType,
      };
    }
    const original = allMessages?.find((m) => m._id === replyTo);
    if (!original) return null;
    const rSender = resolveSender ? resolveSender(original.sender) : (original.sender || {});
    return {
      id: original._id,
      senderName: rSender?.name || 'Unknown',
      content: original.content,
      mediaName: original.mediaName,
      messageType: original.messageType,
    };
  })();

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

  const toggleMenu = (e) => { e.stopPropagation(); setShowMenu(!showMenu); };
  const closeMenu = () => setShowMenu(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu();
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
      case 'image': return null;
      case 'video':
        return <video src={message.mediaUrl} controls className="max-w-full rounded-lg max-h-80" />;
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
              style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : '#0d9488' }}
            >
              {isPlaying ? <FaPause className="text-xs text-white" /> : <FaPlay className="text-xs text-white ml-0.5" />}
            </button>
            <AudioWaveform isOwn={isOwn} isPlaying={isPlaying} />
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
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">📄</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{message.mediaName || 'File'}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{message.mediaSize ? `${(message.mediaSize / 1024).toFixed(1)} KB` : 'File'}</div>
            </div>
            <button onClick={handleDownload} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <FaDownload className="text-sm" />
            </button>
          </div>
        );
      default: return null;
    }
  };

  const swipeStyle = {
    transform: `translateX(${swipeX}px)`,
    transition: swipeX === 0 ? 'transform 0.2s ease' : 'none',
  };
  const swipeIconOpacity = Math.min(swipeX / 60, 1);

  // ─── Image messages ──────────────────────────────────────────────────
  if (message.messageType === 'image') {
    return (
      <div data-message-id={message._id} className="relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove}>
        {isMobile && swipeX > 0 && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" style={{ opacity: swipeIconOpacity }}>
            <FaReply className="text-sm" />
          </div>
        )}
        <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`} style={isMobile ? swipeStyle : undefined}>
          {!isOwn && (
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
              {senderProfile ? (
                <img src={senderProfile} alt={senderName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#0d9488' }}>
                  {senderName?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
          )}
          <div className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
            {!isOwn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (senderId) onOpenDM(senderId);
                }}
                className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1 mb-0.5 hover:underline focus:outline-none transition"
                title="Open private chat"
              >
                {senderName}
              </button>
            )}
            {replyPreview && (
              <div className="w-full mb-1">
                <QuotedReplyBlock replyData={replyPreview} isOwn={isOwn} onJump={onJumpToMessage} />
              </div>
            )}
            <div
              className="relative rounded-2xl overflow-hidden cursor-pointer group"
              onClick={() => {
                if (message.mediaUrl) {
                  onImageClick && onImageClick({ url: message.mediaUrl, senderName: isOwn ? 'You' : senderName, time });
                } else {
                  toast.error('Image URL not available');
                }
              }}
            >
              {message.mediaUrl ? (
                <img src={message.mediaUrl} alt={message.mediaName || 'Image'} className="max-w-full max-h-80 object-cover w-full" />
              ) : (
                <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <FaExclamationTriangle className="text-2xl mr-2" /> Image unavailable
                </div>
              )}
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">
                <span>{time}</span>
                <MessageTicks message={message} isOwn={isOwn} />
              </div>
              {!isMobile && (
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition" ref={menuRef}>
                  <button onClick={toggleMenu} className="text-white bg-black/40 p-1 rounded-full hover:bg-black/60">
                    <FaEllipsisV className="text-xs" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-8 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[160px] z-10 py-1">
                      <button onClick={() => { closeMenu(); onReply(message); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full">
                        <FaReply className="text-xs" /> Reply
                      </button>
                      {isOwn && (
                        <button onClick={() => { closeMenu(); onDelete(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full">
                          <FaTrashAlt className="text-xs" /> Delete
                        </button>
                      )}
                      {isStarred ? (
                        <button onClick={() => { closeMenu(); onUnstar(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full">
                          <FaStar className="text-xs" /> Unstar
                        </button>
                      ) : (
                        <button onClick={() => { closeMenu(); onStar(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full">
                          <FaRegStar className="text-xs" /> Star
                        </button>
                      )}
                      {isArchived ? (
                        <button onClick={() => { closeMenu(); onUnarchive(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full">
                          <FaUndo className="text-xs" /> Unarchive
                        </button>
                      ) : (
                        <button onClick={() => { closeMenu(); onArchive(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full">
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
    <div data-message-id={message._id} className="relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove}>
      {isMobile && swipeX > 0 && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" style={{ opacity: swipeIconOpacity }}>
          <FaReply className="text-sm" />
        </div>
      )}
      <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`} style={isMobile ? swipeStyle : undefined}>
        {!isOwn && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
            {senderProfile ? (
              <img src={senderProfile} alt={senderName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#0d9488' }}>
                {senderName?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
        )}
        <div className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
          {!isOwn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (senderId) onOpenDM(senderId);
              }}
              className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1 hover:underline focus:outline-none transition"
              title="Open private chat"
            >
              {senderName}
            </button>
          )}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
              isOwn
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200'
            }`}
            style={isOwn ? { backgroundColor: '#0d9488' } : {}}
          >
            {replyPreview && <QuotedReplyBlock replyData={replyPreview} isOwn={isOwn} onJump={onJumpToMessage} />}
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
                <button onClick={toggleMenu} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5">
                  <FaEllipsisV className="text-xs" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 bottom-6 bg-white dark:bg-[#1e1e26] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[160px] z-10 py-1">
                    <button onClick={() => { closeMenu(); onReply(message); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full">
                      <FaReply className="text-xs" /> Reply
                    </button>
                    {isOwn && (
                      <button onClick={() => { closeMenu(); onDelete(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition w-full">
                        <FaTrashAlt className="text-xs" /> Delete
                      </button>
                    )}
                    {isStarred ? (
                      <button onClick={() => { closeMenu(); onUnstar(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition w-full">
                        <FaStar className="text-xs" /> Unstar
                      </button>
                    ) : (
                      <button onClick={() => { closeMenu(); onStar(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full">
                        <FaRegStar className="text-xs" /> Star
                      </button>
                    )}
                    {isArchived ? (
                      <button onClick={() => { closeMenu(); onUnarchive(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition w-full">
                        <FaUndo className="text-xs" /> Unarchive
                      </button>
                    ) : (
                      <button onClick={() => { closeMenu(); onArchive(message._id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition w-full">
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

// ─── System Message Component ──────────────────────────────────────
const SystemMessage = ({ message }) => {
  return (
    <div className="flex justify-center my-1">
      <div className="bg-gray-200/70 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-full max-w-[80%] text-center">
        {message.content}
      </div>
    </div>
  );
};

// ─── Reply Preview Bar ────────────────────────────────────────────
const ReplyPreview = ({ replyTo, onCancel, resolveSender }) => {
  if (!replyTo) return null;
  const resolved = resolveSender ? resolveSender(replyTo.sender) : replyTo.sender;
  const senderName = resolved?.name || 'Unknown';
  const content = replyTo.content || (replyTo.mediaName ? `📎 ${replyTo.mediaName}` : 'Media');
  return (
    <div className="flex items-center justify-between px-3 py-2 mb-2 bg-gray-100 dark:bg-gray-800/60 rounded-lg border-l-4 border-teal-500">
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

// ─── Fullscreen image preview ──────────────────────────────────────
const ImagePreviewModal = ({ imageUrl, onClose, senderName, time }) => {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = 'image';
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 text-white flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition">
            <FaArrowLeft />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{senderName || 'Photo'}</p>
            {time && <p className="text-[11px] text-white/60">{time}</p>}
          </div>
        </div>
        {imageUrl && (
          <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-lg transition">
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
            onError={() => { setLoading(false); setImageError(true); }}
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
}) => {
  if (!isOpen || !message) return null;
  if (message.messageType === 'system') return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] rounded-t-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700/60">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {message.messageType === 'image' ? <FaImage className="text-sm" /> : <FaComment className="text-sm" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {message.content ? message.content.substring(0, 60) : (message.mediaName || 'Media')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(message.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="space-y-1">
          <button onClick={() => { onReply(message); onClose(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            <FaReply className="text-sm" /> <span className="text-sm font-medium">Reply</span>
          </button>
          {isOwn && (
            <button onClick={() => { onDelete(message._id); onClose(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
              <FaTrashAlt className="text-sm" /> <span className="text-sm font-medium">Delete for everyone</span>
            </button>
          )}
          {isStarred ? (
            <button onClick={() => { onUnstar(message._id); onClose(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 transition">
              <FaStar className="text-sm" /> <span className="text-sm font-medium">Unstar</span>
            </button>
          ) : (
            <button onClick={() => { onStar(message._id); onClose(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
              <FaRegStar className="text-sm" /> <span className="text-sm font-medium">Star</span>
            </button>
          )}
          {isArchived ? (
            <button onClick={() => { onUnarchive(message._id); onClose(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition">
              <FaUndo className="text-sm" /> <span className="text-sm font-medium">Unarchive</span>
            </button>
          ) : (
            <button onClick={() => { onArchive(message._id); onClose(); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
              <FaArchive className="text-sm" /> <span className="text-sm font-medium">Archive</span>
            </button>
          )}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Edit Channel Modal ──────────────────────────────────────────
const EditChannelModal = ({ isOpen, onClose, chat, onSuccess }) => {
  const [name, setName] = useState(chat?.name || '');
  const [description, setDescription] = useState(chat?.description || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(chat?.avatar || '');
  const [isLoading, setIsLoading] = useState(false);
  const [updatePublicGroup] = useUpdatePublicGroupMutation();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Channel name is required.');
      return;
    }
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      if (avatarFile) formData.append('avatar', avatarFile);

      await updatePublicGroup({ chatId: chat._id, data: formData }).unwrap();
      toast.success('Channel updated!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update channel.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            <FaEdit className="inline mr-2 text-teal-500" /> Edit Channel
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
              rows="2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Avatar</label>
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                  />
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                  >
                    <FaTrashIcon className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-teal-500 transition bg-gray-50 dark:bg-[#2a2a2a]">
                  <FaImageIcon className="text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Upload Avatar</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, or SVG (max 5MB)</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
            >
              {isLoading ? <FaSpinner className="animate-spin mx-auto" /> : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Channel Details Panel (Group only) ──────────────────────────
const ChannelDetailsPanel = ({ chat, userInfo, onClose, onEdit, onOpenDM }) => {
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const isAdmin = chat?.participants?.some(
    (p) => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === 'admin'
  );
  const isCreator = chat?.createdBy?._id === userInfo?._id;

  const { data: membersData, isLoading: membersLoading } = useGetGroupMembersQuery(chat?._id, {
    skip: !chat?._id,
  });
  const { data: joinRequestsData, refetch: refetchJoinRequests } = useGetJoinRequestsQuery(chat?._id, {
    skip: !chat?._id || !isAdmin,
  });
  const [handleJoinRequest] = useHandleJoinRequestMutation();

  const handleRequest = async (requestId, action) => {
    try {
      await handleJoinRequest({ chatId: chat._id, requestId, action }).unwrap();
      toast.success(`Join request ${action}ed`);
      refetchJoinRequests();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to handle request');
    }
  };

  const members = membersData?.members || [];
  const joinRequests = joinRequestsData?.requests || [];

  return (
    <div className="h-full bg-white dark:bg-[#14141a] border-l border-gray-200 dark:border-gray-800/60 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800/60">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Channel Info</h3>
        <div className="flex items-center gap-2">
          {(isAdmin || isCreator) && (
            <button onClick={onEdit} className="p-1 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition" title="Edit channel">
              <FaEdit className="text-sm" />
            </button>
          )}
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition">
            <FaTimes className="text-sm" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <div>
          <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">{chat?.name}</h4>
          {chat?.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{chat.description}</p>}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <FaUsers className="text-teal-500" />
          <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
        </div>

        {isAdmin && (
          <div>
            <button
              onClick={() => setShowJoinRequests(!showJoinRequests)}
              className="flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
            >
              <FaUserPlus className="text-xs" />
              Join Requests ({joinRequests.length})
              <FaChevronDown className={`text-xs transition-transform ${showJoinRequests ? 'rotate-180' : ''}`} />
            </button>
            {showJoinRequests && (
              <div className="mt-2 space-y-2">
                {joinRequests.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">No pending requests</p>
                ) : (
                  joinRequests.map((req) => (
                    <div key={req._id} className="flex items-center gap-2 justify-between bg-gray-50 dark:bg-gray-800/30 p-2 rounded-lg">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{req.user?.name || 'Unknown'}</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleRequest(req._id, 'accept')} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition">Accept</button>
                        <button onClick={() => handleRequest(req._id, 'reject')} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition">Reject</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Members</h5>
          {membersLoading ? (
            <div className="flex justify-center py-4"><FaSpinner className="animate-spin text-teal-500 text-lg" /></div>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => {
                const user = member.user || {};
                const isCreatorUser = chat?.createdBy?._id === user._id;
                const isAdminRole = member.role === 'admin';
                const isSelf = user._id === userInfo?._id;
                return (
                  <li key={user._id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-medium flex-shrink-0">
                      {user.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isSelf ? (
                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                          {user.name || 'Unknown'} (You)
                          {(isCreatorUser || isAdminRole) && (
                            <span className="ml-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                              {isCreatorUser && '👑 '}
                              {isAdminRole && '(Admin)'}
                            </span>
                          )}
                        </span>
                      ) : (
                        <button
                          onClick={() => { if (user._id) onOpenDM(user._id); }}
                          className="text-sm text-gray-800 dark:text-gray-200 truncate hover:underline focus:outline-none transition"
                          title="Open private chat"
                        >
                          {user.name || 'Unknown'}
                          {(isCreatorUser || isAdminRole) && (
                            <span className="ml-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                              {isCreatorUser && '👑 '}
                              {isAdminRole && '(Admin)'}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component (Group Channel) ──────────────────────────────────
const GeneralChannelId = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDesktop = !isMobile;

  const { socket, isConnected } = useSocket();

  const { data: chatListData, refetch: refetchChats } = useGetUserChatsQuery({ archived: false });
  const chat = chatListData?.chats?.find(c => c._id === chatId);
  
  useEffect(() => {
    if (chat && (chat.type !== 'group' || chat.scope !== 'public')) {
      navigate('/channels');
    }
  }, [chat, navigate]);

  const displayName = chat?.name || 'Unnamed Channel';
  const displayAvatar = chat?.avatar || null;
  const memberCount = chat?.participants?.length || 0;
  const isAdmin = chat?.participants?.some(
    (p) => (p.user?._id === userInfo?._id || p.user === userInfo?._id) && p.role === 'admin'
  );
  const isCreator = chat?.createdBy?._id === userInfo?._id;

  // ─── Build user map for sender resolution ──────────────────────────
  const userMapRef = useRef(new Map());
  useEffect(() => {
    if (chat?.participants) {
      const map = new Map();
      chat.participants.forEach(p => {
        const user = p.user || {};
        if (user._id) map.set(user._id, user);
      });
      if (userInfo?._id) map.set(userInfo._id, userInfo);
      userMapRef.current = map;
    }
  }, [chat, userInfo]);

  const resolveSender = useCallback((senderField) => {
    if (!senderField) return { name: 'Unknown', profile: null };
    if (typeof senderField === 'string') {
      const found = userMapRef.current.get(senderField);
      return found ? found : { _id: senderField, name: 'Unknown', profile: null };
    }
    if (senderField.name) return senderField;
    const found = senderField._id ? userMapRef.current.get(senderField._id) : null;
    if (found) {
      return { ...senderField, name: found.name, profile: found.profile ?? senderField.profile };
    }
    return { ...senderField, name: senderField.name || 'Unknown' };
  }, []);

  // ─── Fetch join requests ──────────────────────────────────────────
  const { data: joinRequestsData, refetch: refetchJoinRequests } = useGetJoinRequestsQuery(chat?._id, {
    skip: !chat?._id || !isAdmin,
  });
  const pendingCount = joinRequestsData?.requests?.length || 0;

  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useGetChatMessagesQuery(
    { chatId, page: 1, limit: 50 },
    { skip: !chatId }
  );
  const [sendMessageApi] = useSendMessageMutation();
  const [deleteMessageApi] = useDeleteMessageMutation();
  const [archiveMessage] = useArchiveMessageMutation();
  const [unarchiveMessage] = useUnarchiveMessageMutation();
  const [starMessage] = useStarMessageMutation();
  const [unstarMessage] = useUnstarMessageMutation();

  const [createDirectChat] = useCreatePublicDirectChatMutation();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, danger: false });
  const [actionModal, setActionModal] = useState({ isOpen: false, message: null });

  // ─── Reset state when chatId changes ──────────────────────────────
  useEffect(() => {
    setLocalMessages([]);
    setReplyToMessage(null);
    setPreviewImage(null);
    setShowDetails(false);
    setActionModal({ isOpen: false, message: null });
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    userMapRef.current = new Map();
    setIsAtBottom(true);
    setShowScrollDown(false);
    setPendingMedia(null);
  }, [chatId]);

  // ─── Scroll / bottom detection ─────────────────────────────────
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

  // ─── Auto-resize textarea ──────────────────────────────────────────
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [message]);

  // ─── Message handling ──────────────────────────────────────────
  const mergeMessagesIntoState = useCallback((incomingList) => {
    if (!incomingList || incomingList.length === 0) return;
    setLocalMessages((prev) => {
      let next = prev;
      let mutated = false;

      incomingList.forEach((incoming) => {
        const existingRealIdx = next.findIndex((m) => m._id === incoming._id);
        if (existingRealIdx > -1) {
          if (!mutated) next = [...next];
          mutated = true;
          next[existingRealIdx] = { ...next[existingRealIdx], ...incoming, _sent: true };
          return;
        }

        const isOwnMessage = incoming.sender?._id === userInfo?._id || incoming.sender === userInfo?._id;
        if (isOwnMessage) {
          const tempIdx = next.findIndex((m) => m._temp && m.content === incoming.content);
          if (tempIdx > -1) {
            if (!mutated) next = [...next];
            mutated = true;
            next[tempIdx] = { ...incoming, _temp: false, _pending: false, _failed: false, _sent: true };
            return;
          }
        }

        if (!mutated) next = [...next];
        mutated = true;
        next.push({ ...incoming, _sent: true });
      });

      return mutated ? next : prev;
    });
  }, [userInfo?._id]);

  useEffect(() => {
    if (messagesData?.messages) {
      const firstMsg = messagesData.messages[0];
      const msgChatId = typeof firstMsg.chat === 'string' ? firstMsg.chat : firstMsg.chat?._id;
      if (msgChatId && msgChatId !== chatId) return;
      mergeMessagesIntoState(messagesData.messages);
    }
  }, [messagesData, mergeMessagesIntoState, chatId]);

  // ─── Socket handlers ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;
    socket.emit('join-chat', chatId);

    const handleNewMessage = (incoming) => {
      const incomingChatId = typeof incoming.chat === 'string' ? incoming.chat : incoming.chat?._id;
      if (incomingChatId && incomingChatId !== chatId) return;
      mergeMessagesIntoState([incoming]);
    };

    const handleMessageDeleted = ({ messageId }) => {
      setLocalMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-deleted', handleMessageDeleted);

    return () => {
      socket.emit('leave-chat', chatId);
      socket.off('new-message', handleNewMessage);
      socket.off('message-deleted', handleMessageDeleted);
    };
  }, [socket, isConnected, chatId, mergeMessagesIntoState]);

  // ─── Auto-refresh polling ──────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(() => {
      refetchMessages();
      refetchChats();
      if (isAdmin) refetchJoinRequests();
    }, 3000);
    return () => clearInterval(interval);
  }, [chatId, refetchMessages, refetchChats, refetchJoinRequests, isAdmin]);

  // ─── Handle media send ──────────────────────────────────────────
  const handleSendMedia = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('media', file);
    formData.append('messageType', file.type.startsWith('image/') ? 'image' : 'file');
    if (replyToMessage) formData.append('replyToId', replyToMessage._id);
    
    try {
      await sendMessageApi({ chatId, data: formData }).unwrap();
      toast.success(`${file.type.startsWith('image/') ? 'Image' : 'File'} sent!`);
      setReplyToMessage(null);
      setPendingMedia(null);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send media');
    }
  };

  // ─── Send message ──────────────────────────────────────────────
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
      content: trimmed,
      sender: userInfo,
      createdAt: new Date().toISOString(),
      messageType: 'text',
      chat: chatId,
      replyTo: replyToMessage ? { _id: replyToMessage._id, sender: replyToMessage.sender, content: replyToMessage.content, mediaName: replyToMessage.mediaName, messageType: replyToMessage.messageType } : null,
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setMessage('');
    const replyToId = replyToMessage?._id || null;
    setReplyToMessage(null);
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    
    socket.emit('send-message', {
      chatId,
      content: trimmed,
      messageType: 'text',
      mentions: [],
      replyToId,
    }, (response) => {
      if (response?.error) {
        setLocalMessages((prev) => prev.map((m) => m._id === tempId ? { ...m, _pending: false, _failed: true } : m));
        toast.error(response.error);
      } else {
        setLocalMessages((prev) => prev.map((m) => m._id === tempId ? { ...m, _pending: false, _sent: true } : m));
      }
    });
  };

  // ─── File / image handlers ──────────────────────────────────────
  const handleFileUpload = (type) => {
    if (type === 'file') fileInputRef.current?.click();
    else imageInputRef.current?.click();
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingMedia(file);
    e.target.value = '';
  };

  // ─── Handle paste ──────────────────────────────────────────────────
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setPendingMedia(file);
          toast.info('Image pasted! Click send to upload.');
          e.preventDefault();
          break;
        }
      }
    }
  };

  // ─── Open private DM ──────────────────────────────────────────
  const handleOpenDM = useCallback(async (userId) => {
    if (!userId) {
      toast.error('User ID is required to start a chat');
      return;
    }
    try {
      const result = await createDirectChat({ userId }).unwrap();
      if (result.chat?._id) {
        navigate(`/chats/${result.chat._id}`);
      } else {
        toast.error('Failed to create direct chat');
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to open private chat');
    }
  }, [createDirectChat, navigate]);

  // ─── Voice recording ──────────────────────────────────────────
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

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecordingRef.current) mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(audioBlob);
        setShowRecordedPreview(true);
        stopTimer();
        setIsRecording(false);
        setIsLocked(false);
        setSwipeProgress(0);
        stream.getTracks().forEach(track => track.stop());
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
      toast.error('Microphone access denied');
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
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    setIsLocked(false);
    setSwipeProgress(0);
    stopTimer();
  };

  const sendAudioMessage = async (audioBlob) => {
    const formData = new FormData();
    const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
    formData.append('media', audioFile);
    formData.append('messageType', 'audio');
    formData.append('mediaDuration', recordingTime.toString());
    if (replyToMessage) {
      formData.append('replyToId', replyToMessage._id);
    }
    try {
      await sendMessageApi({ chatId, data: formData }).unwrap();
      setRecordingBlob(null);
      setShowRecordedPreview(false);
      setRecordingTime(0);
      setReplyToMessage(null);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send voice note');
    }
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

  // ─── Message action handlers ──────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    setConfirmModal({ isOpen: true, title: 'Delete Message', message: 'Are you sure?', onConfirm: async () => {
      try { await deleteMessageApi(messageId).unwrap(); toast.success('Message deleted'); } catch (err) { toast.error(err?.data?.message || 'Failed'); }
    }, danger: true });
  };
  const handleArchiveMessage = async (messageId) => { try { await archiveMessage(messageId).unwrap(); toast.success('Archived'); refetchMessages(); } catch (err) { toast.error(err?.data?.message); } };
  const handleUnarchiveMessage = async (messageId) => { try { await unarchiveMessage(messageId).unwrap(); toast.success('Unarchived'); refetchMessages(); } catch (err) { toast.error(err?.data?.message); } };
  const handleStarMessage = async (messageId) => { try { await starMessage(messageId).unwrap(); toast.success('Starred'); refetchMessages(); } catch (err) { toast.error(err?.data?.message); } };
  const handleUnstarMessage = async (messageId) => { try { await unstarMessage(messageId).unwrap(); toast.success('Unstarred'); refetchMessages(); } catch (err) { toast.error(err?.data?.message); } };
  const handleReply = (msg) => { setReplyToMessage(msg); setTimeout(() => inputRef.current?.focus(), 100); };
  const cancelReply = () => setReplyToMessage(null);
  const handleLongPress = (message) => setActionModal({ isOpen: true, message });
  const handleJumpToMessage = useCallback((messageId) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-message-id="${messageId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('ring-2', 'ring-teal-400', 'rounded-2xl');
    setTimeout(() => target.classList.remove('ring-2', 'ring-teal-400', 'rounded-2xl'), 1200);
  }, []);
  const handleEditChannel = () => setShowEditModal(true);
  const handleEditSuccess = () => { refetchChats(); };
  const clearPendingMedia = () => setPendingMedia(null);

  // ─── Render messages with dividers ────────────────────────────
  const renderMessagesWithDividers = () => {
    if (localMessages.length === 0) {
      return <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500"><FaComment className="text-4xl mb-2 opacity-30" /><p className="text-sm">No messages yet</p></div>;
    }
    const sorted = [...localMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let lastDate = null;
    const elements = [];
    sorted.forEach((msg) => {
      const msgDate = new Date(msg.createdAt);
      const dateKey = msgDate.toDateString();
      if (dateKey !== lastDate) {
        const dividerText = formatDateDivider(msg.createdAt);
        elements.push(<div key={`divider-${dateKey}`} className="flex justify-center my-3"><div className="bg-gray-200/70 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full">{dividerText}</div></div>);
        lastDate = dateKey;
      }
      if (msg.messageType === 'system') {
        elements.push(<SystemMessage key={msg._id} message={msg} />);
      } else {
        const resolvedSender = resolveSender(msg.sender);
        const isOwn = resolvedSender._id === userInfo?._id || msg.sender === userInfo?._id || msg.sender?._id === userInfo?._id;
        const senderName = resolvedSender.name || 'Unknown';
        const senderId = resolvedSender._id;
        const senderProfile = resolvedSender.profile || null;
        elements.push(
          <MediaMessage
            key={msg._id}
            message={msg}
            isOwn={isOwn}
            senderName={senderName}
            senderId={senderId}
            senderProfile={senderProfile}
            onImageClick={(payload) => setPreviewImage(payload)}
            onDelete={handleDeleteMessage}
            onArchive={handleArchiveMessage}
            onUnarchive={handleUnarchiveMessage}
            onStar={handleStarMessage}
            onUnstar={handleUnstarMessage}
            onReply={handleReply}
            onOpenDM={handleOpenDM}
            userId={userInfo?._id}
            isMobile={isMobile}
            onLongPress={handleLongPress}
            allMessages={sorted}
            onJumpToMessage={handleJumpToMessage}
            resolveSender={resolveSender}
          />
        );
      }
    });
    return elements;
  };

  // ─── Render ────────────────────────────────────────────────────
  if (!chat) {
    return <div className="min-h-screen flex items-center justify-center"><FaUsers className="text-4xl mb-2 opacity-30" /><p className="text-sm text-gray-500">Channel not found</p></div>;
  }

  return (
    <>
      <div className="h-dvh bg-white dark:bg-[#0f0f12] flex flex-col lg:flex-row overflow-hidden">
        <div className="hidden lg:block lg:w-72 lg:h-full flex-shrink-0"><GeneralSidebar /></div>
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className={`flex-1 flex flex-col h-full overflow-hidden ${isDesktop && showDetails ? 'lg:w-2/3' : 'lg:w-full'}`}>
            {/* Header */}
            <header className="fixed lg:sticky top-0 left-0 right-0 lg:left-auto lg:right-auto z-20 flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl text-gray-800 dark:text-white flex-shrink-0 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button onClick={() => navigate('/channels')} className="p-1 lg:hidden flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft /></button>
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  {displayAvatar ? <img src={displayAvatar} alt="" className="w-full h-full rounded-full object-cover" /> : <FaUsers className="text-sm" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-base text-gray-800 dark:text-gray-100 truncate">{displayName}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{memberCount} members</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setShowDetails(!showDetails)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition relative" aria-label="Channel info">
                  <FaInfoCircle className="text-lg" />
                  {isAdmin && pendingCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white dark:border-gray-800"></span>}
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="relative flex-1 overflow-hidden">
              <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="h-full overflow-y-auto px-4 py-3 space-y-1 pt-20 lg:pt-3 pb-24 lg:pb-3">
                {renderMessagesWithDividers()}
                <div ref={messagesEndRef} />
              </div>
              {showScrollDown && (
                <button onClick={scrollToBottom} className="absolute bottom-4 right-4 z-30 w-10 h-10 rounded-full bg-white dark:bg-[#14141a] shadow-lg border border-gray-200 dark:border-gray-700/60 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all">
                  <FaChevronDown className="text-sm" />
                </button>
              )}
            </div>

            {/* Input area */}
            <div className="fixed lg:sticky bottom-0 left-0 right-0 lg:left-auto lg:right-auto z-20 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/90 dark:bg-[#0f0f12]/90 backdrop-blur-xl flex-shrink-0 px-3 sm:px-4">
              <div className="py-2">
                <ReplyPreview replyTo={replyToMessage} onCancel={cancelReply} resolveSender={resolveSender} />

                {/* Media Preview */}
                {pendingMedia && (
                  <MediaPreview
                    mediaFile={pendingMedia}
                    onRemove={clearPendingMedia}
                    onSend={handleSendMedia}
                    brandColor="#0d9488"
                  />
                )}

                {showRecordedPreview && recordingBlob && (
                  <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700/40">
                    <div className="flex items-center gap-2">
                      <FaCheckCircle className="text-green-500 dark:text-green-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Voice note ready</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(recordingTime)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { const audio = new Audio(URL.createObjectURL(recordingBlob)); audio.play(); }} className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"><FaPlay className="text-xs" /></button>
                      <button onClick={() => sendAudioMessage(recordingBlob)} className="px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded text-xs hover:bg-green-700 dark:hover:bg-green-800 transition">Send</button>
                      <button onClick={cancelRecording} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"><FaTimes className="text-xs" /></button>
                    </div>
                  </div>
                )}

                {isRecording && !isLocked && (
                  <div className="relative flex items-center justify-between px-3 py-2 mb-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/40">
                    <span className="text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Recording... {formatTime(recordingTime)}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">Slide up to lock</span>
                    <div className="absolute right-4 bottom-20 flex flex-col items-center">
                      <FaLock className="text-xs" style={{ color: swipeProgress > 0.6 ? '#0d9488' : '#9CA3AF' }} />
                      <FaChevronUp className="text-gray-300 dark:text-gray-500 text-xs" />
                    </div>
                  </div>
                )}

                {isRecording && isLocked && (
                  <div className="flex items-center justify-between px-3 py-2 mb-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700/40">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs text-red-600 dark:text-red-300">{recordingPaused ? 'Paused' : 'Recording...'} {formatTime(recordingTime)}</span>
                      <FaLock className="text-[10px]" style={{ color: '#0d9488' }} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={pauseRecording} className="text-xs text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200">{recordingPaused ? 'Resume' : 'Pause'}</button>
                      <button onClick={cancelRecording} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white"><FaTrashAlt className="text-xs" /></button>
                      <button onClick={stopRecording} className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition"><FaStop className="text-xs" /></button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <button type="button" onClick={() => handleFileUpload('file')} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0 mb-1"><FaPaperclip className="text-sm" /></button>
                  <button type="button" onClick={() => handleFileUpload('image')} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0 mb-1"><FaImage className="text-sm" /></button>
                  <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'file')} className="hidden" />
                  <input type="file" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} className="hidden" accept="image/*,video/*" />
                  <textarea 
                    ref={inputRef} 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Type a message... (paste images)"
                    rows={1}
                    className="flex-1 min-w-0 px-4 py-2 border border-gray-300 dark:border-gray-700/60 rounded-2xl bg-white dark:bg-[#0b0b10] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none max-h-32 overflow-y-auto"
                    style={{ minHeight: '42px', lineHeight: '1.5' }}
                  />
                  {message.trim() ? (
                    <button type="submit" disabled={!isConnected} className="p-2 rounded-full text-white disabled:opacity-50 flex-shrink-0 transition hover:opacity-80 mb-1" style={{ backgroundColor: '#0d9488' }}><FaPaperPlane className="text-sm" /></button>
                  ) : (
                    <button type="button" onPointerDown={handleMicPointerDown} onPointerMove={handleMicPointerMove} onPointerUp={handleMicPointerUp} onPointerCancel={handleMicPointerUp} className="p-2 rounded-full text-white flex-shrink-0 transition hover:opacity-80 mb-1" style={{ backgroundColor: '#0d9488' }}><FaMicrophone className="text-sm" /></button>
                  )}
                </form>
              </div>
            </div>
          </div>

          {isDesktop && showDetails && (
            <div className="lg:w-80 lg:flex-shrink-0 border-l border-gray-200 dark:border-gray-800/60 h-full overflow-hidden">
              <ChannelDetailsPanel chat={chat} userInfo={userInfo} onClose={() => setShowDetails(false)} onEdit={handleEditChannel} onOpenDM={handleOpenDM} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile details overlay */}
      {isMobile && showDetails && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowDetails(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-white dark:bg-[#14141a] shadow-xl border-l border-gray-200 dark:border-gray-800/60 overflow-y-auto transition-transform duration-300 ease-in-out">
            <ChannelDetailsPanel chat={chat} userInfo={userInfo} onClose={() => setShowDetails(false)} onEdit={handleEditChannel} onOpenDM={handleOpenDM} />
          </div>
        </>
      )}

      <EditChannelModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} chat={chat} onSuccess={handleEditSuccess} />
      <ConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} danger={confirmModal.danger} />
      {previewImage && <ImagePreviewModal imageUrl={previewImage.url} senderName={previewImage.senderName} time={previewImage.time} onClose={() => setPreviewImage(null)} />}
      <MessageActionModal isOpen={actionModal.isOpen} onClose={() => setActionModal({ isOpen: false, message: null })} message={actionModal.message} isOwn={actionModal.message?.sender?._id === userInfo?._id} isStarred={actionModal.message?.starredBy?.some(id => id === userInfo?._id)} isArchived={actionModal.message?.archivedBy?.some(id => id === userInfo?._id)} onDelete={handleDeleteMessage} onArchive={handleArchiveMessage} onUnarchive={handleUnarchiveMessage} onStar={handleStarMessage} onUnstar={handleUnstarMessage} onReply={handleReply} />
    </>
  );
};

export default GeneralChannelId;