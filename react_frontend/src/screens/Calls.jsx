// src/screens/Calls.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  FaPhone,
  FaVideo,
  FaPlayCircle,
  FaHistory,
  FaSpinner,
  FaLink,
  FaCopy,
  FaTimes,
  FaCheck,
  FaCircle,
  FaUsers,
  FaSignInAlt,
  FaChevronRight,
  FaRocket,
  FaPlus,
} from 'react-icons/fa';
import { motion } from 'framer-motion';

import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';
import {
  useGetOngoingCallsQuery,
  useGetCallLogsQuery,
  useInitiateDirectCallMutation,
  useCreateMeetingMutation,
  useJoinByMeetingCodeMutation,
} from '../slices/callApiSlice';

// ─────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────
const BRAND = '#0d9488'; // teal — matches MyWorkspaces

// ─────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: new Date(d).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
const fmtDateTime = (d) => `${fmtDate(d)} · ${fmtTime(d)}`;
const fmtRelative = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return fmtDate(d);
};
const fmtDuration = (s) => {
  if (!s && s !== 0) return '';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
};
const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};
const getUserId = (p) => String(p?.user?._id || p?.user || p?._id || '');
const extractCode = (input) => {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/')) return trimmed.split('/').filter(Boolean).pop() || '';
  return trimmed;
};

// ─────────────────────────────────────────────────────────────────────
// Global styles
// ─────────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }

    .skeleton { position: relative; overflow: hidden; background-color: rgb(229 231 235); }
    .dark .skeleton { background-color: rgba(255, 255, 255, 0.07); }
    .skeleton::after {
      content: ''; position: absolute; inset: 0; transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
      animation: skeletonShimmer 1.5s ease-in-out infinite;
    }
    .dark .skeleton::after {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
    }
    @keyframes skeletonShimmer { 100% { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .skeleton::after { animation: none; } }

    @keyframes livePulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.15); }
    }
    .live-dot { animation: livePulse 1.6s ease-in-out infinite; }
  `}</style>
);

// ─────────────────────────────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-md ${className}`} />
);

const CallRowSkeleton = () => (
  <div className="flex items-center gap-3 px-3 sm:px-4 min-h-[70px]">
    <Skeleton className="w-9 h-9 flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-3.5 w-28 sm:w-40" />
      <Skeleton className="h-2.5 w-24 sm:w-32" />
    </div>
    <Skeleton className="h-8 w-16 flex-shrink-0" />
  </div>
);

const CallListSkeleton = ({ rows = 3 }) => (
  <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
    {Array.from({ length: rows }).map((_, i) => (
      <CallRowSkeleton key={i} />
    ))}
  </div>
);

const CallsSkeleton = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
    <div className="hidden md:block md:w-72 md:flex-shrink-0 border-r border-gray-100 dark:border-gray-800/60 p-4 space-y-4">
      <Skeleton className="h-9 w-36" />
      <div className="space-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="h-8 w-8 flex-shrink-0" />
            <Skeleton className="h-3.5 flex-1 max-w-[110px]" />
          </div>
        ))}
      </div>
    </div>

    <div className="flex-1 flex flex-col min-h-screen">
      <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 px-4 sm:px-6 h-14 flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-20" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-6">
        <div className="flex bg-gray-100 dark:bg-[#1c1c20] rounded-lg p-1 mb-4">
          <div className="flex-1 h-8" />
          <div className="flex-1 h-8" />
        </div>
        <div className="bg-white dark:bg-[#161619] rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
          <CallListSkeleton rows={4} />
        </div>
      </main>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// Bottom sheet
// ─────────────────────────────────────────────────────────────────────
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
        className="w-full md:max-w-md md:rounded-lg rounded-t-lg bg-white dark:bg-[#1a1a1a] shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Status + type pills
