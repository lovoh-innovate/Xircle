// src/screens/workspace/WorkspaceCall.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import {
  FaArrowLeft,
  FaPhone,
  FaVideo,
  FaCalendarAlt,
  FaCalendarPlus,
  FaUsers,
  FaSpinner,
  FaPlus,
  FaLink,
  FaCopy,
  FaTimes,
  FaCheck,
  FaHistory,
  FaPlayCircle,
  FaCircle,
  FaLock,
  FaSearch,
  FaChevronRight,
} from 'react-icons/fa';

import { useGetWorkspaceQuery } from '../../slices/workspaceApiSlice';
import {
  useGetOngoingCallsQuery,
  useGetScheduledCallsQuery,
  useGetCallLogsQuery,
  useInitiateCallMutation,
  useScheduleCallMutation,
  useCreateMeetingMutation,
  useJoinCallMutation,
  useCancelScheduledCallMutation,
  useGetCallTokenMutation,
} from '../../slices/callApiSlice';
import { useWorkspacePresence } from '../../services/useWorkspacePresence';
import WorkspaceSidebar from '../../components/WorkspaceSidebar';
import WorkspaceBottombar from '../../components/WorkspaceBottombar';

// ─────────────────────────────────────────────────────────────────────
// Base path
// ─────────────────────────────────────────────────────────────────────
const WORKSPACE_BASE_PATH = '/workspace';

// ─────────────────────────────────────────────────────────────────────
// Helpers
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
const fmtFuture = (d) => {
  if (!d) return '';
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d`;
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

// ─────────────────────────────────────────────────────────────────────
// Global styles
// ─────────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    .ws-mobile-header { padding-top: env(safe-area-inset-top, 0px); }
    .ws-mobile-header-spacer { height: calc(3.5rem + env(safe-area-inset-top, 0px)); }

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

    .call-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .call-scroll::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.3);
      border-radius: 999px;
    }
    .call-scroll::-webkit-scrollbar-track { background: transparent; }

    @keyframes livePulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.15); }
    }
    .live-dot { animation: livePulse 1.6s ease-in-out infinite; }
  `}</style>
);

const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-md ${className}`} />
);

const CallRowSkeleton = () => (
  <div className="flex items-center gap-3 px-3 sm:px-4 min-h-[70px]">
    <Skeleton className="w-9 h-9 flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-3.5 w-32 sm:w-48" />
      <Skeleton className="h-2.5 w-24 sm:w-36" />
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

// ─────────────────────────────────────────────────────────────────────
// Bottom sheet (same pattern as MyWorkspaces)
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
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
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
// Pills
// ─────────────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const Icon = type === 'video' ? FaVideo : FaPhone;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400">
      <Icon className="text-[9px]" />
      {type === 'video' ? 'Video' : 'Voice'}
    </span>
  );
};

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
  if (status === 'scheduled') {
    return (
      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded">
        Scheduled
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded">
        Cancelled
      </span>
    );
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────
// Mini avatar + stack
// ─────────────────────────────────────────────────────────────────────
const MiniAvatar = ({ user, size = 16, brandColor }) => {
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
        backgroundColor: brandColor,
        fontSize: Math.max(7, Math.floor(size / 2.5)),
      }}
    >
      {getInitials(user?.name)}
    </div>
  );
};

const ParticipantStack = ({ participants = [], brandColor, max = 3 }) => {
  if (!participants.length) return null;
  const visible = participants.slice(0, max);
  const rest = participants.length - visible.length;
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <div className="flex -space-x-1.5">
        {visible.map((p, i) => (
          <MiniAvatar key={i} user={p.user} size={16} brandColor={brandColor} />
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
const OngoingCallRow = ({ call, onJoin, brandColor, joining, myId }) => {
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const participants = call.participants || [];
  const accepted = participants.filter((p) => p.status === 'accepted').length;
  const total = participants.length;
  const myP = participants.find((p) => getUserId(p) === myId);
  const myStatus = myP?.status;
  const started = call.startedAt || call.updatedAt;

  const title = call.isMeeting
    ? `${call.creator?.name || 'Someone'}'s meeting`
    : `${call.creator?.name || 'Someone'}'s call`;

  const subtitle = [
    call.type === 'video' ? 'Video' : 'Voice',
    `${accepted}/${total} in call`,
    fmtRelative(started),
  ]
    .filter(Boolean)
    .join(' · ');

  let buttonLabel = 'Join';
  let BtnIcon = FaPlayCircle;
  if (myStatus === 'ringing') {
    buttonLabel = 'Answer';
    BtnIcon = FaPhone;
  } else if (myStatus === 'accepted') {
    buttonLabel = 'Open';
    BtnIcon = FaPlayCircle;
  }

  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 min-h-[70px] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
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
              <ParticipantStack
                participants={participants}
                brandColor={brandColor}
              />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onJoin(call)}
        disabled={joining}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-white rounded-md text-xs font-medium hover:opacity-90 active:scale-95 transition disabled:opacity-60"
        style={{ backgroundColor: myStatus === 'ringing' ? '#16a34a' : brandColor }}
      >
        {joining ? (
          <FaSpinner className="animate-spin text-[10px]" />
        ) : (
          <BtnIcon className="text-[10px]" />
        )}
        <span>{buttonLabel}</span>
      </button>
    </div>
  );
};

