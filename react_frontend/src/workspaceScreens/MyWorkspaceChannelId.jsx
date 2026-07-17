// src/workspaceScreens/MyWorkspaceChannelId.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery, useGetChatMessagesQuery, useSendMessageMutation, useDeleteMessageMutation } from '../slices/messagingApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import {
  FaHashtag,
  FaArrowLeft,
  FaComment,
  FaPaperPlane,
  FaSmile,
  FaPaperclip,
  FaImage,
  FaCheck,
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
  FaCircle,
  FaSearch,
  FaChevronRight,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Helper: Format time ──────────────────────────────────────────────
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// How far (px) the user has to drag the mic button up before it locks.
const LOCK_THRESHOLD = 80;

// ─── Image Preview Modal ──────────────────────────────────────────────
const ImagePreviewModal = ({ imageUrl, onClose, fileName }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full max-h-[90vh]">
        <img src={imageUrl} alt="Preview" className="w-full h-auto max-h-[90vh] object-contain rounded-lg" />
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition"
        >
          <FaTimes className="text-xl" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="absolute bottom-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-3 transition"
        >
          <FaDownload className="text-xl" />
        </button>
      </div>
    </div>
  );
};

// ─── Media Message Component ──────────────────────────────────────────
const MediaMessage = ({ message, isOwn, senderName, senderProfile, brandColor, onImageClick, onDelete }) => {
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
        return (
          <div className="relative group cursor-pointer" onClick={() => onImageClick && onImageClick(message.mediaUrl)}>
            <img
              src={message.mediaUrl}
              alt={message.mediaName || 'Image'}
              className="max-w-full rounded-lg max-h-80 object-cover"
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(e); }}
              className="absolute bottom-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition"
            >
              <FaDownload className="text-sm" />
            </button>
          </div>
        );

      case 'video':
        return (
          <div className="relative group">
            <video
              src={message.mediaUrl}
              controls
              className="max-w-full rounded-lg max-h-80"
            />
            <button
              onClick={handleDownload}
              className="absolute bottom-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition"
            >
              <FaDownload className="text-sm" />
            </button>
          </div>
        );

      case 'audio':
        return (
          <div className="flex items-center gap-3 bg-gray-800/10 rounded-lg p-3 min-w-[200px]">
            <button
              onClick={() => {
                if (audioRef.current) {
                  if (isPlaying) {
                    audioRef.current.pause();
                  } else {
                    audioRef.current.play();
                  }
                  setIsPlaying(!isPlaying);
                }
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: brandColor }}
            >
              {isPlaying ? <FaPause className="text-sm" /> : <FaPlay className="text-sm" />}
            </button>
            <div className="flex-1">
              <audio
                ref={audioRef}
                src={message.mediaUrl}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                className="hidden"
              />
              <div className="text-sm font-medium text-gray-900">
                {message.mediaName || 'Voice note'}
              </div>
              <div className="text-xs text-gray-500">
                {message.mediaDuration ? formatTime(message.mediaDuration) : '0:00'}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(e); }}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <FaDownload className="text-sm" />
            </button>
          </div>
        );

      case 'file':
        return (
          <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-3 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-gray-300 flex items-center justify-center text-gray-600">
              📄
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {message.mediaName || 'File'}
              </div>
              <div className="text-xs text-gray-500">
                {message.mediaSize ? `${(message.mediaSize / 1024).toFixed(1)} KB` : 'File'}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(e); }}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <FaDownload className="text-sm" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

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
        {!isOwn && (
          <span className="text-xs font-medium text-gray-600 ml-1">{senderName}</span>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
            isOwn
              ? 'text-white'
              : 'bg-gray-100 text-gray-800'
          }`}
          style={isOwn ? { backgroundColor: brandColor } : {}}
        >
          {message.content && <p className="mb-2">{message.content}</p>}
          {renderMediaContent()}
        </div>
        <div className={`flex items-center gap-1 text-[10px] text-gray-400 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span>{time}</span>
          {isOwn && (
            <span className="text-gray-400">
              <FaCheck className="text-[8px]" />
            </span>
          )}
          <div className="relative ml-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-300 hover:text-gray-500 transition p-0.5"
            >
              <FaEllipsisV className="text-xs" />
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-6 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[120px] z-10">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete && onDelete(message._id);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition w-full"
                >
                  <FaTrashAlt className="text-xs" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────

const MyWorkspaceChannelId = () => {
  const { workspaceId, chatId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Preview modal state
  const [previewImage, setPreviewImage] = useState(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [showRecordedPreview, setShowRecordedPreview] = useState(false);

  // Swipe-up-to-lock states
  const [isLocked, setIsLocked] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);

  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const touchStartYRef = useRef(0);
  const isRecordingRef = useRef(false);

  // ─── Data fetching ────────────────────────────────────────────────
  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId);
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useGetChatMessagesQuery(
    { chatId, page: 1, limit: 50 },
    { skip: !chatId }
  );
  const [sendMessage] = useSendMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  // ─── Find current chat ─────────────────────────────────────────────
  const chat = chatsData?.chats?.find(c => c._id === chatId);
  const isDM = chat?.type === 'direct';
  const otherParticipant = isDM
    ? chat?.participants?.find(p => p.user?._id !== userInfo?._id && p.user !== userInfo?._id)?.user || null
    : null;
  const displayName = isDM ? otherParticipant?.name || 'Unknown' : chat?.name || 'Unnamed Channel';
  const displayAvatar = isDM ? otherParticipant?.profile : null;
  const isDMOnline = isDM ? otherParticipant?.online || false : false;

  // ─── Scroll to bottom ──────────────────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesData]);

  // ─── Keep ref in sync ──────────────────────────────────────────────
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ─── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecordingRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // ─── Timer logic ───────────────────────────────────────────────────
  const startTimer = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  if (error) {
    navigate('/my-workspaces');
  }

  if (workspaceLoading || chatsLoading || messagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }}
          />
          <p className="mt-4 text-gray-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const messages = messagesData?.messages || [];
  const chats = chatsData?.chats || [];

  if (!workspace) {
    return null;
  }

  const brandColor = workspace.color || '#4F46E5';
  const activeMembers = workspace.members?.filter(m => m.status === 'active') || [];
  const onlineCount = activeMembers.filter(m => m.status === 'active').length || 0;
  const memberCount = chat?.participants?.length || 0;

  // ─── Filter channels for the left list ─────────────────────────────
  const groupChats = chats.filter(c => c.type === 'group');
  const directMessages = chats.filter(c => c.type === 'direct');

  const filteredChannels = groupChats.filter(channel =>
    channel.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDMs = directMessages.filter(dm => {
    const participant = dm.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    );
    const name = participant?.user?.name || participant?.name || 'Unknown';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // ─── Get DM participant ────────────────────────────────────────────
  const getDMParticipant = (dmChat) => {
    const other = dmChat.participants.find(
      (p) => p.user?._id !== userInfo?._id && p.user !== userInfo?._id
    );
    return other?.user || other;
  };

  // ─── Get sender info ─────────────────────────────────────────────────────
  const getSender = (senderId) => {
    const member = workspace.members?.find(m => m.user?._id === senderId || m.user === senderId);
    return member?.user || null;
  };

  // ─── Send Text Message ────────────────────────────────────────────────
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const formData = new FormData();
    formData.append('content', message.trim());
    formData.append('messageType', 'text');

    try {
      setIsLoading(true);
      await sendMessage({ chatId, data: formData }).unwrap();
      setMessage('');
      refetchMessages();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Send File ──────────────────────────────────────────────────────────
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
      setIsLoading(true);
      await sendMessage({ chatId, data: formData }).unwrap();
      refetchMessages();
      toast.success(`${type === 'image' ? 'Image' : 'File'} sent!`);
    } catch (err) {
      toast.error(err?.data?.message || `Failed to send ${type}`);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  // ─── Voice Recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

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
      toast.error('Microphone access denied. Please allow microphone permissions.');
      console.error('Recording error:', err);
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
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const sendAudioMessage = async (audioBlob) => {
    const formData = new FormData();
    const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
    formData.append('media', audioFile);
    formData.append('messageType', 'audio');
    formData.append('mediaDuration', recordingTime.toString());

    try {
      setIsLoading(true);
      await sendMessage({ chatId, data: formData }).unwrap();
      refetchMessages();
      toast.success('Voice note sent!');
      setRecordingBlob(null);
      setShowRecordedPreview(false);
      setRecordingTime(0);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send voice note');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    setIsLocked(false);
    setSwipeProgress(0);
    stopTimer();
  };

  // ─── Delete Message ──────────────────────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteMessage(messageId).unwrap();
      refetchMessages();
      toast.success('Message deleted');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete message');
    }
  };

  // ─── Handle Call Button ──────────────────────────────────────────────────
  const handleCall = () => {
    toast.info('Voice/Video calls are not available for now.');
  };

  // ─── Swipe-up-to-lock (mic button) ───────────────────────────────────────
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
    if (isRecordingRef.current) {
      stopRecording();
    }
  };

  return (
    <div className="h-screen bg-[#f0f2f5] flex flex-col lg:flex-row">
      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
          fileName="image"
        />
      )}

      {/* ─── Left: Workspace Sidebar (desktop only) ─── */}
      <div className="hidden lg:block lg:w-64 lg:h-full lg:flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* ─── Middle: Channel List (desktop only) ─── */}
      <div className="hidden lg:flex lg:w-72 lg:flex-shrink-0 lg:flex-col lg:bg-white lg:border-r border-gray-200/80 h-full overflow-hidden">
        <div className="p-4 border-b border-gray-200/80">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FaHashtag className="text-sm" style={{ color: brandColor }} />
            Channels
          </h2>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-200/80">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search channels and DMs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm bg-gray-50"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filteredChannels.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
                Channels ({filteredChannels.length})
              </h3>
              <div className="space-y-0.5">
                {filteredChannels.map((channel) => {
                  const isActive = channel._id === chatId;
                  return (
                    <Link
                      key={channel._id}
                      to={`/my-workspace/${workspaceId}/chat/${channel._id}`}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition group ${
                        isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FaHashtag className={`text-xs ${isActive ? 'text-gray-700' : 'text-gray-400'}`} style={isActive ? { color: brandColor } : {}} />
                        <span className={`text-sm truncate ${isActive ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                          {channel.name}
                        </span>
                      </div>
                      {channel.unreadCount > 0 && (
                        <span className="text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-medium" style={{ backgroundColor: brandColor }}>
                          {channel.unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {filteredDMs.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
                Direct Messages ({filteredDMs.length})
              </h3>
              <div className="space-y-0.5">
                {filteredDMs.map((dm) => {
                  const participant = getDMParticipant(dm);
                  const isActive = dm._id === chatId;
                  const isOnline = participant?.online || false;
                  return (
                    <Link
                      key={dm._id}
                      to={`/my-workspace/${workspaceId}/chat/${dm._id}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition group ${
                        isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        {participant?.profile ? (
                          <img src={participant.profile} alt={participant.name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: brandColor }}>
                            {participant?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        {isOnline && <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />}
                      </div>
                      <span className={`text-sm truncate flex-1 ${isActive ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {participant?.name || 'Unknown'}
                      </span>
                      {dm.unreadCount > 0 && (
                        <span className="text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-medium" style={{ backgroundColor: brandColor }}>
                          {dm.unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {filteredChannels.length === 0 && filteredDMs.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm">
              {searchQuery ? 'No results found' : 'No channels or DMs yet'}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Chat View ─── */}
      <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
        {/* ── Chat Header ── */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/80 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile back button */}
            <button
              onClick={() => navigate(`/my-workspace/${workspaceId}/channels`)}
              className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition"
            >
              <FaArrowLeft className="text-gray-500 text-sm" />
            </button>
            {isDM ? (
              displayAvatar ? (
                <img src={displayAvatar} alt={displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: brandColor }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <FaHashtag className="text-sm" style={{ color: brandColor }} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">{displayName}</h2>
              <p className="text-xs text-gray-500 truncate">
                {isDM ? (
                  isDMOnline ? (
                    <span className="flex items-center gap-1 text-green-500">
                      <FaCircle className="text-[8px]" /> Online
                    </span>
                  ) : (
                    'Offline'
                  )
                ) : (
                  `${memberCount} members · ${onlineCount} online`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={handleCall} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
              <FaPhone className="text-sm" />
            </button>
            <button onClick={handleCall} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
              <FaVideo className="text-sm" />
            </button>
          </div>
        </div>

        {/* ── Messages Area (only this scrolls) ── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FaComment className="text-3xl mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Be the first to send a message!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const sender = getSender(msg.sender?._id || msg.sender);
              const isOwn = msg.sender?._id === userInfo?._id || msg.sender === userInfo?._id;
              return (
                <MediaMessage
                  key={msg._id}
                  message={msg}
                  isOwn={isOwn}
                  senderName={sender?.name || 'Unknown'}
                  senderProfile={sender?.profile}
                  brandColor={brandColor}
                  onImageClick={(url) => setPreviewImage(url)}
                  onDelete={handleDeleteMessage}
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Message Input (fixed at bottom) ── */}
        <div className="border-t border-gray-200/80 p-2 flex-shrink-0 bg-white relative">
          {/* Recording preview */}
          {showRecordedPreview && recordingBlob && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <FaCheckCircle className="text-xs" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Voice note ready</p>
                  <p className="text-xs text-gray-500">{formatTime(recordingTime)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const audio = new Audio(URL.createObjectURL(recordingBlob));
                    audio.play();
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  <FaPlay className="text-xs" />
                </button>
                <button
                  onClick={() => sendAudioMessage(recordingBlob)}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                >
                  Send
                </button>
                <button
                  onClick={cancelRecording}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
            </div>
          )}

          {/* Recording in progress: not locked */}
          {isRecording && !isLocked && (
            <>
              <div
                className="absolute right-4 flex flex-col items-center gap-1 pointer-events-none transition-all"
                style={{
                  bottom: `${72 + swipeProgress * 20}px`,
                  opacity: 1 - swipeProgress * 0.3,
                }}
              >
                <div
                  className="w-7 h-7 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center"
                  style={{ color: swipeProgress > 0.6 ? brandColor : '#9CA3AF' }}
                >
                  <FaLock className="text-xs" />
                </div>
                <FaChevronUp className="text-gray-300 text-xs animate-bounce" />
              </div>

              <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-medium text-red-600">Recording...</span>
                  <span className="text-xs text-red-400">{formatTime(recordingTime)}</span>
                </div>
                <span className="text-[10px] text-gray-400">Slide up to lock</span>
              </div>
            </>
          )}

          {/* Recording in progress: locked */}
          {isRecording && isLocked && (
            <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-medium text-red-600">
                  {recordingPaused ? 'Paused' : 'Recording...'}
                </span>
                <span className="text-xs text-red-400">{formatTime(recordingTime)}</span>
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <FaLock className="text-[10px]" style={{ color: brandColor }} />
                  Locked
                </span>
                <button
                  onClick={pauseRecording}
                  className="px-2 py-0.5 text-[10px] bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                >
                  {recordingPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={cancelRecording}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <FaTrashAlt className="text-xs" />
                </button>
                <button
                  onClick={stopRecording}
                  className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                >
                  <FaStop className="text-[10px]" />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleFileUpload('file')}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FaPaperclip className="text-sm" />
            </button>
            <button
              type="button"
              onClick={() => handleFileUpload('image')}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FaImage className="text-sm" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e, 'file')}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.zip,.rar,.mp3,.wav,.m4a,.aac,.ogg,.amr"
            />
            <input
              type="file"
              ref={imageInputRef}
              onChange={(e) => handleFileChange(e, 'image')}
              className="hidden"
              accept="image/*,video/*"
            />

            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:border-transparent text-sm bg-gray-50"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />

            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FaSmile className="text-sm" />
            </button>

            {message.trim() ? (
              <button
                type="submit"
                disabled={isLoading}
                className="p-1.5 text-white rounded-lg transition hover:opacity-90 disabled:opacity-50"
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
                disabled={isLoading}
                className={`p-1.5 rounded-lg transition hover:opacity-90 disabled:opacity-50 touch-none select-none ${
                  isRecording ? 'bg-red-500 text-white' : 'text-white'
                }`}
                style={!isRecording ? { backgroundColor: brandColor } : {}}
              >
                <FaMicrophone className="text-sm" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default MyWorkspaceChannelId;