// ─────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  if (status === 'ongoing') {
    return (
      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-red-500 text-white px-1.5 py-0.5 rounded">
        <FaCircle className="text-[5px] live-dot" /> Live
      </span>
    );
  }
  if (status === 'ringing') {
    return (
      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-500 text-white px-1.5 py-0.5 rounded">
        <FaCircle className="text-[5px] live-dot" /> Ringing
      </span>
    );
  }
  if (status === 'missed') {
    return (
      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
        Missed
      </span>
    );
  }
  if (status === 'ended') {
    return (
      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
        Ended
      </span>
    );
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────
// Mini avatar + stack
// ─────────────────────────────────────────────────────────────────────
const MiniAvatar = ({ user, size = 16 }) => {
  const px = `${size}px`;
  if (user?.profile) {
    return (
      <img
        src={user.profile}
        alt=""
        className="rounded-full object-cover ring-1 ring-white dark:ring-[#161619]"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold ring-1 ring-white dark:ring-[#161619]"
      style={{
        width: px,
        height: px,
        backgroundColor: BRAND,
        fontSize: Math.max(7, Math.floor(size / 2.5)),
      }}
    >
      {getInitials(user?.name)}
    </div>
  );
};

const ParticipantStack = ({ participants = [], max = 3 }) => {
  if (!participants.length) return null;
  const visible = participants.slice(0, max);
  const rest = participants.length - visible.length;
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <div className="flex -space-x-1.5">
        {visible.map((p, i) => (
          <MiniAvatar key={i} user={p.user} size={16} />
        ))}
      </div>
      {rest > 0 && (
        <span className="text-[10px] text-gray-500 dark:text-gray-500 font-medium">
          +{rest}
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────
const OngoingCallRow = ({ call, onOpen, myId }) => {
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const myP = (call.participants || []).find((p) => getUserId(p) === myId);
  const myStatus = myP?.status;
  const accepted = (call.participants || []).filter((p) => p.status === 'accepted').length;
  const total = (call.participants || []).length;
  const started = call.startedAt || call.updatedAt;

  let buttonLabel = 'Join';
  let BtnIcon = FaPlayCircle;
  if (myStatus === 'ringing') {
    buttonLabel = 'Answer';
    BtnIcon = FaPhone;
  } else if (myStatus === 'accepted') {
    buttonLabel = 'Open';
    BtnIcon = FaPlayCircle;
  }

  const title = call.isMeeting
    ? 'Meeting'
    : call.creator?.name
    ? `${call.creator.name}'s call`
    : 'Direct call';

  const subtitle = [
    call.type === 'video' ? 'Video' : 'Voice',
    `${accepted}/${total} in call`,
    fmtRelative(started),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 min-h-[70px] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${BRAND}20`, color: BRAND }}
      >
        <Icon className="text-sm" />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {title}
          </p>
          <StatusBadge status={call.status} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate">
            {subtitle}
          </p>
          {total > 1 && (
            <div className="hidden sm:block">
              <ParticipantStack participants={call.participants} />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onOpen(call)}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-white rounded-md text-xs font-medium hover:opacity-90 active:scale-95 transition"
        style={{ backgroundColor: myStatus === 'ringing' ? '#16a34a' : BRAND }}
      >
        <BtnIcon className="text-[10px]" />
        <span>{buttonLabel}</span>
      </button>
    </div>
  );
};

const HistoryCallRow = ({ call, onOpen, myId }) => {
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const isMissed = call.status === 'missed';
  const myP = (call.participants || []).find((p) => getUserId(p) === myId);
  const myMissed = isMissed && myP?.status === 'missed';
  const when = call.endedAt || call.updatedAt || call.createdAt;
  const duration = call.duration;

  const title = call.isMeeting
    ? 'Meeting'
    : call.creator?.name
    ? `${call.creator.name}'s call`
    : 'Direct call';

  const subtitle = [
    call.type === 'video' ? 'Video' : 'Voice',
    duration ? fmtDuration(duration) : null,
    fmtRelative(when),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      onClick={() => onOpen(call)}
      className="w-full text-left flex items-center gap-3 px-3 sm:px-4 min-h-[70px] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
    >
      <div
        className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
          myMissed
            ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
            : 'text-teal-600 dark:text-teal-400'
        }`}
        style={!myMissed ? { backgroundColor: `${BRAND}20` } : undefined}
      >
        <Icon className="text-sm" />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {title}
          </p>
          <StatusBadge status={call.status} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate">
            {subtitle}
          </p>
          {(call.participants || []).length > 1 && (
            <div className="hidden sm:block">
              <ParticipantStack participants={call.participants} />
            </div>
          )}
        </div>
      </div>

      <FaChevronRight className="flex-shrink-0 text-gray-300 dark:text-gray-600 text-[10px]" />
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Empty state (with optional action button — restored)
// ─────────────────────────────────────────────────────────────────────
const EmptyList = ({ icon: Icon = FaPhone, message = 'Nothing here yet.', action = null }) => (
  <div className="flex flex-col items-center justify-center min-h-[160px] text-gray-400 dark:text-gray-500 px-4 py-8">
    <Icon className="text-3xl mb-2 opacity-30" />
    <p className="text-sm text-center max-w-[280px]">{message}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// FAB options sheet
// ─────────────────────────────────────────────────────────────────────
const FabOptionsSheet = ({
  isOpen,
  onClose,
  onNewCall,
  onCreateMeeting,
  onJoinByCode,
}) => (
  <BottomSheet isOpen={isOpen} onClose={onClose}>
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        What would you like to do?
      </h3>

      <button
        onClick={() => {
          onClose();
          onNewCall();
        }}
        className="flex items-center gap-4 w-full px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition"
      >
        <div className="w-11 h-11 rounded-md bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
          <FaPhone className="text-lg" />
        </div>
        <div className="text-left">
          <span className="block font-medium text-gray-700 dark:text-gray-200">
            New call
          </span>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
            Call someone by @username
          </span>
        </div>
      </button>

      <button
        onClick={() => {
          onClose();
          onCreateMeeting();
        }}
        className="flex items-center gap-4 w-full px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition"
      >
        <div className="w-11 h-11 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
          <FaLink className="text-lg" />
        </div>
        <div className="text-left">
          <span className="block font-medium text-gray-700 dark:text-gray-200">
            Meeting link
          </span>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
            Create a shareable link
          </span>
        </div>
      </button>

      <button
        onClick={() => {
          onClose();
          onJoinByCode();
        }}
        className="flex items-center gap-4 w-full px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition"
      >
        <div className="w-11 h-11 rounded-md bg-gray-100 dark:bg-gray-800/60 flex items-center justify-center text-gray-600 dark:text-gray-300">
          <FaSignInAlt className="text-lg" />
        </div>
        <div className="text-left">
          <span className="block font-medium text-gray-700 dark:text-gray-200">
            Join by code
          </span>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
            Enter a meeting link or code
          </span>
        </div>
      </button>
    </div>
  </BottomSheet>
);

// ─────────────────────────────────────────────────────────────────────
// Direct-call form
// ─────────────────────────────────────────────────────────────────────
const DirectCallContent = ({ onClose, onStart }) => {
  const [username, setUsername] = useState('');
  const [type, setType] = useState('video');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const cleaned = username.replace(/^@/, '').trim().toLowerCase();
    if (!cleaned) return toast.error('Enter a username');
    setBusy(true);
    try {
      await onStart({ username: cleaned, type });
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start call');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          <FaPhone className="inline mr-2 text-teal-500" /> New Call
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
        >
          <FaTimes />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Username *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              @
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="johndoe"
              autoFocus
              required
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Any Xircle user — no workspace required.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Call type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'voice', icon: FaPhone, label: 'Voice' },
              { v: 'video', icon: FaVideo, label: 'Video' },
            ].map(({ v, icon: Icon, label }) => {
              const active = type === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border transition ${
                    active
                      ? 'bg-teal-600 dark:bg-teal-500 text-white border-teal-600 dark:border-teal-500'
                      : 'bg-gray-50 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="text-xs" /> {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="flex-1 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <FaSpinner className="animate-spin" /> Calling…
              </>
            ) : (
              <>
                <FaPhone className="text-xs" /> Call
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Meeting-link content
// ─────────────────────────────────────────────────────────────────────
const MeetingLinkContent = ({ meeting, loading, onClose, onJoinNow }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && meeting) setCopied(false);
  }, [loading, meeting]);

  const link = meeting?.meetingLink;
  const code = meeting?.meetingCode;

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          <FaLink className="inline mr-2 text-purple-500" />
          {loading ? 'Creating meeting…' : 'Meeting Ready'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
        >
          <FaTimes />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-10">
          <FaSpinner className="animate-spin text-3xl text-purple-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Generating your link…
          </p>
        </div>
      ) : link ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Share this link. Guests without an account just enter a name to join.
          </p>

          <div className="bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-1">
              Meeting link
            </p>
            <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
              {link}
            </p>
          </div>

          {code && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Code:{' '}
              <span className="font-mono text-gray-700 dark:text-gray-300">
                {code}
              </span>
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={copy}
              className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <FaCheck className="text-xs text-green-500" /> Copied
                </>
              ) : (
                <>
                  <FaCopy className="text-xs" /> Copy
                </>
              )}
            </button>
            <button
              onClick={onJoinNow}
              className="flex-1 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition flex items-center justify-center gap-2"
            >
              <FaPlayCircle className="text-xs" /> Join now
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-500">Failed to create meeting.</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Join-by-code content
// ─────────────────────────────────────────────────────────────────────
const JoinByCodeContent = ({ onClose, onJoin }) => {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const code = extractCode(input);
    if (!code) return toast.error('Enter a meeting code or link');
    setBusy(true);
    try {
      await onJoin(code);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Meeting not found or ended');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          <FaSignInAlt className="inline mr-2 text-teal-500" /> Join by Code
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
        >
          <FaTimes />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Meeting code or link *
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-900 dark:text-white placeholder-gray-400 font-mono"
            placeholder="abcd1234  or  https://…/join/abcd1234"
            autoFocus
            required
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Paste a code or the full meeting link.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex-1 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <FaSpinner className="animate-spin" /> Joining…
              </>
            ) : (
              <>
                <FaPlayCircle className="text-xs" /> Join
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Call detail content
// ─────────────────────────────────────────────────────────────────────
const CallDetailContent = ({ call, onClose, onRejoin }) => {
  const participants = call.participants || [];
  const guests = call.guests || [];
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const duration = call.duration;
  const canRejoin = ['ringing', 'ongoing'].includes(call.status);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${BRAND}20`, color: BRAND }}
          >
            <Icon className="text-base" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {call.isMeeting
                ? 'Meeting'
                : call.creator?.name
                ? `${call.creator.name}'s call`
                : 'Direct call'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusBadge status={call.status} />
              <span className="text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                {call.type === 'video' ? 'Video' : 'Voice'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition flex-shrink-0"
        >
          <FaTimes />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
        {call.startedAt && (
          <div>
            <p className="text-gray-500 dark:text-gray-500 mb-0.5">Started</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">
              {fmtDateTime(call.startedAt)}
            </p>
          </div>
        )}
        {call.endedAt && (
          <div>
            <p className="text-gray-500 dark:text-gray-500 mb-0.5">Ended</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">
              {fmtDateTime(call.endedAt)}
            </p>
          </div>
        )}
        {duration && (
          <div>
            <p className="text-gray-500 dark:text-gray-500 mb-0.5">Duration</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">
              {fmtDuration(duration)}
            </p>
          </div>
        )}
      </div>

      {participants.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
            Participants ({participants.length})
          </p>
          <div className="space-y-1">
            {participants.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg px-3 py-2"
              >
                <MiniAvatar user={p.user} size={26} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                    {p.user?.name || 'Unknown'}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 capitalize">
                    {p.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {guests.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
            Guests ({guests.length})
          </p>
          <div className="space-y-1">
            {guests.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg px-3 py-2"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ backgroundColor: BRAND }}
                >
                  {getInitials(g.name)}
                </div>
                <p className="text-xs text-gray-800 dark:text-gray-200 truncate">
                  {g.name}{' '}
                  <span className="text-[10px] text-gray-500 dark:text-gray-500">
                    (guest)
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {call.isMeeting && call.meetingLink && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
            Meeting link
          </p>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg px-3 py-2">
            <FaLink className="text-gray-400 text-[10px] shrink-0" />
            <p className="flex-1 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
              {call.meetingLink}
            </p>
          </div>
        </div>
      )}

      {canRejoin && (
        <button
          onClick={() => onRejoin(call)}
          className="w-full py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 transition flex items-center justify-center gap-2 font-medium"
        >
          <FaPlayCircle className="text-xs" /> Rejoin call
        </button>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════
const Calls = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);
  const myId = String(userInfo?._id || '');

  useEffect(() => {
    if (!userInfo) navigate('/login', { replace: true });
  }, [userInfo, navigate]);

  // ─── Queries ────────────────────────────────────────────────
  const { data: ongoingData, isLoading: ongoingLoading } = useGetOngoingCallsQuery(
    undefined,
    {
      pollingInterval: 15_000,
      refetchOnFocus: true,
      skip: !userInfo,
    }
  );
  const ongoingCalls = ongoingData?.calls || [];

  const { data: logsData, isLoading: logsLoading } = useGetCallLogsQuery(
    { limit: 100 },
    { refetchOnFocus: true, skip: !userInfo }
  );
  const allLogs = logsData?.calls || [];

  const historyCalls = useMemo(
    () => allLogs.filter((c) => ['ended', 'missed', 'cancelled'].includes(c.status)),
    [allLogs]
  );

  // ─── Mutations ──────────────────────────────────────────────
  const [initiateDirectCall] = useInitiateDirectCallMutation();
  const [createMeeting] = useCreateMeetingMutation();
  const [joinByMeetingCode] = useJoinByMeetingCodeMutation();

  // ─── UI state ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('ongoing');
  const [showFabOptions, setShowFabOptions] = useState(false);
  const [showDirectCall, setShowDirectCall] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showJoinByCode, setShowJoinByCode] = useState(false);
  const [detailCall, setDetailCall] = useState(null);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meeting, setMeeting] = useState(null);

  // ─── Handlers ───────────────────────────────────────────────
  const handleDirectCall = useCallback(
    async ({ username, type }) => {
      const res = await initiateDirectCall({ username, type }).unwrap();
      navigate(`/call/${res.call._id}`);
    },
    [initiateDirectCall, navigate]
  );

  const handleCreateMeeting = useCallback(async () => {
    setShowMeeting(true);
    setMeetingLoading(true);
    setMeeting(null);
    try {
      const res = await createMeeting({ type: 'video', participantIds: [] }).unwrap();
      setMeeting(res.call);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create meeting');
      setShowMeeting(false);
    } finally {
      setMeetingLoading(false);
    }
  }, [createMeeting]);

  const handleJoinByCode = useCallback(
    async (code) => {
      const res = await joinByMeetingCode(code).unwrap();
      navigate(`/call/${res.call._id}`);
    },
    [joinByMeetingCode, navigate]
  );

  const handleOpenOngoing = useCallback(
    (call) => navigate(`/call/${call._id}`),
    [navigate]
  );
  const handleJoinNowMeeting = useCallback(() => {
    if (meeting?._id) navigate(`/call/${meeting._id}`);
  }, [meeting, navigate]);
  const handleRejoin = useCallback(
    (call) => navigate(`/call/${call._id}`),
    [navigate]
  );

  // ─── Loading skeleton ──────────────────────────────────────
  if (!userInfo) return null;
  if (ongoingLoading && logsLoading) {
    return (
      <>
        <GlobalStyles />
        <CallsSkeleton />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <GlobalStyles />

      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          {/* ─── Header ──────────────────────────────────────── */}
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
            <div className="min-w-0 flex flex-col">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 truncate">
                Calls
                {ongoingCalls.length > 0 && (
                  <span
                    className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: '#dc2626' }}
                  >
                    {ongoingCalls.length} live
                  </span>
                )}
              </h1>
              <p className="hidden sm:block text-[11px] text-gray-500 dark:text-gray-400 -mt-0.5 truncate">
                Direct calls and shareable meetings
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Join by code */}
              <button
                onClick={() => setShowJoinByCode(true)}
                title="Join by code"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition text-sm font-medium"
              >
                <FaSignInAlt className="text-sm" />
                <span className="hidden sm:inline">Join by code</span>
              </button>

              {/* Meeting link */}
              <button
                onClick={handleCreateMeeting}
                title="Meeting link"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-sm font-medium"
              >
                <FaLink className="text-sm" />
                <span className="hidden sm:inline">Meeting link</span>
              </button>

              {/* New call */}
              <button
                onClick={() => setShowDirectCall(true)}
                title="New call"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition text-sm font-medium"
              >
                <FaPhone className="text-sm" />
                <span className="hidden sm:inline">New call</span>
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-6 flex flex-col">
            {/* ─── Tabs ──────────────────────────────────────── */}
            <div className="flex bg-gray-100 dark:bg-[#1c1c20] rounded-lg p-1 mb-4">
              <button
                onClick={() => setActiveTab('ongoing')}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'ongoing'
                    ? 'bg-white dark:bg-[#0f0f12] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <FaPlayCircle className="text-[10px]" />
                Ongoing
                {ongoingCalls.length > 0 && (
                  <span
                    className={`ml-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === 'ongoing'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {ongoingCalls.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-[#0f0f12] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <FaHistory className="text-[10px]" />
                History
                {historyCalls.length > 0 && (
                  <span className="ml-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {historyCalls.length}
                  </span>
                )}
              </button>
            </div>

            {/* ─── Panel ─────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#161619] rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              {activeTab === 'ongoing' && (
                <>
                  {ongoingLoading ? (
                    <CallListSkeleton rows={3} />
                  ) : ongoingCalls.length === 0 ? (
                    <EmptyList
                      icon={FaPhone}
                      message="No calls in progress. Start one — voice, video, or a shareable meeting."
                      action={
                        <button
                          onClick={() => setShowDirectCall(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-700 dark:hover:bg-teal-600 transition"
                        >
                          <FaPlus className="text-xs" /> Start one
                        </button>
                      }
                    />
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                      {ongoingCalls.map((call) => (
                        <OngoingCallRow
                          key={call._id}
                          call={call}
                          myId={myId}
                          onOpen={handleOpenOngoing}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <>
                  {logsLoading ? (
                    <CallListSkeleton rows={4} />
                  ) : historyCalls.length === 0 ? (
                    <EmptyList
                      icon={FaHistory}
                      message="No past calls yet. Ended, missed and cancelled calls will show up here."
                    />
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                      {historyCalls.map((call) => (
                        <HistoryCallRow
                          key={call._id}
                          call={call}
                          myId={myId}
                          onOpen={setDetailCall}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </main>

          <GeneralBottombar />

          {/* ─── FAB ────────────────────────────────────────── */}
          <button
            onClick={() => setShowFabOptions(true)}
            className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-14 h-14 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg shadow-teal-600/25 flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
            aria-label="Start a new call"
          >
            <FaRocket className="text-2xl" />
          </button>
        </div>
      </div>

      {/* ─── Sheets ─────────────────────────────────────────── */}
      <FabOptionsSheet
        isOpen={showFabOptions}
        onClose={() => setShowFabOptions(false)}
        onNewCall={() => setShowDirectCall(true)}
        onCreateMeeting={handleCreateMeeting}
        onJoinByCode={() => setShowJoinByCode(true)}
      />

      <BottomSheet isOpen={showDirectCall} onClose={() => setShowDirectCall(false)}>
        <DirectCallContent
          onClose={() => setShowDirectCall(false)}
          onStart={handleDirectCall}
        />
      </BottomSheet>

      <BottomSheet
        isOpen={showMeeting}
        onClose={() => {
          setShowMeeting(false);
          setMeeting(null);
        }}
      >
        <MeetingLinkContent
          meeting={meeting}
          loading={meetingLoading}
          onClose={() => {
            setShowMeeting(false);
            setMeeting(null);
          }}
          onJoinNow={handleJoinNowMeeting}
        />
      </BottomSheet>

      <BottomSheet isOpen={showJoinByCode} onClose={() => setShowJoinByCode(false)}>
        <JoinByCodeContent
          onClose={() => setShowJoinByCode(false)}
          onJoin={handleJoinByCode}
        />
      </BottomSheet>

      <BottomSheet isOpen={!!detailCall} onClose={() => setDetailCall(null)}>
        {detailCall && (
          <CallDetailContent
            call={detailCall}
            onClose={() => setDetailCall(null)}
            onRejoin={handleRejoin}
          />
        )}
      </BottomSheet>
    </>
  );
};

export default Calls;