const ScheduledCallRow = ({
  call,
  canCancel,
  onCancel,
  brandColor,
  cancelling,
  myId,
}) => {
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const participants = call.participants || [];
  const when = call.scheduledAt ? new Date(call.scheduledAt) : null;

  const title = `${call.creator?.name || 'Someone'}'s scheduled call`;
  const subtitle = [
    call.type === 'video' ? 'Video' : 'Voice',
    when ? fmtDateTime(when) : null,
    when ? fmtFuture(when) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 min-h-[70px] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
      >
        <Icon className="text-sm" />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {title}
          </p>
          <StatusBadge status="scheduled" />
        </div>
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate">
            {subtitle}
          </p>
          {participants.length > 1 && (
            <div className="hidden sm:block">
              <ParticipantStack
                participants={participants}
                brandColor={brandColor}
              />
            </div>
          )}
        </div>
      </div>

      {canCancel && (
        <button
          onClick={() => onCancel(call)}
          disabled={cancelling}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-95 transition disabled:opacity-60"
        >
          {cancelling ? (
            <FaSpinner className="animate-spin text-[10px]" />
          ) : (
            <FaTimes className="text-[10px]" />
          )}
          <span className="hidden sm:inline">Cancel</span>
        </button>
      )}
    </div>
  );
};

