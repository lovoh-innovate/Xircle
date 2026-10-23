// src/screens/workspace/WorkspaceCall.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  FaArrowLeft,
  FaPhone,
  FaVideo,
  FaPhoneSlash,
  FaCalendarAlt,
  FaCalendarPlus,
  FaClock,
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
  FaUserPlus,
  FaExclamationTriangle,
  FaLock,
  FaAngleDown,
  FaSearch,
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

// ─── Base path ──────────────────────────────────────────────────
const WORKSPACE_BASE_PATH = '/workspace';

// ─── Helpers ────────────────────────────────────────────────────
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year:
      new Date(d).getFullYear() !== new Date().getFullYear()
        ? 'numeric'
        : undefined,
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

// ─── Global styles ─────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    .skeleton {
      position: relative;
      overflow: hidden;
      background-color: rgb(229 231 235);
    }
    .dark .skeleton { background-color: rgba(255, 255, 255, 0.07); }
    .skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
      animation: skeletonShimmer 1.5s ease-in-out infinite;
    }
    .dark .skeleton::after {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
    }
    @keyframes skeletonShimmer { 100% { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .skeleton::after { animation: none; } }

    .ws-mobile-header { padding-top: env(safe-area-inset-top, 0px); }
    .ws-mobile-header-spacer { height: calc(3.5rem + env(safe-area-inset-top, 0px)); }

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
  <div className={`skeleton rounded-lg ${className}`} />
);

const CallCardSkeleton = () => (
  <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/40 p-4">
    <div className="flex items-start gap-3">
      <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-48 max-w-[60%]" />
        <Skeleton className="h-3 w-32 max-w-[50%]" />
        <div className="flex gap-1">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-6 h-6 rounded-full" />
        </div>
      </div>
      <Skeleton className="w-20 h-9 rounded-lg flex-shrink-0" />
    </div>
  </div>
);

// ─── Small pills ───────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const Icon = type === 'video' ? FaVideo : FaPhone;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800/60">
      <Icon className="text-[9px]" />
      {type === 'video' ? 'Video' : 'Voice'}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  if (status === 'ongoing') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500 text-white">
        <FaCircle className="text-[6px] live-dot" /> Live
      </span>
    );
  }
  if (status === 'ringing') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500 text-white">
        <FaCircle className="text-[6px] live-dot" /> Ringing
      </span>
    );
  }
  if (status === 'missed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50">
        Missed
      </span>
    );
  }
  if (status === 'ended') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800/60">
        Ended
      </span>
    );
  }
  if (status === 'scheduled') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
        Scheduled
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-500 border border-gray-200 dark:border-gray-800/60">
        Cancelled
      </span>
    );
  }
  return null;
};

