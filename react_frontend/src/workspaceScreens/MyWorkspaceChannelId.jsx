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
  FaCircle,
  FaSearch,
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

// WhatsApp's read-receipt blue. Swap this if your brand wants a different seen color.
const SEEN_TICK_COLOR = '#34B7F1';

// ─── Message status ticks (WhatsApp-style) ─────────────────────────────
// clock  = still sending / optimistic
// 1 tick = sent to server
// 2 gray = delivered to recipient(s)
// 2 blue = read — DMs only. Channels never show delivered/read state since
//          there's no single "seen by everyone" signal, so they cap at 1 tick.
const MessageTicks = ({ message, isOwn, isDM }) => {
  if (!isOwn) return null;

  const isPending =
    message.pending || (typeof message._id === 'string' && message._id.startsWith('temp-'));
  if (isPending) {
    return <FaRegClock className="text-[10px] text-gray-400" />;
  }

  if (!isDM) {
    return <FaCheck className="text-[10px] text-gray-400" />;
  }

  const isRead = message.status === 'read' || (message.readBy && message.readBy.length > 0);
  const isDelivered =
    isRead || message.status === 'delivered' || (message.deliveredTo && message.deliveredTo.length > 0);

  if (isRead) {
    return (
      <span className="inline-flex items-center -space-x-[5px]">
        <FaCheck className="text-[10px]" style={{ color: SEEN_TICK_COLOR }} />
        <FaCheck className="text-[10px]" style={{ color: SEEN_TICK_COLOR }} />
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span className="inline-flex items-center -space-x-[5px] text-gray-400">
        <FaCheck className="text-[10px]" />
        <FaCheck className="text-[10px]" />
      </span>
    );
  }
  return <FaCheck className="text-[10px] text-gray-400" />;
};

// ─── Static waveform bars for voice notes ──────────────────────────────
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

// ─── WhatsApp‑style fullscreen image viewer ────────────────────────────
const ImagePreviewModal = ({ imageUrl, onClose, fileName, senderName, time }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName || 'image';
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
          <button onClick={onClose} className="p-1 flex-shrink-0">
            <FaArrowLeft />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{senderName || 'Photo'}</p>
            {time && <p className="text-[11px] text-white/60">{time}</p>}
          </div>
        </div>
        <button onClick={handleDownload} className="p-2 flex-shrink-0">
          <FaDownload />
        </button>
      </div>
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
      </div>
    </div>
  );
};