const HistoryCallRow = ({ call, onOpen, brandColor, myId }) => {
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const participants = call.participants || [];
  const myP = participants.find((p) => getUserId(p) === myId);
  const myMissed = call.status === 'missed' && myP?.status === 'missed';
  const when = call.endedAt || call.updatedAt || call.createdAt;
  const duration = call.duration;

  const title = call.isMeeting
    ? `${call.creator?.name || 'Someone'}'s meeting`
    : `${call.creator?.name || 'Someone'}'s call`;

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
            : ''
        }`}
        style={!myMissed ? { backgroundColor: `${brandColor}20`, color: brandColor } : undefined}
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
          {participants.length > 1 && (
            <div className="hidden sm:block">
              <ParticipantStack
                participants={participants}
                brandColor={brandColor}
              />
            </div>
          )}
        </div>
      </div>

      <FaChevronRight className="flex-shrink-0 text-gray-300 dark:text-gray-600 text-[10px]" />
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────
const EmptyList = ({ icon: Icon = FaPhone, message = 'Nothing here yet.', action = null }) => (
  <div className="flex flex-col items-center justify-center min-h-[160px] text-gray-400 dark:text-gray-500 px-4 py-8">
    <Icon className="text-3xl mb-2 opacity-30" />
    <p className="text-sm text-center max-w-[280px]">{message}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ═════════════════════════════════════════════════════════════════════
// START CALL modal (bottom sheet)
// ═════════════════════════════════════════════════════════════════════
const StartCallModal = ({
  isOpen,
  onClose,
  members,
  myId,
  brandColor,
  onStart,
}) => {
  const [type, setType] = useState('video');
  const [selectedIds, setSelectedIds] = useState([]);
  const [starting, setStarting] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setType('video');
      setSelectedIds([]);
      setQuery('');
      setStarting(false);
    }
  }, [isOpen]);

  const available = members.filter((m) => getUserId(m) !== myId);
  const filtered = available.filter((m) => {
    if (!query.trim()) return true;
    const u = m.user || m;
    return (u.name || '').toLowerCase().includes(query.toLowerCase());
  });

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleStart = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one member to call');
      return;
    }
    setStarting(true);
    try {
      await onStart({ type, participantIds: selectedIds });
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start call');
    } finally {
      setStarting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            <FaPhone className="inline mr-2" style={{ color: brandColor }} /> New Call
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-4">
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
                        ? 'text-white border-transparent'
                        : 'bg-gray-50 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={active ? { backgroundColor: brandColor } : undefined}
                  >
                    <Icon className="text-xs" /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Invite members
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {selectedIds.length} selected
              </span>
            </div>

            <div className="relative mb-2">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members"
                className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-white outline-none focus:border-teal-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto call-scroll border border-gray-200 dark:border-gray-800 rounded-lg">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-gray-500 dark:text-gray-500 py-6">
                  No members found
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {filtered.map((m) => {
                    const u = m.user || m;
                    const id = getUserId(m);
                    const checked = selectedIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggle(id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                          checked
                            ? 'bg-teal-50 dark:bg-teal-900/15'
                            : 'hover:bg-gray-50 dark:hover:bg-[#242428]'
                        }`}
                      >
                        <MiniAvatar user={u} size={28} brandColor={brandColor} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-gray-800 dark:text-white truncate">
                            {u.name || 'Unknown'}
                          </span>
                          {m.role && (
                            <span className="block text-[10px] text-gray-500 dark:text-gray-500 capitalize">
                              {m.role}
                            </span>
                          )}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            checked ? 'text-white' : 'border-gray-300 dark:border-gray-600'
                          }`}
                          style={
                            checked
                              ? { backgroundColor: brandColor, borderColor: brandColor }
                              : undefined
                          }
                        >
                          {checked && <FaCheck className="text-[9px]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={starting || selectedIds.length === 0}
            className="flex-1 py-3 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: brandColor }}
          >
            {starting ? (
              <>
                <FaSpinner className="animate-spin text-xs" /> Starting…
              </>
            ) : (
              <>
                <FaPhone className="text-xs" /> Start call
              </>
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

// ═════════════════════════════════════════════════════════════════════
// SCHEDULE CALL modal (bottom sheet)
// ═════════════════════════════════════════════════════════════════════
const ScheduleCallModal = ({
  isOpen,
  onClose,
  members,
  myId,
  brandColor,
  onSchedule,
}) => {
  const [type, setType] = useState('video');
  const [selectedIds, setSelectedIds] = useState([]);
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setType('video');
      setSelectedIds([]);
      setWhen('');
      setSaving(false);
      setQuery('');
    }
  }, [isOpen]);

  const available = members.filter((m) => getUserId(m) !== myId);
  const filtered = available.filter((m) => {
    if (!query.trim()) return true;
    const u = m.user || m;
    return (u.name || '').toLowerCase().includes(query.toLowerCase());
  });

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) return toast.error('Select at least one member');
    if (!when) return toast.error('Pick a date and time');
    const dt = new Date(when);
    if (dt <= new Date()) return toast.error('Scheduled time must be in the future');

    setSaving(true);
    try {
      await onSchedule({
        type,
        participantIds: selectedIds,
        scheduledAt: dt.toISOString(),
      });
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            <FaCalendarPlus className="inline mr-2" style={{ color: brandColor }} /> Schedule Call
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-4">
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
                        ? 'text-white border-transparent'
                        : 'bg-gray-50 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={active ? { backgroundColor: brandColor } : undefined}
                  >
                    <Icon className="text-xs" /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date & time
            </label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-white outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Invite members
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {selectedIds.length} selected
              </span>
            </div>

            <div className="relative mb-2">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members"
                className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-white outline-none focus:border-teal-500"
              />
            </div>

            <div className="max-h-56 overflow-y-auto call-scroll border border-gray-200 dark:border-gray-800 rounded-lg">
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {filtered.map((m) => {
                  const u = m.user || m;
                  const id = getUserId(m);
                  const checked = selectedIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                        checked
                          ? 'bg-teal-50 dark:bg-teal-900/15'
                          : 'hover:bg-gray-50 dark:hover:bg-[#242428]'
                      }`}
                    >
                      <MiniAvatar user={u} size={28} brandColor={brandColor} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-800 dark:text-white truncate">
                          {u.name || 'Unknown'}
                        </span>
                        {m.role && (
                          <span className="block text-[10px] text-gray-500 dark:text-gray-500 capitalize">
                            {m.role}
                          </span>
                        )}
                      </span>
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          checked ? 'text-white' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        style={
                          checked
                            ? { backgroundColor: brandColor, borderColor: brandColor }
                            : undefined
                        }
                      >
                        {checked && <FaCheck className="text-[9px]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selectedIds.length === 0 || !when}
            className="flex-1 py-3 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: brandColor }}
          >
            {saving ? (
              <>
                <FaSpinner className="animate-spin text-xs" /> Scheduling…
              </>
            ) : (
              <>
                <FaCalendarAlt className="text-xs" /> Schedule
              </>
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

// ═════════════════════════════════════════════════════════════════════
// MEETING LINK modal (bottom sheet)
// ═════════════════════════════════════════════════════════════════════
const MeetingLinkModal = ({ isOpen, onClose, link, code, brandColor, loading }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            <FaLink className="inline mr-2" style={{ color: brandColor }} />
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
            <FaSpinner
              className="animate-spin text-3xl"
              style={{ color: brandColor }}
            />
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
                onClick={onClose}
                className="flex-1 py-3 text-white rounded-lg font-medium transition flex items-center justify-center"
                style={{ backgroundColor: brandColor }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-500">Failed to create meeting.</p>
        )}
      </div>
    </BottomSheet>
  );
};

// ═════════════════════════════════════════════════════════════════════
// CALL DETAIL modal (bottom sheet)
// ═════════════════════════════════════════════════════════════════════
const CallDetailModal = ({
  isOpen,
  onClose,
  call,
  brandColor,
  onRejoin,
  rejoining,
}) => {
  if (!call) return null;

  const participants = call.participants || [];
  const guests = call.guests || [];
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const duration = call.duration;
  const canRejoin = ['ringing', 'ongoing'].includes(call.status);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
            >
              <Icon className="text-base" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {call.creator?.name || 'Someone'}'s call
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusBadge status={call.status} />
                <TypeBadge type={call.type} />
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
          {call.scheduledAt && (
            <div>
              <p className="text-gray-500 dark:text-gray-500 mb-0.5">Scheduled</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {fmtDateTime(call.scheduledAt)}
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
                  <MiniAvatar user={p.user} size={26} brandColor={brandColor} />
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
                    style={{ backgroundColor: brandColor }}
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
            disabled={rejoining}
            className="w-full py-3 text-white rounded-lg font-medium transition disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: brandColor }}
          >
            {rejoining ? (
              <>
                <FaSpinner className="animate-spin text-xs" /> Joining…
              </>
            ) : (
              <>
                <FaPlayCircle className="text-xs" /> Rejoin call
              </>
            )}
          </button>
        )}
      </div>
    </BottomSheet>
  );
};

