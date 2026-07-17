// src/workspaceScreens/YourWorkspaceChannelId.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetUserChatsQuery, useGetChatMessagesQuery, useSendMessageMutation, useDeleteMessageMutation } from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
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
  FaUser,
  FaCircle,
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
          {/* Delete button - only for own messages */}
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

const YourWorkspaceChannelId = () => {
  const { workspaceId, chatId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  const { data: workspaceData, isLoading: workspaceLoading, error } = useGetWorkspaceQuery(workspaceId);
  const { data: chatsData, isLoading: chatsLoading } = useGetUserChatsQuery(workspaceId);
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useGetChatMessagesQuery({ chatId, page: 1, limit: 50 });
  const [sendMessage] = useSendMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  const chat = chatsData?.chats?.find(c => c._id === chatId);

  // ─── Determine if DM or Channel ──────────────────────────────────────
  const isDM = chat?.type === 'direct';
  const otherParticipant = isDM
    ? chat?.participants?.find(p => p.user?._id !== userInfo?._id && p.user !== userInfo?._id)?.user || null
    : null;
  const displayName = isDM ? otherParticipant?.name || 'Unknown' : chat?.name || 'Unnamed Channel';
  const displayAvatar = isDM ? otherParticipant?.profile : null;
  const isOnline = isDM ? otherParticipant?.online || false : false;
  const backPath = isDM ? `/workspace/${workspaceId}/dms` : `/workspace/${workspaceId}/channels`;

  // ─── Scroll to bottom ────────────────────────────────────────────────
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
    navigate('/workspaces'); // fallback
  }

  if (workspaceLoading || chatsLoading || messagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const messages = messagesData?.messages || [];

  if (!workspace || !chat) {
    return null;
  }

  const brandColor = workspace.color || '#4F46E5';
  const activeMembers = workspace.members?.filter(m => m.status === 'active') || [];
  const onlineCount = activeMembers.filter(m => m.status === 'active').length || 0;
  const memberCount = chat.participants?.length || 0;

  // ─── Send Text Message ───────────────────────────────────────────────────
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

  // ─── Get sender info ─────────────────────────────────────────────────────
  const getSender = (senderId) => {
    const member = workspace.members?.find(m => m.user?._id === senderId || m.user === senderId);
    return member?.user || null;
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
    <div className="h-screen bg-gray-100 flex flex-col md:flex-row overflow-hidden">
      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
          fileName="image"
        />
      )}

      {/* ── Left Sidebar ── */}
      <div className="hidden md:block md:w-64 md:h-screen md:flex-shrink-0 md:sticky md:top-0">
        <YourWorkspaceSidebar workspace={workspace} chats={chatsData?.chats || []} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col bg-white h-screen overflow-hidden">

        {/* ── Chat Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(backPath)}
              className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition"
            >
              <FaArrowLeft className="text-gray-500 text-sm" />
            </button>
            {isDM ? (
              displayAvatar ? (
                <img src={displayAvatar} alt={displayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <FaHashtag className="text-sm" style={{ color: brandColor }} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">{displayName}</h2>
              <p className="text-xs text-gray-500 truncate">
                {isDM ? (
                  isOnline ? (
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
          <div className="flex items-center gap-1">
            <button onClick={handleCall} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
              <FaPhone className="text-sm" />
            </button>
            <button onClick={handleCall} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
              <FaVideo className="text-sm" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
              <FaInfoCircle className="text-sm" />
            </button>
          </div>
        </div>

        {/* ── Messages Area ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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

        {/* ── Message Input ── */}
        <div className="border-t border-gray-200 p-3 flex-shrink-0 bg-white relative">
          {/* Recording preview */}
          {showRecordedPreview && recordingBlob && (
            <div className="flex items-center justify-between px-4 py-3 mb-2 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <FaCheckCircle className="text-sm" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Voice note ready</p>
                  <p className="text-xs text-gray-500">{formatTime(recordingTime)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const audio = new Audio(URL.createObjectURL(recordingBlob));
                    audio.play();
                  }}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  <FaPlay className="text-sm" />
                </button>
                <button
                  onClick={() => sendAudioMessage(recordingBlob)}
                  className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                >
                  Send
                </button>
                <button
                  onClick={cancelRecording}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>
            </div>
          )}

          {/* Recording in progress: not locked */}
          {isRecording && !isLocked && (
            <>
              <div
                className="absolute right-6 flex flex-col items-center gap-2 pointer-events-none transition-all"
                style={{
                  bottom: `${76 + swipeProgress * 20}px`,
                  opacity: 1 - swipeProgress * 0.3,
                }}
              >
                <div
                  className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center"
                  style={{ color: swipeProgress > 0.6 ? brandColor : '#9CA3AF' }}
                >
                  <FaLock className="text-xs" />
                </div>
                <FaChevronUp className="text-gray-300 text-xs animate-bounce" />
              </div>

              <div className="flex items-center justify-between px-4 py-2 mb-2 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium text-red-600">Recording...</span>
                  <span className="text-sm text-red-400">{formatTime(recordingTime)}</span>
                </div>
                <span className="text-xs text-gray-400">Slide up to lock</span>
              </div>
            </>
          )}

          {/* Recording in progress: locked */}
          {isRecording && isLocked && (
            <div className="flex items-center justify-between px-4 py-2 mb-2 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-red-600">
                  {recordingPaused ? 'Paused' : 'Recording...'}
                </span>
                <span className="text-sm text-red-400">{formatTime(recordingTime)}</span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <FaLock className="text-[10px]" style={{ color: brandColor }} />
                  Locked
                </span>
                <button
                  onClick={pauseRecording}
                  className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                >
                  {recordingPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelRecording}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <FaTrashAlt className="text-xs" />
                </button>
                <button
                  onClick={stopRecording}
                  className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                >
                  <FaStop className="text-xs" />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleFileUpload('file')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FaPaperclip className="text-sm" />
            </button>
            <button
              type="button"
              onClick={() => handleFileUpload('image')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
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
              className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': brandColor }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
            />

            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FaSmile className="text-sm" />
            </button>

            {message.trim() ? (
              <button
                type="submit"
                disabled={isLoading}
                className="p-2 text-white rounded-lg transition hover:opacity-90 disabled:opacity-50"
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
                className={`p-2 rounded-lg transition hover:opacity-90 disabled:opacity-50 touch-none select-none ${
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

      {/* ─── Right Sidebar (Desktop) ─── */}
      <div className="hidden lg:block w-72 h-screen flex-shrink-0 sticky top-0 overflow-y-auto bg-gray-50 border-l border-gray-200 p-6">
        {isDM ? (
          // ── DM Right Sidebar ──
          <div>
            <div className="flex flex-col items-center text-center mb-6">
              {displayAvatar ? (
                <img src={displayAvatar} alt={displayName} className="w-20 h-20 rounded-full object-cover mb-3" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-3"
                  style={{ backgroundColor: brandColor }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{displayName}</h3>
              <p className="text-sm text-gray-500">
                {isOnline ? (
                  <span className="flex items-center justify-center gap-1 text-green-500">
                    <FaCircle className="text-[10px]" /> Online
                  </span>
                ) : (
                  'Offline'
                )}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400">Direct Message</p>
              <p className="text-sm text-gray-700 mt-1">Private conversation</p>
            </div>
          </div>
        ) : (
          // ── Channel Right Sidebar ──
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <FaHashtag className="text-xl" style={{ color: brandColor }} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{displayName}</h3>
                  <p className="text-xs text-gray-500">{memberCount} members</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-lg font-bold text-gray-900">{memberCount}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Members</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{messages.length}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Messages</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{onlineCount}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Online</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{chat.participants?.filter(p => p.online).length || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Active</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Members</h4>
              <div className="space-y-1">
                {chat.participants?.slice(0, 8).map((participant) => {
                  const memberUser = participant.user || participant;
                  const isOnline = participant.online || false;
                  const isOwner = memberUser._id === workspace.owner?._id || memberUser._id === workspace.owner;
                  const isYou = memberUser._id === userInfo?._id;
                  return (
                    <div key={memberUser._id} className="flex items-center gap-3 px-3 py-2 hover:bg-white rounded-xl transition cursor-pointer">
                      {memberUser?.profile ? (
                        <img src={memberUser.profile} alt={memberUser.name} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: brandColor }}>
                          {memberUser?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">
                          {memberUser?.name || 'Unknown'}
                          {isOwner && <span className="text-xs text-amber-500 ml-1">👑</span>}
                          {isYou && <span className="text-xs text-gray-400 ml-1">(You)</span>}
                        </p>
                      </div>
                      {isOnline && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
                    </div>
                  );
                })}
                {chat.participants?.length > 8 && (
                  <Link to={`/workspace/${workspaceId}/members`} className="block text-xs text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl px-3 py-2 transition font-medium">
                    View all {chat.participants?.length} members →
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400">Created</p>
              <p className="text-sm text-gray-700">
                {new Date(chat.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
              {chat.createdBy && (
                <>
                  <p className="text-xs text-gray-400 mt-2">Created by</p>
                  <p className="text-sm text-gray-700">
                    {chat.createdBy?.name || 'Unknown'}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default YourWorkspaceChannelId;