// ─── Media Message Component ──────────────────────────────────────────
const MediaMessage = ({ message, isOwn, isDM, senderName, senderProfile, brandColor, onImageClick, onDelete }) => {
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
          <div
            className="relative group cursor-pointer"
            onClick={() =>
              onImageClick &&
              onImageClick({
                url: message.mediaUrl,
                senderName: isOwn ? 'You' : senderName,
                time,
              })
            }
          >
            <img
              src={message.mediaUrl}
              alt={message.mediaName || 'Image'}
              className="max-w-full rounded-lg max-h-80 object-cover"
            />
          </div>
        );

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
              {isPlaying ? (
                <FaPause className="text-xs text-white" />
              ) : (
                <FaPlay className="text-xs text-white ml-0.5" />
              )}
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
          className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
            isOwn ? 'text-white' : 'bg-gray-100 text-gray-800'
          }`}
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
                  onClick={() => {
                    setShowMenu(false);
                    onDelete && onDelete(message._id);
                  }}
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

  const [previewImage, setPreviewImage] = useState(null);

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

  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId);
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useGetChatMessagesQuery(
    { chatId, page: 1, limit: 50 },
    { skip: !chatId }
  );
  const [sendMessage] = useSendMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  const chat = chatsData?.chats?.find(c => c._id === chatId);
  const isDM = chat?.type === 'direct';
  const otherParticipant = isDM
    ? chat?.participants?.find(p => p.user?._id !== userInfo?._id && p.user !== userInfo?._id)?.user || null
    : null;
  const displayName = isDM ? otherParticipant?.name || 'Unknown' : chat?.name || 'Unnamed Channel';
  const displayAvatar = isDM ? otherParticipant?.profile : null;
  const isDMOnline = isDM ? otherParticipant?.online || false : false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

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

  if (error) navigate('/my-workspaces');

  if (workspaceLoading || chatsLoading || messagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const messages = messagesData?.messages || [];
  const chats = chatsData?.chats || [];
  if (!workspace) return null;

  const brandColor = workspace.color || '#0d9488';
  const memberCount = chat?.participants?.length || 0;

  // Channel list filtering (desktop only)
  const groupChats = chats.filter(c => c.type === 'group');
  const directMessages = chats.filter(c => c.type === 'direct');
  const filteredChannels = groupChats.filter(ch => ch.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredDMs = directMessages.filter(dm => {
    const participant = dm.participants.find(p => p.user?._id !== userInfo?._id && p.user !== userInfo?._id);
    const name = participant?.user?.name || participant?.name || 'Unknown';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getDMParticipant = (dmChat) => {
    const other = dmChat.participants.find(p => p.user?._id !== userInfo?._id && p.user !== userInfo?._id);
    return other?.user || other;
  };

  const getSender = (senderId) => {
    const member = workspace.members?.find(m => m.user?._id === senderId || m.user === senderId);
    return member?.user || null;
  };

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

  // Voice recording logic (unchanged, but kept for brevity)
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
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    setRecordingBlob(null);
    setShowRecordedPreview(false);
    setRecordingTime(0);
    setIsRecording(false);
    setIsLocked(false);
    setSwipeProgress(0);
    stopTimer();
  };

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

  const handleCall = () => toast.info('Voice/Video calls not available yet');

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
    <div className="h-screen bg-gray-50 flex flex-col lg:flex-row">
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          senderName={previewImage.senderName}
          time={previewImage.time}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* Sidebar (desktop only) */}
      <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
        <MyWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Channel list (desktop only) */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col bg-white border-r border-gray-200 h-full overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FaHashtag className="text-sm" style={{ color: brandColor }} />
            Channels
          </h2>
        </div>
        <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* Channels */}
          {filteredChannels.map(channel => (
            <Link
              key={channel._id}
              to={`/my-workspace/${workspaceId}/chat/${channel._id}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${
                channel._id === chatId ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <FaHashtag className="text-xs text-gray-400" />
              <span className="text-sm truncate">{channel.name}</span>
              {channel.unreadCount > 0 && (
                <span className="ml-auto bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {channel.unreadCount}
                </span>
              )}
            </Link>
          ))}
          {/* DMs */}
          {filteredDMs.map(dm => {
            const participant = getDMParticipant(dm);
            return (
              <Link
                key={dm._id}
                to={`/my-workspace/${workspaceId}/chat/${dm._id}`}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${
                  dm._id === chatId ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-6 h-6 rounded-full overflow-hidden">
                  {participant?.profile ? (
                    <img src={participant.profile} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: brandColor }}>
                      {participant?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <span className="text-sm truncate">{participant?.name || 'Unknown'}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
        {/* Header — sticky so it never scrolls with messages */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-teal-600 text-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(`/my-workspace/${workspaceId}/channels`)} className="p-1 lg:hidden">
              <FaArrowLeft />
            </button>
            {isDM ? (
              displayAvatar ? (
                <img src={displayAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <FaHashtag />
              </div>
            )}
            <div>
              <h2 className="font-semibold text-base truncate">{displayName}</h2>
              <p className="text-xs text-white/80">
                {isDM ? (isDMOnline ? 'Online' : 'Offline') : `${memberCount} members`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCall} className="p-1.5"><FaPhone /></button>
            <button onClick={handleCall} className="p-1.5"><FaVideo /></button>
          </div>
        </header>

        {/* Messages — only this area scrolls */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FaComment className="text-4xl mb-2 opacity-30" />
              <p className="text-sm">No messages yet</p>
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

        {/* Input area — sticky so it never scrolls with messages */}
        <div className="sticky bottom-0 z-20 border-t border-gray-200 px-3 py-2 bg-white flex-shrink-0">
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
              {/* Lock icon with arrow */}
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
              <button type="submit" disabled={isLoading} className="p-2 rounded-full text-white" style={{ backgroundColor: brandColor }}>
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
    </div>
  );
};

export default MyWorkspaceChannelId;