// ═════════════════════════════════════════════════════════════════════
// MAIN — WorkspaceCall
// ═════════════════════════════════════════════════════════════════════
const WorkspaceCall = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);

  const isLoggedIn = !!userInfo;
  const myId = String(userInfo?._id || '');

  // ─── Workspace + role ─────────────────────────────────────
  const { data: wData, isLoading: wLoading, error: wError } =
    useGetWorkspaceQuery(workspaceId);

  const workspace = wData?.workspace;
  const members = useMemo(() => workspace?.members || [], [workspace]);

  const myMembership = useMemo(
    () => (isLoggedIn ? members.find((m) => getUserId(m) === myId) : null),
    [members, isLoggedIn, myId]
  );

  const isMember = !!myMembership;
  const memberRole = String(myMembership?.role || '').toLowerCase();
  const isOwnerOrAdmin = isMember && ['owner', 'admin'].includes(memberRole);
  const canSchedule = isOwnerOrAdmin;

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );

  const brandColor = workspace?.color || '#0d9488';

  // ─── Presence ─────────────────────────────────────────────
  useWorkspacePresence(isMember ? workspaceId : null);

  // ─── Queries ──────────────────────────────────────────────
  const {
    data: ongoingData,
    isLoading: ongoingLoading,
    refetch: refetchOngoing,
  } = useGetOngoingCallsQuery(workspaceId, {
    skip: !isMember,
    pollingInterval: 15_000,
    refetchOnFocus: true,
  });
  const ongoingCalls = ongoingData?.calls || [];

  const {
    data: scheduledData,
    isLoading: scheduledLoading,
    refetch: refetchScheduled,
  } = useGetScheduledCallsQuery(workspaceId, {
    skip: !isMember,
    pollingInterval: 30_000,
    refetchOnFocus: true,
  });
  const scheduledCalls = scheduledData?.calls || [];

  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useGetCallLogsQuery(
    { workspaceId, limit: 100 },
    { skip: !isMember, refetchOnFocus: true }
  );
  const allLogs = logsData?.calls || [];
  const historyCalls = useMemo(
    () => allLogs.filter((c) => ['ended', 'missed', 'cancelled'].includes(c.status)),
    [allLogs]
  );

  // ─── Mutations ────────────────────────────────────────────
  const [initiateCall] = useInitiateCallMutation();
  const [scheduleCall] = useScheduleCallMutation();
  const [createMeeting] = useCreateMeetingMutation();
  const [joinCall] = useJoinCallMutation();
  const [cancelScheduledCall] = useCancelScheduledCallMutation();
  const [getCallToken] = useGetCallTokenMutation();

  // ─── UI state ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('ongoing');
  const [startOpen, setStartOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetingResult, setMeetingResult] = useState(null);

  const [joiningId, setJoiningId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [detailCall, setDetailCall] = useState(null);
  const [rejoining, setRejoining] = useState(false);

  // ─── Redirect on error ────────────────────────────────────
  useEffect(() => {
    if (wError) navigate('/my-workspaces');
  }, [wError, navigate]);

  // ─── Handlers ─────────────────────────────────────────────
  const handleStart = useCallback(
    async ({ type, participantIds }) => {
      const res = await initiateCall({
        workspaceId,
        type,
        participantIds,
      }).unwrap();
      const call = res.call;
      toast.success('Call started — ringing participants');
      refetchOngoing();
      refetchLogs();
      if (call?._id) {
        navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/calls/${call._id}`);
      }
    },
    [initiateCall, navigate, workspaceId, refetchOngoing, refetchLogs]
  );

  const handleSchedule = useCallback(
    async (payload) => {
      await scheduleCall({ workspaceId, ...payload }).unwrap();
      toast.success('Call scheduled');
      refetchScheduled();
    },
    [scheduleCall, workspaceId, refetchScheduled]
  );

  const handleCreateMeeting = useCallback(async () => {
    setMeetingOpen(true);
    setMeetingLoading(true);
    setMeetingResult(null);
    try {
      const res = await createMeeting({
        workspaceId,
        type: 'video',
        participantIds: [],
      }).unwrap();
      setMeetingResult(res.call);
      refetchOngoing();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create meeting');
      setMeetingOpen(false);
    } finally {
      setMeetingLoading(false);
    }
  }, [createMeeting, workspaceId, refetchOngoing]);

  const handleJoin = useCallback(
    async (call) => {
      setJoiningId(call._id);
      try {
        await joinCall(call._id).unwrap();
        try {
          await getCallToken(call._id).unwrap();
        } catch {
          /* detail page will retry */
        }
        navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/calls/${call._id}`);
      } catch (err) {
        toast.error(err?.data?.message || 'Failed to join call');
      } finally {
        setJoiningId(null);
      }
    },
    [joinCall, getCallToken, navigate, workspaceId]
  );

  const handleCancelScheduled = useCallback(
    async (call) => {
      setCancellingId(call._id);
      try {
        await cancelScheduledCall(call._id).unwrap();
        toast.success('Scheduled call cancelled');
        refetchScheduled();
      } catch (err) {
        toast.error(err?.data?.message || 'Failed to cancel');
      } finally {
        setCancellingId(null);
      }
    },
    [cancelScheduledCall, refetchScheduled]
  );

  const handleRejoin = useCallback(
    async (call) => {
      setRejoining(true);
      try {
        await joinCall(call._id).unwrap();
        navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/calls/${call._id}`);
      } catch (err) {
        toast.error(err?.data?.message || 'Failed to rejoin');
      } finally {
        setRejoining(false);
      }
    },
    [joinCall, navigate, workspaceId]
  );

  // ─── Loading skeleton ─────────────────────────────────────
  if (wLoading) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
          <div className="hidden md:block md:w-[260px] md:min-h-screen fixed top-0 left-0 z-20">
            <WorkspaceSidebar />
          </div>
          <div className="flex-1 md:ml-[260px]">
            <div className="ws-mobile-header-spacer md:hidden" />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-24 md:pb-6 space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="flex bg-gray-100 dark:bg-[#1c1c20] rounded-lg p-1">
                <div className="flex-1 h-8" />
                <div className="flex-1 h-8" />
                <div className="flex-1 h-8" />
              </div>
              <div className="bg-white dark:bg-[#161619] rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                <CallListSkeleton rows={3} />
              </div>
            </main>
          </div>
          <WorkspaceBottombar />
        </div>
      </>
    );
  }

  if (!workspace) return null;

  // ─── Guest / non-member gates ─────────────────────────────
  if (!isLoggedIn) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex items-center justify-center px-4">
          <div className="max-w-sm text-center bg-white dark:bg-[#14141a] rounded-lg border border-gray-200/60 dark:border-gray-800/60 p-8">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mx-auto mb-3">
              <FaLock className="text-teal-600 dark:text-teal-400 text-xl" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
              Sign in to view calls
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4 leading-relaxed">
              You need an account to view, join and start workspace calls.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition"
            >
              Sign in
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!isMember) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
          <div className="hidden md:block md:w-[260px] md:min-h-screen fixed top-0 left-0 z-20">
            <WorkspaceSidebar workspace={workspace} chats={[]} />
          </div>
          <div className="flex-1 md:ml-[260px]">
            <div className="ws-mobile-header-spacer md:hidden" />
            <main className="max-w-md mx-auto px-4 py-16 text-center">
              <div className="bg-white dark:bg-[#14141a] rounded-lg border border-gray-200/60 dark:border-gray-800/60 p-8">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-3">
                  <FaLock className="text-amber-600 dark:text-amber-400 text-xl" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
                  Members only
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-4 leading-relaxed">
                  You must be an active member of this workspace to view calls.
                </p>
                <Link
                  to={`${WORKSPACE_BASE_PATH}/${workspaceId}`}
                  className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition"
                >
                  Back to workspace
                </Link>
              </div>
            </main>
          </div>
          <WorkspaceBottombar workspace={workspace} />
        </div>
      </>
    );
  }

  // ─── Tabs config ──────────────────────────────────────────
  const tabs = [
    {
      id: 'ongoing',
      label: 'Ongoing',
      count: ongoingCalls.length,
      icon: FaPlayCircle,
      danger: ongoingCalls.length > 0,
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      count: scheduledCalls.length,
      icon: FaCalendarAlt,
    },
    {
      id: 'history',
      label: 'History',
      count: historyCalls.length,
      icon: FaHistory,
    },
  ];

  const renderTabContent = () => {
    if (activeTab === 'ongoing') {
      if (ongoingLoading) return <CallListSkeleton rows={3} />;
      if (ongoingCalls.length === 0) {
        return (
          <EmptyList
            icon={FaPhone}
            message="No calls in progress. Start one — voice, video, or a shareable meeting."
            action={
              <button
                onClick={() => setStartOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium transition"
                style={{ backgroundColor: brandColor }}
              >
                <FaPlus className="text-xs" /> Start one
              </button>
            }
          />
        );
      }
      return (
        <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
          {ongoingCalls.map((call) => (
            <OngoingCallRow
              key={call._id}
              call={call}
              brandColor={brandColor}
              onJoin={handleJoin}
              joining={joiningId === call._id}
              myId={myId}
            />
          ))}
        </div>
      );
    }

    if (activeTab === 'scheduled') {
      if (scheduledLoading) return <CallListSkeleton rows={3} />;
      if (scheduledCalls.length === 0) {
        return (
          <EmptyList
            icon={FaCalendarAlt}
            message={
              canSchedule
                ? 'No scheduled calls. Set a time and we’ll ring every invitee automatically.'
                : 'Admins can schedule calls that ring everyone at a set time.'
            }
            action={
              canSchedule ? (
                <button
                  onClick={() => setScheduleOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium transition"
                  style={{ backgroundColor: brandColor }}
                >
                  <FaCalendarPlus className="text-xs" /> Schedule one
                </button>
              ) : null
            }
          />
        );
      }
      return (
        <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
          {scheduledCalls.map((call) => {
            const creatorId = String(call.creator?._id || call.creator || '');
            const canCancel = isOwnerOrAdmin || creatorId === myId;
            return (
              <ScheduledCallRow
                key={call._id}
                call={call}
                canCancel={canCancel}
                onCancel={handleCancelScheduled}
                brandColor={brandColor}
                cancelling={cancellingId === call._id}
                myId={myId}
              />
            );
          })}
        </div>
      );
    }

    if (activeTab === 'history') {
      if (logsLoading) return <CallListSkeleton rows={4} />;
      if (historyCalls.length === 0) {
        return (
          <EmptyList
            icon={FaHistory}
            message="No past calls yet. Ended, missed and cancelled calls will show up here."
          />
        );
      }
      return (
        <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
          {historyCalls.map((call) => (
            <HistoryCallRow
              key={call._id}
              call={call}
              brandColor={brandColor}
              onOpen={setDetailCall}
              myId={myId}
            />
          ))}
        </div>
      );
    }
    return null;
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <GlobalStyles />

      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
        {/* Desktop sidebar */}
        <div className="hidden md:block md:min-h-screen fixed top-0 left-0 z-20 workspace-shell-sidebar">
          <WorkspaceSidebar workspace={workspace} chats={[]} />
        </div>

        <div className="flex-1 md:ml-[260px] workspace-shell-main">
          {/* Mobile header */}
          <header className="ws-mobile-header md:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-[#0b0b10] border-b border-gray-200 dark:border-gray-800/60">
            <div className="h-14 flex items-center gap-1 px-2 overflow-hidden">
              <button
                onClick={() => navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}`)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 active:scale-90 transition flex-shrink-0"
                aria-label="Back"
              >
                <FaArrowLeft className="text-sm" />
              </button>
              <div className="flex-1 min-w-0 px-1">
                <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  Calls
                </h1>
              </div>
            </div>
          </header>
          <div className="ws-mobile-header-spacer md:hidden" />

          {/* Desktop sticky header */}
          <header className="hidden md:flex bg-white dark:bg-[#0f0f12] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 px-6 h-14 items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                Calls
                {ongoingCalls.length > 0 && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white flex items-center gap-1"
                    style={{ backgroundColor: '#dc2626' }}
                  >
                    <FaCircle className="text-[5px] live-dot" /> {ongoingCalls.length} live
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-0.5 truncate">
                Voice and video meetings in {workspace.name}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleCreateMeeting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-sm font-medium"
              >
                <FaLink className="text-sm" />
                Meeting link
              </button>
              {canSchedule && (
                <button
                  onClick={() => setScheduleOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition text-sm font-medium"
                >
                  <FaCalendarPlus className="text-sm" />
                  Schedule
                </button>
              )}
              <button
                onClick={() => setStartOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white transition text-sm font-medium hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                <FaPhone className="text-sm" />
                New call
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-6">
            {/* Mobile quick actions */}
            <div className="md:hidden grid grid-cols-3 gap-2 mb-4">
              <button
                onClick={() => setStartOpen(true)}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-white text-[11px] font-medium active:scale-95 transition"
                style={{ backgroundColor: brandColor }}
              >
                <FaPhone className="text-sm" />
                Call
              </button>
              <button
                onClick={handleCreateMeeting}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg bg-white dark:bg-[#161619] border border-gray-200 dark:border-gray-800 text-[11px] font-medium text-gray-700 dark:text-gray-300 active:scale-95 transition"
              >
                <FaLink className="text-sm" style={{ color: brandColor }} />
                Link
              </button>
              <button
                onClick={() =>
                  canSchedule
                    ? setScheduleOpen(true)
                    : toast.info('Only workspace admins or owners can schedule')
                }
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg bg-white dark:bg-[#161619] border border-gray-200 dark:border-gray-800 text-[11px] font-medium text-gray-700 dark:text-gray-300 active:scale-95 transition"
              >
                <FaCalendarPlus className="text-sm" style={{ color: brandColor }} />
                Schedule
              </button>
            </div>

            {/* Segmented tabs */}
            <div className="flex bg-gray-100 dark:bg-[#1c1c20] rounded-lg p-1 mb-4">
              {tabs.map((t) => {
                const active = activeTab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition flex items-center justify-center gap-1.5 ${
                      active
                        ? 'bg-white dark:bg-[#0f0f12] text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Icon className="text-[10px]" />
                    {t.label}
                    {t.count > 0 && (
                      <span
                        className={`ml-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          active
                            ? t.danger
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            : t.danger
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Panel */}
            <div className="bg-white dark:bg-[#161619] rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
              {renderTabContent()}
            </div>
          </main>
        </div>

        <WorkspaceBottombar workspace={workspace} />
      </div>

      {/* ─── Modals ─────────────────────────────────────────── */}
      <StartCallModal
        isOpen={startOpen}
        onClose={() => setStartOpen(false)}
        members={activeMembers}
        myId={myId}
        brandColor={brandColor}
        onStart={handleStart}
      />

      {canSchedule && (
        <ScheduleCallModal
          isOpen={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          members={activeMembers}
          myId={myId}
          brandColor={brandColor}
          onSchedule={handleSchedule}
        />
      )}

      <MeetingLinkModal
        isOpen={meetingOpen}
        onClose={() => {
          setMeetingOpen(false);
          setMeetingResult(null);
        }}
        link={meetingResult?.meetingLink}
        code={meetingResult?.meetingCode}
        brandColor={brandColor}
        loading={meetingLoading}
      />

      <CallDetailModal
        isOpen={!!detailCall}
        onClose={() => setDetailCall(null)}
        call={detailCall}
        brandColor={brandColor}
        onRejoin={handleRejoin}
        rejoining={rejoining}
      />
    </>
  );
};

export default WorkspaceCall;