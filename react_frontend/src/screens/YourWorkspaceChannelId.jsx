// src/workspaceScreens/YourWorkspaceChannelId.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetUserChatsQuery,
  useGetChatMessagesQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
} from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
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
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useSocket } from '../components/SocketContext.jsx';

// ─── Helper: Format time ──────────────────────────────────────────────
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const LOCK_THRESHOLD = 80;
const SEEN_TICK_COLOR = '#34B7F1';

// ─── Message status ticks (optimistic) ─────────────────────────────────
const MessageTicks = ({ message, isOwn, isDM }) => {
  if (!isOwn) return null;

  if (message._pending) {
    return <FaRegClock className="text-[10px] text-gray-400" />;
  }

  if (message._failed) {
    return <FaTimes className="text-[10px] text-red-500" />;
  }

  if (!message._delivered && !message._read) {
    return <FaCheck className="text-[10px] text-gray-400" />;
  }

  if (message._delivered && !message._read) {
    return (
      <span className="inline-flex items-center -space-x-[5px] text-gray-400">
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
}) => {
  const time = new Date(message.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef(null);

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
            <span className={`text-[10px] flex-shrink-0 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
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
          <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-3 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-gray-300 flex items-center justify-center text-gray-600">📄</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{message.mediaName || 'File'}</div>
              <div className="text-xs text-gray-500">{message.mediaSize ? `${(message.mediaSize / 1024).toFixed(1)} KB` : 'File'}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleDownload(e); }} className="text-gray-400 hover:text-gray-600 transition">
              <FaDownload className="text-sm" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Image messages without bubble ──
  if (message.messageType === 'image') {
    return (
      <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
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
        <div className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isOwn && <span className="text-xs font-medium text-gray-600 ml-1 mb-0.5">{senderName}</span>}
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
              <MessageTicks message={message} isOwn={isOwn} isDM={isDM} />
            </div>
            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="text-white bg-black/40 p-1 rounded-full hover:bg-black/60"
              >
                <FaEllipsisV className="text-xs" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[120px] z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete && onDelete(message._id); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition w-full"
                  >
                    <FaTrashAlt className="text-xs" /> Delete
                  </button>
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
    <div className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
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
      <div className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isOwn && <span className="text-xs font-medium text-gray-600 ml-1">{senderName}</span>}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm break-words ${isOwn ? 'text-white' : 'bg-gray-100 text-gray-800'}`}
          style={isOwn ? { backgroundColor: brandColor } : {}}
        >
          {message.content && <p className="mb-2">{message.content}</p>}
          {renderMediaContent()}
        </div>
        <div className={`flex items-center gap-1 text-[10px] text-gray-400 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span>{time}</span>
          <MessageTicks message={message} isOwn={isOwn} isDM={isDM} />
          <div className="relative ml-2">
            <button onClick={() => setShowMenu(!showMenu)} className="text-gray-300 hover:text-gray-500 transition p-0.5">
              <FaEllipsisV className="text-xs" />
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-6 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[120px] z-10">
                <button
                  onClick={() => { setShowMenu(false); onDelete && onDelete(message._id); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition w-full"
                >
                  <FaTrashAlt className="text-xs" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Bottom Sheet for Chat Details ─────────────────────────────────────
const ChatDetailsSheet = ({ isOpen, onClose, chat, workspace, isDM, otherParticipant, isDMOnline }) => {
  if (!isOpen) return null;

  const participants = chat?.participants || [];
  const displayName = isDM ? otherParticipant?.name || 'Unknown' : chat?.name || 'Unnamed Channel';
  const displayAvatar = isDM ? otherParticipant?.profile : null;
  const memberCount = participants.length;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[70vh] overflow-y-auto transform transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            {isDM ? (
              displayAvatar ? (
                <img src={displayAvatar} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-14 h-14 rounded-full bg-teal-500 flex items-center justify-center text-white">
                <FaHashtag size={24} />
              </div>
            )}
            <div>
              <h3 className="font-bold text-lg text-gray-900">{displayName}</h3>
              <p className="text-sm text-gray-500">
                {isDM
                  ? isDMOnline ? 'Online' : 'Offline'
                  : `${memberCount} member${memberCount !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>

          {/* Members Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {isDM ? 'Participant' : `Members (${memberCount})`}
            </h4>
            <ul className="space-y-2">
              {participants.map((p) => {
                const user = p.user || {};
                const profile = user.profile || null;
                const name = user.name || 'Unknown Member';
                return (
                  <li key={user._id || p._id} className="flex items-center gap-3">
                    {profile ? (
                      <img src={profile} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                      {isDM && otherParticipant?._id === user._id && (
                        <span className="text-xs text-gray-500 ml-2">
                          {isDMOnline ? '🟢 online' : '⚫ offline'}
                        </span>
                      )}
                    </div>
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

// ─── Main Component ──────────────────────────────────────────────────────
const YourWorkspaceChannelId = () => {
  const { workspaceId, chatId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);

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
  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch,
  } = useGetChatMessagesQuery({ chatId, page: 1, limit: 50 }, { skip: !chatId });
  const [sendMessageApi] = useSendMessageMutation();
  const [deleteMessageApi] = useDeleteMessageMutation();

  const chat = chatsData?.chats?.find(c => c._id === chatId);
  const isDM = chat?.type === 'direct';
  const otherParticipant = isDM
    ? chat?.participants?.find(p => p.user?._id !== userInfo?._id && p.user !== userInfo?._id)?.user || null
    : null;
  const displayName = isDM ? otherParticipant?.name || 'Unknown' : chat?.name || 'Unnamed Channel';
  const displayAvatar = isDM ? otherParticipant?.profile : null;
  const isDMOnline = isDM ? otherParticipant?.online || false : false;
  const backPath = isDM ? `/workspace/${workspaceId}/dms` : `/workspace/${workspaceId}/channels`;

  // ── Silent polling every 3 seconds ──────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [refetch, chatId]);

  // ── Scroll state & new‑message button ──────────────────────────────
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

  // ── Join chat room & listen for socket events ──────────────────────
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;

    socket.emit('join-chat', chatId);

    const handleNewMessage = (incoming) => {
      setLocalMessages((prev) => {
        if (
          (incoming.sender?._id === userInfo?._id || incoming.sender === userInfo?._id) &&
          incoming.content
        ) {
          const tempIdx = prev.findIndex(
            (m) => m._temp && m.content === incoming.content
          );
          if (tempIdx > -1) {
            const updated = [...prev];
            updated[tempIdx] = { ...incoming, _temp: false, _pending: false, _failed: false, _sent: true };
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

    socket.on('new-message', handleNewMessage);
    socket.on('message-deleted', handleMessageDeleted);

    return () => {
      socket.emit('leave-chat', chatId);
      socket.off('new-message', handleNewMessage);
      socket.off('message-deleted', handleMessageDeleted);
    };
  }, [socket, isConnected, chatId, userInfo?._id]);

  // ── Merge polled messages without overwriting optimistics ──────────
  useEffect(() => {
    if (messagesData?.messages) {
      setLocalMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m._id));
        const newMessages = messagesData.messages.filter(
          (m) => !existingIds.has(m._id)
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

  // ── Error / loading states ─────────────────────────────────────────
  if (error) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  if (workspaceLoading || chatsLoading || messagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#0d9488', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  if (!workspace || !chat) return null;

  const brandColor = workspace.color || '#0d9488';
  const memberCount = chat.participants?.length || 0;

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
      messageType: 'text',
      chat: chatId,
    };

    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setMessage('');

    socket.emit('send-message', {
      chatId,
      content: trimmed,
      messageType: 'text',
      mentions: [],
      replyToId: null,
      mediaUrl: null,
      mediaName: null,
      mediaSize: null,
      mediaDuration: null,
    }, (response) => {
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
    });
  };

  // ── File / image / voice via REST (backend will broadcast) ──────
  const handleFileUpload = (type) => {
    if (type === 'file') fileInputRef.current?.click();
    else if (type === 'image') imageInputRef.current?.click();
  };

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('media', file);
    formData.append('messageType', type === 'image' ? 'image' : 'file');
    try {
      await sendMessageApi({ chatId, data: formData }).unwrap();
      toast.success(`${type === 'image' ? 'Image' : 'File'} sent!`);
    } catch (err) {
      toast.error(err?.data?.message || `Failed to send ${type}`);
    } finally {
      e.target.value = '';
    }
  };

  const sendAudioMessage = async (audioBlob) => {
    const formData = new FormData();
    const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
    formData.append('media', audioFile);
    formData.append('messageType', 'audio');
    formData.append('mediaDuration', recordingTime.toString());
    try {
      await sendMessageApi({ chatId, data: formData }).unwrap();
      setRecordingBlob(null);
      setShowRecordedPreview(false);
      setRecordingTime(0);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send voice note');
    }
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

  // ── Delete message ─────────────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteMessageApi(messageId).unwrap();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete message');
    }
  };

  const getSender = (senderId) => {
    const member = workspace.members?.find(m => m.user?._id === senderId || m.user === senderId);
    return member?.user || null;
  };

  const handleCall = () => toast.info('Voice/Video calls not available yet');

  // Mic pointer events
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
    <div className="h-dvh bg-gray-50 flex flex-col lg:flex-row overflow-hidden">
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          senderName={previewImage.senderName}
          time={previewImage.time}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chatsData?.chats || []} />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
        {/* Header – no sticky needed, part of flex flow */}
        <header
          className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-teal-600 text-white flex-shrink-0 cursor-pointer"
          onClick={() => setShowDetailsSheet(true)}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(backPath);
              }}
              className="p-1 lg:hidden flex-shrink-0"
            >
              <FaArrowLeft />
            </button>
            {isDM ? (
              displayAvatar ? (
                <img src={displayAvatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <FaHashtag />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-base truncate">{displayName}</h2>
              <p className="text-xs text-white/80 truncate">
                {isDM ? (isDMOnline ? 'Online' : 'Offline') : `${memberCount} members`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleCall} className="p-1.5"><FaPhone /></button>
            <button onClick={handleCall} className="p-1.5"><FaVideo /></button>
          </div>
        </header>

        {/* Messages area with scroll listener and new‑message button */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="h-full overflow-y-auto px-4 py-3 space-y-4"
          >
            {localMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FaComment className="text-4xl mb-2 opacity-30" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              localMessages.map((msg) => {
                const sender = getSender(msg.sender?._id || msg.sender);
                const isOwn = (msg.sender?._id === userInfo?._id || msg.sender === userInfo?._id);
                return (
                  <MediaMessage
                    key={msg._id}
                    message={msg}
                    isOwn={isOwn}
                    isDM={isDM}
                    senderName={sender?.name || 'Unknown'}
                    senderProfile={sender?.profile}
                    brandColor={brandColor}
                    onImageClick={(payload) => setPreviewImage(payload)}
                    onDelete={handleDeleteMessage}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating "new messages" button */}
          {showScrollDown && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 z-30 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-all"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            >
              <FaChevronDown className="text-sm" />
            </button>
          )}
        </div>

        {/* Input area – no sticky, just flex-shrink-0 */}
        <div className="border-t border-gray-200 px-3 py-2 bg-white flex-shrink-0">
          {showRecordedPreview && recordingBlob && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500" />
                <span className="text-sm">Voice note ready</span>
                <span className="text-xs text-gray-500">{formatTime(recordingTime)}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { const audio = new Audio(URL.createObjectURL(recordingBlob)); audio.play(); }} className="p-1"><FaPlay className="text-xs" /></button>
                <button onClick={() => sendAudioMessage(recordingBlob)} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Send</button>
                <button onClick={cancelRecording} className="p-1 text-gray-400"><FaTimes className="text-xs" /></button>
              </div>
            </div>
          )}

          {isRecording && !isLocked && (
            <div className="relative flex items-center justify-between px-3 py-2 mb-2 bg-red-50 rounded-lg border border-red-200">
              <span className="text-xs text-red-600 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Recording... {formatTime(recordingTime)}
              </span>
              <span className="text-[10px] text-gray-400">Slide up to lock</span>
              <div className="absolute right-4 bottom-20 flex flex-col items-center">
                <FaLock className="text-xs" style={{ color: swipeProgress > 0.6 ? brandColor : '#9CA3AF' }} />
                <FaChevronUp className="text-gray-300 text-xs" />
              </div>
            </div>
          )}

          {isRecording && isLocked && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-600">{recordingPaused ? 'Paused' : 'Recording...'} {formatTime(recordingTime)}</span>
                <FaLock className="text-[10px]" style={{ color: brandColor }} />
              </div>
              <div className="flex gap-2">
                <button onClick={pauseRecording} className="text-xs text-red-600">{recordingPaused ? 'Resume' : 'Pause'}</button>
                <button onClick={cancelRecording} className="text-gray-400"><FaTrashAlt className="text-xs" /></button>
                <button onClick={stopRecording} className="bg-red-500 text-white p-1 rounded-full"><FaStop className="text-xs" /></button>
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <button type="button" onClick={() => handleFileUpload('file')} className="p-1.5 text-gray-400 hover:text-gray-600"><FaPaperclip className="text-sm" /></button>
            <button type="button" onClick={() => handleFileUpload('image')} className="p-1.5 text-gray-400 hover:text-gray-600"><FaImage className="text-sm" /></button>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'file')} className="hidden" />
            <input type="file" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} className="hidden" accept="image/*,video/*" />

            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor }}
            />

            {message.trim() ? (
              <button
                type="submit"
                disabled={!isConnected}
                className="p-2 rounded-full text-white disabled:opacity-50"
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
                className="p-2 rounded-full text-white"
                style={{ backgroundColor: brandColor }}
              >
                <FaMicrophone className="text-sm" />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Chat/Group Details Bottom Sheet */}
      <ChatDetailsSheet
        isOpen={showDetailsSheet}
        onClose={() => setShowDetailsSheet(false)}
        chat={chat}
        workspace={workspace}
        isDM={isDM}
        otherParticipant={otherParticipant}
        isDMOnline={isDMOnline}
      />
    </div>
  );
};

export default YourWorkspaceChannelId;