// ─── Avatar ─────────────────────────────────────────────────────
const Avatar = ({ user, size = 24, ring = false, brandColor, online = null }) => {
  const px = `${size}px`;
  return (
    <div className="relative flex-shrink-0" style={{ width: px, height: px }}>
      {user?.profile ? (
        <img
          src={user.profile}
          alt={user.name || ''}
          className={`rounded-full object-cover w-full h-full ${
            ring ? 'border-2 border-white dark:border-[#14141a]' : ''
          }`}
        />
      ) : (
        <div
          className={`rounded-full flex items-center justify-center text-white font-bold w-full h-full ${
            ring ? 'border-2 border-white dark:border-[#14141a]' : ''
          }`}
          style={{
            backgroundColor: brandColor || '#0d9488',
            fontSize: Math.max(9, Math.floor(size / 2.6)),
          }}
        >
          {getInitials(user?.name)}
        </div>
      )}
      {online !== null && (
        <span
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white dark:border-[#14141a] ${
            online ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
};

const ParticipantStack = ({ participants = [], brandColor, max = 4 }) => {
  const visible = participants.slice(0, max);
  const rest = participants.length - visible.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((p, i) => {
          const accepted = p.status === 'accepted';
          return (
            <Avatar
              key={i}
              user={p.user}
              size={22}
              ring
              brandColor={brandColor}
              online={accepted}
            />
          );
        })}
      </div>
      {rest > 0 && (
        <span className="text-[10px] text-gray-500 dark:text-gray-500 ml-1.5">
          +{rest}
        </span>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// Cards
// ═════════════════════════════════════════════════════════════

const OngoingCallCard = ({ call, onJoin, brandColor, joining }) => {
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const participants = call.participants || [];
  const accepted = participants.filter((p) => p.status === 'accepted').length;
  const total = participants.length;
  const isRinging = call.status === 'ringing';
  const startedLabel = isRinging
    ? `Started ringing ${fmtRelative(call.updatedAt)}`
    : `Started ${fmtRelative(call.startedAt || call.updatedAt)}`;

  return (
    <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/40 p-4 hover:border-teal-400 dark:hover:border-[#0d9488]/50 transition">
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
        >
          <Icon className="text-lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate max-w-full">
              {call.creator?.name || 'Someone'}'s call
            </span>
            <StatusBadge status={call.status} />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-500 mt-0.5 flex-wrap">
            <TypeBadge type={call.type} />
            <span>
              {accepted}/{total} in call
            </span>
            <span>·</span>
            <span>{startedLabel}</span>
            {call.isMeeting && (
              <>
                <span>·</span>
                <span className="text-teal-600 dark:text-[#0d9488] inline-flex items-center gap-0.5">
                  <FaLink className="text-[9px]" /> Link
                </span>
              </>
            )}
          </div>
          {participants.length > 0 && (
            <div className="mt-2">
              <ParticipantStack participants={participants} brandColor={brandColor} />
            </div>
          )}
        </div>

        <button
          onClick={() => onJoin(call)}
          disabled={joining}
          className="shrink-0 px-3 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition disabled:opacity-60"
          style={{ backgroundColor: brandColor }}
        >
          {joining ? (
            <FaSpinner className="animate-spin text-xs" />
          ) : (
            <FaPlayCircle className="text-xs" />
          )}
          <span>Join</span>
        </button>
      </div>
    </div>
  );
};

const ScheduledCallCard = ({ call, canCancel, onCancel, brandColor, cancelling }) => {
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const participants = call.participants || [];
  const when = call.scheduledAt ? new Date(call.scheduledAt) : null;

  return (
    <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/40 p-4 hover:border-teal-400 dark:hover:border-[#0d9488]/50 transition">
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
        >
          <Icon className="text-lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate max-w-full">
              {call.creator?.name || 'Someone'}'s scheduled call
            </span>
            <StatusBadge status="scheduled" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-500 mt-0.5 flex-wrap">
            <TypeBadge type={call.type} />
            {when && (
              <>
                <span className="inline-flex items-center gap-1 text-teal-600 dark:text-[#0d9488] font-medium">
                  <FaCalendarAlt className="text-[9px]" /> {fmtDateTime(when)}
                </span>
                <span>·</span>
                <span>{fmtRelative(when)}</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1">
            {participants.length} invited
          </p>
          {participants.length > 0 && (
            <div className="mt-1.5">
              <ParticipantStack participants={participants} brandColor={brandColor} />
            </div>
          )}
        </div>

        {canCancel && (
          <button
            onClick={() => onCancel(call)}
            disabled={cancelling}
            className="shrink-0 px-3 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-95 transition disabled:opacity-60"
          >
            {cancelling ? (
              <FaSpinner className="animate-spin text-xs" />
            ) : (
              <FaTimes className="text-xs" />
            )}
            <span className="hidden sm:inline">Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
};

const HistoryCallCard = ({ call, onOpen, brandColor }) => {
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const isMissed = call.status === 'missed';
  const isEnded = call.status === 'ended';
  const participants = call.participants || [];
  const myParticipant = participants.find(
    (p) => String(p.user?._id || p.user) === String(call._myId || '')
  );
  const myMissed = isMissed && myParticipant?.status === 'missed';
  const duration = call.duration;
  const when = call.endedAt || call.updatedAt || call.createdAt;

  return (
    <button
      onClick={() => onOpen(call)}
      className="w-full text-left bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/40 p-4 hover:border-teal-400 dark:hover:border-[#0d9488]/50 active:scale-[0.99] transition"
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
            myMissed ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
              : 'bg-gray-100 dark:bg-[#1a1a24] text-gray-600 dark:text-gray-400'
          }`}
          style={!myMissed ? { backgroundColor: `${brandColor}10`, color: brandColor } : undefined}
        >
          <Icon className="text-lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate max-w-full">
              {call.creator?.name || 'Someone'}'s call
            </span>
            <StatusBadge status={call.status} />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-500 mt-0.5 flex-wrap">
            <TypeBadge type={call.type} />
            {duration && (
              <>
                <span>·</span>
                <span>{fmtDuration(duration)}</span>
              </>
            )}
            <span>·</span>
            <span>{fmtRelative(when)}</span>
          </div>
          {participants.length > 0 && (
            <div className="mt-1.5">
              <ParticipantStack participants={participants} brandColor={brandColor} />
            </div>
          )}
        </div>

        <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0 self-center">
          Details →
        </span>
      </div>
    </button>
  );
};

// ═════════════════════════════════════════════════════════════
// Empty states
// ═════════════════════════════════════════════════════════════
const EmptyState = ({ icon: Icon, title, subtitle, action, brandColor }) => (
  <div className="text-center py-14 bg-white dark:bg-[#14141a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-800/60 px-4">
    <div
      className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
      style={{
        backgroundColor: `${brandColor}12`,
        color: brandColor,
      }}
    >
      <Icon className="text-xl" />
    </div>
    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
      {title}
    </h3>
    {subtitle && (
      <p className="text-xs text-gray-500 dark:text-gray-500 max-w-xs mx-auto mb-4 leading-relaxed">
        {subtitle}
      </p>
    )}
    {action}
  </div>
);

// ═════════════════════════════════════════════════════════════
// Start call modal
// ═════════════════════════════════════════════════════════════
const StartCallModal = ({
  isOpen,
  onClose,
  workspaceId,
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

  if (!isOpen) return null;

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
      await onStart({ workspaceId, type, participantIds: selectedIds });
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start call');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/40 shrink-0">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaPhone className="text-teal-600 dark:text-[#0d9488]" /> New call
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Type */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
              Call type
            </p>
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
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition ${
                      active
                        ? 'text-white border-transparent'
                        : 'bg-gray-50 dark:bg-[#0b0b10] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800/60'
                    }`}
                    style={active ? { backgroundColor: brandColor } : undefined}
                  >
                    <Icon className="text-xs" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold">
                Invite members
              </p>
              <span className="text-[10px] text-gray-500 dark:text-gray-500">
                {selectedIds.length} selected
              </span>
            </div>

            <div className="relative mb-2">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members"
                className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 call-scroll">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-gray-500 dark:text-gray-500 py-6">
                  No members found
                </p>
              ) : (
                filtered.map((m) => {
                  const u = m.user || m;
                  const id = getUserId(m);
                  const checked = selectedIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                        checked
                          ? 'bg-teal-50 dark:bg-[#0d9488]/15 border border-teal-300 dark:border-[#0d9488]/40'
                          : 'border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <Avatar user={u} size={28} brandColor={brandColor} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {u.name || 'Unknown'}
                        </span>
                        <span className="block text-[10px] text-gray-500 dark:text-gray-500 truncate">
                          {m.role || ''}
                        </span>
                      </span>
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                          checked
                            ? 'text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                        style={checked ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                      >
                        {checked && <FaCheck className="text-[9px]" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 py-4 border-t border-gray-200/60 dark:border-gray-800/40 shrink-0">
          <button
            onClick={onClose}
            className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={starting || selectedIds.length === 0}
            className="py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
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
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// Schedule call modal (admin/owner only)
// ═════════════════════════════════════════════════════════════
const ScheduleCallModal = ({
  isOpen,
  onClose,
  workspaceId,
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

  if (!isOpen) return null;

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
    if (selectedIds.length === 0) {
      toast.error('Select at least one member');
      return;
    }
    if (!when) {
      toast.error('Pick a date and time');
      return;
    }
    const dt = new Date(when);
    if (dt <= new Date()) {
      toast.error('Scheduled time must be in the future');
      return;
    }
    setSaving(true);
    try {
      await onSchedule({
        workspaceId,
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
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/40 shrink-0">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaCalendarPlus className="text-teal-600 dark:text-[#0d9488]" />{' '}
            Schedule call
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Type */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
              Call type
            </p>
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
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition ${
                      active
                        ? 'text-white border-transparent'
                        : 'bg-gray-50 dark:bg-[#0b0b10] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800/60'
                    }`}
                    style={active ? { backgroundColor: brandColor } : undefined}
                  >
                    <Icon className="text-xs" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* When */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
              Date & time
            </label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500"
            />
          </div>

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold">
                Invite members
              </p>
              <span className="text-[10px] text-gray-500 dark:text-gray-500">
                {selectedIds.length} selected
              </span>
            </div>

            <div className="relative mb-2">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members"
                className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500"
              />
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1 call-scroll">
              {filtered.map((m) => {
                const u = m.user || m;
                const id = getUserId(m);
                const checked = selectedIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                      checked
                        ? 'bg-teal-50 dark:bg-[#0d9488]/15 border border-teal-300 dark:border-[#0d9488]/40'
                        : 'border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <Avatar user={u} size={28} brandColor={brandColor} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {u.name || 'Unknown'}
                      </span>
                      <span className="block text-[10px] text-gray-500 dark:text-gray-500 truncate">
                        {m.role || ''}
                      </span>
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                        checked
                          ? 'text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={checked ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                    >
                      {checked && <FaCheck className="text-[9px]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 py-4 border-t border-gray-200/60 dark:border-gray-800/40 shrink-0">
          <button
            onClick={onClose}
            className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedIds.length === 0 || !when}
            className="py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
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
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// Meeting link modal
// ═════════════════════════════════════════════════════════════
const MeetingLinkModal = ({ isOpen, onClose, link, code, brandColor, loading }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-5 text-center"
          style={{
            background: `linear-gradient(135deg, ${brandColor}15, ${brandColor}08)`,
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white shadow-lg"
            style={{ backgroundColor: brandColor }}
          >
            {loading ? <FaSpinner className="animate-spin text-xl" /> : <FaLink className="text-xl" />}
          </div>
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
            {loading ? 'Creating meeting…' : 'Meeting ready'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {loading
              ? 'Almost there — generating your link.'
              : 'Share this link with anyone. Guests will be asked for their name.'}
          </p>
        </div>

        {!loading && link && (
          <div className="px-5 py-4 space-y-3">
            <div className="bg-gray-50 dark:bg-[#0b0b10] border border-gray-200 dark:border-gray-800/60 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-1">
                Meeting link
              </p>
              <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
                {link}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={copy}
                className="py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition flex items-center justify-center gap-1.5"
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
                className="py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition"
                style={{ backgroundColor: brandColor }}
              >
                Done
              </button>
            </div>

            {code && (
              <p className="text-[10px] text-center text-gray-500 dark:text-gray-500">
                Meeting code:{' '}
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {code}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// Call detail modal (from history)
// ═════════════════════════════════════════════════════════════
const CallDetailModal = ({ isOpen, onClose, call, brandColor, isCreator, onRejoin, rejoining }) => {
  if (!isOpen || !call) return null;

  const participants = call.participants || [];
  const guests = call.guests || [];
  const Icon = call.type === 'video' ? FaVideo : FaPhone;
  const duration = call.duration;
  const canRejoin = ['ringing', 'ongoing'].includes(call.status);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/40 shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
          >
            <Icon className="text-base" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
              {call.creator?.name || 'Someone'}'s call
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <StatusBadge status={call.status} />
              <TypeBadge type={call.type} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
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
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
                Participants ({participants.length})
              </p>
              <div className="space-y-1.5">
                {participants.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 bg-gray-50 dark:bg-[#0b0b10] rounded-xl px-3 py-2"
                  >
                    <Avatar user={p.user} size={26} brandColor={brandColor} />
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
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
                Guests ({guests.length})
              </p>
              <div className="space-y-1.5">
                {guests.map((g, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 bg-gray-50 dark:bg-[#0b0b10] rounded-xl px-3 py-2"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
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
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-semibold mb-2">
                Meeting link
              </p>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0b0b10] rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-800/60">
                <FaLink className="text-gray-400 text-[10px] shrink-0" />
                <p className="flex-1 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                  {call.meetingLink}
                </p>
              </div>
            </div>
          )}
        </div>

        {canRejoin && (
          <div className="px-5 py-4 border-t border-gray-200/60 dark:border-gray-800/40 shrink-0">
            <button
              onClick={() => onRejoin(call)}
              disabled={rejoining}
              className="w-full py-2.5 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
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
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN — WorkspaceCall
// ═════════════════════════════════════════════════════════════
const WorkspaceCall = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);

  const isLoggedIn = !!userInfo;
  const myId = String(userInfo?._id || '');

  // ─── Workspace + role ──────────────────────────────────────
  const { data: wData, isLoading: wLoading, error: wError } =
    useGetWorkspaceQuery(workspaceId);

  const workspace = wData?.workspace;
  const members = useMemo(() => workspace?.members || [], [workspace]);

  const myMembership = useMemo(
    () =>
      isLoggedIn
        ? members.find((m) => getUserId(m) === myId)
        : null,
    [members, isLoggedIn, myId]
  );

  const isMember = !!myMembership;
  const memberRole = String(myMembership?.role || '').toLowerCase();
  const isOwnerOrAdmin =
    isMember && ['owner', 'admin'].includes(memberRole);
  const canSchedule = isOwnerOrAdmin;

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );

  const brandColor = workspace?.color || '#0d9488';

  // ─── Presence ──────────────────────────────────────────────
  useWorkspacePresence(isMember ? workspaceId : null);

  // ─── Queries ───────────────────────────────────────────────
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
    () =>
      allLogs
        .filter((c) => ['ended', 'missed', 'cancelled'].includes(c.status))
        .map((c) => ({ ...c, _myId: myId })),
    [allLogs, myId]
  );

  // ─── Mutations ─────────────────────────────────────────────
  const [initiateCall] = useInitiateCallMutation();
  const [scheduleCall] = useScheduleCallMutation();
  const [createMeeting] = useCreateMeetingMutation();
  const [joinCall] = useJoinCallMutation();
  const [cancelScheduledCall] = useCancelScheduledCallMutation();
  const [getCallToken] = useGetCallTokenMutation();

  // ─── UI state ──────────────────────────────────────────────
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

  // ─── Redirect on error ─────────────────────────────────────
  useEffect(() => {
    if (wError) navigate('/my-workspaces');
  }, [wError, navigate]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleStart = useCallback(
    async ({ workspaceId: wsId, type, participantIds }) => {
      const res = await initiateCall({ workspaceId: wsId, type, participantIds }).unwrap();
      const call = res.call;
      toast.success('Call started — ringing participants');
      // Refresh lists
      refetchOngoing();
      refetchLogs();
      // Navigate to the call page (which will fetch a token)
      if (call?._id) {
        navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/calls/${call._id}`);
      }
    },
    [initiateCall, navigate, workspaceId, refetchOngoing, refetchLogs]
  );

  const handleSchedule = useCallback(
    async (payload) => {
      await scheduleCall(payload).unwrap();
      toast.success('Call scheduled');
      refetchScheduled();
    },
    [scheduleCall, refetchScheduled]
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
        // Best-effort: pre-warm the token then navigate
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

  // ─── Loading / error ───────────────────────────────────────
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
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6 space-y-3">
              <Skeleton className="h-8 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
              </div>
              <div className="space-y-2">
                <CallCardSkeleton />
                <CallCardSkeleton />
                <CallCardSkeleton />
              </div>
            </main>
          </div>
          <WorkspaceBottombar />
        </div>
      </>
    );
  }

  if (!workspace) return null;

  // ─── Access gating ─────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col items-center justify-center px-4">
          <div className="max-w-sm text-center bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-8">
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
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition"
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
              <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-8">
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
                  className="inline-block px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition"
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

  // ─── Tabs config ───────────────────────────────────────────
  const tabs = [
    { id: 'ongoing', label: 'Ongoing', count: ongoingCalls.length, icon: FaPlayCircle },
    { id: 'scheduled', label: 'Scheduled', count: scheduledCalls.length, icon: FaCalendarAlt },
    { id: 'history', label: 'History', count: historyCalls.length, icon: FaHistory },
  ];

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <GlobalStyles />

      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col">
        {/* Sidebar (desktop) */}
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

          <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
            {/* Desktop hero bar */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
                  Calls
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                  Voice and video meetings in {workspace.name}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {ongoingCalls.length > 0 && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-full text-white flex items-center gap-1"
                    style={{ backgroundColor: '#dc2626' }}
                  >
                    <FaCircle className="text-[6px] live-dot" /> {ongoingCalls.length}{' '}
                    live
                  </span>
                )}
                <button
                  onClick={handleCreateMeeting}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition flex items-center gap-1.5"
                >
                  <FaLink className="text-xs" /> Meeting link
                </button>
                {canSchedule && (
                  <button
                    onClick={() => setScheduleOpen(true)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition flex items-center gap-1.5"
                  >
                    <FaCalendarPlus className="text-xs" /> Schedule
                  </button>
                )}
                <button
                  onClick={() => setStartOpen(true)}
                  className="px-3.5 py-2 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition"
                  style={{ backgroundColor: brandColor }}
                >
                  <FaPhone className="text-xs" /> New call
                </button>
              </div>
            </div>

            {/* Mobile quick actions */}
            <div className="md:hidden grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => setStartOpen(true)}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-white text-[11px] font-medium"
                style={{ backgroundColor: brandColor }}
              >
                <FaPhone className="text-sm" />
                Call
              </button>
              <button
                onClick={handleCreateMeeting}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 text-[11px] font-medium text-gray-700 dark:text-gray-300"
              >
                <FaLink className="text-sm text-teal-600 dark:text-[#0d9488]" />
                Link
              </button>
              <button
                onClick={() => (canSchedule ? setScheduleOpen(true) : toast.info('Only admins can schedule'))}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 text-[11px] font-medium text-gray-700 dark:text-gray-300 disabled:opacity-60"
              >
                <FaCalendarPlus className="text-sm text-teal-600 dark:text-[#0d9488]" />
                Schedule
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 overflow-x-auto call-scroll pb-0.5">
              {tabs.map((t) => {
                const active = activeTab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                      active
                        ? 'text-white shadow-sm'
                        : 'bg-white dark:bg-[#14141a] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                    style={active ? { backgroundColor: brandColor } : undefined}
                  >
                    <Icon className="text-[10px]" />
                    {t.label}
                    {t.count > 0 && (
                      <span
                        className={`ml-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          active
                            ? 'bg-white/25 text-white'
                            : t.id === 'ongoing'
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

            {/* ─── Tab content ─────────────────────────────── */}
            {activeTab === 'ongoing' && (
              <div>
                {ongoingLoading ? (
                  <div className="space-y-2">
                    <CallCardSkeleton />
                    <CallCardSkeleton />
                  </div>
                ) : ongoingCalls.length === 0 ? (
                  <EmptyState
                    icon={FaPhone}
                    title="No calls in progress"
                    subtitle="When someone starts a voice or video call, it will show up here so you can join."
                    brandColor={brandColor}
                    action={
                      <button
                        onClick={() => setStartOpen(true)}
                        className="px-4 py-2 text-white rounded-xl text-sm font-medium hover:opacity-90 transition inline-flex items-center gap-1.5"
                        style={{ backgroundColor: brandColor }}
                      >
                        <FaPlus className="text-xs" /> Start one
                      </button>
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {ongoingCalls.map((call) => (
                      <OngoingCallCard
                        key={call._id}
                        call={call}
                        brandColor={brandColor}
                        onJoin={handleJoin}
                        joining={joiningId === call._id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'scheduled' && (
              <div>
                {scheduledLoading ? (
                  <div className="space-y-2">
                    <CallCardSkeleton />
                    <CallCardSkeleton />
                  </div>
                ) : scheduledCalls.length === 0 ? (
                  <EmptyState
                    icon={FaCalendarAlt}
                    title="No scheduled calls"
                    subtitle={
                      canSchedule
                        ? 'Set a time and we’ll ring every invitee automatically.'
                        : 'Admins can schedule calls that ring everyone at a set time.'
                    }
                    brandColor={brandColor}
                    action={
                      canSchedule ? (
                        <button
                          onClick={() => setScheduleOpen(true)}
                          className="px-4 py-2 text-white rounded-xl text-sm font-medium hover:opacity-90 transition inline-flex items-center gap-1.5"
                          style={{ backgroundColor: brandColor }}
                        >
                          <FaCalendarPlus className="text-xs" /> Schedule one
                        </button>
                      ) : null
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {scheduledCalls.map((call) => {
                      const creatorId = String(call.creator?._id || call.creator || '');
                      const canCancel = isOwnerOrAdmin || creatorId === myId;
                      return (
                        <ScheduledCallCard
                          key={call._id}
                          call={call}
                          canCancel={canCancel}
                          onCancel={handleCancelScheduled}
                          brandColor={brandColor}
                          cancelling={cancellingId === call._id}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                {logsLoading ? (
                  <div className="space-y-2">
                    <CallCardSkeleton />
                    <CallCardSkeleton />
                    <CallCardSkeleton />
                  </div>
                ) : historyCalls.length === 0 ? (
                  <EmptyState
                    icon={FaHistory}
                    title="No past calls yet"
                    subtitle="Ended, missed and cancelled calls will appear here."
                    brandColor={brandColor}
                  />
                ) : (
                  <div className="space-y-2">
                    {historyCalls.map((call) => (
                      <HistoryCallCard
                        key={call._id}
                        call={call}
                        brandColor={brandColor}
                        onOpen={setDetailCall}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        <WorkspaceBottombar workspace={workspace} />
      </div>

      {/* ─── Modals ─────────────────────────────────────────── */}
      <StartCallModal
        isOpen={startOpen}
        onClose={() => setStartOpen(false)}
        workspaceId={workspaceId}
        members={activeMembers}
        myId={myId}
        brandColor={brandColor}
        onStart={handleStart}
      />

      {canSchedule && (
        <ScheduleCallModal
          isOpen={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          workspaceId={workspaceId}
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
        isCreator={String(detailCall?.creator?._id || detailCall?.creator || '') === myId}
        onRejoin={handleRejoin}
        rejoining={rejoining}
      />
    </>
  );
};

export default WorkspaceCall;